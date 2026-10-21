import { connection } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import {
  readSessionFromToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  sessionCookieOptions,
  signSession,
} from "@/lib/session-token"

export async function createSession(user: { id: string; email: string; name: string }) {
  const token = await signSession({ sub: user.id, email: user.email, name: user.name })
  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, sessionCookieOptions(SESSION_MAX_AGE))
}

export async function clearSession() {
  const jar = await cookies()
  jar.set(SESSION_COOKIE, "", sessionCookieOptions(0))
}

export async function requireUser() {
  await connection()
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null
  const session = await readSessionFromToken(token)
  if (!session) return null
  return prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, name: true },
  })
}
