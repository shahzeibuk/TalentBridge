"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
import type { ApplicationItem, GmailAccountStatus, ReplyStatus } from "@/lib/application-data"
import { formatWhen } from "@/lib/format"
import { ApiError, api } from "@/lib/http"
import type { ResumeListItem } from "@/lib/resume-data"

const emptyForm = {
  company: "",
  title: "",
  contactEmail: "",
  resumeId: "",
  coverLetter: "",
  subject: "",
}

function replyLabel(status: ReplyStatus) {
  if (status === "replied") return "Reply received"
  if (status === "waiting") return "No reply yet"
  if (status === "check_failed") return "Couldn't check replies"
  return "Not sent"
}

function gmailNotice(code: string | null, expired: boolean) {
  if (expired) {
    return {
      title: "Gmail connection expired",
      body: "Google's testing mode keeps access for about 7 days. Connect Gmail again to send and check replies.",
    }
  }
  if (code === "connected") {
    return {
      title: "Gmail connected",
      body: "You can send a cover letter and resume from this account. TalentBridge checks replies only on threads it started.",
    }
  }
  if (code === "unconfigured") {
    return {
      title: "Gmail isn't configured on this server",
      body: "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from a Google Cloud OAuth client that is still in Testing. Add yourself as a test user, and register the redirect URI http://127.0.0.1:3847/api/gmail/callback. Google's verification review is not required while the app stays in Testing.",
    }
  }
  if (code === "denied") {
    return {
      title: "Gmail wasn't connected",
      body: "Google only connects the account if you allow sending mail and reading mail metadata.",
    }
  }
  if (code === "scope") {
    return {
      title: "Gmail permissions were incomplete",
      body: "Connect again and leave both permissions checked: send email, and read mail so replies on your threads can be checked.",
    }
  }
  if (code === "error") {
    return {
      title: "Gmail didn't connect",
      body: "Google didn't finish the sign-in. Confirm the OAuth client is in Testing, your address is a test user, and the redirect URI matches this app.",
    }
  }
  return null
}

export function ApplicationsPanel({ resumes }: { resumes: ResumeListItem[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [gmail, setGmail] = useState<GmailAccountStatus | null>(null)
  const [applications, setApplications] = useState<ApplicationItem[]>([])
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [error, setError] = useState("")
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState("")
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [checking, setChecking] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const load = useCallback(
    async (refresh: boolean) => {
      setError("")
      try {
        const result = await api<{ gmail: GmailAccountStatus; applications: ApplicationItem[] }>(
          `/api/applications${refresh ? "?refresh=1" : ""}`,
        )
        setGmail(result.gmail)
        setApplications(result.applications)
        setStatus("ready")
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401) {
          router.replace("/login")
          return
        }
        setError(caught instanceof Error ? caught.message : "We couldn't load your applications.")
        setStatus("error")
      }
    },
    [router],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const notice = gmailNotice(searchParams.get("gmail"), Boolean(gmail?.expired))
  const sentCount = applications.filter((item) => item.status === "sent").length

  function update(field: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function startSend() {
    setFormError("")
    if (!gmail?.connected) {
      setFormError("Connect Gmail before sending. The message goes out from your account.")
      return
    }
    if (!form.company.trim() || !form.title.trim()) {
      setFormError("Enter the company and the job title.")
      return
    }
    if (!form.contactEmail.trim()) {
      setFormError("Enter the contact email from the job posting.")
      return
    }
    if (!form.resumeId) {
      setFormError("Choose a saved resume to attach.")
      return
    }
    if (form.coverLetter.trim().length < 20) {
      setFormError("Write the cover letter you want to send.")
      return
    }
    setConfirming(true)
  }

  async function send() {
    setSending(true)
    setFormError("")
    try {
      await api("/api/applications", {
        method: "POST",
        body: JSON.stringify({
          company: form.company.trim(),
          title: form.title.trim(),
          contactEmail: form.contactEmail.trim(),
          resumeId: form.resumeId,
          coverLetter: form.coverLetter.trim(),
          subject: form.subject.trim(),
        }),
      })
      setForm(emptyForm)
      setConfirming(false)
      toast.success("Sent from your Gmail account. Reply status will show on this job entry.")
      await load(true)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "We couldn't send that application."
      setFormError(message)
      setConfirming(false)
      toast.error(message)
      await load(true)
    } finally {
      setSending(false)
    }
  }

  async function retry(id: string) {
    try {
      await api(`/api/applications/${id}/send`, { method: "POST" })
      toast.success("Sent from your Gmail account.")
      await load(true)
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "We couldn't send that application.")
      await load(true)
    }
  }

  async function remove(id: string) {
    try {
      await api(`/api/applications/${id}`, { method: "DELETE" })
      toast.success("Application removed.")
      await load(false)
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "We couldn't remove that application.")
    }
  }

  async function disconnect() {
    setDisconnecting(true)
    try {
      await api("/api/gmail/disconnect", { method: "POST" })
      toast.success("Gmail disconnected.")
      await load(false)
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "We couldn't disconnect Gmail.")
    } finally {
      setDisconnecting(false)
    }
  }

  const chosenResume = resumes.find((resume) => resume.id === form.resumeId)

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-3xl tracking-tight">Applications</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Send the cover letter you wrote, with a saved resume attached, from your own Gmail account.
          </p>
        </div>
        {gmail?.connected && sentCount > 0 ? (
          <Button
            type="button"
            variant="outline"
            className="h-10"
            disabled={checking}
            onClick={() => {
              setChecking(true)
              void load(true).finally(() => setChecking(false))
            }}
          >
            {checking ? "Checking replies…" : "Check for replies"}
          </Button>
        ) : null}
      </div>

      {notice ? (
        <Alert variant={searchParams.get("gmail") === "connected" && !gmail?.expired ? "default" : "destructive"}>
          <AlertTitle>{notice.title}</AlertTitle>
          <AlertDescription>{notice.body}</AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6">
        {gmail?.connected ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Gmail connected as {gmail.email}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Messages send from this inbox. Reply status is read from those threads only. This OAuth client is meant
                for Google&apos;s testing mode: add testers in Cloud Console, and reconnect after about 7 days.
              </p>
            </div>
            <Button type="button" variant="outline" disabled={disconnecting} onClick={() => void disconnect()}>
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Send from your Gmail account</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Connect Gmail to allow sending email and reading replies on the threads TalentBridge starts. While the
                Google app stays in Testing, only the test users you add can connect. Google&apos;s full verification
                review is not part of this setup.
              </p>
            </div>
            <a
              href="/api/gmail/connect"
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Connect Gmail
            </a>
          </div>
        )}
      </div>

      {status === "loading" ? <LoadingBlock label="Loading applications…" /> : null}
      {status === "error" ? <ErrorBlock message={error} onRetry={() => void load(true)} /> : null}

      {status === "ready" ? (
        <>
          <form
            className="space-y-4 rounded-2xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6"
            onSubmit={(event) => {
              event.preventDefault()
              startSend()
            }}
          >
            <div>
              <h3 className="font-heading text-2xl">New application</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Use the contact email on the job posting and paste the cover letter you tailored for it.
              </p>
            </div>
            {formError ? (
              <Alert variant="destructive">
                <AlertTitle>Couldn&apos;t send</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="jobCompany">Company</Label>
                <Input id="jobCompany" className="h-10" value={form.company} onChange={(event) => update("company", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobTitle">Job title</Label>
                <Input id="jobTitle" className="h-10" value={form.title} onChange={(event) => update("title", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobContact">Contact email</Label>
                <Input
                  id="jobContact"
                  className="h-10"
                  type="email"
                  autoComplete="off"
                  value={form.contactEmail}
                  onChange={(event) => update("contactEmail", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobResume">Resume</Label>
                <select
                  id="jobResume"
                  className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  value={form.resumeId}
                  onChange={(event) => update("resumeId", event.target.value)}
                >
                  <option value="">Choose a resume</option>
                  {resumes.map((resume) => (
                    <option key={resume.id} value={resume.id}>
                      {resume.fullName || resume.fileName} · {resume.fileName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobSubject">Subject</Label>
              <Input
                id="jobSubject"
                className="h-10"
                placeholder={form.title && form.company ? `Application for ${form.title} at ${form.company}` : "Application for the role"}
                value={form.subject}
                onChange={(event) => update("subject", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobLetter">Cover letter</Label>
              <Textarea
                id="jobLetter"
                className="min-h-40"
                value={form.coverLetter}
                onChange={(event) => update("coverLetter", event.target.value)}
                placeholder="Paste the letter you want the contact to read. The resume goes out as an attachment."
              />
            </div>
            {resumes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Upload a resume before you can attach one.</p>
            ) : null}
            <Button type="submit" className="h-10 px-4">
              Send from Gmail
            </Button>
          </form>

          {applications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-10 text-center">
              <h3 className="font-heading text-2xl">No applications yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Add a job&apos;s contact email, choose a resume, and send the cover letter. Reply status shows here
                after Gmail has a thread to watch.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {applications.map((item) => (
                <li key={item.id} className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">
                          {item.title} · {item.company}
                        </p>
                        <Badge variant={item.replyStatus === "replied" ? "default" : "outline"}>
                          {replyLabel(item.replyStatus)}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        To {item.contactEmail}
                        {item.resumeFileName ? ` · ${item.resumeFileName}` : " · Resume removed"}
                        {item.sentAt ? ` · Sent ${formatWhen(item.sentAt)}` : ""}
                      </p>
                      {item.replyStatus === "replied" && item.replyFrom ? (
                        <p className="mt-2 text-sm leading-6">
                          Reply from {item.replyFrom}
                          {item.replySnippet ? ` — ${item.replySnippet}` : ""}
                        </p>
                      ) : null}
                      {item.status === "send_failed" && item.lastError ? (
                        <p className="mt-2 text-sm leading-6 text-destructive">{item.lastError}</p>
                      ) : null}
                      {item.replyStatus === "check_failed" && item.lastError ? (
                        <p className="mt-2 text-sm leading-6 text-destructive">{item.lastError}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.status !== "sent" ? (
                        <Button type="button" className="h-9" onClick={() => void retry(item.id)}>
                          Retry send
                        </Button>
                      ) : null}
                      <Button type="button" variant="ghost" onClick={() => void remove(item.id)}>
                        Remove
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send this application?</DialogTitle>
            <DialogDescription>
              Gmail will send “{form.subject.trim() || `Application for ${form.title} at ${form.company}`}” to{" "}
              {form.contactEmail} from {gmail?.email}, with {chosenResume?.fileName || "your resume"} attached.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={sending} onClick={() => void send()}>
              {sending ? "Sending…" : "Send from Gmail"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
