import { JobsList } from "@/components/jobs/jobs-list"
import { DashboardShell } from "@/components/shell"

export const metadata = {
  title: "Jobs",
}

export default function JobsPage() {
  return (
    <DashboardShell>
      <JobsList />
    </DashboardShell>
  )
}
