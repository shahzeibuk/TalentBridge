import { fallbackExtract } from "@/lib/fallback-extract"
import {
  looseResumeData,
  type ParseSource,
  type ResumeData,
} from "@/lib/resume-data"

const GEMINI_MODEL = "gemini-3.8-flash"
const GROQ_MODEL = "openai/gpt-oss-20b"
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

const SYSTEM_PROMPT = `Extract resume facts into JSON. Use only information that appears in the resume text. If a value is missing, use an empty string or an empty array. Do not invent employers, schools, dates, or skills.

Return JSON with this shape:
{
  "fullName": "",
  "email": "",
  "phone": "",
  "location": "",
  "links": [],
  "experience": [{ "company": "", "title": "", "start": "", "end": "", "description": "" }],
  "education": [{ "school": "", "degree": "", "field": "", "start": "", "end": "" }],
  "skills": []
}

Keep dates as written. Put the role summary in description as plain text.`

export type ParseResult = {
  data: ResumeData
  parseSource: ParseSource
  parseNote: string
}

type ParseDeps = {
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
}

const FALLBACK_NOTE =
  "These fields were guessed from headings, dates, and contact lines in the file. An AI model did not produce them. Correct anything that's off before you confirm."

function fallbackResult(text: string, note: string): ParseResult {
  return {
    data: fallbackExtract(text),
    parseSource: "fallback",
    parseNote: note,
  }
}

function resolveProvider(env: NodeJS.ProcessEnv):
  | { provider: "gemini" | "groq"; apiKey: string }
  | { provider: "fallback"; note: string } {
  const requested = (env.AI_PROVIDER ?? "").trim().toLowerCase() || "gemini"
  if (requested === "fallback") {
    return {
      provider: "fallback",
      note: `AI_PROVIDER is fallback, so this draft used the local extractor. ${FALLBACK_NOTE}`,
    }
  }
  if (requested === "groq") {
    const apiKey = env.GROQ_API_KEY?.trim()
    if (!apiKey) {
      return {
        provider: "fallback",
        note: `AI_PROVIDER is groq, but GROQ_API_KEY is not set. ${FALLBACK_NOTE}`,
      }
    }
    return { provider: "groq", apiKey }
  }
  if (requested !== "gemini") {
    return {
      provider: "fallback",
      note: `AI_PROVIDER "${requested}" isn't gemini, groq, or fallback. ${FALLBACK_NOTE}`,
    }
  }
  const apiKey = env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return {
      provider: "fallback",
      note: `No GEMINI_API_KEY is set, so this draft used the local extractor. ${FALLBACK_NOTE}`,
    }
  }
  return { provider: "gemini", apiKey }
}

function parseModelJson(raw: string) {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim()
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    const start = trimmed.indexOf("{")
    const end = trimmed.lastIndexOf("}")
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1)) as unknown
    throw new Error("The model response was not JSON.")
  }
}

async function geminiParse(text: string, apiKey: string, fetchImpl: typeof fetch) {
  const makeBody = (includeThinking: boolean) =>
    JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: `${SYSTEM_PROMPT}\n\nResume text:\n${text}` }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        ...(includeThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    })

  const send = (body: string) =>
    fetchImpl(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body,
      signal: AbortSignal.timeout(25_000),
    })

  let response = await send(makeBody(true))
  if (response.status === 400) response = await send(makeBody(false))
  if (!response.ok) throw new Error(`Gemini request failed (${response.status}).`)

  const payload = (await response.json()) as {
    candidates?: { content?: { parts?: { thought?: boolean; text?: string }[] } }[]
  }
  const parts = payload.candidates?.[0]?.content?.parts ?? []
  const textOut = parts
    .filter((part) => !part.thought)
    .map((part) => part.text ?? "")
    .join("")
    .trim()
  if (!textOut) throw new Error("Gemini returned an empty response.")
  return parseModelJson(textOut)
}

async function groqParse(text: string, apiKey: string, fetchImpl: typeof fetch) {
  const makeBody = (extras: Record<string, unknown>) =>
    JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.1,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      ...extras,
    })

  const send = (body: string) =>
    fetchImpl(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body,
      signal: AbortSignal.timeout(25_000),
    })

  let response = await send(makeBody({ response_format: { type: "json_object" }, reasoning_effort: "low" }))
  if (response.status === 400) {
    response = await send(makeBody({ response_format: { type: "json_object" } }))
  }
  if (!response.ok) throw new Error(`Groq request failed (${response.status}).`)

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = payload.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error("Groq returned an empty response.")
  return parseModelJson(content)
}

export async function parseResumeText(text: string, deps: ParseDeps = {}): Promise<ParseResult> {
  const env = deps.env ?? process.env
  const fetchImpl = deps.fetchImpl ?? fetch
  const clipped = text.slice(0, 24_000)
  const choice = resolveProvider(env)

  if (choice.provider === "fallback") {
    return fallbackResult(clipped, choice.note)
  }

  try {
    const modelJson =
      choice.provider === "gemini"
        ? await geminiParse(clipped, choice.apiKey, fetchImpl)
        : await groqParse(clipped, choice.apiKey, fetchImpl)
    const data = looseResumeData(modelJson)
    const label = choice.provider === "gemini" ? `Gemini (${GEMINI_MODEL})` : `Groq (${GROQ_MODEL})`
    return {
      data,
      parseSource: choice.provider,
      parseNote: `Drafted by ${label}. This text came from the model. Correct anything that doesn't match the file before you confirm.`,
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "The AI request failed."
    const who = choice.provider === "gemini" ? "Gemini" : "Groq"
    return fallbackResult(
      clipped,
      `${who} didn't return usable resume JSON (${reason}). ${FALLBACK_NOTE}`,
    )
  }
}
