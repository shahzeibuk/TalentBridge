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
      note: `Your AI settings use local fallback, so this draft used the local extractor. ${FALLBACK_NOTE}`,
    }
  }
  if (requested === "groq") {
    const apiKey = env.GROQ_API_KEY?.trim()
    if (!apiKey) {
      return {
        provider: "fallback",
        note: `Groq is selected, but no Groq API key is saved on your account. Add one under AI keys. ${FALLBACK_NOTE}`,
      }
    }
    return { provider: "groq", apiKey }
  }
  if (requested !== "gemini") {
    return {
      provider: "fallback",
      note: `AI provider "${requested}" isn't gemini, groq, or fallback. ${FALLBACK_NOTE}`,
    }
  }
  const apiKey = env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return {
      provider: "fallback",
      note: `Gemini is selected, but no Gemini API key is saved on your account. Add one under AI keys. ${FALLBACK_NOTE}`,
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

const AI_FETCH_TIMEOUT_MS = 50_000

function isAbortError(error: unknown) {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")
}

async function geminiJson(system: string, user: string, apiKey: string, fetchImpl: typeof fetch) {
  const makeBody = (includeThinking: boolean) =>
    JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: `${system}\n\n${user}` }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
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
      signal: AbortSignal.timeout(AI_FETCH_TIMEOUT_MS),
    })

  async function readJson(response: Response) {
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

  try {
    let response = await send(makeBody(true))
    if (response.status === 400) response = await send(makeBody(false))
    return await readJson(response)
  } catch (error) {
    if (!isAbortError(error)) throw error
    // One leaner retry without thinking config after a timeout.
    try {
      return await readJson(await send(makeBody(false)))
    } catch (retryError) {
      if (isAbortError(retryError)) {
        throw new Error("Gemini timed out. Try again in a moment, or switch to Groq under AI keys.")
      }
      throw retryError
    }
  }
}

async function groqJson(system: string, user: string, apiKey: string, fetchImpl: typeof fetch) {
  const makeBody = (extras: Record<string, unknown>) =>
    JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.1,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
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
      signal: AbortSignal.timeout(AI_FETCH_TIMEOUT_MS),
    })

  try {
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
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error("Groq timed out. Try again in a moment, or switch to Gemini under AI keys.")
    }
    throw error
  }
}

export async function completeJson(system: string, user: string, deps: ParseDeps = {}) {
  const env = deps.env ?? process.env
  const fetchImpl = deps.fetchImpl ?? fetch
  const choice = resolveProvider(env)
  if (choice.provider === "fallback") return choice
  const json =
    choice.provider === "gemini"
      ? await geminiJson(system, user, choice.apiKey, fetchImpl)
      : await groqJson(system, user, choice.apiKey, fetchImpl)
  return { provider: choice.provider, json }
}

export async function parseResumeText(text: string, deps: ParseDeps = {}): Promise<ParseResult> {
  const clipped = text.slice(0, 24_000)
  try {
    const result = await completeJson(SYSTEM_PROMPT, `Resume text:\n${clipped}`, deps)
    if (result.provider === "fallback") return fallbackResult(clipped, result.note)
    const data = looseResumeData(result.json)
    const label = result.provider === "gemini" ? `Gemini (${GEMINI_MODEL})` : `Groq (${GROQ_MODEL})`
    return {
      data,
      parseSource: result.provider,
      parseNote: `Drafted by ${label}. This text came from the model. Correct anything that doesn't match the file before you confirm.`,
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "The AI request failed."
    const requested = ((deps.env ?? process.env).AI_PROVIDER ?? "gemini").trim().toLowerCase()
    const who = requested === "groq" ? "Groq" : "Gemini"
    return fallbackResult(
      clipped,
      `${who} didn't return usable resume JSON (${reason}). ${FALLBACK_NOTE}`,
    )
  }
}
