import { CvsList } from "@/components/cv/cvs-list"
import { DashboardShell } from "@/components/shell"

export const metadata = {
  title: "CVs",
}

export default function CvsPage() {
  return (
    <DashboardShell>
      <CvsList />
    </DashboardShell>
  )
}
