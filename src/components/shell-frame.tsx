"use client"

import Link from "next/link"
import { useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { Briefcase, FileText, KeyRound, LayoutDashboard, LogOut, Menu, Send, UserRound, X } from "lucide-react"
import { AdminUserProvider } from "@/components/admin-user"
import { buttonVariants } from "@/components/ui/button"
import { workspaceNav, workspaceSection, workspaceTitle, type WorkspaceSection } from "@/lib/admin-nav"
import { cn } from "@/lib/utils"

const navIcons: Record<WorkspaceSection, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  profile: UserRound,
  resumes: FileText,
  jobs: Briefcase,
  applications: Send,
  ai: KeyRound,
}

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
    <AdminUserProvider user={user}>
      <div className="admin-theme min-h-dvh lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
        {menuOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/60 lg:hidden"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
        ) : null}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-white/8 bg-[oklch(0.14_0.03_285)] print:hidden lg:static lg:z-auto",
            menuOpen ? "flex" : "hidden lg:flex",
          )}
        >
          <div className="flex items-center justify-between px-4 py-5">
            <Link
              href="/dashboard?tab=overview"
              className="flex items-center gap-2 text-base font-semibold tracking-tight"
              onClick={() => setMenuOpen(false)}
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm text-primary-foreground">
                T
              </span>
              TalentBridge
            </Link>
            <button type="button" className="lg:hidden" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
              <X className="size-5" />
            </button>
          </div>
          <p className="px-5 pb-2 text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">Menu</p>
          <nav className="flex flex-col gap-1 px-3" aria-label="Workspace">
            {workspaceNav.map((item) => {
              const active = item.id === section
              const Icon = navIcons[item.id]
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-xl px-3 text-sm",
                    active ? "bg-white/10 font-medium text-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
          <form action="/api/logout" method="post" className="mt-auto border-t border-white/8 p-3">
            <button
              type="submit"
              className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground"
            >
              <LogOut className="size-4" />
              Log out
            </button>
          </form>
        </aside>
        <div className="relative min-w-0">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,oklch(0.4_0.14_292/0.35),transparent_68%)] print:hidden" />
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/8 bg-background/80 px-4 backdrop-blur print:hidden">
            <button type="button" className="lg:hidden" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
              <Menu className="size-5" />
            </button>
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-medium">
                {initial}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <p className="ml-4 hidden text-sm text-muted-foreground sm:block">{title}</p>
            <Link href="/resumes/new" className={cn(buttonVariants(), "ml-auto h-9 rounded-full px-4")}>
              Upload resume
            </Link>
          </header>
          <div className="relative px-4 py-6 lg:px-6">{children}</div>
        </div>
      </div>
    </AdminUserProvider>
  )
}
