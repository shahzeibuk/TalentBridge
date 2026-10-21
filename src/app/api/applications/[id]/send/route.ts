import { ApplicationError, sendSavedApplication } from "@/lib/application-mail"
import { jsonError, jsonOk } from "@/lib/responses"
import { requireUser } from "@/lib/session"

export const maxDuration = 60

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!user) return jsonError("Sign in to send an application.", 401)
  const { id } = await context.params
  try {
    const application = await sendSavedApplication(user.id, id)
    return jsonOk({ application })
  } catch (error) {
    if (error instanceof ApplicationError) return jsonError(error.message, error.status)
    console.error("application retry failed", error instanceof Error ? error.message : "unknown")
    return jsonError("We couldn't send that application. Try again.", 500)
  }
}
