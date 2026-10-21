import { parseClientPayload } from "@/lib/resume-data"
import { jsonError, jsonOk } from "@/lib/responses"
import { copyResumeToProfile, findOwnedResume, toResumeDetail } from "@/lib/resume-store"
import { requireUser } from "@/lib/session"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  const user = await requireUser()
  if (!user) return jsonError("Sign in to confirm this resume.", 401)
  const { id } = await context.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError("The resume fields weren't valid JSON.", 400)
  }

  const parsed = parseClientPayload(body)
  if (!parsed.ok) return jsonError(parsed.error, 400)

  try {
    await copyResumeToProfile(user.id, id, parsed.data)
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return jsonError("That resume isn't in your account.", 404)
    }
    console.error("confirm resume failed", error)
    return jsonError("We couldn't save the resume. Try again in a moment.", 500)
  }

  const resume = await findOwnedResume(user.id, id)
  if (!resume) return jsonError("That resume isn't in your account.", 404)
  return jsonOk({ resume: toResumeDetail(resume) })
}
