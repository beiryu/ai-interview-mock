"use client"

import { FileText, ScrollText } from "lucide-react"

import { useJobCv } from "@/hooks/api/cv/useCvs"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Icons } from "@/components/icons"

/** The job's final CV in a side drawer — read-only quick glance mid-interview. */
export function CvSheet({ jobId }: { jobId: string }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          title="The CV you send for this job"
        >
          <FileText className="size-3.5" />
          CV
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full p-0 sm:max-w-2xl">
        <SheetHeader className="border-b px-5 py-3">
          <SheetTitle className="text-sm">CV</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-3.5rem)]">
          <div className="p-5">
            <ReadOnlyCv jobId={jobId} />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  )
}

/** The final CV rendered read-only (no editing / approval / export). */
function ReadOnlyCv({ jobId }: { jobId: string }) {
  const cv = useJobCv(jobId)
  const content = cv.data?.content

  if (cv.isLoading || cv.data?.status === "pending") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icons.spinner className="size-4 animate-spin" />
        Preparing the CV…
      </div>
    )
  }
  if (!content) {
    return (
      <p className="text-sm text-muted-foreground">No CV for this job yet.</p>
    )
  }

  return (
    <div className="space-y-6 text-sm">
      <div className="space-y-1.5">
        {content.headline && (
          <h2 className="text-base font-semibold leading-snug">
            {content.headline}
          </h2>
        )}
        {content.summary && (
          <p className="leading-relaxed text-muted-foreground">
            {content.summary}
          </p>
        )}
      </div>

      {content.skills.length > 0 && (
        <section>
          <Heading>Skills</Heading>
          <div className="space-y-1">
            {content.skills.map((g, i) => (
              <p key={i}>
                <span className="font-medium">{g.group}: </span>
                <span className="text-muted-foreground">
                  {g.items.join(", ")}
                </span>
              </p>
            ))}
          </div>
        </section>
      )}

      {content.experience.length > 0 && (
        <section>
          <Heading>Experience</Heading>
          <div className="space-y-4">
            {content.experience.map((e) => (
              <div key={e.id}>
                <p className="font-medium">{e.role}</p>
                <p className="text-xs text-muted-foreground">
                  {[e.company, e.period].filter(Boolean).join(" · ")}
                </p>
                {e.bullets.length > 0 && (
                  <ul className="mt-1.5 list-disc space-y-1 pl-5 text-muted-foreground">
                    {e.bullets.map((b) => (
                      <li key={b.id}>{b.text}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {content.education.length > 0 && (
        <section>
          <Heading>Education</Heading>
          <div className="space-y-3">
            {content.education.map((ed, i) => (
              <div key={i}>
                <p className="font-medium">{ed.degree}</p>
                <p className="text-xs text-muted-foreground">
                  {[ed.school, ed.period].filter(Boolean).join(" · ")}
                </p>
                {ed.note && (
                  <p className="text-muted-foreground">{ed.note}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

/** The job description in a side drawer (read-only). */
export function JdSheet({
  company,
  title,
  jdText,
}: {
  company?: string
  title?: string
  jdText?: string
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          title="The job description"
        >
          <ScrollText className="size-3.5" />
          JD
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full p-0 sm:max-w-2xl">
        <SheetHeader className="border-b px-5 py-3">
          <SheetTitle className="text-sm">Job description</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-3.5rem)]">
          <div className="space-y-3 p-5">
            {(company || title) && (
              <p className="text-sm font-medium">
                {[company, title].filter(Boolean).join(" · ")}
              </p>
            )}
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {jdText?.trim() || "No job description for this job yet."}
            </p>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
