import Link from "next/link"
import { redirect } from "next/navigation"
import {
  CalendarIcon,
  FileText,
  MessageSquare,
  Settings,
  Wrench,
} from "lucide-react"

import { getCurrentUser } from "@/lib/session"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DashboardHeader } from "@/components/header"
import { DashboardShell } from "@/components/shell"

export const metadata = {
  title: "Dashboard",
}

export default async function DashboardPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Dashboard"
        text={`Welcome back, ${user.name || "there"}!`}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-lg">Interviews</h3>
            <MessageSquare className="size-5 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground mb-4">
            Practice interviews with AI assistant feedback.
          </p>
          <Link
            className={cn(
              buttonVariants({ variant: "outline", className: "w-full" })
            )}
            href="/dashboard/interviews"
          >
            Start Interview
          </Link>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-lg">Documents</h3>
            <FileText className="size-5 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground mb-4">
            Manage your documents for interview preparation.
          </p>
          <Link
            className={cn(
              buttonVariants({ variant: "outline", className: "w-full" })
            )}
            href="/dashboard/documents"
          >
            View Documents
          </Link>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-lg">Tools</h3>
            <Wrench className="size-5 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground mb-4">
            Use our tools to help you prepare for your interview.
          </p>
          <Link
            className={cn(
              buttonVariants({ variant: "outline", className: "w-full" })
            )}
            href="/dashboard/tools"
          >
            View Tools
          </Link>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="font-medium text-xl mb-4">Getting Started</h2>
        <div className="bg-muted rounded-lg p-6">
          <ol className="space-y-4 list-decimal list-inside">
            <li>
              Upload your resume and documents in the{" "}
              <a href="/dashboard/documents" className="font-medium underline">
                Documents section
              </a>
            </li>
            <li>
              Create your first interview in the{" "}
              <a href="/dashboard/interviews" className="font-medium underline">
                Interviews section
              </a>
            </li>
            <li>Practice with our AI interview coach and receive feedback</li>
            <li>Review your performance in Analytics</li>
          </ol>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-lg">Upcoming Sessions</h3>
            <CalendarIcon className="size-5 text-muted-foreground" />
          </div>
          <div className="text-center py-8 text-muted-foreground">
            No upcoming sessions scheduled.
          </div>
          <Link
            className={cn(
              buttonVariants({ variant: "outline", className: "w-full" })
            )}
            href="/dashboard/interviews"
          >
            Schedule Practice
          </Link>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-lg">Account Settings</h3>
            <Settings className="size-5 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground mb-4">
            Manage your profile and preferences.
          </p>
          <Link
            className={cn(
              buttonVariants({ variant: "outline", className: "w-full" })
            )}
            href="/dashboard/settings"
          >
            Manage Settings
          </Link>
        </Card>
      </div>
    </DashboardShell>
  )
}
