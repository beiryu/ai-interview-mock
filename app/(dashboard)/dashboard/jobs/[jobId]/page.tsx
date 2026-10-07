import { JobPage } from "@/components/jobs/job-page"
import { DashboardShell } from "@/components/shell"

export const metadata = {
  title: "Job",
}

interface Props {
  params: Promise<{ jobId: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function JobDetailPage(props: Props) {
  const { jobId } = await props.params
  const { tab } = await props.searchParams

  return (
    <DashboardShell>
      <JobPage jobId={jobId} tab={tab} />
    </DashboardShell>
  )
}
