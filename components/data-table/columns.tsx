"use client"

import Link from "next/link"
import { ColumnDef } from "@tanstack/react-table"
import { Play } from "lucide-react"

import { cn } from "@/lib/utils"
import { Interview } from "@/lib/validations/interview"
import { buttonVariants } from "@/components/ui/button"

import { DataTableColumnHeader } from "./data-table-column-header"
import { DataTableRowActions } from "./data-table-row-actions"

const muted = <span className="text-muted-foreground">—</span>

export const columns: ColumnDef<Interview>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => (
      <span className="max-w-[360px] truncate font-medium">
        {row.original.name}
      </span>
    ),
    enableHiding: false,
  },
  {
    accessorKey: "companyName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Company" />
    ),
    cell: ({ row }) => row.original.companyName || muted,
  },
  {
    accessorKey: "jobTitle",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Role" />
    ),
    cell: ({ row }) => row.original.jobTitle || muted,
  },
  {
    accessorKey: "scheduledAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Scheduled" />
    ),
    cell: ({ row }) => {
      const value = row.original.scheduledAt
      if (!value) return muted
      return new Date(value).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      })
    },
    sortingFn: "datetime",
  },
  {
    id: "sessions",
    accessorFn: (interview) => interview._count?.sessions ?? 0,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Sessions" />
    ),
    cell: ({ row }) => {
      const count = row.original._count?.sessions ?? 0
      if (count === 0) return muted
      return (
        <Link
          href={`/dashboard/interviews/${row.original.id}/sessions`}
          className="underline-offset-4 hover:underline"
        >
          {count}
        </Link>
      )
    },
  },
  {
    id: "launch",
    cell: ({ row }) => (
      <Link
        href={`/dashboard/interviews/${row.original.id}`}
        className={cn(
          buttonVariants({ variant: "secondary", size: "sm" }),
          "gap-2"
        )}
      >
        <Play className="size-4" />
        Launch
      </Link>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: "actions",
    cell: ({ row }) => <DataTableRowActions row={row} />,
    enableHiding: false,
  },
]
