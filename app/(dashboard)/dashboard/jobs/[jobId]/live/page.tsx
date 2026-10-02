import { LiveInterviewPlaygroundV2 } from "@/components/live-interview-playground-v2"
import { DashboardShell } from "@/components/shell"

export const metadata = {
  title: "Live interview",
}

interface Props {
  params: Promise<{ jobId: string }>
}

export default async function LiveInterviewPage(props: Props) {
  const { jobId } = await props.params

  return (
    <DashboardShell className="m-2 overscroll-none">
      <LiveInterviewPlaygroundV2 jobId={jobId} />
    </DashboardShell>
  )
}
