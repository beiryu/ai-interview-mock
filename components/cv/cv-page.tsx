"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"

import { CV_ORIGIN_LABEL } from "@/lib/cv/schema"
import { useCv } from "@/hooks/api/cv/useCvs"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/use-toast"

import { CvEditor } from "./cv-editor"

/** One CV on its own page: edit, download, delete. */
export function CvPage({ cvId }: { cvId: string }) {
  const router = useRouter()
  const cv = useCv(cvId)
  const state = cv.data

  if (cv.isError) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        This CV doesn&apos;t exist anymore.{" "}
        <Link href="/dashboard/cvs" className="underline">
          Back to CVs
        </Link>
      </Card>
    )
  }
  if (!state?.cv) return <Skeleton className="h-96 w-full" />
  const summary = state.cv

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="font-heading text-3xl md:text-4xl">{summary.title}</h1>
          <p className="text-sm text-muted-foreground">
            {CV_ORIGIN_LABEL[summary.origin]}
            {summary.basedOn && (
              <>
                {" "}
                from{" "}
                <Link
                  href={`/dashboard/cvs/${summary.basedOn.id}`}
                  className="underline"
                >
                  {summary.basedOn.title}
                </Link>
              </>
            )}
            {summary.job && (
              <>
                {" · for "}
                <Link
                  href={`/dashboard/jobs/${summary.job.id}?tab=cv`}
                  className="underline"
                >
                  {[summary.job.company, summary.job.title]
                    .filter(Boolean)
                    .join(" — ")}
                </Link>
              </>
            )}
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Trash2 className="size-4" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this CV?</AlertDialogTitle>
              <AlertDialogDescription>
                {summary.job
                  ? "The job keeps going without a CV until you make a new one."
                  : "CVs made from it keep their content but can't be regenerated from it."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={() =>
                  cv.remove.mutate(undefined, {
                    onSuccess: () => router.push("/dashboard/cvs"),
                  })
                }
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <CvEditor
        state={state}
        saving={cv.save.isPending}
        onSave={(content, done) =>
          cv.save.mutate(
            { content },
            {
              onSuccess: done,
              onError: () =>
                toast({ title: "Could not save", variant: "destructive" }),
            }
          )
        }
        onRebuild={() => cv.rebuild.mutate()}
        rebuilding={cv.rebuild.isPending}
        rebuildLabel={
          summary.origin === "UPLOADED" ? "Read again" : "Regenerate"
        }
        emptyText={
          summary.origin === "UPLOADED"
            ? "Reading your CV into sections (about 20 seconds)…"
            : "Writing this CV (about 15 seconds)…"
        }
      />
    </div>
  )
}
