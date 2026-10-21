import { Suspense } from "react"
import { LoginForm } from "@/components/login-form"

export const metadata = {
  title: "Log in",
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="px-4 py-16 text-sm text-muted-foreground">Opening log in…</p>}>
      <LoginForm />
    </Suspense>
  )
}
