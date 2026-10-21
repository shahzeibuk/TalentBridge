import { z } from "zod"

export type GmailAccountStatus = {
  configured: boolean
  connected: boolean
  email: string | null
  expired: boolean
}

export type ApplicationStatus = "draft" | "sent" | "send_failed"
export type ReplyStatus = "unsent" | "waiting" | "replied" | "check_failed"

export type ApplicationItem = {
  id: string
  company: string
  title: string
  contactEmail: string
  coverLetter: string
  subject: string
  resumeId: string | null
  resumeFileName: string | null
  status: ApplicationStatus
  replyStatus: ReplyStatus
  replyFrom: string
  replySnippet: string
  sentAt: string | null
  replyCheckedAt: string | null
  lastError: string
  createdAt: string
  updatedAt: string
}

export const applicationInputSchema = z.object({
  company: z.string().trim().min(1, "Enter the company.").max(160),
  title: z.string().trim().min(1, "Enter the job title.").max(160),
  contactEmail: z.email("Enter the contact email from the job posting."),
  resumeId: z.string().trim().min(1, "Choose a resume to attach."),
  coverLetter: z.string().trim().min(20, "Write the cover letter you want to send.").max(20000),
  subject: z.string().trim().max(200).optional(),
})

export function applicationSubject(input: { subject?: string; title: string; company: string }) {
  const custom = input.subject?.trim()
  if (custom) return custom
  return `Application for ${input.title} at ${input.company}`
}

export function asApplicationStatus(value: string): ApplicationStatus {
  if (value === "sent" || value === "send_failed") return value
  return "draft"
}

export function asReplyStatus(value: string): ReplyStatus {
  if (value === "waiting" || value === "replied" || value === "check_failed") return value
  return "unsent"
}
