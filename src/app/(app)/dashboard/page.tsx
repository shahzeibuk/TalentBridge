import { Suspense } from "react"
import { DashboardScreen } from "@/components/dashboard-screen"
import { LoadingBlock } from "@/components/status-block"

export const metadata = {
  title: "Dashboard",
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<LoadingBlock label="Loading your profile and resumes…" />}>
      <DashboardScreen />
    </Suspense>
  )
}
