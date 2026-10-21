import { ApplicationError, deleteApplication } from "@/lib/application-mail"
import { jsonError, jsonOk } from "@/lib/responses"
import { requireUser } from "@/lib/session"

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!user) return jsonError("Sign in to delete an application.", 401)
  const { id } = await context.params
  try {
    await deleteApplication(user.id, id)
    return jsonOk({ ok: true })
  } catch (error) {
    if (error instanceof ApplicationError) return jsonError(error.message, error.status)
    console.error("application delete failed", error instanceof Error ? error.message : "unknown")
    return jsonError("We couldn't delete that application.", 500)
  }
}
