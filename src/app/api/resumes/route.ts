import { prisma } from "@/lib/prisma"
import { extractDocxText, extractPdfText, ExtractError } from "@/lib/extract-text"
import { aiEnvForUser } from "@/lib/ai-settings"
import { parseResumeText } from "@/lib/parse-resume"
import { jsonError, jsonOk } from "@/lib/responses"
import { resumeFields, toListItem, toResumeDetail } from "@/lib/resume-store"
import { requireUser } from "@/lib/session"
import { HOST_BODY_LIMIT_BYTES, inspectUpload } from "@/lib/uploads"

export const maxDuration = 60

export async function GET() {
  const user = await requireUser()
  if (!user) return jsonError("Sign in to see your resumes.", 401)

  try {
    const resumes = await prisma.resume.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        fileName: true,
        status: true,
        parseSource: true,
        fullName: true,
        updatedAt: true,
        createdAt: true,
      },
    })
    return jsonOk({ resumes: resumes.map(toListItem) })
  } catch (error) {
    console.error("resume list failed", error)
    return jsonError("We couldn't load your resumes. Try again in a moment.", 500)
  }
}

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) return jsonError("Sign in to upload a resume.", 401)

  const contentLength = Number(request.headers.get("content-length") ?? "0")
  if (Number.isFinite(contentLength) && contentLength > HOST_BODY_LIMIT_BYTES) {
    return jsonError(
      "This upload is too large for the host. Vercel rejects request bodies around 4.5 MB. Use a PDF or DOCX under 4 MB.",
      413,
    )
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return jsonError(
      "We couldn't read that upload. Keep the file under 4 MB so it stays inside the hosting limit.",
      400,
    )
  }

  const file = form.get("file")
  if (!(file instanceof File)) {
    return jsonError("Choose a PDF or DOCX file.", 400)
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const inspected = inspectUpload(file.name, bytes)
  if (!inspected.ok) return jsonError(inspected.error, 400)

  try {
    const extractedText =
      inspected.kind === "pdf" ? await extractPdfText(bytes) : await extractDocxText(bytes)
    const parsed = await parseResumeText(extractedText, { env: await aiEnvForUser(user.id) })
    const resume = await prisma.resume.create({
      data: {
        userId: user.id,
        fileName: inspected.fileName,
        mimeType: inspected.mimeType,
        fileBytes: Buffer.from(bytes),
        extractedText,
        status: "draft",
        parseSource: parsed.parseSource,
        parseNote: parsed.parseNote,
        ...resumeFields(parsed.data),
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
    return jsonOk({ resume: toResumeDetail(resume) }, 201)
  } catch (error) {
    if (error instanceof ExtractError) return jsonError(error.message, 422)
    console.error("resume upload failed", error)
    return jsonError("We couldn't store that resume. Try again in a moment.", 500)
  }
}
