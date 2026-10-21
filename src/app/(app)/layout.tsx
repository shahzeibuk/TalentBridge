import { Suspense, type ReactNode } from "react"
import { AppShell } from "@/components/app-shell"
import { LoadingBlock } from "@/components/status-block"

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-4 py-10">
          <LoadingBlock label="Opening your account…" />
        </div>
      }
    >
      <AppShell>{children}</AppShell>
    </Suspense>
  )
}
