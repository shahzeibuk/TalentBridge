"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AuthFrame } from "@/components/auth-frame"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { safeNextPath } from "@/lib/format"
import { ApiError, api } from "@/lib/http"

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState(() => searchParams.get("email")?.trim() ?? "")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError("")
    if (!email.trim() || !password) {
      setError("Enter the email and password for your account.")
      return
    }
    setPending(true)
    try {
      await api("/api/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      })
      router.push(safeNextPath(searchParams.get("next")))
      router.refresh()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "We couldn't log you in.")
      setPending(false)
    }
  }

  return (
    <AuthFrame
      title="Welcome back"
      subtitle="Log in to review your resumes and the profile snapshot saved on your account."
      footer={
        <>
          New to TalentBridge?{" "}
          <Link href="/signup" className="font-medium text-foreground underline underline-offset-4">
            Create an account
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Could not log in</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            className="h-10"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            className="h-10"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <Button type="submit" className="h-11 w-full rounded-full" disabled={pending}>
          {pending ? "Logging in…" : "Log in"}
        </Button>
      </form>
    </AuthFrame>
  )
}
