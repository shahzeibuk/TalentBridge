import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  asParseSource,
  asStatus,
  looseResumeData,
  type ProfileSnapshot,
  type ResumeData,
  type ResumeDetail,
  type ResumeListItem,
} from "@/lib/resume-data"

const detailSelect = {
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
} satisfies Prisma.ResumeSelect

type DetailRow = Prisma.ResumeGetPayload<{ select: typeof detailSelect }>

export function resumeFields(data: ResumeData): {
  fullName: string
  email: string
  phone: string
  location: string
  links: Prisma.InputJsonValue
  experience: Prisma.InputJsonValue
  education: Prisma.InputJsonValue
  skills: Prisma.InputJsonValue
} {
  return {
    fullName: data.fullName,
    email: data.email,
    phone: data.phone,
    location: data.location,
    links: data.links,
    experience: data.experience,
    education: data.education,
    skills: data.skills,
  }
}

function dataFromRow(row: {
  fullName: string
  email: string
  phone: string
  location: string
  links: Prisma.JsonValue
  experience: Prisma.JsonValue
  education: Prisma.JsonValue
  skills: Prisma.JsonValue
}): ResumeData {
  return looseResumeData({
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    location: row.location,
    links: row.links,
    experience: row.experience,
    education: row.education,
    skills: row.skills,
  })
}

export function toListItem(row: {
  id: string
  fileName: string
  status: string
  parseSource: string
  fullName: string
  updatedAt: Date
  createdAt: Date
}): ResumeListItem {
  return {
    id: row.id,
    fileName: row.fileName,
    status: asStatus(row.status),
    parseSource: asParseSource(row.parseSource),
    fullName: row.fullName,
    updatedAt: row.updatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }
}

export function toResumeDetail(row: DetailRow): ResumeDetail {
  return {
    ...toListItem(row),
    mimeType: row.mimeType,
    parseNote: row.parseNote,
    extractedText: row.extractedText,
    ...dataFromRow(row),
  }
}

export function toProfileSnapshot(row: {
  fullName: string
  email: string
  phone: string
  location: string
  links: Prisma.JsonValue
  experience: Prisma.JsonValue
  education: Prisma.JsonValue
  skills: Prisma.JsonValue
  sourceResumeId: string | null
  updatedAt: Date
}): ProfileSnapshot {
  return {
    ...dataFromRow(row),
    sourceResumeId: row.sourceResumeId,
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function findOwnedResume(userId: string, id: string) {
  return prisma.resume.findFirst({
    where: { id, userId },
    select: detailSelect,
  })
}

export async function saveResumeFields(userId: string, id: string, data: ResumeData, status?: "draft" | "confirmed") {
  const result = await prisma.resume.updateMany({
    where: { id, userId },
    data: {
      ...resumeFields(data),
      ...(status ? { status } : {}),
    },
  })
  return result.count === 1
}

export async function copyResumeToProfile(userId: string, resumeId: string, data: ResumeData) {
  await prisma.$transaction(async (tx) => {
    const updated = await tx.resume.updateMany({
      where: { id: resumeId, userId },
      data: {
        ...resumeFields(data),
        status: "confirmed",
      },
    })
    if (updated.count !== 1) {
      throw new Error("NOT_FOUND")
    }
    await tx.profile.upsert({
      where: { userId },
      create: {
        userId,
        sourceResumeId: resumeId,
        ...resumeFields(data),
      },
      update: {
        sourceResumeId: resumeId,
        ...resumeFields(data),
      },
    })
  })
}
