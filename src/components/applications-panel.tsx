"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, FileText, Inbox, PenLine, RefreshCw, Send, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { api } from "@/lib/http"
import type { ResumeListItem } from "@/lib/resume-data"
import { cn } from "@/lib/utils"

const emptyForm = {
  company: "",
  title: "",
  contactEmail: "",
  resumeId: "",
  coverLetter: "",
  subject: "",
}

type Folder = "inbox" | "sent" | "drafts"

function replyLabel(status: ReplyStatus) {
  if (status === "replied") return "Reply received"
  if (status === "waiting") return "No reply yet"
  if (status === "check_failed") return "Couldn't check replies"
  return "Not sent"
}

function subjectLine(item: ApplicationItem) {
  return item.subject.trim() || `Application for ${item.title} at ${item.company}`
}

function snippet(text: string) {
  const line = text.replace(/\s+/g, " ").trim()
  return line.length > 90 ? `${line.slice(0, 90)}…` : line
}

function inFolder(item: ApplicationItem, folder: Folder) {
  if (folder === "sent") return item.status === "sent"
  if (folder === "drafts") return item.status !== "sent"
  return true
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

export function ApplicationsPanel({
  resumes,
  applications,
  gmail,
  onReload,
}: {
  resumes: ResumeListItem[]
  applications: ApplicationItem[]
  gmail: GmailAccountStatus | null
  onReload: (refresh: boolean) => Promise<void>
}) {
  const searchParams = useSearchParams()
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState("")
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [checking, setChecking] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [folder, setFolder] = useState<Folder>("inbox")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)

  const notice = gmailNotice(searchParams.get("gmail"), Boolean(gmail?.expired))
  const sentCount = applications.filter((item) => item.status === "sent").length
  const visible = applications.filter((item) => inFolder(item, folder))
  const selected = applications.find((item) => item.id === selectedId) || null
  const chosenResume = resumes.find((resume) => resume.id === form.resumeId)
  const showReader = Boolean(selected) && !composing

  function update(field: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function openCompose() {
    setComposing(true)
    setSelectedId(null)
    setFormError("")
  }

  function openMessage(id: string) {
    setComposing(false)
    setSelectedId(id)
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
      setComposing(false)
      setFolder("sent")
      toast.success("Sent from your Gmail account. Reply status will show on this job entry.")
      await onReload(true)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "We couldn't send that application."
      setFormError(message)
      setConfirming(false)
      toast.error(message)
      await onReload(true)
    } finally {
      setSending(false)
    }
  }

  async function retry(id: string) {
    try {
      await api(`/api/applications/${id}/send`, { method: "POST" })
      toast.success("Sent from your Gmail account.")
      setFolder("sent")
      await onReload(true)
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "We couldn't send that application.")
      await onReload(true)
    }
  }

  async function remove(id: string) {
    try {
      await api(`/api/applications/${id}`, { method: "DELETE" })
      if (selectedId === id) setSelectedId(null)
      toast.success("Application removed.")
      await onReload(false)
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "We couldn't remove that application.")
    }
  }

  async function disconnect() {
    setDisconnecting(true)
    try {
      await api("/api/gmail/disconnect", { method: "POST" })
      toast.success("Gmail disconnected.")
      await onReload(false)
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "We couldn't disconnect Gmail.")
    } finally {
      setDisconnecting(false)
    }
  }

  const folders: { id: Folder; label: string; icon: typeof Inbox; count: number }[] = [
    { id: "inbox", label: "Inbox", icon: Inbox, count: applications.length },
    { id: "sent", label: "Sent", icon: Send, count: sentCount },
    { id: "drafts", label: "Drafts", icon: FileText, count: applications.length - sentCount },
  ]

  return (
    <section className="space-y-4">
      <div className="print:hidden">
        <h2 className="font-heading text-3xl tracking-tight">Applications</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Cover letters you send from Gmail, listed like mail. Replies are read only on threads this app started.
        </p>
      </div>

      {notice ? (
        <Alert variant={searchParams.get("gmail") === "connected" && !gmail?.expired ? "default" : "destructive"}>
          <AlertTitle>{notice.title}</AlertTitle>
          <AlertDescription>{notice.body}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-card md:h-[min(720px,calc(100dvh-9rem))] md:flex-row">
        <nav className="flex gap-1 overflow-x-auto border-b border-white/10 p-3 md:w-52 md:shrink-0 md:flex-col md:overflow-visible md:border-r md:border-b-0" aria-label="Mail">
          <button
            type="button"
            onClick={openCompose}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-lg md:mb-3"
          >
            <PenLine className="size-4" />
            Compose
          </button>
          {folders.map((item) => {
            const Icon = item.icon
            const active = folder === item.id && !composing
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setFolder(item.id)
                  setComposing(false)
                  setSelectedId(null)
                }}
                className={cn(
                  "inline-flex h-10 shrink-0 items-center gap-3 rounded-full px-3 text-sm md:w-full",
                  active ? "bg-white/10 font-medium" : "text-muted-foreground hover:bg-white/5",
                )}
              >
                <Icon className="size-4" />
                <span className="flex-1 text-left">{item.label}</span>
                <span className="text-xs tabular-nums">{item.count}</span>
              </button>
            )
          })}
          <div className="mt-auto hidden border-t border-white/10 pt-3 md:block">
            {gmail?.connected ? (
              <div>
                <p className="truncate text-sm font-medium">{gmail.email}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Testing mode. Reconnect after about 7 days.
                </p>
                <Button type="button" variant="ghost" className="mt-2 h-8 px-2" disabled={disconnecting} onClick={() => void disconnect()}>
                  {disconnecting ? "Disconnecting…" : "Disconnect"}
                </Button>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium">Send from your Gmail</p>
                <a
                  href="/api/gmail/connect"
                  className="mt-2 inline-flex h-9 items-center rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground"
                >
                  Connect Gmail
                </a>
              </div>
            )}
          </div>
        </nav>

        {composing ? (
          <form
            className="flex min-w-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault()
              startSend()
            }}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <h3 className="text-sm font-medium">New message</h3>
              <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setComposing(false)}>
                Close
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {formError ? (
                <Alert variant="destructive">
                  <AlertTitle>Couldn&apos;t send</AlertTitle>
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Company" id="jobCompany">
                  <Input id="jobCompany" className="h-10" value={form.company} onChange={(event) => update("company", event.target.value)} />
                </Field>
                <Field label="Job title" id="jobTitle">
                  <Input id="jobTitle" className="h-10" value={form.title} onChange={(event) => update("title", event.target.value)} />
                </Field>
              </div>
              <div className="flex items-center gap-3 border-b border-white/10 py-2">
                <Label htmlFor="jobContact" className="w-16 text-muted-foreground">To</Label>
                <Input
                  id="jobContact"
                  className="h-10 border-0 bg-transparent shadow-none"
                  type="email"
                  autoComplete="off"
                  placeholder="Contact email"
                  value={form.contactEmail}
                  onChange={(event) => update("contactEmail", event.target.value)}
                />
              </div>
              <div className="flex items-center gap-3 border-b border-white/10 py-2">
                <Label htmlFor="jobSubject" className="w-16 text-muted-foreground">Subject</Label>
                <Input
                  id="jobSubject"
                  className="h-10 border-0 bg-transparent shadow-none"
                  placeholder={form.title && form.company ? `Application for ${form.title} at ${form.company}` : "Application for the role"}
                  value={form.subject}
                  onChange={(event) => update("subject", event.target.value)}
                />
              </div>
              <Textarea
                id="jobLetter"
                className="min-h-48 border-0 bg-transparent shadow-none"
                value={form.coverLetter}
                onChange={(event) => update("coverLetter", event.target.value)}
                placeholder="Write the cover letter. The resume is attached."
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Label htmlFor="jobResume" className="text-muted-foreground">Attachment</Label>
                <select
                  id="jobResume"
                  className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:max-w-sm"
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
              {resumes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Upload a resume before you can attach one.</p>
              ) : null}
              {!gmail?.connected ? (
                <a href="/api/gmail/connect" className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline md:hidden">
                  Connect Gmail
                </a>
              ) : null}
            </div>
            <div className="border-t border-white/10 px-4 py-3">
              <Button type="submit" className="h-10 rounded-full px-5">
                Send from Gmail
              </Button>
            </div>
          </form>
        ) : (
          <>
            <div className={cn("flex min-w-0 flex-col border-white/10 md:w-[340px] md:shrink-0 md:border-r", showReader ? "hidden md:flex" : "flex flex-1 md:flex-none")}>
              <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
                <p className="text-sm font-medium">{folders.find((item) => item.id === folder)?.label}</p>
                {!gmail?.connected ? (
                  <a
                    href="/api/gmail/connect"
                    className="inline-flex h-8 shrink-0 items-center rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground md:hidden"
                  >
                    Connect Gmail
                  </a>
                ) : null}
                {gmail?.connected && sentCount > 0 ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                    disabled={checking}
                    onClick={() => {
                      setChecking(true)
                      void onReload(true).finally(() => setChecking(false))
                    }}
                  >
                    <RefreshCw className={cn("size-3.5", checking && "animate-spin")} />
                    {checking ? "Checking replies…" : "Check for replies"}
                  </button>
                ) : null}
              </div>
              {visible.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
                  <h3 className="font-heading text-2xl">{folder === "inbox" ? "No applications yet" : `Nothing in ${folders.find((item) => item.id === folder)?.label}`}</h3>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
                    Compose a message with the job contact, a cover letter, and a saved resume.
                  </p>
                </div>
              ) : (
                <ul className="min-h-0 flex-1 overflow-y-auto">
                  {visible.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => openMessage(item.id)}
                        className={cn(
                          "flex w-full gap-3 border-b border-white/8 px-3 py-3 text-left hover:bg-white/5",
                          selectedId === item.id && "bg-white/10",
                          item.replyStatus === "replied" && "font-medium",
                        )}
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm">
                          {(item.company.trim()[0] || "?").toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-sm">{item.company}</span>
                            <span className="shrink-0 text-[11px] font-normal text-muted-foreground">
                              {formatWhen(item.sentAt || item.updatedAt)}
                            </span>
                          </span>
                          <span className="block truncate text-sm">{subjectLine(item)}</span>
                          <span className="block truncate text-xs font-normal text-muted-foreground">
                            {replyLabel(item.replyStatus)} · {snippet(item.coverLetter) || item.contactEmail}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className={cn("min-w-0 flex-1 flex-col", showReader ? "flex" : "hidden md:flex")}>
              {selected ? (
                <article className="flex min-h-0 flex-1 flex-col">
                  <div className="flex items-start gap-2 border-b border-white/10 px-4 py-3">
                    <button type="button" className="mt-1 md:hidden" aria-label="Back to messages" onClick={() => setSelectedId(null)}>
                      <ArrowLeft className="size-5" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xl font-semibold tracking-tight">{subjectLine(selected)}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        To {selected.contactEmail}
                        {gmail?.email ? ` · From ${gmail.email}` : ""}
                      </p>
                    </div>
                    <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Remove application" onClick={() => void remove(selected.id)}>
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{replyLabel(selected.replyStatus)}</p>
                    <p className="whitespace-pre-wrap text-sm leading-6">{selected.coverLetter}</p>
                    <p className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-sm">
                      <FileText className="size-4" />
                      {selected.resumeFileName || "Resume removed"}
                    </p>
                    {selected.replyStatus === "replied" && selected.replyFrom ? (
                      <div className="rounded-xl border border-white/10 bg-background/40 p-4">
                        <p className="text-sm font-medium">Reply from {selected.replyFrom}</p>
                        {selected.replySnippet ? <p className="mt-2 text-sm leading-6">{selected.replySnippet}</p> : null}
                      </div>
                    ) : null}
                    {selected.status === "send_failed" && selected.lastError ? (
                      <p className="text-sm leading-6 text-destructive">{selected.lastError}</p>
                    ) : null}
                    {selected.replyStatus === "check_failed" && selected.lastError ? (
                      <p className="text-sm leading-6 text-destructive">{selected.lastError}</p>
                    ) : null}
                    {selected.status !== "sent" ? (
                      <Button type="button" className="h-9 rounded-full" onClick={() => void retry(selected.id)}>
                        Retry send
                      </Button>
                    ) : null}
                  </div>
                </article>
              ) : (
                <div className="hidden flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground md:flex">
                  Select a message, or compose a new one.
                </div>
              )}
            </div>
          </>
        )}
      </div>

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

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}
