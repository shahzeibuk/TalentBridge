import { prisma } from "@/lib/prisma"
import { jsonError, jsonOk } from "@/lib/responses"
import { toProfileSnapshot } from "@/lib/resume-store"
import { requireUser } from "@/lib/session"

export async function GET() {
  const user = await requireUser()
  if (!user) return jsonError("Sign in to see your profile.", 401)

  try {
    const profile = await prisma.profile.findUnique({ where: { userId: user.id } })
    return jsonOk({ profile: profile ? toProfileSnapshot(profile) : null })
  } catch (error) {
    console.error("profile load failed", error)
    return jsonError("We couldn't load your profile. Try again in a moment.", 500)
  }
}
