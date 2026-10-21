import { redirect } from "next/navigation"
import { ShellFrame } from "@/components/shell-frame"
import { requireUser } from "@/lib/session"

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  if (!user) redirect("/login")
  return <ShellFrame user={user}>{children}</ShellFrame>
}
