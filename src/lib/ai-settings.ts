import { prisma } from "@/lib/prisma"
import { decryptSecret, encryptSecret } from "@/lib/secret-box"

export type AiProvider = "gemini" | "groq" | "fallback"

export const AI_PROVIDER_OPTIONS: { id: AiProvider; label: string; blurb: string }[] = [
  {
    id: "gemini",
    label: "Gemini",
    blurb: "Google’s Gemini model for resume drafts and ATS tailoring.",
  },
  {
    id: "groq",
    label: "Groq",
    blurb: "Groq chat completions for resume drafts and ATS tailoring.",
  },
  {
    id: "fallback",
    label: "Local fallback",
    blurb: "No API key. TalentBridge guesses from headings and contact lines only.",
  },
]

export const AI_KEY_GUIDES = {
  gemini: {
    label: "Get a Gemini API key",
    href: "https://aistudio.google.com/apikey",
    steps: [
      "Open Google AI Studio and sign in with your Google account.",
      "Choose Create API key, then copy the key.",
      "Paste it below. The key stays encrypted on your account and is never shown again.",
    ],
  },
  groq: {
    label: "Get a Groq API key",
    href: "https://console.groq.com/keys",
    steps: [
      "Open the Groq console and create or sign in to an account.",
      "Open API Keys, create a key, then copy it.",
      "Paste it below. The key stays encrypted on your account and is never shown again.",
    ],
  },
} as const

export type AiSettingsPublic = {
  provider: AiProvider
  geminiKeySet: boolean
  groqKeySet: boolean
  guides: typeof AI_KEY_GUIDES
}

function asProvider(value: string | null | undefined): AiProvider {
  const normalized = (value ?? "").trim().toLowerCase()
  if (normalized === "groq" || normalized === "fallback" || normalized === "gemini") return normalized
  return "gemini"
}

export async function getAiSettingsPublic(userId: string): Promise<AiSettingsPublic> {
  const row = await prisma.aiSettings.findUnique({ where: { userId } })
  return {
    provider: asProvider(row?.provider),
    geminiKeySet: Boolean(row?.geminiApiKeyCiphertext),
    groqKeySet: Boolean(row?.groqApiKeyCiphertext),
    guides: AI_KEY_GUIDES,
  }
}

/** Build the env bag parse/tailor use, preferring this user’s saved keys over server env. */
export async function aiEnvForUser(userId: string): Promise<NodeJS.ProcessEnv> {
  const row = await prisma.aiSettings.findUnique({ where: { userId } })
  const provider = asProvider(row?.provider ?? process.env.AI_PROVIDER)
  let gemini = process.env.GEMINI_API_KEY?.trim() ?? ""
  let groq = process.env.GROQ_API_KEY?.trim() ?? ""
  if (row?.geminiApiKeyCiphertext) {
    try {
      gemini = decryptSecret(row.geminiApiKeyCiphertext)
    } catch (error) {
      console.error("gemini key decrypt failed", error)
      gemini = ""
    }
  }
  if (row?.groqApiKeyCiphertext) {
    try {
      groq = decryptSecret(row.groqApiKeyCiphertext)
    } catch (error) {
      console.error("groq key decrypt failed", error)
      groq = ""
    }
  }
  return {
    ...process.env,
    AI_PROVIDER: provider,
    GEMINI_API_KEY: gemini,
    GROQ_API_KEY: groq,
  }
}

export async function saveAiSettings(
  userId: string,
  input: {
    provider: AiProvider
    geminiApiKey?: string | null
    groqApiKey?: string | null
    clearGemini?: boolean
    clearGroq?: boolean
  },
) {
  const existing = await prisma.aiSettings.findUnique({ where: { userId } })
  let geminiCipher = existing?.geminiApiKeyCiphertext ?? null
  let groqCipher = existing?.groqApiKeyCiphertext ?? null

  if (input.clearGemini) geminiCipher = null
  else if (typeof input.geminiApiKey === "string" && input.geminiApiKey.trim()) {
    geminiCipher = encryptSecret(input.geminiApiKey.trim())
  }

  if (input.clearGroq) groqCipher = null
  else if (typeof input.groqApiKey === "string" && input.groqApiKey.trim()) {
    groqCipher = encryptSecret(input.groqApiKey.trim())
  }

  await prisma.aiSettings.upsert({
    where: { userId },
    create: {
      userId,
      provider: input.provider,
      geminiApiKeyCiphertext: geminiCipher,
      groqApiKeyCiphertext: groqCipher,
    },
    update: {
      provider: input.provider,
      geminiApiKeyCiphertext: geminiCipher,
      groqApiKeyCiphertext: groqCipher,
    },
  })

  return getAiSettingsPublic(userId)
}

const GEMINI_MODEL = "gemini-3.8-flash"
const GROQ_MODEL = "openai/gpt-oss-20b"
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
const PROBE_TIMEOUT_MS = 20_000

export type AiProbeResult =
  | { ok: true; provider: "gemini" | "groq"; model: string; latencyMs: number }
  | { ok: false; provider: "gemini" | "groq" | "fallback"; message: string }

async function resolveKeyForProbe(
  userId: string,
  provider: "gemini" | "groq",
  draftKey?: string,
): Promise<string> {
  const trimmed = draftKey?.trim() ?? ""
  if (trimmed) return trimmed
  const env = await aiEnvForUser(userId)
  return provider === "gemini" ? env.GEMINI_API_KEY?.trim() ?? "" : env.GROQ_API_KEY?.trim() ?? ""
}

async function probeGemini(apiKey: string): Promise<AiProbeResult> {
  const started = Date.now()
  try {
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: 'Reply with JSON only: {"ok":true}' }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 32,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    if (response.status === 400) {
      const retry = await fetch(GEMINI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: 'Reply with JSON only: {"ok":true}' }] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 32,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      })
      if (!retry.ok) {
        return { ok: false, provider: "gemini", message: `Gemini rejected the key (${retry.status}).` }
      }
      return { ok: true, provider: "gemini", model: GEMINI_MODEL, latencyMs: Date.now() - started }
    }
    if (!response.ok) {
      return { ok: false, provider: "gemini", message: `Gemini rejected the key (${response.status}).` }
    }
    return { ok: true, provider: "gemini", model: GEMINI_MODEL, latencyMs: Date.now() - started }
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")
    return {
      ok: false,
      provider: "gemini",
      message: timedOut ? "Gemini timed out. Try again in a moment." : "We couldn't reach Gemini with that key.",
    }
  }
}

async function probeGroq(apiKey: string): Promise<AiProbeResult> {
  const started = Date.now()
  try {
    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0,
        max_tokens: 32,
        messages: [
          { role: "system", content: "Reply with JSON only." },
          { role: "user", content: '{"ok":true}' },
        ],
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    if (!response.ok) {
      return { ok: false, provider: "groq", message: `Groq rejected the key (${response.status}).` }
    }
    return { ok: true, provider: "groq", model: GROQ_MODEL, latencyMs: Date.now() - started }
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")
    return {
      ok: false,
      provider: "groq",
      message: timedOut ? "Groq timed out. Try again in a moment." : "We couldn't reach Groq with that key.",
    }
  }
}

/** Tiny live call so the user can confirm their Gemini or Groq key before uploading. */
export async function probeAiConnection(
  userId: string,
  provider: AiProvider,
  draftKey?: string,
): Promise<AiProbeResult> {
  if (provider === "fallback") {
    return {
      ok: false,
      provider: "fallback",
      message: "Local fallback does not use an API key. Pick Gemini or Groq to test a connection.",
    }
  }
  const apiKey = await resolveKeyForProbe(userId, provider, draftKey)
  if (!apiKey) {
    return {
      ok: false,
      provider,
      message: `No ${provider === "gemini" ? "Gemini" : "Groq"} API key is saved or pasted yet.`,
    }
  }
  return provider === "gemini" ? probeGemini(apiKey) : probeGroq(apiKey)
}
