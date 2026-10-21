import { prisma } from "@/lib/prisma"
import { parseClientPayload } from "@/lib/resume-data"
import { jsonError, jsonOk } from "@/lib/responses"
import { findOwnedResume, saveResumeFields, toResumeDetail } from "@/lib/resume-store"
import { requireUser } from "@/lib/session"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireUser()
  if (!user) return jsonError("Sign in to open this resume.", 401)
  const { id } = await context.params
  const resume = await findOwnedResume(user.id, id)
  if (!resume) return jsonError("That resume isn't in your account.", 404)
  return jsonOk({ resume: toResumeDetail(resume) })
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await requireUser()
  if (!user) return jsonError("Sign in to edit this resume.", 401)
  const { id } = await context.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError("The resume fields weren't valid JSON.", 400)
  }

  const parsed = parseClientPayload(body)
  if (!parsed.ok) return jsonError(parsed.error, 400)

  const saved = await saveResumeFields(user.id, id, parsed.data)
  if (!saved) return jsonError("That resume isn't in your account.", 404)

  const resume = await findOwnedResume(user.id, id)
  if (!resume) return jsonError("That resume isn't in your account.", 404)
  return jsonOk({ resume: toResumeDetail(resume) })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await requireUser()
  if (!user) return jsonError("Sign in to delete this resume.", 401)
  const { id } = await context.params
  const deleted = await prisma.resume.deleteMany({ where: { id, userId: user.id } })
  if (deleted.count !== 1) return jsonError("That resume isn't in your account.", 404)
  return jsonOk({ ok: true })
}
