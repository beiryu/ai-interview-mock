import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { DashboardHeader } from "@/components/header"
import { DashboardShell } from "@/components/shell"

export default function ToolsLoading() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Document Chat"
        text="Ask questions and get insights from your uploaded documents."
      />
      <Card className="h-[calc(100vh-12rem)] overflow-hidden bg-background p-6">
        <div className="flex h-full flex-col space-y-4">
          <div className="flex-1 space-y-4">
            <Skeleton className="h-10 w-full" />
            <div className="grid grid-cols-1 gap-4">
              <Skeleton className="h-[calc(100vh-20rem)] w-full rounded-md" />
            </div>
          </div>
        </div>
      </Card>
    </DashboardShell>
  )
}
