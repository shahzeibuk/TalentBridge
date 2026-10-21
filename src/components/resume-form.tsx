"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ApiError, api } from "@/lib/http"
import type { Education, Experience, ResumeData, ResumeDetail } from "@/lib/resume-data"

type ExperienceDraft = Experience & { key: string }
type EducationDraft = Education & { key: string }
type LinkDraft = { key: string; url: string }

type Draft = {
  fullName: string
  email: string
  phone: string
  location: string
  links: LinkDraft[]
  linkDraft: string
  experience: ExperienceDraft[]
  education: EducationDraft[]
  skills: string[]
  skillDraft: string
}

function keyed<T extends object>(item: T) {
  return { ...item, key: crypto.randomUUID() }
}

function draftFrom(data: ResumeData): Draft {
  return {
    fullName: data.fullName,
    email: data.email,
    phone: data.phone,
    location: data.location,
    links: data.links.map((url) => ({ key: crypto.randomUUID(), url })),
    linkDraft: "",
    experience: data.experience.map((item) => keyed(item)),
    education: data.education.map((item) => keyed(item)),
    skills: data.skills,
    skillDraft: "",
  }
}

function payloadFrom(draft: Draft): ResumeData {
  return {
    fullName: draft.fullName,
    email: draft.email,
    phone: draft.phone,
    location: draft.location,
    links: [...draft.links.map((link) => link.url), draft.linkDraft],
    experience: draft.experience.map((item) => ({
      company: item.company,
      title: item.title,
      start: item.start,
      end: item.end,
      description: item.description,
    })),
    education: draft.education.map((item) => ({
      school: item.school,
      degree: item.degree,
      field: item.field,
      start: item.start,
      end: item.end,
    })),
    skills: draft.skillDraft.trim() ? [...draft.skills, draft.skillDraft.trim()] : draft.skills,
  }
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className="h-10"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

export function ResumeForm({ resume, mode }: { resume: ResumeDetail; mode: "review" | "edit" }) {
  const router = useRouter()
  const [draft, setDraft] = useState<Draft>(() => draftFrom(resume))
  const [error, setError] = useState("")
  const [pending, setPending] = useState<"confirm" | "save" | "profile" | "delete" | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function updateExperience(key: string, patch: Partial<Experience>) {
    setDraft((current) => ({
      ...current,
      experience: current.experience.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    }))
  }

  function updateEducation(key: string, patch: Partial<Education>) {
    setDraft((current) => ({
      ...current,
      education: current.education.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    }))
  }

  async function submit(action: "confirm" | "save" | "profile") {
    setError("")
    setPending(action)
    const path =
      action === "confirm"
        ? `/api/resumes/${resume.id}/confirm`
        : action === "profile"
          ? `/api/resumes/${resume.id}/profile`
          : `/api/resumes/${resume.id}`
    const method = action === "save" ? "PATCH" : "POST"
    try {
      await api(path, { method, body: JSON.stringify(payloadFrom(draft)) })
      if (action === "save" && mode === "review") {
        toast.success("Draft saved. Your profile snapshot was left as it is.")
        setPending(null)
        return
      }
      if (action === "save") {
        toast.success("Resume updated. Your profile snapshot was left as it is.")
        setPending(null)
        return
      }
      router.push(action === "confirm" ? "/dashboard?saved=1" : "/dashboard?profile=1")
      router.refresh()
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login")
        return
      }
      setError(caught instanceof Error ? caught.message : "We couldn't save the resume.")
      setPending(null)
    }
  }

  async function remove() {
    setPending("delete")
    setError("")
    try {
      await api(`/api/resumes/${resume.id}`, { method: "DELETE" })
      toast.success("Resume deleted. Your profile snapshot was left as it is.")
      router.push("/dashboard")
      router.refresh()
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login")
        return
      }
      setError(caught instanceof Error ? caught.message : "We couldn't delete the resume.")
      setPending(null)
      setConfirmDelete(false)
    }
  }

  return (
    <form
      className="space-y-8"
      autoComplete="off"
      onSubmit={(event) => {
        event.preventDefault()
        void submit(mode === "review" ? "confirm" : "save")
      }}
    >
      {resume.parseSource === "fallback" ? (
        <Alert>
          <AlertTitle>Local fallback extractor</AlertTitle>
          <AlertDescription>
            This draft did not come from an AI model. {resume.parseNote}
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <AlertTitle>{resume.parseSource === "groq" ? "Drafted by Groq" : "Drafted by Gemini"}</AlertTitle>
          <AlertDescription>{resume.parseNote}</AlertDescription>
        </Alert>
      )}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not save</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="space-y-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
        <h2 className="font-heading text-2xl">Contact</h2>
        <Field
          id="fullName"
          label="Full name"
          value={draft.fullName}
          onChange={(fullName) => setDraft({ ...draft, fullName })}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="contactEmail" label="Email" value={draft.email} onChange={(email) => setDraft({ ...draft, email })} />
          <Field id="phone" label="Phone" value={draft.phone} onChange={(phone) => setDraft({ ...draft, phone })} />
        </div>
        <Field
          id="location"
          label="Location"
          value={draft.location}
          onChange={(location) => setDraft({ ...draft, location })}
          placeholder="City, region"
        />
        <div className="space-y-2">
          <Label htmlFor="linkDraft">Links</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="linkDraft"
              className="h-10"
              value={draft.linkDraft}
              placeholder="https://linkedin.com/in/you"
              onChange={(event) => setDraft({ ...draft, linkDraft: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  const url = draft.linkDraft.trim()
                  if (!url) return
                  setDraft({
                    ...draft,
                    links: [...draft.links, { key: crypto.randomUUID(), url }],
                    linkDraft: "",
                  })
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="h-10"
              onClick={() => {
                const url = draft.linkDraft.trim()
                if (!url) return
                setDraft({
                  ...draft,
                  links: [...draft.links, { key: crypto.randomUUID(), url }],
                  linkDraft: "",
                })
              }}
            >
              Add link
            </Button>
          </div>
          <ul className="space-y-2">
            {draft.links.map((link) => (
              <li key={link.key} className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2 text-sm">
                <span className="truncate">{link.url}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setDraft({ ...draft, links: draft.links.filter((item) => item.key !== link.key) })
                  }
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-2xl">Experience</h2>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setDraft({
                ...draft,
                experience: [
                  ...draft.experience,
                  keyed({ company: "", title: "", start: "", end: "", description: "" }),
                ],
              })
            }
          >
            Add a job
          </Button>
        </div>
        {draft.experience.length === 0 ? (
          <p className="text-sm text-muted-foreground">No jobs yet. Add the roles you want on your profile.</p>
        ) : null}
        {draft.experience.map((job, index) => (
          <div key={job.key} className="space-y-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-muted-foreground">Job {index + 1}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setDraft({ ...draft, experience: draft.experience.filter((item) => item.key !== job.key) })
                }
              >
                Remove
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id={`company-${job.key}`}
                label="Company"
                value={job.company}
                onChange={(company) => updateExperience(job.key, { company })}
              />
              <Field
                id={`title-${job.key}`}
                label="Title"
                value={job.title}
                onChange={(title) => updateExperience(job.key, { title })}
              />
              <Field
                id={`start-${job.key}`}
                label="Start"
                value={job.start}
                placeholder="Mar 2022"
                onChange={(start) => updateExperience(job.key, { start })}
              />
              <Field
                id={`end-${job.key}`}
                label="End"
                value={job.end}
                placeholder="Present"
                onChange={(end) => updateExperience(job.key, { end })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`description-${job.key}`}>Description</Label>
              <Textarea
                id={`description-${job.key}`}
                value={job.description}
                onChange={(event) => updateExperience(job.key, { description: event.target.value })}
              />
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-2xl">Education</h2>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setDraft({
                ...draft,
                education: [
                  ...draft.education,
                  keyed({ school: "", degree: "", field: "", start: "", end: "" }),
                ],
              })
            }
          >
            Add a school
          </Button>
        </div>
        {draft.education.length === 0 ? (
          <p className="text-sm text-muted-foreground">No education yet.</p>
        ) : null}
        {draft.education.map((school, index) => (
          <div key={school.key} className="space-y-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-muted-foreground">School {index + 1}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setDraft({ ...draft, education: draft.education.filter((item) => item.key !== school.key) })
                }
              >
                Remove
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id={`school-${school.key}`}
                label="School"
                value={school.school}
                onChange={(value) => updateEducation(school.key, { school: value })}
              />
              <Field
                id={`degree-${school.key}`}
                label="Degree"
                value={school.degree}
                onChange={(degree) => updateEducation(school.key, { degree })}
              />
              <Field
                id={`field-${school.key}`}
                label="Field"
                value={school.field}
                onChange={(field) => updateEducation(school.key, { field })}
              />
              <Field
                id={`edu-start-${school.key}`}
                label="Start"
                value={school.start}
                onChange={(start) => updateEducation(school.key, { start })}
              />
              <Field
                id={`edu-end-${school.key}`}
                label="End"
                value={school.end}
                onChange={(end) => updateEducation(school.key, { end })}
              />
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
        <h2 className="font-heading text-2xl">Skills</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Label htmlFor="skillDraft" className="sr-only">
            Add a skill
          </Label>
          <Input
            id="skillDraft"
            className="h-10"
            value={draft.skillDraft}
            placeholder="Add a skill"
            onChange={(event) => setDraft({ ...draft, skillDraft: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                const skill = draft.skillDraft.trim()
                if (!skill) return
                setDraft({ ...draft, skills: [...draft.skills, skill], skillDraft: "" })
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={() => {
              const skill = draft.skillDraft.trim()
              if (!skill) return
              setDraft({ ...draft, skills: [...draft.skills, skill], skillDraft: "" })
            }}
          >
            Add skill
          </Button>
        </div>
        <ul className="flex flex-wrap gap-2">
          {draft.skills.map((skill) => (
            <li key={skill}>
              <button
                type="button"
                className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground"
                onClick={() => setDraft({ ...draft, skills: draft.skills.filter((item) => item !== skill) })}
              >
                {skill}
                <span className="sr-only">, remove</span>
                <span aria-hidden="true"> ×</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <details className="rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10 sm:px-6">
        <summary className="cursor-pointer font-medium">Text read from the file</summary>
        <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
          {resume.extractedText}
        </pre>
      </details>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {mode === "review" ? (
          <Button type="submit" className="h-10" disabled={pending !== null}>
            {pending === "confirm" ? "Confirming…" : "Confirm and update profile"}
          </Button>
        ) : (
          <Button type="submit" className="h-10" disabled={pending !== null}>
            {pending === "save" ? "Saving…" : "Save resume"}
          </Button>
        )}
        {mode === "review" ? (
          <Button
            type="button"
            variant="outline"
            className="h-10"
            disabled={pending !== null}
            onClick={() => void submit("save")}
          >
            {pending === "save" ? "Saving…" : "Save draft"}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-10"
            disabled={pending !== null}
            onClick={() => void submit("profile")}
          >
            {pending === "profile" ? "Updating profile…" : "Set as my profile"}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          className="h-10"
          disabled={pending !== null}
          onClick={() => setConfirmDelete(true)}
        >
          Delete resume
        </Button>
      </div>

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
    </form>
  )
}
