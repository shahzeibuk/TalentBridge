import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-4 py-16">
      <p className="font-heading text-2xl text-primary">TalentBridge</p>
      <h1 className="mt-6 max-w-xl font-heading text-5xl leading-tight tracking-tight">
        A resume you can stand behind.
      </h1>
      <p className="mt-4 max-w-xl text-lg leading-8 text-muted-foreground">
        Upload a PDF or DOCX, correct the name, jobs, education, and skills, then confirm that version as your
        profile. When a posting lists a contact, connect Gmail and send your cover letter and resume from your own
        account.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/signup" className={cn(buttonVariants(), "h-10 px-4")}>
          Create account
        </Link>
        <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "h-10 px-4")}>
          Log in
        </Link>
      </div>
    </main>
  )
}
