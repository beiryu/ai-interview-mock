"use client"

import * as React from "react"
import Link from "next/link"
import { Row } from "@tanstack/react-table"
import {
  FileText,
  History,
  MoreHorizontal,
  ScrollText,
  Trash2,
} from "lucide-react"

import type { Job } from "@/lib/validations/job"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import DeleteDialog from "@/components/modals/delete-modal"

interface DataTableRowActionsProps<TData> {
  row: Row<TData>
}

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)

  const job = row.original as Job
  const base = `/dashboard/jobs/${job.id}`

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex size-8 p-0 data-[state=open]:bg-muted"
          >
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[180px]">
          <DropdownMenuItem asChild>
            <Link href={`${base}?tab=cv`}>
              <FileText className="mr-2 size-4" />
              Tailored CV
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`${base}?tab=jd`}>
              <ScrollText className="mr-2 size-4" />
              Job description
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`${base}?tab=sessions`}>
              <History className="mr-2 size-4" />
              Past sessions
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setShowDeleteDialog(true)}
            className="text-red-600"
          >
            <Trash2 className="mr-2 size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteDialog
        job={job}
        isOpen={showDeleteDialog}
        showActionToggle={setShowDeleteDialog}
      />
    </>
  )
}
