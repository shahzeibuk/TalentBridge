import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { appOrigin } from "@/lib/origin"
import { readSessionFromToken, SESSION_COOKIE } from "@/lib/session-token"

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const session = token ? await readSessionFromToken(token) : null
  const { pathname } = request.nextUrl
  const isProtected = pathname.startsWith("/dashboard") || pathname.startsWith("/resumes")
  const isAuthPage = pathname === "/login" || pathname === "/signup"

  if (isProtected && !session) {
    const url = new URL("/login", request.url)
    if (pathname !== "/dashboard") url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  if (isAuthPage && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  if (pathname === "/" && session) {
    return NextResponse.redirect(`${appOrigin(request)}/dashboard`)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/resumes/:path*", "/login", "/signup"],
}
