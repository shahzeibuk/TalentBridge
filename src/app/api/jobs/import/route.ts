import { prisma } from "@/lib/prisma"
import { importJobSchema } from "@/lib/job-data"
import { ScrapeError, scrapeJobUrl } from "@/lib/job-scrape"
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
    const extracted = await scrapeJobUrl(parsed.data.url)
    const job = await prisma.jobPosting.create({
      data: {
        userId: user.id,
        title: extracted.title,
        company: extracted.company,
        description: extracted.description,
        sourceUrl: parsed.data.url,
        source: "scraped",
      },
    })
    return jsonOk({
      job: {
        id: job.id,
        sourceUrl: job.sourceUrl,
        title: job.title,
        company: job.company,
        description: job.description,
        source: "scraped" as const,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
      },
    }, 201)
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
