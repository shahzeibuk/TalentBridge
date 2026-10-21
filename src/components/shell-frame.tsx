"use client"

import Link from "next/link"
import { useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { Menu, X } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { workspaceNav, workspaceSection, workspaceTitle } from "@/lib/admin-nav"
import { cn } from "@/lib/utils"

export function ShellFrame({
  user,
  children,
}: {
  user: { email: string; name: string }
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const section = workspaceSection(pathname, searchParams)
  const title = workspaceTitle(pathname, section)
  const [menuOpen, setMenuOpen] = useState(false)
  const initial = user.name.trim().slice(0, 1).toUpperCase() || "T"

  return (
    <div className="min-h-dvh bg-muted/40 lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      {menuOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-foreground/40 lg:hidden"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-foreground text-background lg:static lg:z-auto",
          menuOpen ? "flex" : "hidden lg:flex",
        )}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <Link href="/dashboard?tab=overview" className="font-heading text-2xl tracking-tight" onClick={() => setMenuOpen(false)}>
            TalentBridge
          </Link>
          <button type="button" className="lg:hidden" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
            <X className="size-5" />
          </button>
        </div>
        <p className="px-4 pb-2 text-xs font-medium tracking-wide text-background/60 uppercase">Workspace</p>
        <nav className="flex flex-col gap-1 px-2" aria-label="Workspace">
          {workspaceNav.map((item) => {
            const active = item.id === section
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "flex h-9 items-center rounded-lg px-3 text-sm",
                  active ? "bg-background font-medium text-foreground" : "text-background/80 hover:bg-background/10",
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="mt-auto border-t border-background/15 p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background/15 text-sm font-medium">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-background/70">{user.email}</p>
            </div>
          </div>
          <form action="/api/logout" method="post" className="mt-3">
            <button type="submit" className="text-sm text-background/80 hover:text-background">
              Log out
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-card px-4">
          <button type="button" className="lg:hidden" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            <Menu className="size-5" />
          </button>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Workspace</p>
            <p className="truncate text-sm font-medium">{title}</p>
          </div>
          <Link href="/resumes/new" className={cn(buttonVariants({ variant: "outline" }), "ml-auto h-9 px-3")}>
            Upload resume
          </Link>
        </header>
        <div className="px-4 py-6 lg:px-6">{children}</div>
      </div>
    </div>
  )
}
