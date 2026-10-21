"use client"

import type { ReactNode } from "react"
import { formatWhen } from "@/lib/format"
import { buildDashboardMetrics, gmailReadout, type DayBucket } from "@/lib/dashboard-metrics"
import type { ApplicationItem, GmailAccountStatus } from "@/lib/application-data"
import type { JobPostingItem } from "@/lib/job-data"
import type { ProfileSnapshot, ResumeListItem } from "@/lib/resume-data"

type OpenTab = "profile" | "resumes" | "jobs" | "applications"

const tones = {
  resumes: "oklch(0.4 0.07 165)",
  jobs: "oklch(0.58 0.11 55)",
  applications: "oklch(0.45 0.08 250)",
  replies: "oklch(0.48 0.11 145)",
  muted: "oklch(0.88 0.02 85)",
}

export function AnalyticsBoard({
  profile,
  resumes,
  jobs,
  applications,
  gmail,
  onOpen,
}: {
  profile: ProfileSnapshot | null
  resumes: ResumeListItem[]
  jobs: JobPostingItem[]
  applications: ApplicationItem[]
  gmail: GmailAccountStatus | null
  onOpen: (tab: OpenTab) => void
}) {
  const metrics = buildDashboardMetrics({ profile, resumes, jobs, applications })
  const peak = Math.max(1, ...metrics.days.map((day) => day.resumes + day.jobs + day.applications))
  const pipelineMax = Math.max(metrics.jobs, metrics.confirmed, metrics.sent, metrics.replied, 1)

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-3xl tracking-tight">Overview</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Counts, reply status, and profile completeness from the records stored on this account.
          </p>
        </div>
        <p className="rounded-full bg-card px-3 py-1.5 text-xs text-muted-foreground ring-1 ring-foreground/10">
          {gmailReadout(gmail)}
        </p>
      </div>

      <p className="overflow-x-auto rounded-xl bg-foreground px-3 py-2 font-mono text-xs leading-5 text-background">
        {metrics.readout}
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Metric
          label="Resumes"
          value={metrics.resumes}
          detail={`${metrics.confirmed} confirmed · ${metrics.drafts} in review`}
          onClick={() => onOpen("resumes")}
        />
        <Metric
          label="ATS drafts"
          value={metrics.atsDrafts}
          detail="Tailored files saved as drafts"
          onClick={() => onOpen("resumes")}
        />
        <Metric
          label="Postings"
          value={metrics.jobs}
          detail={`${metrics.scraped} from a page · ${metrics.manual} pasted`}
          onClick={() => onOpen("jobs")}
        />
        <Metric
          label="Sent"
          value={metrics.sent}
          detail={`${metrics.applications} applications · ${metrics.sendFailed} failed`}
          onClick={() => onOpen("applications")}
        />
        <Metric
          label="Replies"
          value={metrics.replied}
          detail={`${metrics.waiting} waiting · ${metrics.checkFailed} check failed`}
          onClick={() => onOpen("applications")}
        />
        <Metric
          label="Reply rate"
          value={metrics.replyRate === null ? "—" : `${metrics.replyRate}%`}
          detail={metrics.sent === 0 ? "No sent applications yet" : `${metrics.replied} of ${metrics.sent} sent`}
          onClick={() => onOpen("applications")}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <article className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5 lg:col-span-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-heading text-2xl tracking-tight">Last 14 days</h3>
            <p className="text-xs text-muted-foreground">New resumes, postings, and applications</p>
          </div>
          <ActivityChart days={metrics.days} peak={peak} />
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <Legend tone={tones.resumes} label="Resumes" />
            <Legend tone={tones.jobs} label="Postings" />
            <Legend tone={tones.applications} label="Applications" />
          </ul>
        </article>

        <article className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5 lg:col-span-2">
          <h3 className="font-heading text-2xl tracking-tight">Pipeline</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Each bar is a count on this account, not a step that contains the next one.
          </p>
          <div className="mt-4 space-y-3">
            <Share label="Job postings" value={metrics.jobs} max={pipelineMax} tone={tones.jobs} />
            <Share label="Confirmed resumes" value={metrics.confirmed} max={pipelineMax} tone={tones.resumes} />
            <Share label="Applications sent" value={metrics.sent} max={pipelineMax} tone={tones.applications} />
            <Share label="Replies received" value={metrics.replied} max={pipelineMax} tone={tones.replies} />
          </div>
        </article>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <article className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
          <h3 className="font-heading text-2xl tracking-tight">Breakdown</h3>
          <div className="mt-4 space-y-4">
            <Group title="How resumes were read">
              <Share label="Gemini" value={metrics.gemini} max={Math.max(metrics.resumes, 1)} tone={tones.resumes} />
              <Share label="Groq" value={metrics.groq} max={Math.max(metrics.resumes, 1)} tone={tones.applications} />
              <Share label="Local fallback" value={metrics.fallback} max={Math.max(metrics.resumes, 1)} tone={tones.jobs} />
            </Group>
            <Group title="Where postings came from">
              <Share label="Read from the page" value={metrics.scraped} max={Math.max(metrics.jobs, 1)} tone={tones.jobs} />
              <Share label="Pasted in" value={metrics.manual} max={Math.max(metrics.jobs, 1)} tone={tones.applications} />
            </Group>
            <Group title="Application replies">
              <Share label="Reply received" value={metrics.replied} max={Math.max(metrics.applications, 1)} tone={tones.replies} />
              <Share label="Waiting" value={metrics.waiting} max={Math.max(metrics.applications, 1)} tone={tones.applications} />
              <Share label="Not sent" value={metrics.unsent} max={Math.max(metrics.applications, 1)} tone={tones.muted} />
            </Group>
          </div>
        </article>

        <article className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-heading text-2xl tracking-tight">Profile</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {metrics.profileScore} of {metrics.profileChecks.length} fields filled on the snapshot.
              </p>
            </div>
            <ScoreRing score={metrics.profileScore} total={metrics.profileChecks.length} />
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-2">
            {metrics.profileChecks.map((check) => (
              <li key={check.label} className="flex items-center gap-2 text-sm">
                <span
                  className={check.done ? "size-2 rounded-full bg-primary" : "size-2 rounded-full bg-border"}
                  aria-hidden
                />
                <span className={check.done ? "" : "text-muted-foreground"}>{check.label}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => onOpen("profile")}
            className="mt-4 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Open profile
          </button>
        </article>

        <article className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
          <h3 className="font-heading text-2xl tracking-tight">Recent records</h3>
          {metrics.recent.length === 0 ? (
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Saves show up here after you keep a resume, a posting, or an application.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {metrics.recent.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(item.tab)}
                    className="flex w-full flex-col gap-0.5 py-2.5 text-left hover:text-primary"
                  >
                    <span className="truncate text-sm font-medium">{item.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.detail} · {formatWhen(item.at)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  )
}

function Metric({
  label,
  value,
  detail,
  onClick,
}: {
  label: string
  value: number | string
  detail: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl bg-card p-4 text-left ring-1 ring-foreground/10 transition-colors hover:bg-secondary/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </button>
  )
}

function ActivityChart({ days, peak }: { days: DayBucket[]; peak: number }) {
  const total = days.reduce((sum, day) => sum + day.resumes + day.jobs + day.applications, 0)
  return (
    <div
      className="mt-5"
      role="img"
      aria-label={
        total === 0
          ? "No resumes, postings, or applications were added in the last 14 days."
          : `${total} records across the last 14 days.`
      }
    >
      <div className="flex h-40 items-end gap-1 sm:gap-2">
        {days.map((day) => {
          const stack = day.resumes + day.jobs + day.applications
          const height = stack === 0 ? 4 : Math.max(8, Math.round((stack / peak) * 128))
          return (
            <div key={day.key} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <div className="flex w-full flex-col-reverse overflow-hidden rounded-sm" style={{ height }}>
                {stack === 0 ? <div className="h-full w-full bg-muted" /> : null}
                <Segment count={day.resumes} tone={tones.resumes} />
                <Segment count={day.jobs} tone={tones.jobs} />
                <Segment count={day.applications} tone={tones.applications} />
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums">{day.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Segment({ count, tone }: { count: number; tone: string }) {
  if (count === 0) return null
  return <div className="min-h-1 w-full" style={{ flex: count, background: tone }} />
}

function Share({ label, value, max, tone }: { label: string; value: number; max: number; tone: string }) {
  const width = Math.round((value / max) * 100)
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">{value}</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-muted">
        <div className="h-1.5 rounded-full" style={{ width: `${width}%`, background: tone }} />
      </div>
    </div>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</p>
      {children}
    </div>
  )
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className="size-2.5 rounded-sm" style={{ background: tone }} aria-hidden />
      {label}
    </li>
  )
}

function ScoreRing({ score, total }: { score: number; total: number }) {
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const filled = total === 0 ? 0 : (score / total) * circumference
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" role="img" aria-label={`Profile ${score} of ${total}`}>
      <circle cx="36" cy="36" r={radius} fill="none" stroke="oklch(0.92 0.015 85)" strokeWidth="6" />
      {score > 0 ? (
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke="oklch(0.4 0.07 165)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
          transform="rotate(-90 36 36)"
        />
      ) : null}
      <text x="36" y="40" textAnchor="middle" className="fill-foreground text-sm font-semibold">
        {score}/{total}
      </text>
    </svg>
  )
}
