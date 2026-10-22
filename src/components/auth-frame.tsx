import type { ReactNode } from "react"
import { MarketingHeader } from "@/components/marketing-header"

/** Login and signup layout, using the same dark theme as the landing page. */
export function AuthFrame({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <div className="admin-theme min-h-dvh overflow-x-hidden">
      <MarketingHeader />
      <main className="relative mx-auto max-w-6xl px-4 pt-10 pb-16 sm:px-6 sm:pt-16">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,oklch(0.4_0.14_292/0.35),transparent_68%)]" />
        <div className="relative grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,28rem)]">
          <div className="max-w-xl">
            <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">For your own applications</p>
            <h1 className="mt-4 font-heading text-4xl leading-tight tracking-tight sm:text-5xl">{title}</h1>
            <p className="mt-5 text-base leading-7 text-muted-foreground">{subtitle}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-card px-5 py-8 sm:px-8">
            {children}
            <div className="mt-6 text-sm text-muted-foreground">{footer}</div>
          </div>
        </div>
      </main>
    </div>
  )
}
