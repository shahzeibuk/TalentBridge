import { NextResponse } from "next/server"
import { connectGmail } from "@/lib/application-mail"
import { exchangeCode, GmailError, gmailRedirectUri, readGmailState } from "@/lib/gmail"
import { appOrigin } from "@/lib/origin"
import { requireUser } from "@/lib/session"

function back(request: Request, code: string) {
  return NextResponse.redirect(new URL(`/dashboard?gmail=${code}`, appOrigin(request)))
}

export async function GET(request: Request) {
  const user = await requireUser()
  if (!user) return NextResponse.redirect(new URL("/login", appOrigin(request)))

  const url = new URL(request.url)
  const oauthError = url.searchParams.get("error")
  if (oauthError === "access_denied") return back(request, "denied")
  if (oauthError) return back(request, "error")

  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  if (!code || !state) return back(request, "error")

  const stateUserId = await readGmailState(state)
  if (!stateUserId || stateUserId !== user.id) return back(request, "error")

  try {
    await connectGmail(user.id, await exchangeCode(code, gmailRedirectUri(request)))
    return back(request, "connected")
  } catch (error) {
    if (error instanceof GmailError && error.code === "scope") return back(request, "scope")
    console.error("gmail callback failed", error instanceof Error ? error.message : "unknown")
    return back(request, "error")
  }
}
