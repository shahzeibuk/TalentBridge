import { NextResponse } from "next/server"
import { appOrigin } from "@/lib/origin"
import { jsonOk } from "@/lib/responses"
import { clearSession } from "@/lib/session"
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session-token"

export async function POST(request: Request) {
  await clearSession()
  const contentType = request.headers.get("content-type") ?? ""
  const isForm =
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")

  if (!isForm) return jsonOk({ ok: true })

  const response = NextResponse.redirect(new URL("/login", appOrigin(request)), 303)
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0))
  return response
}
