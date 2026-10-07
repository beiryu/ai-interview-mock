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
import { NewJobDialog } from "@/components/jobs/new-job-dialog"
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

  const [upcoming, recentSessions, cvCount, jobCount] = await Promise.all([
    db.job.findMany({
      where: { userId: user.id, scheduledAt: { gte: new Date() } },
      orderBy: { scheduledAt: "asc" },
      take: 5,
    }),
    db.interviewSession.findMany({
      where: { userId: user.id },
      orderBy: { startedAt: "desc" },
      take: 5,
      include: { job: { select: { id: true, company: true, title: true } } },
    }),
    db.cv.count({ where: { userId: user.id } }),
    db.job.count({ where: { userId: user.id } }),
  ])

  return (
    <DashboardShell>
      <DashboardHeader
        heading={user.name ? `Hi, ${user.name}` : "Home"}
        text="Paste a job you like to get a CV for it; your upcoming interviews and recent sessions are here."
      >
        <NewJobDialog />
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
              <EmptyLine>
                Nothing scheduled. Invited? Open the job and click Schedule
                interview.
              </EmptyLine>
            ) : (
              upcoming.map((job) => (
                <Link
                  key={job.id}
                  href={`/dashboard/jobs/${job.id}`}
                  className="flex items-center justify-between gap-4 py-3 text-sm hover:underline"
                >
                  <span className="truncate font-medium">
                    {job.company || "Unknown company"}
                    {job.title && (
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · {job.title}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {dateTime(job.scheduledAt!)}
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
                No sessions yet. Launch a job&apos;s interview and share the
                meeting tab to record one.
              </EmptyLine>
            ) : (
              recentSessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/dashboard/jobs/${session.job.id}?tab=sessions`}
                  className="flex items-center justify-between gap-4 py-3 text-sm hover:underline"
                >
                  <span className="truncate font-medium">
                    {[session.job.company, session.job.title]
                      .filter(Boolean)
                      .join(" — ") || "Untitled job"}
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
            <CardTitle className="text-lg">CVs</CardTitle>
            <CardDescription>
              {cvCount === 0
                ? "No CVs yet. Create a job: upload your CV there, or generate a practice persona from the JD."
                : `${cvCount} CV${
                    cvCount === 1 ? "" : "s"
                  } for ${jobCount} job${
                    jobCount === 1 ? "" : "s"
                  }: your uploads and the versions made for each job.`}
            </CardDescription>
          </div>
          <Link
            href="/dashboard/cvs"
            className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
          >
            <FileText className="size-4" />
            Open
          </Link>
        </CardHeader>
      </Card>
    </DashboardShell>
  )
}
