"use client"

import { useEffect, useState } from "react"
import { ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AI_PROVIDER_OPTIONS, type AiProvider, type AiSettingsPublic } from "@/lib/ai-settings"
import { ApiError, api } from "@/lib/http"
import { cn } from "@/lib/utils"

export function AiSettingsPanel() {
  const [settings, setSettings] = useState<AiSettingsPublic | null>(null)
  const [provider, setProvider] = useState<AiProvider>("gemini")
  const [geminiApiKey, setGeminiApiKey] = useState("")
  const [groqApiKey, setGroqApiKey] = useState("")
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  async function load() {
    setStatus("loading")
    setError("")
    try {
      const result = await api<{ settings: AiSettingsPublic }>("/api/settings/ai")
      setSettings(result.settings)
      setProvider(result.settings.provider)
      setGeminiApiKey("")
      setGroqApiKey("")
      setStatus("ready")
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "We couldn't load your AI settings.")
      setStatus("error")
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  async function save(extra?: { clearGemini?: boolean; clearGroq?: boolean }) {
    setSaving(true)
    try {
      const result = await api<{ settings: AiSettingsPublic }>("/api/settings/ai", {
        method: "PUT",
        body: JSON.stringify({
          provider,
          geminiApiKey: geminiApiKey.trim() || undefined,
          groqApiKey: groqApiKey.trim() || undefined,
          clearGemini: extra?.clearGemini,
          clearGroq: extra?.clearGroq,
        }),
      })
      setSettings(result.settings)
      setProvider(result.settings.provider)
      setGeminiApiKey("")
      setGroqApiKey("")
      toast.success("AI settings saved.")
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "We couldn't save your AI settings.")
    } finally {
      setSaving(false)
    }
  }

  if (status === "loading") {
    return <p className="text-sm text-muted-foreground">Loading AI settings…</p>
  }
  if (status === "error") {
    return (
      <Alert variant="destructive">
        <AlertTitle>AI settings unavailable</AlertTitle>
        <AlertDescription>
          {error}{" "}
          <button type="button" className="underline underline-offset-3" onClick={() => void load()}>
            Try again
          </button>
        </AlertDescription>
      </Alert>
    )
  }

  const geminiGuide = settings?.guides.gemini
  const groqGuide = settings?.guides.groq

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-heading text-3xl tracking-tight">AI keys</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Each account uses its own API keys for resume parsing and ATS tailoring. Keys are encrypted at rest. Leave a
          field blank to keep the key you already saved.
        </p>
      </div>

      <div className="space-y-3">
        <Label>Provider</Label>
        <div className="grid gap-3 sm:grid-cols-3">
          {AI_PROVIDER_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setProvider(option.id)}
              className={cn(
                "rounded-2xl border px-4 py-4 text-left transition-colors",
                provider === option.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-foreground/20",
              )}
            >
              <p className="text-sm font-medium">{option.label}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{option.blurb}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-medium">Gemini API key</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {settings?.geminiKeySet ? "A key is saved on your account." : "No Gemini key saved yet."}
              </p>
            </div>
            {geminiGuide ? (
              <a
                href={geminiGuide.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {geminiGuide.label}
                <ExternalLink className="size-3.5" />
              </a>
            ) : null}
          </div>
          {geminiGuide ? (
            <ol className="list-decimal space-y-1 pl-4 text-sm leading-6 text-muted-foreground">
              {geminiGuide.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="geminiApiKey">Paste Gemini key</Label>
            <Input
              id="geminiApiKey"
              type="password"
              autoComplete="off"
              placeholder={settings?.geminiKeySet ? "••••••••••••••••" : "AIza…"}
              value={geminiApiKey}
              onChange={(event) => setGeminiApiKey(event.target.value)}
            />
          </div>
          {settings?.geminiKeySet ? (
            <Button type="button" variant="outline" className="h-9" disabled={saving} onClick={() => void save({ clearGemini: true })}>
              Remove Gemini key
            </Button>
          ) : null}
        </div>

        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-medium">Groq API key</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {settings?.groqKeySet ? "A key is saved on your account." : "No Groq key saved yet."}
              </p>
            </div>
            {groqGuide ? (
              <a
                href={groqGuide.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {groqGuide.label}
                <ExternalLink className="size-3.5" />
              </a>
            ) : null}
          </div>
          {groqGuide ? (
            <ol className="list-decimal space-y-1 pl-4 text-sm leading-6 text-muted-foreground">
              {groqGuide.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="groqApiKey">Paste Groq key</Label>
            <Input
              id="groqApiKey"
              type="password"
              autoComplete="off"
              placeholder={settings?.groqKeySet ? "••••••••••••••••" : "gsk_…"}
              value={groqApiKey}
              onChange={(event) => setGroqApiKey(event.target.value)}
            />
          </div>
          {settings?.groqKeySet ? (
            <Button type="button" variant="outline" className="h-9" disabled={saving} onClick={() => void save({ clearGroq: true })}>
              Remove Groq key
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" className="h-10 px-5" disabled={saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save AI settings"}
        </Button>
        <p className="text-sm text-muted-foreground">
          {provider === "fallback"
            ? "Uploads will use the local extractor until you pick Gemini or Groq with a key."
            : provider === "gemini"
              ? "Uploads and ATS drafts will use your Gemini key when one is saved."
              : "Uploads and ATS drafts will use your Groq key when one is saved."}
        </p>
      </div>
    </section>
  )
}
