"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { ApplicationsPanel } from "@/components/applications-panel"
import { JobsPanel } from "@/components/jobs-panel"
import { ResumeDetails } from "@/components/resume-details"
import { ErrorBlock, LoadingBlock } from "@/components/status-block"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatWhen } from "@/lib/format"
import { ApiError, api } from "@/lib/http"
import type { ProfileSnapshot, ResumeListItem } from "@/lib/resume-data"
import { cn } from "@/lib/utils"

function sourceLabel(source: ResumeListItem["parseSource"]) {
  if (source === "gemini") return "Gemini"
  if (source === "groq") return "Groq"
  return "Local fallback"
}

export function DashboardScreen() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [profile, setProfile] = useState<ProfileSnapshot | null>(null)
  const [resumes, setResumes] = useState<ResumeListItem[]>([])
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [error, setError] = useState("")
  const [target, setTarget] = useState<ResumeListItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setStatus("loading")
    setError("")
    try {
      const [profileResponse, resumeResponse] = await Promise.all([
        api<{ profile: ProfileSnapshot | null }>("/api/profile"),
        api<{ resumes: ResumeListItem[] }>("/api/resumes"),
      ])
      setProfile(profileResponse.profile)
      setResumes(resumeResponse.resumes)
      setStatus("ready")
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login")
        return
      }
      setError(caught instanceof Error ? caught.message : "We couldn't load your dashboard.")
      setStatus("error")
    }
  }, [router])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  async function remove() {
    if (!target) return
    setDeleting(true)
    try {
      await api(`/api/resumes/${target.id}`, { method: "DELETE" })
      toast.success("Resume deleted. Your profile snapshot was left as it is.")
      setTarget(null)
      await load()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "We couldn't delete the resume.")
    } finally {
      setDeleting(false)
    }
  }

  const notice =
    searchParams.get("saved") === "1"
      ? "Resume saved. Your profile snapshot now matches it."
      : searchParams.get("profile") === "1"
        ? "Profile snapshot replaced with that resume."
        : ""
  const sourceName = resumes.find((resume) => resume.id === profile?.sourceResumeId)?.fileName

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-4xl tracking-tight">Dashboard</h1>
          <p className="mt-2 max-w-xl text-base leading-7 text-muted-foreground">
            Your profile snapshot, saved resumes, job postings, and applications sent from Gmail.
          </p>
        </div>
        <Link href="/resumes/new" className={cn(buttonVariants(), "h-10 px-4")}>
          Upload a resume
        </Link>
      </div>

      {notice ? (
        <Alert>
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}

      {status === "loading" ? <LoadingBlock label="Loading your profile and resumes…" /> : null}
      {status === "error" ? <ErrorBlock message={error} onRetry={() => void load()} /> : null}

      {status === "ready" ? (
        <>
          <ApplicationsPanel resumes={resumes} />

          <section className="space-y-4">
            <div>
              <h2 className="font-heading text-3xl tracking-tight">Your profile</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                This snapshot updates when you confirm a resume or choose Set as my profile.
              </p>
            </div>
            <div className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10 sm:p-7">
            {profile ? (
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  {sourceName
                    ? `Snapshot from ${sourceName}, updated ${formatWhen(profile.updatedAt)}.`
                    : `Snapshot updated ${formatWhen(profile.updatedAt)}.`}
                </p>
                <ResumeDetails data={profile} />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
                <h3 className="font-heading text-2xl">No profile yet</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  Confirm a resume and TalentBridge copies the name, contact details, jobs, education, and skills here.
                </p>
              </div>
            )}
            </div>
          </section>

          <div className="grid min-w-0 items-start gap-10 lg:grid-cols-2">
          <section className="min-w-0 space-y-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-heading text-3xl tracking-tight">Resumes</h2>
              <p className="text-sm text-muted-foreground">
                {resumes.length === 0 ? "None yet" : `${resumes.length} saved`}
              </p>
            </div>
            {resumes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-10 text-center">
                <h3 className="font-heading text-2xl">No resumes yet</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  Upload a PDF or DOCX. You&apos;ll correct every field before it touches your profile.
                </p>
                <Link href="/resumes/new" className={cn(buttonVariants({ variant: "outline" }), "mt-5 h-10 px-4")}>
                  Upload a resume
                </Link>
              </div>
            ) : (
              <ul className="space-y-3">
                {resumes.map((resume) => (
                  <li
                    key={resume.id}
                    className="flex min-w-0 flex-col gap-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{resume.fullName || resume.fileName}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {resume.fileName} · Updated {formatWhen(resume.updatedAt)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant={resume.status === "confirmed" ? "default" : "outline"}>
                          {resume.status === "confirmed" ? "Saved" : "Needs review"}
                        </Badge>
                        <Badge variant={resume.parseSource === "fallback" ? "secondary" : "outline"}>
                          {sourceLabel(resume.parseSource)}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {resume.status === "draft" ? (
                        <Link href={`/resumes/${resume.id}/review`} className={cn(buttonVariants(), "h-9 px-3")}>
                          Review
                        </Link>
                      ) : (
                        <>
                          <Link
                            href={`/resumes/${resume.id}`}
                            className={cn(buttonVariants({ variant: "outline" }), "h-9 px-3")}
                          >
                            View
                          </Link>
                          <Link
                            href={`/resumes/${resume.id}/edit`}
                            className={cn(buttonVariants({ variant: "outline" }), "h-9 px-3")}
                          >
                            Edit
                          </Link>
                        </>
                      )}
                      <Button type="button" variant="ghost" onClick={() => setTarget(resume)}>
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <JobsPanel resumes={resumes} />
          </div>
        </>
      ) : null}

      <Dialog open={target !== null} onOpenChange={(open) => { if (!open) setTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this resume?</DialogTitle>
            <DialogDescription>
              {target?.fileName} will be removed, including the original file. Your profile snapshot stays as it is.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTarget(null)}>
              Keep it
            </Button>
            <Button type="button" variant="destructive" disabled={deleting} onClick={() => void remove()}>
              {deleting ? "Deleting…" : "Delete resume"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
