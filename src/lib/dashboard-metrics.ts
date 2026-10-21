import type { ApplicationItem, GmailAccountStatus } from "@/lib/application-data"
import type { JobPostingItem } from "@/lib/job-data"
import type { ProfileSnapshot, ResumeListItem } from "@/lib/resume-data"

export type DayBucket = {
  key: string
  label: string
  resumes: number
  jobs: number
  applications: number
}

export type ActivityItem = {
  id: string
  at: string
  title: string
  detail: string
  tab: "resumes" | "jobs" | "applications"
}

export type ProfileCheck = {
  label: string
  done: boolean
}

export type DashboardMetrics = {
  resumes: number
  confirmed: number
  drafts: number
  atsDrafts: number
  gemini: number
  groq: number
  fallback: number
  jobs: number
  scraped: number
  manual: number
  applications: number
  sent: number
  sendFailed: number
  unsent: number
  waiting: number
  replied: number
  checkFailed: number
  replyRate: number | null
  profileChecks: ProfileCheck[]
  profileScore: number
  days: DayBucket[]
  recent: ActivityItem[]
  readout: string
}

function dayKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function parseTime(iso: string) {
  const time = new Date(iso).getTime()
  return Number.isNaN(time) ? 0 : time
}

export function buildDashboardMetrics(input: {
  profile: ProfileSnapshot | null
  resumes: ResumeListItem[]
  jobs: JobPostingItem[]
  applications: ApplicationItem[]
  now?: Date
}): DashboardMetrics {
  const resumes = input.resumes
  const jobs = input.jobs
  const applications = input.applications
  const confirmed = resumes.filter((resume) => resume.status === "confirmed").length
  const drafts = resumes.length - confirmed
  const atsDrafts = resumes.filter((resume) => resume.fileName.startsWith("ATS ")).length
  const gemini = resumes.filter((resume) => resume.parseSource === "gemini").length
  const groq = resumes.filter((resume) => resume.parseSource === "groq").length
  const fallback = resumes.filter((resume) => resume.parseSource === "fallback").length
  const scraped = jobs.filter((job) => job.source === "scraped").length
  const manual = jobs.length - scraped
  const sent = applications.filter((item) => item.status === "sent").length
  const sendFailed = applications.filter((item) => item.status === "send_failed").length
  const unsent = applications.filter((item) => item.replyStatus === "unsent").length
  const waiting = applications.filter((item) => item.replyStatus === "waiting").length
  const replied = applications.filter((item) => item.replyStatus === "replied").length
  const checkFailed = applications.filter((item) => item.replyStatus === "check_failed").length
  const profileChecks = profileChecklist(input.profile)
  const profileScore = profileChecks.filter((check) => check.done).length
  const days = activityDays(resumes, jobs, applications, input.now ?? new Date())
  const recent = recentActivity(resumes, jobs, applications)
  const replyRate = sent === 0 ? null : Math.round((replied / sent) * 100)

  return {
    resumes: resumes.length,
    confirmed,
    drafts,
    atsDrafts,
    gemini,
    groq,
    fallback,
    jobs: jobs.length,
    scraped,
    manual,
    applications: applications.length,
    sent,
    sendFailed,
    unsent,
    waiting,
    replied,
    checkFailed,
    replyRate,
    profileChecks,
    profileScore,
    days,
    recent,
    readout: [
      `resumes ${resumes.length}`,
      `confirmed ${confirmed}`,
      `drafts ${drafts}`,
      `postings ${jobs.length}`,
      `sent ${sent}`,
      `replies ${replied}`,
      `profile ${profileScore}/${profileChecks.length}`,
    ].join(" · "),
  }
}

function filled(value: string | undefined) {
  return Boolean(value && value.trim())
}

function profileChecklist(profile: ProfileSnapshot | null): ProfileCheck[] {
  return [
    { label: "Name", done: filled(profile?.fullName) },
    { label: "Email", done: filled(profile?.email) },
    { label: "Phone", done: filled(profile?.phone) },
    { label: "Location", done: filled(profile?.location) },
    { label: "A role", done: (profile?.experience.length ?? 0) > 0 },
    { label: "A school", done: (profile?.education.length ?? 0) > 0 },
    { label: "A skill", done: (profile?.skills.length ?? 0) > 0 },
    { label: "A link", done: (profile?.links.length ?? 0) > 0 },
  ]
}

function activityDays(
  resumes: ResumeListItem[],
  jobs: JobPostingItem[],
  applications: ApplicationItem[],
  now: Date,
): DayBucket[] {
  const days: DayBucket[] = []
  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = new Date(now)
    date.setHours(12, 0, 0, 0)
    date.setDate(date.getDate() - offset)
    days.push({
      key: dayKey(date),
      label: String(date.getDate()),
      resumes: 0,
      jobs: 0,
      applications: 0,
    })
  }
  const index = new Map(days.map((day, position) => [day.key, position]))
  for (const resume of resumes) add(index, days, resume.createdAt, "resumes")
  for (const job of jobs) add(index, days, job.createdAt, "jobs")
  for (const application of applications) add(index, days, application.createdAt, "applications")
  return days
}

function add(index: Map<string, number>, days: DayBucket[], iso: string, field: "resumes" | "jobs" | "applications") {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return
  const position = index.get(dayKey(date))
  if (position === undefined) return
  days[position][field] += 1
}

function recentActivity(
  resumes: ResumeListItem[],
  jobs: JobPostingItem[],
  applications: ApplicationItem[],
): ActivityItem[] {
  const items: ActivityItem[] = [
    ...resumes.map((resume) => ({
      id: `resume-${resume.id}`,
      at: resume.updatedAt,
      title: resume.fullName || resume.fileName,
      detail: resume.status === "confirmed" ? "Saved resume" : "Resume needs review",
      tab: "resumes" as const,
    })),
    ...jobs.map((job) => ({
      id: `job-${job.id}`,
      at: job.updatedAt,
      title: `${job.title} · ${job.company}`,
      detail: job.source === "scraped" ? "Posting read from the page" : "Posting pasted in",
      tab: "jobs" as const,
    })),
    ...applications.map((item) => ({
      id: `application-${item.id}`,
      at: item.sentAt || item.createdAt,
      title: `${item.title} · ${item.company}`,
      detail: applicationDetail(item),
      tab: "applications" as const,
    })),
  ]
  return items.sort((left, right) => parseTime(right.at) - parseTime(left.at)).slice(0, 6)
}

function applicationDetail(item: ApplicationItem) {
  if (item.replyStatus === "replied") return "Reply received"
  if (item.replyStatus === "waiting") return "Sent, waiting for a reply"
  if (item.replyStatus === "check_failed") return "Sent, reply check failed"
  if (item.status === "send_failed") return "Send failed"
  if (item.status === "sent") return "Sent from Gmail"
  return "Not sent"
}

export function gmailReadout(gmail: GmailAccountStatus | null) {
  if (!gmail) return "Gmail status unavailable"
  if (!gmail.configured) return "Gmail isn't configured on this server"
  if (gmail.connected && gmail.expired) return "Gmail connection expired"
  if (gmail.connected && gmail.email) return `Gmail connected · ${gmail.email}`
  return "Gmail not connected"
}
