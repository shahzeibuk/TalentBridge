import { jsonOk } from "@/lib/responses"
import { requireUser } from "@/lib/session"

export async function GET() {
  const user = await requireUser()
  return jsonOk({ user })
}
