import { ApplicationError, createAndSend, gmailAccount, listApplications } from "@/lib/application-mail"
import { applicationInputSchema, applicationSubject } from "@/lib/application-data"
import { jsonError, jsonOk } from "@/lib/responses"
import { requireUser } from "@/lib/session"

export const maxDuration = 60

export async function GET(request: Request) {
  const user = await requireUser()
  if (!user) return jsonError("Sign in to see your applications.", 401)
  const refresh = new URL(request.url).searchParams.get("refresh") === "1"
  try {
    const gmail = await gmailAccount(user.id)
    const applications = await listApplications(user.id, refresh)
    return jsonOk({ gmail, applications })
  } catch (error) {
    console.error("application list failed", error instanceof Error ? error.message : "unknown")
    return jsonError("We couldn't load your applications. Try again in a moment.", 500)
  }
}

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) return jsonError("Sign in to send an application.", 401)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError("The application form was empty.", 400)
  }
  const parsed = applicationInputSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message || "Check the application and try again.", 400)
  }

  try {
    const application = await createAndSend(user.id, {
      ...parsed.data,
      subject: applicationSubject(parsed.data),
    })
    return jsonOk({ application }, 201)
  } catch (error) {
    if (error instanceof ApplicationError) return jsonError(error.message, error.status)
    console.error("application send failed", error instanceof Error ? error.message : "unknown")
    return jsonError("We couldn't send that application. Try again.", 500)
  }
}
