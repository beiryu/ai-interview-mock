import { PropsWithChildren } from "react"

import { DashboardShell } from "@/components/shell"

export default async function LiveInterviewLayout({
  children,
}: PropsWithChildren) {
  return (
    <DashboardShell className="m-2 overscroll-none">{children}</DashboardShell>
  )
}
