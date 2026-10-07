"use client"

import Link from "next/link"

import { CV_ORIGIN_LABEL, type CvOrigin } from "@/lib/cv/schema"
import { cn } from "@/lib/utils"
import { useCvs } from "@/hooks/api/cv/useCvs"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { DashboardHeader } from "@/components/header"
import { Icons } from "@/components/icons"

import { UploadCvDialog } from "./upload-cv-dialog"

const ORIGIN_TONE: Record<CvOrigin, string> = {
  UPLOADED: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  REFINED: "bg-green-500/15 text-green-700 dark:text-green-300",
  GENERATED: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
}

/** Every CV: the ones you uploaded and the ones made for each job. */
export function CvsList() {
  const { data: cvs, isLoading } = useCvs()

  return (
    <>
      <DashboardHeader
        heading="CVs"
        text="Your uploaded CVs and the version made for each job. A job's CV is refined from one of yours, or generated as a practice persona."
      >
        <UploadCvDialog />
      </DashboardHeader>
      {isLoading || !cvs ? (
        <Skeleton className="h-64 w-full" />
      ) : cvs.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No CVs yet. Upload yours, or create a job and upload it there.
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {cvs.map((cv) => (
            <Link key={cv.id} href={`/dashboard/cvs/${cv.id}`}>
              <Card className="grid h-full gap-2 p-4 transition-colors hover:bg-muted/50">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{cv.title}</span>
                  <Badge
                    variant="outline"
                    className={cn("shrink-0 border-0", ORIGIN_TONE[cv.origin])}
                  >
                    {CV_ORIGIN_LABEL[cv.origin]}
                  </Badge>
                </div>
                {cv.headline && (
                  <p className="text-sm text-muted-foreground">{cv.headline}</p>
                )}
                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {cv.status === "pending" && (
                    <span className="flex items-center gap-1">
                      <Icons.spinner className="size-3 animate-spin" />
                      Working…
                    </span>
                  )}
                  {cv.status === "failed" && (
                    <span className="text-destructive">Failed</span>
                  )}
                  {cv.basedOn && <span>from {cv.basedOn.title}</span>}
                  {cv.pending > 0 && (
                    <span className="text-amber-700 dark:text-amber-300">
                      {cv.pending} to approve
                    </span>
                  )}
                  <span>
                    updated {new Date(cv.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
