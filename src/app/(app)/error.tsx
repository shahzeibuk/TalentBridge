"use client"

import { Button } from "@/components/ui/button"

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="mx-auto max-w-lg py-16">
      <h1 className="font-heading text-3xl tracking-tight">This page didn&apos;t load</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        TalentBridge couldn&apos;t read your account data. Try again, or log in if your session expired.
      </p>
      <Button type="button" className="mt-5 h-10" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  )
}
