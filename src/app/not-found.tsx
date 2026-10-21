import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4">
      <p className="font-heading text-2xl text-primary">TalentBridge</p>
      <h1 className="mt-4 font-heading text-4xl tracking-tight">That page isn&apos;t here.</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        The link may be old. Head back to your profile, or log in if you still need to.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/dashboard" className={cn(buttonVariants(), "h-10 px-4")}>
          Go to your profile
        </Link>
        <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "h-10 px-4")}>
          Log in
        </Link>
      </div>
    </main>
  )
}
