import { z } from "zod"
import { getAiSettingsPublic, saveAiSettings, type AiProvider } from "@/lib/ai-settings"
import { jsonError, jsonOk } from "@/lib/responses"
import { requireUser } from "@/lib/session"

const saveSchema = z.object({
  provider: z.enum(["gemini", "groq", "fallback"]),
  geminiApiKey: z.string().max(500).optional(),
  groqApiKey: z.string().max(500).optional(),
  clearGemini: z.boolean().optional(),
  clearGroq: z.boolean().optional(),
})

export async function GET() {
  const user = await requireUser()
  if (!user) return jsonError("Sign in to manage AI settings.", 401)
  try {
    return jsonOk({ settings: await getAiSettingsPublic(user.id) })
  } catch (error) {
    console.error("ai settings load failed", error)
    return jsonError("We couldn't load your AI settings. Try again in a moment.", 500)
  }
}

export async function PUT(request: Request) {
  const user = await requireUser()
  if (!user) return jsonError("Sign in to manage AI settings.", 401)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError("Send your AI settings as JSON.", 400)
  }

  const parsed = saveSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Check the AI settings and try again.", 400)
  }

  try {
    const settings = await saveAiSettings(user.id, {
      provider: parsed.data.provider as AiProvider,
      geminiApiKey: parsed.data.geminiApiKey,
      groqApiKey: parsed.data.groqApiKey,
      clearGemini: parsed.data.clearGemini,
      clearGroq: parsed.data.clearGroq,
    })
    return jsonOk({ settings })
  } catch (error) {
    console.error("ai settings save failed", error)
    return jsonError("We couldn't save your AI settings. Try again in a moment.", 500)
  }
}
