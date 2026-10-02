"use client"

import { useGetJobs } from "@/hooks/api/job/useJobs"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { columns } from "@/components/data-table/columns"
import { DataTable } from "@/components/data-table/data-table"
import { DashboardHeader } from "@/components/header"
import { NewJobDialog } from "@/components/jobs/new-job-dialog"

export function JobsList() {
  const { data: jobs, isLoading } = useGetJobs()

  return (
    <>
      <DashboardHeader
        heading="Jobs"
        text="Paste a job description to get a CV tailored to it. When you're invited, schedule the interview and launch the copilot on the day."
      >
        <NewJobDialog />
      </DashboardHeader>
      {isLoading || !jobs ? (
        <Skeleton className="h-64 w-full" />
      ) : jobs.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No jobs yet. Click <b>New job</b> and paste a job description you
          like: the CV for it is written from your documents in about ten
          seconds.
        </Card>
      ) : (
        <DataTable data={jobs} columns={columns} />
      )}
    </>
  )
}
