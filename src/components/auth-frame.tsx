import Link from "next/link"
import type { ReactNode } from "react"

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
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <aside className="hidden flex-col justify-between bg-primary px-10 py-12 text-primary-foreground lg:flex">
        <div>
          <p className="font-heading text-3xl tracking-tight">TalentBridge</p>
          <p className="mt-10 max-w-sm font-heading text-4xl leading-tight">
            Check the resume before it becomes your profile.
          </p>
          <p className="mt-4 max-w-sm text-base leading-7 text-primary-foreground/80">
            Upload a PDF or DOCX, correct the draft, and confirm the snapshot stored with your account.
          </p>
        </div>
        <ol className="space-y-4 text-sm leading-6">
          <li>
            <span className="mr-2 font-heading text-lg">1</span>
            Upload a PDF or DOCX under 4 MB.
          </li>
          <li>
            <span className="mr-2 font-heading text-lg">2</span>
            Fix the name, jobs, education, and skills.
          </li>
          <li>
            <span className="mr-2 font-heading text-lg">3</span>
            Confirm to save the resume and refresh your profile.
          </li>
        </ol>
      </aside>
      <main className="flex flex-col justify-center px-4 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-md">
          <Link href="/" className="font-heading text-2xl tracking-tight text-primary lg:hidden">
            TalentBridge
          </Link>
          <h1 className="mt-6 font-heading text-4xl tracking-tight text-foreground">{title}</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-6 text-sm text-muted-foreground">{footer}</div>
        </div>
      </main>
    </div>
  )
}
