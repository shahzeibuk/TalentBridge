import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Public header shared by the landing page and the login and signup screens. */
export function MarketingHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
      <Link href="/" className="flex min-w-0 items-center gap-2 text-base font-semibold tracking-tight">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm text-primary-foreground">
          T
        </span>
        TalentBridge
      </Link>
      <nav className="ml-auto flex flex-wrap items-center gap-2" aria-label="Account">
        <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "h-9 rounded-full px-4")}>
          Log in
        </Link>
        <Link href="/signup" className={cn(buttonVariants(), "h-9 rounded-full px-4")}>
          Create account
        </Link>
      </nav>
    </header>
  )
}
