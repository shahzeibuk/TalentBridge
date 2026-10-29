"use client"

import type { ReactNode } from "react"
import { Briefcase, FileText, Mail, Send } from "lucide-react"
import { useAdminUser } from "@/components/admin-user"
import { DashboardAgent } from "@/components/dashboard-agent"
import { formatWhen } from "@/lib/format"
import { buildDashboardMetrics, gmailReadout, type DayBucket } from "@/lib/dashboard-metrics"
import type { ApplicationItem, GmailAccountStatus } from "@/lib/application-data"
import type { JobPostingItem } from "@/lib/job-data"
import type { ProfileSnapshot, ResumeListItem } from "@/lib/resume-data"

type OpenTab = "profile" | "resumes" | "jobs" | "applications" | "ai"
type SeriesKey = "resumes" | "jobs" | "applications"

const tones = {
  resumes: "oklch(0.74 0.14 300)",
  jobs: "oklch(0.7 0.12 265)",
  applications: "oklch(0.78 0.14 175)",
  replies: "oklch(0.78 0.15 155)",
  muted: "oklch(0.4 0.03 285)",
}

const card = "rounded-2xl border border-white/8 bg-card"

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
  const account = useAdminUser()
  const metrics = buildDashboardMetrics({ profile, resumes, jobs, applications })
  const peak = Math.max(1, ...metrics.days.map((day) => day.resumes + day.jobs + day.applications))
  const pipelineMax = Math.max(metrics.jobs, metrics.confirmed, metrics.sent, metrics.replied, 1)
  const first = account?.name.trim().split(/\s+/)[0] || "there"

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">Dashboard</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">Welcome back, {first}</h2>
        </div>
        <p className="w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-muted-foreground">
          {gmailReadout(gmail)}
        </p>
      </div>

      <DashboardAgent onOpen={onOpen} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Resumes"
          value={metrics.resumes}
          delta={weekDelta(metrics.days, "resumes")}
          series={metrics.days.map((day) => day.resumes)}
          icon={<FileText className="size-4" />}
          onClick={() => onOpen("resumes")}
        />
        <StatCard
          label="Postings"
          value={metrics.jobs}
          delta={weekDelta(metrics.days, "jobs")}
          series={metrics.days.map((day) => day.jobs)}
          icon={<Briefcase className="size-4" />}
          onClick={() => onOpen("jobs")}
        />
        <StatCard
          label="Sent"
          value={metrics.sent}
          delta={weekDelta(metrics.days, "applications")}
          series={metrics.days.map((day) => day.applications)}
          icon={<Send className="size-4" />}
          onClick={() => onOpen("applications")}
        />
        <StatCard
          label="Replies"
          value={metrics.replied}
          delta={{
            text: metrics.replyRate === null ? "No sends yet" : `${metrics.replyRate}% reply rate`,
            tone: metrics.replied > 0 ? "up" : "flat",
          }}
          series={metrics.days.map((day) => day.applications)}
          icon={<Mail className="size-4" />}
          onClick={() => onOpen("applications")}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <article className={`${card} p-4 sm:p-5 lg:col-span-2`}>
          <h3 className="text-lg font-semibold tracking-tight">Recent records</h3>
          {metrics.recent.length === 0 ? (
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Saves show up here after you keep a resume, a posting, or an application.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {metrics.recent.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(item.tab)}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/8 bg-background/50 px-3 py-3 text-left hover:bg-white/5"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-primary">
                      <FileText className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{item.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.detail} · {formatWhen(item.at)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className={`${card} p-4 sm:p-5 lg:col-span-3`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-semibold tracking-tight">Last 14 days</h3>
            <p className="text-xs text-muted-foreground">New resumes, postings, and applications</p>
          </div>
          <ActivityChart days={metrics.days} peak={peak} />
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <Legend tone={tones.resumes} label="Resumes" />
            <Legend tone={tones.jobs} label="Postings" />
            <Legend tone={tones.applications} label="Applications" />
          </ul>
        </article>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <article className={`${card} p-4 sm:p-5`}>
          <h3 className="text-lg font-semibold tracking-tight">Pipeline</h3>
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

        <article className={`${card} p-4 sm:p-5`}>
          <h3 className="text-lg font-semibold tracking-tight">Breakdown</h3>
          <div className="mt-4 space-y-4">
            <Group title="How resumes were read">
              <Share label="Gemini" value={metrics.gemini} max={Math.max(metrics.resumes, 1)} tone={tones.resumes} />
              <Share label="Groq" value={metrics.groq} max={Math.max(metrics.resumes, 1)} tone={tones.jobs} />
              <Share label="Local fallback" value={metrics.fallback} max={Math.max(metrics.resumes, 1)} tone={tones.applications} />
            </Group>
            <Group title="Where postings came from">
              <Share label="Read from the page" value={metrics.scraped} max={Math.max(metrics.jobs, 1)} tone={tones.jobs} />
              <Share label="Pasted in" value={metrics.manual} max={Math.max(metrics.jobs, 1)} tone={tones.resumes} />
            </Group>
          </div>
        </article>

        <article className={`${card} p-4 sm:p-5`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold tracking-tight">Profile</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {metrics.profileScore} of {metrics.profileChecks.length} fields filled on the snapshot.
              </p>
            </div>
            <ScoreRing score={metrics.profileScore} total={metrics.profileChecks.length} />
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-2">
            {metrics.profileChecks.map((check) => (
              <li key={check.label} className="flex items-center gap-2 text-sm">
                <span className={check.done ? "size-2 rounded-full bg-primary" : "size-2 rounded-full bg-white/15"} aria-hidden />
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
      </div>
    </section>
  )
}

function weekDelta(days: DayBucket[], key: SeriesKey) {
  const recent = days.slice(-7).reduce((sum, day) => sum + day[key], 0)
  const prior = days.slice(0, 7).reduce((sum, day) => sum + day[key], 0)
  const diff = recent - prior
  if (diff > 0) return { text: `+${diff} this week`, tone: "up" as const }
  if (diff < 0) return { text: `${diff} this week`, tone: "down" as const }
  return { text: recent === 0 ? "None this week" : "Same as last week", tone: "flat" as const }
}

function StatCard({
  label,
  value,
  delta,
  series,
  icon,
  onClick,
}: {
  label: string
  value: number
  delta: { text: string; tone: "up" | "down" | "flat" }
  series: number[]
  icon: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${card} p-4 text-left transition-colors hover:bg-white/5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-9 items-center justify-center rounded-xl bg-white/6 text-primary">{icon}</span>
        <Sparkline values={series} />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p
        className={
          delta.tone === "up" ? "mt-1 text-xs text-emerald-400" : delta.tone === "down" ? "mt-1 text-xs text-rose-300" : "mt-1 text-xs text-muted-foreground"
        }
      >
        {delta.text}
      </p>
    </button>
  )
}

function Sparkline({ values }: { values: number[] }) {
  const width = 92
  const height = 36
  const max = Math.max(1, ...values)
  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width
      const y = height - 4 - (value / max) * (height - 8)
      return `${x},${y}`
    })
    .join(" ")
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline
        fill="none"
        stroke="oklch(0.75 0.13 300)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
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
                {stack === 0 ? <div className="h-full w-full bg-white/8" /> : null}
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
      <div className="mt-1.5 h-1.5 rounded-full bg-white/8">
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
      <circle cx="36" cy="36" r={radius} fill="none" stroke="oklch(0.32 0.04 285)" strokeWidth="6" />
      {score > 0 ? (
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke="oklch(0.68 0.18 292)"
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
