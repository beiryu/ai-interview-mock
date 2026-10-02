"use client"

import type { Table } from "@tanstack/react-table"

import { JOB_STATUSES, JOB_STATUS_LABEL } from "@/lib/validations/job"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options"

// "Active" hides what is closed
const ACTIVE = ["SAVED", "APPLIED", "INTERVIEWING", "OFFER"]

interface DataTableToolbarProps<TData> {
  table: Table<TData>
}

export function DataTableToolbar<TData>({
  table,
}: DataTableToolbarProps<TData>) {
  const status = table.getColumn("status")
  const filter = (status?.getFilterValue() as string[] | undefined) ?? []
  const value =
    filter.length === 0
      ? "all"
      : filter.length === ACTIVE.length
      ? "active"
      : filter[0]

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Filter jobs..."
          value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("name")?.setFilterValue(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {status && (
          <Select
            value={value}
            onValueChange={(next) =>
              status.setFilterValue(
                next === "all" ? [] : next === "active" ? ACTIVE : [next]
              )
            }
          >
            <SelectTrigger className="h-8 w-[150px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              {JOB_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {JOB_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  )
}
