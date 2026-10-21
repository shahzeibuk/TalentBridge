import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ShellFrame({
  user,
  children,
}: {
  user: { email: string; name: string }
  children: React.ReactNode
}) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <Link href="/dashboard" className="font-heading text-2xl tracking-tight text-primary">
            TalentBridge
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <p className="max-w-40 truncate text-sm text-muted-foreground sm:max-w-xs">{user.email}</p>
            <Link href="/dashboard" className={cn(buttonVariants({ variant: "ghost" }))}>
              Dashboard
            </Link>
            <Link href="/resumes/new" className={cn(buttonVariants({ variant: "outline" }))}>
              Upload
            </Link>
            <form action="/api/logout" method="post">
              <Button type="submit" variant="ghost">
                Log out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">{children}</div>
    </div>
  )
}
