import { aiEnvForUser } from "@/lib/ai-settings"
import { prisma } from "@/lib/prisma"
import { looseResumeData } from "@/lib/resume-data"
import { resumeFields, toResumeDetail } from "@/lib/resume-store"
import { jsonError, jsonOk } from "@/lib/responses"
import { requireUser } from "@/lib/session"
import { renderTailoredText, tailorResume } from "@/lib/tailor-resume"

export const maxDuration = 60

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!user) return jsonError("Sign in to tailor a resume.", 401)
  const { id } = await context.params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }
  const resumeId = body && typeof body === "object" && "resumeId" in body ? String(body.resumeId) : ""
  if (!resumeId) return jsonError("Choose a resume to tailor.", 400)

  const [job, resume] = await Promise.all([
    prisma.jobPosting.findFirst({ where: { id, userId: user.id } }),
    prisma.resume.findFirst({ where: { id: resumeId, userId: user.id } }),
  ])
  if (!job) return jsonError("That job posting isn't on your account.", 404)
  if (!resume) return jsonError("Choose a resume from your account.", 404)

  try {
    const source = looseResumeData(resume)
    const tailored = await tailorResume(source, job, { env: await aiEnvForUser(user.id) })
    const text = renderTailoredText(tailored.data)
    const created = await prisma.resume.create({
      data: {
        userId: user.id,
        fileName: `ATS ${job.company} ${job.title}.txt`.replace(/[^\w.\- ()]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120),
        mimeType: "text/plain",
        fileBytes: Buffer.from(text, "utf8"),
        extractedText: text,
        status: "draft",
        parseSource: tailored.parseSource,
        parseNote: tailored.parseNote,
        ...resumeFields(tailored.data),
      },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        status: true,
        fullName: true,
        email: true,
        phone: true,
        location: true,
        links: true,
        experience: true,
        education: true,
        skills: true,
        parseSource: true,
        parseNote: true,
        extractedText: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return jsonOk({ resume: toResumeDetail(created) }, 201)
  } catch (error) {
    console.error("tailor failed", error instanceof Error ? error.message : "unknown")
    return jsonError("We couldn't tailor that resume. Try again in a moment.", 500)
  }
}
