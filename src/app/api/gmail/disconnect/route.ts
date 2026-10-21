import { disconnectGmail } from "@/lib/application-mail"
import { jsonError, jsonOk } from "@/lib/responses"
import { requireUser } from "@/lib/session"

export async function POST() {
  const user = await requireUser()
  if (!user) return jsonError("Sign in to disconnect Gmail.", 401)
  try {
    await disconnectGmail(user.id)
    return jsonOk({ ok: true })
  } catch (error) {
    console.error("gmail disconnect failed", error instanceof Error ? error.message : "unknown")
    return jsonError("We couldn't disconnect Gmail. Try again.", 500)
  }
}
