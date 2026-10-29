import { z } from "zod"
import { aiEnvForUser } from "@/lib/ai-settings"
import { gmailAccount, listApplications } from "@/lib/application-mail"
import { runDashboardAgent, type DashboardAgentContext } from "@/lib/dashboard-agent"
import { buildDashboardMetrics, gmailReadout } from "@/lib/dashboard-metrics"
import { asJobSource } from "@/lib/job-data"
import { prisma } from "@/lib/prisma"
import { toListItem, toProfileSnapshot } from "@/lib/resume-store"
import { jsonError, jsonOk } from "@/lib/responses"
import { requireUser } from "@/lib/session"

export const maxDuration = 60

const bodySchema = z.object({
  message: z.string().trim().min(1, "Ask the agent something.").max(1000, "Keep the question under 1000 characters."),
})

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) return jsonError("Sign in to use the dashboard agent.", 401)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError("Send your question as JSON.", 400)
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Ask the agent something.", 400)
  }

  try {
    const [profile, resumes, jobs, applications, gmail] = await Promise.all([
      prisma.profile.findUnique({ where: { userId: user.id } }),
      prisma.resume.findMany({
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
      }),
      prisma.jobPosting.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } }),
      listApplications(user.id, false),
      gmailAccount(user.id),
    ])

    const metrics = buildDashboardMetrics({
      profile: profile ? toProfileSnapshot(profile) : null,
      resumes: resumes.map(toListItem),
      jobs: jobs.map((row) => ({
        id: row.id,
        sourceUrl: row.sourceUrl,
        title: row.title,
        company: row.company,
        description: row.description,
        source: asJobSource(row.source),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      applications,
    })

    const context: DashboardAgentContext = {
      name: user.name,
      gmail: gmailReadout(gmail),
      resumes: metrics.resumes,
      confirmed: metrics.confirmed,
      drafts: metrics.drafts,
      jobs: metrics.jobs,
      sent: metrics.sent,
      waiting: metrics.waiting,
      replied: metrics.replied,
      profileScore: metrics.profileScore,
      profileTotal: metrics.profileChecks.length,
      missingProfile: metrics.profileChecks.filter((check) => !check.done).map((check) => check.label),
      recent: metrics.recent.map((item) => `${item.title} (${item.detail})`),
      readout: metrics.readout,
    }

    const result = await runDashboardAgent(parsed.data.message, context, await aiEnvForUser(user.id))
    return jsonOk(result)
  } catch (error) {
    console.error("dashboard agent failed", error)
    return jsonError("The dashboard agent couldn't answer. Try again in a moment.", 500)
  }
}
