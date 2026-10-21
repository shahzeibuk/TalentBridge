import { looseResumeData, parseClientPayload } from "@/lib/resume-data"
import { jsonError, jsonOk } from "@/lib/responses"
import { copyResumeToProfile, findOwnedResume, toResumeDetail } from "@/lib/resume-store"
import { requireUser } from "@/lib/session"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  const user = await requireUser()
  if (!user) return jsonError("Sign in to update your profile.", 401)
  const { id } = await context.params
  const existing = await findOwnedResume(user.id, id)
  if (!existing) return jsonError("That resume isn't in your account.", 404)

  const raw = await request.text()
  let data = looseResumeData(existing)
  if (raw.trim()) {
    let body: unknown
    try {
      body = JSON.parse(raw) as unknown
    } catch {
      return jsonError("The resume fields weren't valid JSON.", 400)
    }
    const parsed = parseClientPayload(body)
    if (!parsed.ok) return jsonError(parsed.error, 400)
    data = parsed.data
  }

  try {
    await copyResumeToProfile(user.id, id, data)
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return jsonError("That resume isn't in your account.", 404)
    }
    console.error("set profile failed", error)
    return jsonError("We couldn't update your profile. Try again in a moment.", 500)
  }

  const resume = await findOwnedResume(user.id, id)
  if (!resume) return jsonError("That resume isn't in your account.", 404)
  return jsonOk({ resume: toResumeDetail(resume) })
}
