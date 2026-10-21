import { prisma } from "@/lib/prisma"
import { jsonError, jsonOk } from "@/lib/responses"
import { requireUser } from "@/lib/session"

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!user) return jsonError("Sign in to remove a job posting.", 401)
  const { id } = await context.params
  const result = await prisma.jobPosting.deleteMany({ where: { id, userId: user.id } })
  if (result.count === 0) return jsonError("That job posting isn't on your account.", 404)
  return jsonOk({ ok: true })
}
