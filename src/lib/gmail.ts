import { SignJWT, jwtVerify } from "jose"
import { appOrigin } from "@/lib/origin"

export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send"
export const GMAIL_READ_SCOPE = "https://www.googleapis.com/auth/gmail.metadata"
export const GMAIL_SCOPES = [GMAIL_SEND_SCOPE, GMAIL_READ_SCOPE]

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const TOKEN_URL = "https://oauth2.googleapis.com/token"

export class GmailError extends Error {
  status: number
  code: string

  constructor(message: string, status: number, code: string) {
    super(message)
    this.name = "GmailError"
    this.status = status
    this.code = code
  }
}

export function gmailConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

export function gmailRedirectUri(request: Request) {
  const override = process.env.GOOGLE_REDIRECT_URI?.trim()
  if (override) return override
  return `${appOrigin(request)}/api/gmail/callback`
}

function clientId() {
  const value = process.env.GOOGLE_CLIENT_ID?.trim()
  if (!value) throw new GmailError("Gmail isn't configured on this server.", 503, "unconfigured")
  return value
}

function clientSecret() {
  const value = process.env.GOOGLE_CLIENT_SECRET?.trim()
  if (!value) throw new GmailError("Gmail isn't configured on this server.", 503, "unconfigured")
  return value
}

function stateKey() {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 16) {
    throw new GmailError("AUTH_SECRET must be set before Gmail can connect.", 500, "config")
  }
  return new TextEncoder().encode(secret)
}

export async function signGmailState(userId: string) {
  return new SignJWT({ purpose: "gmail-connect" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(stateKey())
}

export async function readGmailState(state: string) {
  try {
    const { payload } = await jwtVerify(state, stateKey())
    if (payload.purpose !== "gmail-connect" || !payload.sub) return null
    return payload.sub
  } catch {
    return null
  }
}

export function googleAuthUrl(state: string, redirectUri: string) {
  const url = new URL(AUTH_URL)
  url.searchParams.set("client_id", clientId())
  url.searchParams.set("redirect_uri", redirectUri)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", GMAIL_SCOPES.join(" "))
  url.searchParams.set("access_type", "offline")
  url.searchParams.set("prompt", "consent")
  url.searchParams.set("include_granted_scopes", "true")
  url.searchParams.set("state", state)
  return url
}

export type GoogleToken = {
  accessToken: string
  refreshToken: string | null
  expiresAt: Date
  scopes: string
}

type TokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  error?: string
  error_description?: string
}

async function postToken(body: URLSearchParams): Promise<TokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  const payload = (await response.json().catch(() => null)) as TokenResponse | null
  if (!response.ok || !payload?.access_token) {
    const reason = payload?.error || "token_exchange_failed"
    if (reason === "invalid_grant") {
      throw new GmailError(
        "This Gmail connection expired. Testing-mode access lasts about 7 days. Connect Gmail again.",
        401,
        "expired",
      )
    }
    throw new GmailError(
      payload?.error_description || "Google didn't complete the Gmail connection.",
      response.status || 502,
      reason,
    )
  }
  return payload
}

function tokenFromPayload(payload: TokenResponse, refreshFallback: string | null): GoogleToken {
  const scopes = payload.scope || ""
  if (!scopes.includes(GMAIL_SEND_SCOPE) || !scopes.includes(GMAIL_READ_SCOPE)) {
    throw new GmailError(
      "Google didn't grant both sending and reading mail. Connect again and allow both permissions.",
      403,
      "scope",
    )
  }
  const expiresIn = payload.expires_in && payload.expires_in > 0 ? payload.expires_in : 3600
  return {
    accessToken: payload.access_token!,
    refreshToken: payload.refresh_token || refreshFallback,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
    scopes,
  }
}

export async function exchangeCode(code: string, redirectUri: string) {
  const payload = await postToken(
    new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  )
  return tokenFromPayload(payload, payload.refresh_token || null)
}

export async function refreshAccessToken(refreshToken: string) {
  const payload = await postToken(
    new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: "refresh_token",
    }),
  )
  return tokenFromPayload(payload, refreshToken)
}

export async function gmailProfileEmail(accessToken: string) {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const payload = (await response.json().catch(() => null)) as { emailAddress?: string; error?: { message?: string } } | null
  if (!response.ok || !payload?.emailAddress) {
    throw new GmailError(payload?.error?.message || "Google didn't return the Gmail address.", response.status || 502, "profile")
  }
  return payload.emailAddress
}

export async function revokeToken(token: string) {
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  }).catch(() => undefined)
}

function headerValue(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim()
}

function wrapBase64(value: string) {
  return value.replace(/.{1,76}/g, "$&\r\n").trim()
}

export function safeAttachmentName(name: string) {
  const cleaned = headerValue(name).replace(/[^\w.\- ()]+/g, "_").slice(0, 120)
  return cleaned || "resume"
}

export function buildRawMessage(input: {
  from: string
  to: string
  subject: string
  text: string
  fileName: string
  mimeType: string
  bytes: Uint8Array
}) {
  const boundary = `tb_${crypto.randomUUID().replace(/-/g, "")}`
  const fileName = safeAttachmentName(input.fileName)
  const subject = `=?UTF-8?B?${Buffer.from(headerValue(input.subject), "utf8").toString("base64")}?=`
  const mime = [
    `From: ${headerValue(input.from)}`,
    `To: ${headerValue(input.to)}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(Buffer.from(input.text, "utf8").toString("base64")),
    `--${boundary}`,
    `Content-Type: ${headerValue(input.mimeType) || "application/octet-stream"}; name="${fileName}"`,
    `Content-Disposition: attachment; filename="${fileName}"`,
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(Buffer.from(input.bytes).toString("base64")),
    `--${boundary}--`,
    "",
  ].join("\r\n")
  return Buffer.from(mime).toString("base64url")
}

export function addressFromHeader(value: string) {
  const match = value.match(/<([^>]+)>/)
  return (match?.[1] || value).trim().toLowerCase()
}

export type ThreadMessage = {
  from: string
  snippet: string
}

export function classifyThread(messages: ThreadMessage[], accountEmail: string): {
  replyStatus: "waiting" | "replied"
  replyFrom: string
  replySnippet: string
} {
  const mine = accountEmail.trim().toLowerCase()
  const inbound = messages.filter((message) => addressFromHeader(message.from) !== mine)
  const reply = inbound[0]
  if (!reply) return { replyStatus: "waiting", replyFrom: "", replySnippet: "" }
  return {
    replyStatus: "replied",
    replyFrom: headerValue(reply.from).slice(0, 200),
    replySnippet: reply.snippet.replace(/\s+/g, " ").trim().slice(0, 280),
  }
}

type GmailThread = {
  messages?: Array<{
    snippet?: string
    payload?: { headers?: Array<{ name?: string; value?: string }> }
  }>
  error?: { message?: string; status?: string }
}

export async function sendGmailMessage(accessToken: string, raw: string) {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  })
  const payload = (await response.json().catch(() => null)) as {
    id?: string
    threadId?: string
    error?: { message?: string; status?: string }
  } | null
  if (!response.ok || !payload?.id || !payload.threadId) {
    const reason = payload?.error?.status || "send_failed"
    const message =
      response.status === 403
        ? "Google didn't allow sending. Connect Gmail again and allow sending mail."
        : payload?.error?.message || "Gmail didn't accept the message."
    throw new GmailError(message, response.status || 502, reason)
  }
  return { id: payload.id, threadId: payload.threadId }
}

export async function readGmailThread(accessToken: string, threadId: string) {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}`)
  url.searchParams.set("format", "metadata")
  url.searchParams.append("metadataHeaders", "From")
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  const payload = (await response.json().catch(() => null)) as GmailThread | null
  if (!response.ok || !payload?.messages) {
    throw new GmailError(
      payload?.error?.message || "Gmail didn't return that thread.",
      response.status || 502,
      payload?.error?.status || "thread",
    )
  }
  return payload.messages.map((message) => ({
    from: message.payload?.headers?.find((header) => header.name?.toLowerCase() === "from")?.value || "",
    snippet: message.snippet || "",
  }))
}
