import { DashboardHeader } from "@/components/header"
import { ProfilePrepEditor } from "@/components/prep/profile-prep-editor"
import { DashboardShell } from "@/components/shell"

export const metadata = {
  title: "Profile prep",
  description: "What the answer coach knows about you.",
}

export default function ProfilePrepPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Profile prep"
        text="What the answer coach knows about you — prepared from your documents, reviewed by you."
      />
      <ProfilePrepEditor />
    </DashboardShell>
  )
}
