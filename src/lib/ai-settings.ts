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
