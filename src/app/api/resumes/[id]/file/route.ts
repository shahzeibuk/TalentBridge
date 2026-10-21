import { prisma } from "@/lib/prisma"
import { jsonError } from "@/lib/responses"
import { requireUser } from "@/lib/session"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireUser()
  if (!user) return jsonError("Sign in to download this resume.", 401)
  const { id } = await context.params
  const resume = await prisma.resume.findFirst({
    where: { id, userId: user.id },
    select: { fileName: true, mimeType: true, fileBytes: true },
  })
  if (!resume) return jsonError("That resume isn't in your account.", 404)

  const safeName = resume.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "resume"
  const bytes = Uint8Array.from(resume.fileBytes)
  return new Response(bytes, {
    headers: {
      "Content-Type": resume.mimeType,
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
    },
  })
}
