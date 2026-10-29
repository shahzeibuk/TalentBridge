"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  resolveDashboardAction,
  type DashboardActionId,
  type DashboardAgentAction,
} from "@/lib/dashboard-agent"
import { ApiError, api } from "@/lib/http"
import { cn } from "@/lib/utils"

type AgentMessage = {
  role: "user" | "agent"
  text: string
  actions?: DashboardAgentAction[]
  source?: "gemini" | "groq" | "fallback"
}

const STARTERS = [
  "What should I do next?",
  "Help me upload a resume",
  "I want to apply to a job",
  "Check my AI key setup",
]

export function DashboardAgent({
  onOpen,
}: {
  onOpen: (tab: "profile" | "resumes" | "jobs" | "applications" | "ai") => void
}) {
  const router = useRouter()
  const [message, setMessage] = useState("")
  const [pending, setPending] = useState(false)
  const [thread, setThread] = useState<AgentMessage[]>([
    {
      role: "agent",
      text: "Ask me what to do next. I can open Resumes, Jobs, Applications, Profile, or AI keys, and point you to upload or connect Gmail.",
      source: "fallback",
    },
  ])

  async function ask(text: string) {
    const trimmed = text.trim()
    if (!trimmed || pending) return
    setPending(true)
    setMessage("")
    setThread((current) => [...current, { role: "user", text: trimmed }])
    try {
      const result = await api<{
        reply: string
        actions: DashboardAgentAction[]
        source: "gemini" | "groq" | "fallback"
      }>("/api/dashboard/agent", {
        method: "POST",
        body: JSON.stringify({ message: trimmed }),
      })
      setThread((current) => [
        ...current,
        {
          role: "agent",
          text: result.reply,
          actions: result.actions,
          source: result.source,
        },
      ])
    } catch (caught) {
      const error = caught instanceof ApiError ? caught.message : "The agent couldn't answer."
      toast.error(error)
      setThread((current) => [...current, { role: "agent", text: error, source: "fallback" }])
    } finally {
      setPending(false)
    }
  }

  function runAction(id: DashboardActionId) {
    const action = resolveDashboardAction(id)
    if (!action) return
    if ("href" in action && action.href) {
      if (action.href.startsWith("/api/")) {
        window.location.href = action.href
        return
      }
      router.push(action.href)
      return
    }
    if ("tab" in action && action.tab) onOpen(action.tab)
  }

  return (
    <article className="rounded-2xl border border-white/8 bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Sparkles className="size-4" />
            </span>
            <h3 className="text-lg font-semibold tracking-tight">Dashboard agent</h3>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Uses your saved Gemini or Groq key when available. Otherwise it gives local next-step guidance.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {STARTERS.map((starter) => (
          <button
            key={starter}
            type="button"
            disabled={pending}
            onClick={() => void ask(starter)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/10 hover:text-foreground disabled:opacity-50"
          >
            {starter}
          </button>
        ))}
      </div>

      <div className="mt-4 max-h-72 space-y-3 overflow-y-auto rounded-xl border border-white/8 bg-background/40 p-3">
        {thread.map((item, index) => (
          <div
            key={`${item.role}-${index}-${item.text.slice(0, 12)}`}
            className={cn("flex", item.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-6",
                item.role === "user" ? "bg-primary text-primary-foreground" : "bg-white/6 text-foreground",
              )}
            >
              <p>{item.text}</p>
              {item.role === "agent" && item.source ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {item.source === "fallback" ? "Local guidance" : `Answered with ${item.source}`}
                </p>
              ) : null}
              {item.actions && item.actions.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.actions.map((action) => (
                    <Button
                      key={action.id}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 border-white/15 bg-background/40"
                      onClick={() => runAction(action.id)}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {pending ? <p className="text-xs text-muted-foreground">Thinking…</p> : null}
      </div>

      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault()
          void ask(message)
        }}
      >
        <Input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Ask the agent to help with your next dashboard step…"
          className="h-10"
          disabled={pending}
        />
        <Button type="submit" className="h-10 shrink-0 px-5" disabled={pending || !message.trim()}>
          {pending ? "Asking…" : "Ask agent"}
        </Button>
      </form>
    </article>
  )
}
