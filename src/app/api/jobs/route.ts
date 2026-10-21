import { prisma } from "@/lib/prisma"
import { asJobSource, manualJobSchema, type JobPostingItem } from "@/lib/job-data"
import { jsonError, jsonOk } from "@/lib/responses"
import { requireUser } from "@/lib/session"

function toItem(row: {
  id: string
  sourceUrl: string
  title: string
  company: string
  description: string
  source: string
  createdAt: Date
  updatedAt: Date
}): JobPostingItem {
  return {
    id: row.id,
    sourceUrl: row.sourceUrl,
    title: row.title,
    company: row.company,
    description: row.description,
    source: asJobSource(row.source),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function GET() {
  const user = await requireUser()
  if (!user) return jsonError("Sign in to see your job postings.", 401)
  try {
    const jobs = await prisma.jobPosting.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
    })
    return jsonOk({ jobs: jobs.map(toItem) })
  } catch (error) {
    console.error("job list failed", error instanceof Error ? error.message : "unknown")
    return jsonError("We couldn't load your job postings. Try again in a moment.", 500)
  }
}

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) return jsonError("Sign in to save a job posting.", 401)
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError("The job form was empty.", 400)
  }
  const parsed = manualJobSchema.safeParse(body)
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Check the job posting and try again.", 400)
  try {
    const job = await prisma.jobPosting.create({
      data: {
        userId: user.id,
        title: parsed.data.title,
        company: parsed.data.company,
        description: parsed.data.description,
        sourceUrl: parsed.data.sourceUrl || "",
        source: "manual",
      },
    })
    return jsonOk({ job: toItem(job) }, 201)
  } catch (error) {
    console.error("job save failed", error instanceof Error ? error.message : "unknown")
    return jsonError("We couldn't save that job posting. Try again.", 500)
  }
}
