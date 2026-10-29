import { compare } from "bcryptjs"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { jsonError, jsonOk } from "@/lib/responses"
import { createSession } from "@/lib/session"

const loginSchema = z.object({
  email: z.email("Enter the email on your account."),
  password: z.string().min(1, "Enter your password.").max(200),
})

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError("Send your email and password as JSON.", 400)
  }

  const parsed = loginSchema.safeParse({
    email:
      typeof body === "object" && body && "email" in body
        ? String((body as { email: unknown }).email).trim().toLowerCase()
        : "",
    password: typeof body === "object" && body && "password" in body ? String((body as { password: unknown }).password) : "",
  })

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Enter your email and password.", 400)
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })
    const passwordMatches = user ? await compare(parsed.data.password, user.passwordHash) : false
    if (!user || !passwordMatches) {
      return jsonError("That email and password don't match.", 401)
    }

    await createSession({ id: user.id, email: user.email, name: user.name })
    return jsonOk({ user: { id: user.id, email: user.email, name: user.name } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return jsonError("The database is not set up yet. Ask the site owner to run migrations.", 503)
    }
    console.error("login failed", error)
    return jsonError("We couldn't log you in. Try again in a moment.", 500)
  }
}
