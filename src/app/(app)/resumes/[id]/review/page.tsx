import { Suspense } from "react"
import { ResumeScreen } from "@/components/resume-screen"
import { LoadingBlock } from "@/components/status-block"

export const metadata = {
  title: "Review resume",
}

export default function ReviewResumePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingBlock label="Opening the draft…" />}>
      <ResumeRoute params={params} />
    </Suspense>
  )
}

async function ResumeRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ResumeScreen id={id} mode="review" />
}
