"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

const SECTIONS: { path: string; title: string }[] = [
  { path: "/dashboard/interviews", title: "Interviews" },
  { path: "/dashboard/documents", title: "Documents" },
  { path: "/dashboard/profile", title: "Profile prep" },
  { path: "/dashboard/settings", title: "Settings" },
]

export function BreadcrumbNav() {
  const pathname = usePathname() || ""
  const section = SECTIONS.find((s) => pathname.startsWith(s.path))

  if (!section) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Home</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    )
  }

  // Deeper interview pages: /dashboard/interviews/[id], /[id]/sessions, /[id]/cv
  const sub =
    section.path === "/dashboard/interviews" && pathname !== section.path
      ? pathname.endsWith("/sessions")
        ? "Past sessions"
        : pathname.endsWith("/cv")
        ? "Tailored CV"
        : "Live session"
      : null

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {sub ? (
          <>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink asChild>
                <Link href={section.path}>{section.title}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbPage>{sub}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : (
          <BreadcrumbItem>
            <BreadcrumbPage>{section.title}</BreadcrumbPage>
          </BreadcrumbItem>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
