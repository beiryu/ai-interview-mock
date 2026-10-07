"use client"

import { useQuery } from "@tanstack/react-query"
import { RefreshCw, Settings } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Icons } from "@/components/icons"

type Credits = {
  gateway: { balance: string; totalUsed: string } | null
  soniox: { days: number; spentUsd: number; requests: number } | null
}

const usd = (v: number | string | undefined) => {
  const n = Number(v)
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : "—"
}

function Row({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={strong ? "text-base font-semibold" : "tabular-nums"}
      >
        {value}
      </span>
    </div>
  )
}

/** Gear menu: remaining AI credit + recent voice (Soniox) spend. */
export function CreditButton() {
  const credits = useQuery({
    queryKey: ["credits"],
    queryFn: async () => {
      const res = await fetch("/api/credits")
      if (!res.ok) throw new Error("Failed to load credit")
      return (await res.json()) as Credits
    },
    staleTime: 60_000,
  })
  const data = credits.data

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" title="Credit & usage">
          <Settings className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">Credit &amp; usage</span>
            <button
              type="button"
              className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              title="Refresh"
              disabled={credits.isFetching}
              onClick={() => void credits.refetch()}
            >
              <RefreshCw
                className={
                  credits.isFetching ? "size-3.5 animate-spin" : "size-3.5"
                }
              />
            </button>
          </div>

          {credits.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icons.spinner className="size-4 animate-spin" />
              Loading…
            </div>
          ) : credits.isError ? (
            <p className="text-destructive">Couldn&apos;t load credit.</p>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  AI (Gateway)
                </p>
                {data?.gateway ? (
                  <>
                    <Row
                      label="Remaining"
                      value={usd(data.gateway.balance)}
                      strong
                    />
                    <Row
                      label="Spent"
                      value={usd(data.gateway.totalUsed)}
                    />
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Unavailable.</p>
                )}
              </div>

              <div className="space-y-1 border-t pt-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Voice (Soniox)
                </p>
                {data?.soniox ? (
                  <>
                    <Row
                      label={`Spent · ${data.soniox.days}d`}
                      value={usd(data.soniox.spentUsd)}
                    />
                    <p className="text-xs text-muted-foreground">
                      No balance API — check console.soniox.com for the
                      remaining amount.
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Unavailable.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
