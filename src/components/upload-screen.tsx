"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ApiError, api } from "@/lib/http"
import type { ResumeDetail } from "@/lib/resume-data"
import { clientUploadError } from "@/lib/uploads"

export function UploadScreen() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const [fileName, setFileName] = useState("")

  async function send(file: File) {
    const rejection = clientUploadError(file)
    if (rejection) {
      setError(rejection)
      setFileName("")
      return
    }
    setError("")
    setFileName(file.name)
    setPending(true)
    const body = new FormData()
    body.set("file", file)
    try {
      const result = await api<{ resume: ResumeDetail }>("/api/resumes", { method: "POST", body })
      setPending(false)
      setFileName("")
      router.push(`/resumes/${result.resume.id}/review`)
      router.refresh()
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login")
        return
      }
      setError(caught instanceof Error ? caught.message : "We couldn't upload that resume.")
      setPending(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-4xl tracking-tight">Upload a resume</h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          PDF or DOCX, up to 4 MB. The original file is stored in your database, then the text is read on the server
          and turned into a draft you can correct.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Upload stopped</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {pending ? (
        <div role="status" className="rounded-2xl bg-card px-5 py-8 ring-1 ring-foreground/10">
          <p className="font-medium">Reading {fileName || "the file"}…</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Extracting the text and drafting fields for you to review. This stays on the server.
          </p>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <span className="font-heading text-2xl">Drop a PDF or DOCX here</span>
          <span className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            Word .doc files, images, and other types are rejected. Keep the file under 4 MB so it fits the hosting
            limit.
          </span>
          <span className="mt-5 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
            Choose a file
          </span>
          <input
            className="sr-only"
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (file) void send(file)
            }}
          />
        </label>
      )}

      <Button type="button" variant="ghost" onClick={() => router.push("/dashboard")}>
        Back to your profile
      </Button>
    </div>
  )
}
