import { CvPage } from "@/components/cv/cv-page"
import { DashboardShell } from "@/components/shell"

export const metadata = {
  title: "CV",
}

interface Props {
  params: Promise<{ cvId: string }>
}

export default async function CvDetailPage(props: Props) {
  const { cvId } = await props.params

  return (
    <DashboardShell>
      <CvPage cvId={cvId} />
    </DashboardShell>
  )
}
