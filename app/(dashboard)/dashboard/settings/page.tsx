import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/session"
import { DashboardHeader } from "@/components/header"
import SettingTabs from "@/components/setting-tabs"
import { DashboardShell } from "@/components/shell"

export const metadata = {
  title: "Settings",
  description: "Manage your account, profile, and preferences.",
}

export default async function SettingsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Settings"
        text="Manage your account, profile, and preferences."
      />
      <SettingTabs userId={user.id} />
    </DashboardShell>
  )
}
