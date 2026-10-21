import { z } from "zod"

export type Experience = {
  company: string
  title: string
  start: string
  end: string
  description: string
}

export type Education = {
  school: string
  degree: string
  field: string
  start: string
  end: string
}

export type ResumeData = {
  fullName: string
  email: string
  phone: string
  location: string
  links: string[]
  experience: Experience[]
  education: Education[]
  skills: string[]
}

export type ParseSource = "gemini" | "groq" | "fallback"

export type ResumeListItem = {
  id: string
  fileName: string
  status: "draft" | "confirmed"
  parseSource: ParseSource
  fullName: string
  updatedAt: string
  createdAt: string
}

export type ResumeDetail = ResumeListItem &
  ResumeData & {
    mimeType: string
    parseNote: string
    extractedText: string
  }

export type ProfileSnapshot = ResumeData & {
  sourceResumeId: string | null
  updatedAt: string
}

const experienceSchema = z.object({
  company: z.string().max(160),
  title: z.string().max(160),
  start: z.string().max(40),
  end: z.string().max(40),
  description: z.string().max(4000),
})

const educationSchema = z.object({
  school: z.string().max(160),
  degree: z.string().max(160),
  field: z.string().max(160),
  start: z.string().max(40),
  end: z.string().max(40),
})

const resumeDataSchema = z.object({
  fullName: z.string().max(120),
  email: z.string().max(200),
  phone: z.string().max(40),
  location: z.string().max(120),
  links: z.array(z.string().max(300)).max(12),
  experience: z.array(experienceSchema).max(20),
  education: z.array(educationSchema).max(12),
  skills: z.array(z.string().max(60)).max(40),
})

export function emptyResumeData(): ResumeData {
  return {
    fullName: "",
    email: "",
    phone: "",
    location: "",
    links: [],
    experience: [],
    education: [],
    skills: [],
  }
}

function textOf(value: unknown, max: number, truncate: boolean) {
  const raw =
    typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : ""
  return truncate ? raw.slice(0, max) : raw
}

function recordOf(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null
}

function listOf(value: unknown, truncate: boolean, max: number) {
  if (Array.isArray(value)) return truncate ? value.slice(0, max) : value
  if (typeof value === "string" && value.trim()) {
    const parts = value
      .split(/[,|\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
    return truncate ? parts.slice(0, max) : parts
  }
  return truncate ? [] : value
}

function experienceFrom(value: unknown, truncate: boolean): Experience | unknown {
  const record = recordOf(value)
  if (!record) return truncate ? { company: "", title: "", start: "", end: "", description: "" } : value
  return {
    company: textOf(record.company ?? record.employer ?? record.organization, 160, truncate),
    title: textOf(record.title ?? record.role ?? record.position, 160, truncate),
    start: textOf(record.start ?? record.startDate, 40, truncate),
    end: textOf(record.end ?? record.endDate, 40, truncate),
    description: textOf(record.description ?? record.summary, 4000, truncate),
  }
}

function educationFrom(value: unknown, truncate: boolean): Education | unknown {
  const record = recordOf(value)
  if (!record) return truncate ? { school: "", degree: "", field: "", start: "", end: "" } : value
  return {
    school: textOf(record.school ?? record.institution, 160, truncate),
    degree: textOf(record.degree, 160, truncate),
    field: textOf(record.field ?? record.fieldOfStudy ?? record.major, 160, truncate),
    start: textOf(record.start ?? record.startDate, 40, truncate),
    end: textOf(record.end ?? record.endDate, 40, truncate),
  }
}

function skillFrom(value: unknown, truncate: boolean) {
  if (typeof value === "string") return textOf(value, 60, truncate)
  const record = recordOf(value)
  if (record) return textOf(record.name ?? record.skill, 60, truncate)
  return truncate ? "" : value
}

function linkFrom(value: unknown, truncate: boolean) {
  if (typeof value === "string") return textOf(value, 300, truncate)
  const record = recordOf(value)
  if (record) return textOf(record.url ?? record.href ?? record.link, 300, truncate)
  return truncate ? "" : value
}

function shapeFromUnknown(input: unknown, truncate: boolean) {
  const record = recordOf(input) ?? {}
  const contact = recordOf(record.contact) ?? {}
  const experience = listOf(record.experience ?? record.workExperience ?? record.work, truncate, 20)
  const education = listOf(record.education, truncate, 12)
  const skills = listOf(record.skills, truncate, 40)
  const links = listOf(record.links ?? contact.links, truncate, 12)

  return {
    fullName: textOf(record.fullName ?? record.name ?? contact.fullName, 120, truncate),
    email: textOf(record.email ?? contact.email, 200, truncate),
    phone: textOf(record.phone ?? contact.phone, 40, truncate),
    location: textOf(record.location ?? contact.location, 120, truncate),
    links: Array.isArray(links) ? links.map((item) => linkFrom(item, truncate)) : links,
    experience: Array.isArray(experience)
      ? experience.map((item) => experienceFrom(item, truncate))
      : experience,
    education: Array.isArray(education) ? education.map((item) => educationFrom(item, truncate)) : education,
    skills: Array.isArray(skills) ? skills.map((item) => skillFrom(item, truncate)) : skills,
  }
}

export function cleanResume(data: ResumeData): ResumeData {
  return {
    fullName: data.fullName.trim(),
    email: data.email.trim(),
    phone: data.phone.trim(),
    location: data.location.trim(),
    links: uniqueStrings(data.links.map((link) => link.trim()).filter(Boolean)).slice(0, 12),
    experience: data.experience
      .map((item) => ({
        company: item.company.trim(),
        title: item.title.trim(),
        start: item.start.trim(),
        end: item.end.trim(),
        description: item.description.trim(),
      }))
      .filter((item) => item.company || item.title || item.start || item.end || item.description)
      .slice(0, 20),
    education: data.education
      .map((item) => ({
        school: item.school.trim(),
        degree: item.degree.trim(),
        field: item.field.trim(),
        start: item.start.trim(),
        end: item.end.trim(),
      }))
      .filter((item) => item.school || item.degree || item.field || item.start || item.end)
      .slice(0, 12),
    skills: uniqueStrings(data.skills.map((skill) => skill.trim()).filter(Boolean)).slice(0, 40),
  }
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(value)
  }
  return result
}

export function looseResumeData(input: unknown): ResumeData {
  const parsed = resumeDataSchema.safeParse(shapeFromUnknown(input, true))
  if (!parsed.success) return emptyResumeData()
  return cleanResume(parsed.data)
}

export function parseClientPayload(
  input: unknown,
): { ok: true; data: ResumeData } | { ok: false; error: string } {
  if (!recordOf(input)) {
    return { ok: false, error: "Send the resume fields as a JSON object." }
  }
  const record = input as Record<string, unknown>
  if (Array.isArray(record.experience) && record.experience.length > 20) {
    return { ok: false, error: "Keep the resume to 20 jobs or fewer." }
  }
  if (Array.isArray(record.education) && record.education.length > 12) {
    return { ok: false, error: "Keep the resume to 12 education entries or fewer." }
  }
  if (Array.isArray(record.skills) && record.skills.length > 40) {
    return { ok: false, error: "Keep the resume to 40 skills or fewer." }
  }
  const parsed = resumeDataSchema.safeParse(shapeFromUnknown(input, false))
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the resume fields. A value is missing, too long, or in the wrong format.",
    }
  }
  const data = cleanResume(parsed.data)
  if (data.email && !z.email().safeParse(data.email).success) {
    return { ok: false, error: "Enter a valid contact email, or leave it blank." }
  }
  return { ok: true, data }
}

export function asStatus(value: string): "draft" | "confirmed" {
  return value === "confirmed" ? "confirmed" : "draft"
}

export function asParseSource(value: string): ParseSource {
  if (value === "gemini" || value === "groq") return value
  return "fallback"
}
