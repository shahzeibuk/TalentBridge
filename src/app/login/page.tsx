import { Suspense } from "react"
import { LoginForm } from "@/components/login-form"

export const metadata = {
  title: "Log in",
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="admin-theme min-h-dvh px-4 py-16 text-sm text-muted-foreground">Opening log in…</div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
