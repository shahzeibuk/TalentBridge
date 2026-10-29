import { z } from "zod"
import { probeAiConnection } from "@/lib/ai-settings"
import { jsonError, jsonOk } from "@/lib/responses"
import { requireUser } from "@/lib/session"

export const maxDuration = 30

const testSchema = z.object({
  provider: z.enum(["gemini", "groq", "fallback"]),
  apiKey: z.string().max(500).optional(),
})

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) return jsonError("Sign in to test an AI key.", 401)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError("Send the provider to test as JSON.", 400)
  }

  const parsed = testSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Choose Gemini or Groq to test.", 400)
  }

  try {
    const result = await probeAiConnection(user.id, parsed.data.provider, parsed.data.apiKey)
    if (!result.ok) return jsonError(result.message, 400)
    return jsonOk({
      ok: true,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
      message: `${result.provider === "gemini" ? "Gemini" : "Groq"} responded in ${Math.max(1, Math.round(result.latencyMs / 100) / 10)}s using ${result.model}.`,
    })
  } catch (error) {
    console.error("ai probe failed", error)
    return jsonError("We couldn't test that API key. Try again in a moment.", 500)
  }
}
