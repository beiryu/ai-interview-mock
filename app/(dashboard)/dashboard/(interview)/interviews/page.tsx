"use client"

import { useGetInterviews } from "@/hooks/api/interview/useGetInterviews"
import { columns } from "@/components/data-table/columns"
import { DataTable } from "@/components/data-table/data-table"
import { DashboardHeader } from "@/components/header"
import { CreateInterviewDialog } from "@/components/modals/create-interview-dialog"

export default function LiveInterviewPage() {
  const { data: interviews } = useGetInterviews()

  if (!interviews) return null

  return (
    <>
      <DashboardHeader
        heading="Interviews"
        text="Each interview holds the company, role and notes the answer coach uses. Launch one to start a live session."
      >
        <CreateInterviewDialog />
      </DashboardHeader>
      <DataTable data={interviews} columns={columns} />
    </>
  )
}
