import { prisma } from "@/lib/prisma"
import {
  asApplicationStatus,
  asReplyStatus,
  type ApplicationItem,
  type GmailAccountStatus,
} from "@/lib/application-data"
import {
  classifyThread,
  GmailError,
  gmailConfigured,
  gmailProfileEmail,
  readGmailThread,
  refreshAccessToken,
  revokeToken,
  sendGmailMessage,
  buildRawMessage,
  type GoogleToken,
} from "@/lib/gmail"
import { decryptSecret, encryptSecret } from "@/lib/secret-box"

const CHECK_FRESH_MS = 60_000

export class ApplicationError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApplicationError"
    this.status = status
  }
}

function toItem(row: {
  id: string
  company: string
  title: string
  contactEmail: string
  coverLetter: string
  subject: string
  resumeId: string | null
  status: string
  replyStatus: string
  replyFrom: string
  replySnippet: string
  sentAt: Date | null
  replyCheckedAt: Date | null
  lastError: string
  createdAt: Date
  updatedAt: Date
  resume: { fileName: string } | null
}): ApplicationItem {
  return {
    id: row.id,
    company: row.company,
    title: row.title,
    contactEmail: row.contactEmail,
    coverLetter: row.coverLetter,
    subject: row.subject,
    resumeId: row.resumeId,
    resumeFileName: row.resume?.fileName ?? null,
    status: asApplicationStatus(row.status),
    replyStatus: asReplyStatus(row.replyStatus),
    replyFrom: row.replyFrom,
    replySnippet: row.replySnippet,
    sentAt: row.sentAt?.toISOString() ?? null,
    replyCheckedAt: row.replyCheckedAt?.toISOString() ?? null,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

const listSelect = {
  id: true,
  company: true,
  title: true,
  contactEmail: true,
  coverLetter: true,
  subject: true,
  resumeId: true,
  status: true,
  replyStatus: true,
  replyFrom: true,
  replySnippet: true,
  sentAt: true,
  replyCheckedAt: true,
  lastError: true,
  createdAt: true,
  updatedAt: true,
  gmailThreadId: true,
  resume: { select: { fileName: true } },
} as const

async function saveToken(userId: string, email: string, token: GoogleToken) {
  if (!token.refreshToken) {
    throw new GmailError(
      "Google didn't return a refresh token. Connect again and allow both permissions.",
      502,
      "refresh",
    )
  }
  await prisma.gmailConnection.upsert({
    where: { userId },
    create: {
      userId,
      email,
      accessTokenCiphertext: encryptSecret(token.accessToken),
      refreshTokenCiphertext: encryptSecret(token.refreshToken),
      accessTokenExpiresAt: token.expiresAt,
      scopes: token.scopes,
    },
    update: {
      email,
      accessTokenCiphertext: encryptSecret(token.accessToken),
      refreshTokenCiphertext: encryptSecret(token.refreshToken),
      accessTokenExpiresAt: token.expiresAt,
      scopes: token.scopes,
    },
  })
}

export async function connectGmail(userId: string, token: GoogleToken) {
  const email = await gmailProfileEmail(token.accessToken)
  await saveToken(userId, email, token)
  return email
}

export async function disconnectGmail(userId: string) {
  const row = await prisma.gmailConnection.findUnique({ where: { userId } })
  if (!row) return
  if (row.refreshTokenCiphertext) {
    await revokeToken(decryptSecret(row.refreshTokenCiphertext))
  }
  await prisma.gmailConnection.delete({ where: { userId } })
}

async function accessTokenFor(userId: string) {
  const row = await prisma.gmailConnection.findUnique({ where: { userId } })
  if (!row?.refreshTokenCiphertext) return null
  const fresh = row.accessTokenExpiresAt.getTime() > Date.now() + 60_000
  if (fresh) {
    return { email: row.email, accessToken: decryptSecret(row.accessTokenCiphertext) }
  }
  try {
    const token = await refreshAccessToken(decryptSecret(row.refreshTokenCiphertext))
    await saveToken(userId, row.email, token)
    return { email: row.email, accessToken: token.accessToken }
  } catch (error) {
    if (error instanceof GmailError && error.code === "expired") {
      await prisma.gmailConnection.delete({ where: { userId } }).catch(() => undefined)
    }
    throw error
  }
}

export async function gmailAccount(userId: string): Promise<GmailAccountStatus> {
  const configured = gmailConfigured()
  if (!configured) return { configured: false, connected: false, email: null, expired: false }
  try {
    const token = await accessTokenFor(userId)
    return {
      configured: true,
      connected: Boolean(token),
      email: token?.email ?? null,
      expired: false,
    }
  } catch (error) {
    if (error instanceof GmailError && error.code === "expired") {
      return { configured: true, connected: false, email: null, expired: true }
    }
    throw error
  }
}

export async function listApplications(userId: string, refresh: boolean) {
  const rows = await prisma.jobApplication.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: listSelect,
  })
  if (refresh) await refreshReplies(userId, rows)
  const fresh = refresh
    ? await prisma.jobApplication.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        select: listSelect,
      })
    : rows
  return fresh.map(toItem)
}

async function refreshReplies(
  userId: string,
  rows: Array<{
    id: string
    status: string
    replyStatus: string
    replyCheckedAt: Date | null
    gmailThreadId: string | null
  }>,
) {
  const due = rows.filter((row) => {
    if (row.status !== "sent" || !row.gmailThreadId) return false
    if (!row.replyCheckedAt) return true
    if (row.replyStatus === "check_failed") return true
    return Date.now() - row.replyCheckedAt.getTime() > CHECK_FRESH_MS
  })
  if (due.length === 0) return
  let account: { email: string; accessToken: string } | null = null
  try {
    account = await accessTokenFor(userId)
  } catch (error) {
    if (error instanceof GmailError && error.code === "expired") return
    throw error
  }
  if (!account) return
  const token = account
  let cursor = 0
  async function worker() {
    for (;;) {
      const current = cursor
      cursor += 1
      if (current >= due.length) return
      const row = due[current]
      if (!row?.gmailThreadId) continue
      try {
        const messages = await readGmailThread(token.accessToken, row.gmailThreadId)
        const result = classifyThread(messages, token.email)
        await prisma.jobApplication.updateMany({
          where: { id: row.id, userId },
          data: {
            replyStatus: result.replyStatus,
            replyFrom: result.replyFrom,
            replySnippet: result.replySnippet,
            replyCheckedAt: new Date(),
            lastError: "",
          },
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Couldn't check this thread."
        await prisma.jobApplication.updateMany({
          where: { id: row.id, userId },
          data: {
            replyStatus: "check_failed",
            replyCheckedAt: new Date(),
            lastError: message,
          },
        })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, due.length) }, () => worker()))
}

export async function createAndSend(
  userId: string,
  input: {
    company: string
    title: string
    contactEmail: string
    resumeId: string
    coverLetter: string
    subject: string
  },
) {
  const resume = await prisma.resume.findFirst({
    where: { id: input.resumeId, userId },
    select: { id: true },
  })
  if (!resume) throw new ApplicationError("Choose a resume from your account.", 404)

  const created = await prisma.jobApplication.create({
    data: {
      userId,
      resumeId: resume.id,
      company: input.company,
      title: input.title,
      contactEmail: input.contactEmail,
      coverLetter: input.coverLetter,
      subject: input.subject,
      status: "draft",
      replyStatus: "unsent",
    },
    select: { id: true },
  })
  return sendSavedApplication(userId, created.id)
}

export async function sendSavedApplication(userId: string, applicationId: string) {
  const row = await prisma.jobApplication.findFirst({
    where: { id: applicationId, userId },
    include: { resume: true },
  })
  if (!row) throw new ApplicationError("That application isn't on your account.", 404)
  if (row.status === "sent") throw new ApplicationError("That message was already sent.", 409)
  if (!row.resume) {
    throw new ApplicationError("That resume is no longer on your account. Attach another one before sending.", 422)
  }

  let account: { email: string; accessToken: string } | null
  try {
    account = await accessTokenFor(userId)
  } catch (error) {
    const message = error instanceof GmailError ? error.message : "Connect Gmail before sending."
    await markSendFailed(userId, row.id, message)
    throw new ApplicationError(message, error instanceof GmailError ? error.status : 409)
  }
  if (!account) {
    const message = "Connect Gmail before sending. The message goes out from your account."
    await markSendFailed(userId, row.id, message)
    throw new ApplicationError(message, 409)
  }

  try {
    const raw = buildRawMessage({
      from: account.email,
      to: row.contactEmail,
      subject: row.subject,
      text: row.coverLetter,
      fileName: row.resume.fileName,
      mimeType: row.resume.mimeType,
      bytes: row.resume.fileBytes,
    })
    const sent = await sendGmailMessage(account.accessToken, raw)
    await prisma.jobApplication.updateMany({
      where: { id: row.id, userId },
      data: {
        status: "sent",
        gmailMessageId: sent.id,
        gmailThreadId: sent.threadId,
        sentAt: new Date(),
        replyStatus: "waiting",
        replyFrom: "",
        replySnippet: "",
        replyCheckedAt: new Date(),
        lastError: "",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gmail didn't accept the message."
    await markSendFailed(userId, row.id, message)
    throw new ApplicationError(message, error instanceof GmailError ? error.status : 502)
  }

  const saved = await prisma.jobApplication.findFirst({
    where: { id: row.id, userId },
    select: listSelect,
  })
  if (!saved) throw new ApplicationError("That application isn't on your account.", 404)
  return toItem(saved)
}

async function markSendFailed(userId: string, id: string, message: string) {
  await prisma.jobApplication.updateMany({
    where: { id, userId, status: { not: "sent" } },
    data: { status: "send_failed", lastError: message },
  })
}

export async function deleteApplication(userId: string, applicationId: string) {
  const result = await prisma.jobApplication.deleteMany({ where: { id: applicationId, userId } })
  if (result.count === 0) throw new ApplicationError("That application isn't on your account.", 404)
}
