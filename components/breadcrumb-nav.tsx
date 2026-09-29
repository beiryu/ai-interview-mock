"use client"

import { usePathname } from "next/navigation"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

const breadcrumbMap = {
  "/dashboard/interviews": {
    parent: { title: "Interview", href: "/dashboard/interviews" },
    current: "Interview Sessions",
  },
  "/dashboard/tools": {
    parent: { title: "AI Tools", href: "/dashboard/tools" },
    current: "Speak with Buddy",
  },
  "/dashboard/documents": {
    parent: { title: "Documents", href: "/dashboard/documents" },
    current: "Resource Center",
  },
  "/dashboard/settings": {
    parent: { title: "Settings", href: "/dashboard/settings" },
    current: "User Settings",
  },
}

export function BreadcrumbNav() {
  const pathname = usePathname() || ""

  const matchPath = Object.keys(breadcrumbMap).find((path) =>
    pathname.startsWith(path)
  )
  const breadcrumb = breadcrumbMap[matchPath as keyof typeof breadcrumbMap]

  if (!breadcrumb) return null

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem className="hidden md:block">
          <BreadcrumbLink href={breadcrumb.parent.href}>
            {breadcrumb.parent.title}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="hidden md:block" />
        <BreadcrumbItem>
          <BreadcrumbPage>{breadcrumb.current}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
