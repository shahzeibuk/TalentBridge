import { NextResponse } from "next/server"
import { gmailConfigured, gmailRedirectUri, googleAuthUrl, signGmailState } from "@/lib/gmail"
import { appOrigin } from "@/lib/origin"
import { requireUser } from "@/lib/session"

export async function GET(request: Request) {
  const user = await requireUser()
  const origin = appOrigin(request)
  if (!user) return NextResponse.redirect(new URL("/login", origin))
  if (!gmailConfigured()) {
    return NextResponse.redirect(new URL("/dashboard?gmail=unconfigured", origin))
  }
  const state = await signGmailState(user.id)
  return NextResponse.redirect(googleAuthUrl(state, gmailRedirectUri(request)))
}
