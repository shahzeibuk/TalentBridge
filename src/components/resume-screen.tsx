"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ResumeDetails } from "@/components/resume-details"
import { ResumeForm } from "@/components/resume-form"
import { ErrorBlock, LoadingBlock } from "@/components/status-block"
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
import { ApiError, api } from "@/lib/http"
import type { ResumeDetail } from "@/lib/resume-data"
import { cn } from "@/lib/utils"

export function ResumeScreen({ id, mode }: { id: string; mode: "view" | "edit" | "review" }) {
  const router = useRouter()
  const [resume, setResume] = useState<ResumeDetail | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [error, setError] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, setPending] = useState<"profile" | "delete" | null>(null)

  const load = useCallback(async () => {
    setStatus("loading")
    setError("")
    try {
      const data = await api<{ resume: ResumeDetail }>(`/api/resumes/${id}`)
      setResume(data.resume)
      setStatus("ready")
      if (mode === "view" && data.resume.status === "draft") {
        router.replace(`/resumes/${id}/review`)
      }
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login")
        return
      }
      setError(caught instanceof Error ? caught.message : "We couldn't open that resume.")
      setStatus("error")
    }
  }, [id, mode, router])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  async function setProfile() {
    if (!resume) return
    setPending("profile")
    try {
      await api(`/api/resumes/${resume.id}/profile`, {
        method: "POST",
        body: JSON.stringify({
          fullName: resume.fullName,
          email: resume.email,
          phone: resume.phone,
          location: resume.location,
          links: resume.links,
          experience: resume.experience,
          education: resume.education,
          skills: resume.skills,
        }),
      })
      router.push("/dashboard?profile=1")
      router.refresh()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "We couldn't update your profile.")
      setPending(null)
    }
  }

  async function remove() {
    if (!resume) return
    setPending("delete")
    try {
      await api(`/api/resumes/${resume.id}`, { method: "DELETE" })
      toast.success("Resume deleted. Your profile snapshot was left as it is.")
      router.push("/dashboard")
      router.refresh()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "We couldn't delete the resume.")
      setPending(null)
    }
  }

  if (status === "loading") {
    return <LoadingBlock label={mode === "review" ? "Opening the draft…" : "Opening the resume…"} />
  }
  if (status === "error" || !resume) {
    return <ErrorBlock message={error || "That resume isn't in your account."} onRetry={() => void load()} />
  }

  const title =
    mode === "review" ? "Review this draft" : mode === "edit" ? "Edit resume" : resume.fullName || resume.fileName
  const subtitle =
    mode === "review"
      ? "Correct anything that's off, then confirm to save the resume and copy it onto your profile."
      : mode === "edit"
        ? "Saving changes updates this resume only. Set as my profile if this version should replace your snapshot."
        : resume.fileName

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{resume.fileName}</p>
          <h1 className="mt-1 font-heading text-4xl tracking-tight">{title}</h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-muted-foreground">{subtitle}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant={resume.status === "confirmed" ? "default" : "outline"}>
              {resume.status === "confirmed" ? "Saved" : "Needs review"}
            </Badge>
            <Badge variant={resume.parseSource === "fallback" ? "secondary" : "outline"}>
              {resume.parseSource === "fallback"
                ? "Local fallback"
                : resume.parseSource === "groq"
                  ? "Groq"
                  : "Gemini"}
            </Badge>
          </div>
        </div>
        {mode === "view" ? (
          <div className="flex flex-wrap gap-2">
            <Link href={`/resumes/${resume.id}/edit`} className={cn(buttonVariants(), "h-10 px-4")}>
              Edit
            </Link>
            <a href={`/api/resumes/${resume.id}/file`} className={cn(buttonVariants({ variant: "outline" }), "h-10 px-4")}>
              Download original
            </a>
            <Button type="button" variant="outline" className="h-10" disabled={pending !== null} onClick={() => void setProfile()}>
              {pending === "profile" ? "Updating profile…" : "Set as my profile"}
            </Button>
            <Button type="button" variant="ghost" className="h-10" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </div>
        ) : null}
      </div>

      {mode === "view" ? (
        <div className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10 sm:p-7">
          {resume.parseSource === "fallback" ? (
            <p className="mb-6 text-sm leading-6 text-muted-foreground">
              Local fallback extractor. This draft did not come from an AI model. {resume.parseNote}
            </p>
          ) : (
            <p className="mb-6 text-sm leading-6 text-muted-foreground">{resume.parseNote}</p>
          )}
          <ResumeDetails data={resume} />
        </div>
      ) : (
        <ResumeForm key={resume.updatedAt} resume={resume} mode={mode === "edit" ? "edit" : "review"} />
      )}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this resume?</DialogTitle>
            <DialogDescription>
              {resume.fileName} will be removed, including the original file. Your profile snapshot stays as it is.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>
              Keep it
            </Button>
            <Button type="button" variant="destructive" disabled={pending === "delete"} onClick={() => void remove()}>
              {pending === "delete" ? "Deleting…" : "Delete resume"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
