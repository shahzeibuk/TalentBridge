import Link from "next/link"
import { Briefcase, FileText, Inbox, ListChecks, Mail, UserRound } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const features = [
  {
    icon: FileText,
    title: "Resumes",
    body: "Upload a PDF or DOCX under 4 MB. Keep more than one. Review the name, roles, education, and skills read from the file before you confirm.",
  },
  {
    icon: UserRound,
    title: "Profile",
    body: "Confirming a resume copies those fields onto your profile. Editing a resume later updates that resume only. “Set as my profile” copies it again.",
  },
  {
    icon: Briefcase,
    title: "Job postings",
    body: "Paste one posting link, or a page that lists openings. TalentBridge saves the title, company, and description on your account. If the page can’t be read, paste the description yourself.",
  },
  {
    icon: ListChecks,
    title: "ATS tailoring",
    body: "A draft lines up keywords and phrasing the source resume already supports. Keywords the posting asks for that aren’t in the resume are left out. Employers, titles, dates, and degrees stay as you saved them.",
  },
  {
    icon: Mail,
    title: "Gmail",
    body: "Connect the Gmail account the message should come from, then send a cover letter and a saved resume to the contact on a posting. Replies are read only on threads this app started.",
  },
  {
    icon: Inbox,
    title: "Applications",
    body: "Each send lives in a mailbox: Compose, Inbox, Sent, and Drafts. Open a message to see the letter, the attached resume, and whether that thread has a reply.",
  },
]

const steps = [
  "Create an account.",
  "Upload a resume and confirm the fields you want on your profile.",
  "Add a job posting and tailor a saved resume toward it.",
  "Send the cover letter from your Gmail and watch that thread for a reply.",
]

export const metadata = {
  description:
    "Upload a resume, import a job posting, tailor for an applicant tracking system, and send the application from your Gmail.",
}

export default function HomePage() {
  return (
    <div className="admin-theme min-h-dvh overflow-x-hidden">
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

      <main>
        <section className="relative mx-auto max-w-6xl px-4 pt-10 pb-16 sm:px-6 sm:pt-16">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,oklch(0.4_0.14_292/0.35),transparent_68%)]" />
          <div className="relative max-w-3xl">
            <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">For your own applications</p>
            <h1 className="mt-4 font-heading text-4xl leading-tight tracking-tight sm:text-6xl">
              The resume, the posting, and the email, on one account.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Upload a PDF or DOCX, review the profile TalentBridge reads from it, and keep every resume you save.
              Import a job posting, tailor a resume toward the words that posting already uses, and send the
              application from your Gmail.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className={cn(buttonVariants(), "h-11 rounded-full px-5")}>
                Create account
              </Link>
              <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "h-11 rounded-full px-5")}>
                Log in
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6" aria-labelledby="what-it-does">
          <h2 id="what-it-does" className="font-heading text-2xl tracking-tight sm:text-3xl">
            What you can do
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <li key={feature.title} className="min-w-0 rounded-2xl border border-white/8 bg-card p-5">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-white/8 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold tracking-tight">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.body}</p>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="mx-auto grid max-w-6xl gap-8 px-4 pb-20 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="min-w-0">
            <h2 className="font-heading text-2xl tracking-tight sm:text-3xl">From file to sent mail</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Nothing is saved until you confirm it. A tailored draft is a new resume you can review, not a silent
              rewrite of the original.
            </p>
          </div>
          <ol className="min-w-0 space-y-3">
            {steps.map((step, index) => (
              <li key={step} className="flex gap-4 rounded-2xl border border-white/8 bg-card px-4 py-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                  {index + 1}
                </span>
                <p className="min-w-0 pt-1 text-sm leading-6">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="rounded-3xl border border-white/10 bg-card px-5 py-8 sm:px-8">
            <h2 className="font-heading text-3xl tracking-tight">Start with the resume you already have.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Your files, postings, and sent applications stay on the account you create. Log in returns you to the
              same workspace.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className={cn(buttonVariants(), "h-11 rounded-full px-5")}>
                Create account
              </Link>
              <Link href="/login" className={cn(buttonVariants({ variant: "ghost" }), "h-11 rounded-full px-5")}>
                Log in
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
