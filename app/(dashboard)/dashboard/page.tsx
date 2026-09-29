import Link from "next/link"
import { redirect } from "next/navigation"
import { CalendarClock, FileText, History } from "lucide-react"

import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DashboardHeader } from "@/components/header"
import { CreateInterviewDialog } from "@/components/modals/create-interview-dialog"
import { DashboardShell } from "@/components/shell"

export const metadata = {
  title: "Home",
}

const dateTime = (date: Date) =>
  date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-sm text-muted-foreground">{children}</p>
}

export default async function DashboardPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const [upcoming, recentSessions, documentCount, indexedCount] =
    await Promise.all([
      db.interview.findMany({
        where: { userId: user.id, scheduledAt: { gte: new Date() } },
        orderBy: { scheduledAt: "asc" },
        take: 5,
      }),
      db.interviewSession.findMany({
        where: { userId: user.id },
        orderBy: { startedAt: "desc" },
        take: 5,
        include: { interview: { select: { id: true, name: true } } },
      }),
      db.document.count({ where: { userId: user.id } }),
      db.document.count({
        where: { userId: user.id, openaiFileId: { not: null } },
      }),
    ])

  return (
    <DashboardShell>
      <DashboardHeader
        heading={user.name ? `Hi, ${user.name}` : "Home"}
        text="Your upcoming interviews and recent sessions."
      >
        <CreateInterviewDialog />
      </DashboardHeader>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">Upcoming</CardTitle>
              <CardDescription>
                Interviews with a scheduled time
              </CardDescription>
            </div>
            <CalendarClock className="size-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="divide-y">
            {upcoming.length === 0 ? (
              <EmptyLine>Nothing scheduled.</EmptyLine>
            ) : (
              upcoming.map((interview) => (
                <Link
                  key={interview.id}
                  href={`/dashboard/interviews/${interview.id}`}
                  className="flex items-center justify-between gap-4 py-3 text-sm hover:underline"
                >
                  <span className="truncate font-medium">
                    {interview.name}
                    {interview.companyName && (
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · {interview.companyName}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {dateTime(interview.scheduledAt!)}
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">Recent sessions</CardTitle>
              <CardDescription>Saved transcripts</CardDescription>
            </div>
            <History className="size-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="divide-y">
            {recentSessions.length === 0 ? (
              <EmptyLine>
                No sessions yet. Launch an interview and share the meeting tab
                to record one.
              </EmptyLine>
            ) : (
              recentSessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/dashboard/interviews/${session.interview.id}/sessions`}
                  className="flex items-center justify-between gap-4 py-3 text-sm hover:underline"
                >
                  <span className="truncate font-medium">
                    {session.interview.name}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {session.status === "completed"
                      ? dateTime(session.startedAt)
                      : "In progress"}
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">Documents</CardTitle>
            <CardDescription>
              {documentCount === 0
                ? "Upload your resume and job descriptions so the answer coach can use them."
                : `${indexedCount} of ${documentCount} documents are searchable by the answer coach.`}
            </CardDescription>
          </div>
          <Link
            href="/dashboard/documents"
            className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
          >
            <FileText className="size-4" />
            Manage
          </Link>
        </CardHeader>
      </Card>
    </DashboardShell>
  )
}
