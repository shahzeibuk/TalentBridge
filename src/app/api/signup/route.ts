import { hash } from "bcryptjs"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { jsonError, jsonOk } from "@/lib/responses"
import { createSession } from "@/lib/session"

const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80, "Use a name under 80 characters."),
  email: z.email("Enter a valid email."),
  password: z.string().min(8, "Use at least 8 characters.").max(200, "Use a shorter password."),
})

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError("Send your name, email, and password as JSON.", 400)
  }

  const parsed = signupSchema.safeParse({
    name: typeof body === "object" && body && "name" in body ? String((body as { name: unknown }).name) : "",
    email:
      typeof body === "object" && body && "email" in body
        ? String((body as { email: unknown }).email).trim().toLowerCase()
        : "",
    password: typeof body === "object" && body && "password" in body ? String((body as { password: unknown }).password) : "",
  })

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Check the signup form and try again.", 400)
  }

  try {
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash: await hash(parsed.data.password, 10),
      },
      select: { id: true, email: true, name: true },
    })
    await createSession(user)
    return jsonOk({ user }, 201)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError("An account with that email already exists. Log in instead.", 409)
    }
    console.error("signup failed", error)
    return jsonError("We couldn't create the account. Try again in a moment.", 500)
  }
}
