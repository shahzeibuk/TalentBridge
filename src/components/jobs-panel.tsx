"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ErrorBlock, LoadingBlock } from "@/components/status-block"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatWhen } from "@/lib/format"
import { ApiError, api } from "@/lib/http"
import type { JobPostingItem } from "@/lib/job-data"
import type { ResumeListItem } from "@/lib/resume-data"

const emptyManual = { title: "", company: "", description: "", sourceUrl: "" }

export function JobsPanel({ resumes }: { resumes: ResumeListItem[] }) {
  const router = useRouter()
  const [jobs, setJobs] = useState<JobPostingItem[]>([])
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [error, setError] = useState("")
  const [url, setUrl] = useState("")
  const [importing, setImporting] = useState(false)
  const [scrapeError, setScrapeError] = useState("")
  const [manualOpen, setManualOpen] = useState(false)
  const [manual, setManual] = useState(emptyManual)
  const [saving, setSaving] = useState(false)
  const [tailorJob, setTailorJob] = useState<JobPostingItem | null>(null)
  const [resumeId, setResumeId] = useState("")
  const [tailoring, setTailoring] = useState(false)

  const load = useCallback(async () => {
    setError("")
    try {
      const result = await api<{ jobs: JobPostingItem[] }>("/api/jobs")
      setJobs(result.jobs)
      setStatus("ready")
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login")
        return
      }
      setError(caught instanceof Error ? caught.message : "We couldn't load your job postings.")
      setStatus("error")
    }
  }, [router])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  function showManual(partial?: { title?: string; company?: string; description?: string; url?: string }) {
    setManual({
      title: partial?.title || "",
      company: partial?.company || "",
      description: partial?.description || "",
      sourceUrl: partial?.url || url,
    })
    setManualOpen(true)
  }

  async function importUrl() {
    setScrapeError("")
    if (!url.trim()) {
      setScrapeError("Paste a job posting URL.")
      return
    }
    setImporting(true)
    try {
      await api("/api/jobs/import", { method: "POST", body: JSON.stringify({ url: url.trim() }) })
      setUrl("")
      toast.success("Job posting saved from that page.")
      await load()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "We couldn't read that page."
      setScrapeError(message)
      const scrape = caught instanceof ApiError ? caught.details?.scrape : null
      const partial = scrape && typeof scrape === "object" ? (scrape as { title?: string; company?: string; description?: string; url?: string }) : undefined
      showManual(partial)
      toast.error(message)
    } finally {
      setImporting(false)
    }
  }

  async function saveManual() {
    setSaving(true)
    try {
      await api("/api/jobs", {
        method: "POST",
        body: JSON.stringify({
          title: manual.title.trim(),
          company: manual.company.trim(),
          description: manual.description.trim(),
          sourceUrl: manual.sourceUrl.trim(),
        }),
      })
      setManual(emptyManual)
      setManualOpen(false)
      setScrapeError("")
      setUrl("")
      toast.success("Job posting saved.")
      await load()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "We couldn't save that job posting.")
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    try {
      await api(`/api/jobs/${id}`, { method: "DELETE" })
      toast.success("Job posting removed.")
      await load()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "We couldn't remove that job posting.")
    }
  }

  async function tailor() {
    if (!tailorJob) return
    if (!resumeId) {
      toast.error("Choose a resume to tailor.")
      return
    }
    setTailoring(true)
    try {
      const result = await api<{ resume: { id: string } }>(`/api/jobs/${tailorJob.id}/tailor`, {
        method: "POST",
        body: JSON.stringify({ resumeId }),
      })
      setTailorJob(null)
      router.push(`/resumes/${result.resume.id}/review`)
      router.refresh()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "We couldn't tailor that resume.")
      setTailoring(false)
    }
  }

  return (
    <section className="min-w-0 space-y-4">
      <div>
        <h2 className="font-heading text-3xl tracking-tight">Job postings</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Paste a posting URL. TalentBridge reads that page for the title, company, and description, and keeps it on
          your account.
        </p>
      </div>

      <form
        className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5"
        onSubmit={(event) => {
          event.preventDefault()
          void importUrl()
        }}
      >
        <Label htmlFor="jobUrl">Job posting URL</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="jobUrl"
            className="h-10"
            type="url"
            placeholder="https://company.example/jobs/designer"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
          <Button type="submit" className="h-10" disabled={importing}>
            {importing ? "Reading the page…" : "Add from URL"}
          </Button>
        </div>
        {scrapeError ? (
          <Alert variant="destructive">
            <AlertTitle>Couldn&apos;t read that page</AlertTitle>
            <AlertDescription>{scrapeError} The form below is ready for the text from the posting.</AlertDescription>
          </Alert>
        ) : null}
        <button
          type="button"
          className="text-sm font-medium text-foreground underline underline-offset-4"
          onClick={() => showManual()}
        >
          Paste the job description instead
        </button>
      </form>

      {manualOpen ? (
        <form
          className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5"
          onSubmit={(event) => {
            event.preventDefault()
            void saveManual()
          }}
        >
          <h3 className="font-heading text-2xl">Add the posting yourself</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="manualTitle">Job title</Label>
              <Input id="manualTitle" className="h-10" value={manual.title} onChange={(event) => setManual({ ...manual, title: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manualCompany">Company</Label>
              <Input id="manualCompany" className="h-10" value={manual.company} onChange={(event) => setManual({ ...manual, company: event.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="manualDescription">Job description</Label>
            <Textarea
              id="manualDescription"
              className="min-h-36"
              value={manual.description}
              onChange={(event) => setManual({ ...manual, description: event.target.value })}
              placeholder="Paste the full posting, including requirements."
            />
          </div>
          <Button type="submit" className="h-10" disabled={saving}>
            {saving ? "Saving…" : "Save job posting"}
          </Button>
        </form>
      ) : null}

      {status === "loading" ? <LoadingBlock label="Loading job postings…" /> : null}
      {status === "error" ? <ErrorBlock message={error} onRetry={() => void load()} /> : null}

      {status === "ready" && jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-10 text-center">
          <h3 className="font-heading text-2xl">No job postings yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Add a URL, or paste the description if the site won&apos;t let us read it. Each posting stays on this
            account.
          </p>
        </div>
      ) : null}

      {status === "ready" && jobs.length > 0 ? (
        <ul className="space-y-3">
          {jobs.map((job) => (
            <li key={job.id} className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">
                  {job.title} · {job.company}
                </p>
                <Badge variant={job.source === "scraped" ? "default" : "secondary"}>
                  {job.source === "scraped" ? "From the page" : "Pasted"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Saved {formatWhen(job.updatedAt)}</p>
              <p className="mt-3 line-clamp-4 text-sm leading-6 text-muted-foreground">{job.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="h-9"
                  onClick={() => {
                    setResumeId(resumes[0]?.id || "")
                    setTailorJob(job)
                  }}
                >
                  Tailor a resume
                </Button>
                <Button type="button" variant="ghost" onClick={() => void remove(job.id)}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <Dialog open={tailorJob !== null} onOpenChange={(open) => { if (!open) setTailorJob(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tailor a resume for ATS</DialogTitle>
            <DialogDescription>
              {tailorJob
                ? `Match keywords and phrasing from ${tailorJob.title} at ${tailorJob.company} to a resume you already saved. Skills the posting asks for that aren't in that resume are left out.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {resumes.length === 0 ? (
            <p className="text-sm leading-6 text-muted-foreground">Upload a resume before tailoring one to this job.</p>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="tailorResume">Resume</Label>
              <select
                id="tailorResume"
                className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={resumeId}
                onChange={(event) => setResumeId(event.target.value)}
              >
                {resumes.map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resume.fullName || resume.fileName} · {resume.fileName}
                  </option>
                ))}
              </select>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTailorJob(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={tailoring || resumes.length === 0} onClick={() => void tailor()}>
              {tailoring ? "Tailoring…" : "Create ATS draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
