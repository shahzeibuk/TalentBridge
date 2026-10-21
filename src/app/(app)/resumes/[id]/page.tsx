import { Suspense } from "react"
import { ResumeScreen } from "@/components/resume-screen"
import { LoadingBlock } from "@/components/status-block"

export const metadata = {
  title: "Resume",
}

export default function ResumePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingBlock label="Opening the resume…" />}>
      <ResumeRoute params={params} />
    </Suspense>
  )
}

async function ResumeRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ResumeScreen id={id} mode="view" />
}
