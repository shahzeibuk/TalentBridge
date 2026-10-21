import { prisma } from "@/lib/prisma"
import { asJobSource, importJobSchema, type JobPostingItem } from "@/lib/job-data"
import { importJobsFromUrl, ScrapeError } from "@/lib/job-scrape"
import { jsonError, jsonOk } from "@/lib/responses"
import { requireUser } from "@/lib/session"

export const maxDuration = 60

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) return jsonError("Sign in to import a job posting.", 401)
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError("Paste a job posting URL.", 400)
  }
  const parsed = importJobSchema.safeParse(body)
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Paste a job posting URL.", 400)

  try {
    const imported = await importJobsFromUrl(parsed.data.url)
    const existing = await prisma.jobPosting.findMany({
      where: { userId: user.id, sourceUrl: { in: imported.map((job) => job.sourceUrl).filter(Boolean) } },
      select: { sourceUrl: true },
    })
    const savedUrls = new Set(existing.map((job) => job.sourceUrl))
    const fresh = imported.filter((job) => job.sourceUrl && !savedUrls.has(job.sourceUrl))
    if (fresh.length === 0) {
      return jsonOk({ jobs: [], alreadySaved: imported.length })
    }
    const created = []
    for (const job of fresh) {
      created.push(
        await prisma.jobPosting.create({
          data: {
            userId: user.id,
            title: job.title,
            company: job.company,
            description: job.description,
            sourceUrl: job.sourceUrl,
            source: "scraped",
          },
        }),
      )
    }
    const jobs: JobPostingItem[] = created.map((job) => ({
      id: job.id,
      sourceUrl: job.sourceUrl,
      title: job.title,
      company: job.company,
      description: job.description,
      source: asJobSource(job.source),
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    }))
    return jsonOk({ jobs, alreadySaved: imported.length - fresh.length }, 201)
  } catch (error) {
    if (error instanceof ScrapeError) {
      return Response.json(
        { error: error.message, scrape: { ...error.partial, url: parsed.data.url } },
        { status: 422, headers: { "Cache-Control": "no-store" } },
      )
    }
    console.error("job import failed", error instanceof Error ? error.message : "unknown")
    return jsonError("We couldn't read that page. Paste the job description instead.", 502)
  }
}
