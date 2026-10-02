"use client"

import * as React from "react"
import Link from "next/link"
import { Row } from "@tanstack/react-table"
import { History, MoreHorizontal, Pencil, Trash2 } from "lucide-react"

import type { Interview } from "@/lib/validations/interview"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import DeleteDialog from "@/components/modals/delete-modal"
import EditDialog from "@/components/modals/edit-modal"

interface DataTableRowActionsProps<TData> {
  row: Row<TData>
}

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {
  const [showEditDialog, setShowEditDialog] = React.useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)

  const interview = row.original as Interview

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
            <Link href={`/dashboard/interviews/${interview.id}/sessions`}>
              <History className="mr-2 size-4" />
              Past sessions
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setShowEditDialog(true)}>
            <Pencil className="mr-2 size-4" />
            Edit
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
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[520px]">
          {showEditDialog && (
            <EditDialog
              interview={interview}
              onDone={() => setShowEditDialog(false)}
            />
          )}
        </DialogContent>
      </Dialog>
      <DeleteDialog
        interview={interview}
        isOpen={showDeleteDialog}
        showActionToggle={setShowDeleteDialog}
      />
    </>
  )
}
