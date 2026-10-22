import { Suspense, type ReactNode } from "react"
import { AppShell } from "@/components/app-shell"
import { LoadingBlock } from "@/components/status-block"

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="admin-theme relative min-h-dvh">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,oklch(0.4_0.14_292/0.35),transparent_68%)]" />
          <div className="relative mx-auto max-w-6xl px-4 py-10">
            <LoadingBlock label="Opening your account…" />
          </div>
        </div>
      }
    >
      <AppShell>{children}</AppShell>
    </Suspense>
  )
}
