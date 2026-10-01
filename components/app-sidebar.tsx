"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  FileText,
  LayoutDashboard,
  Mic,
  Podcast,
  Settings2,
  UserRoundCheck,
} from "lucide-react"

import { siteConfig } from "@/config/defaults/site"
import type { SessionUser } from "@/lib/auth"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"

const NAV_ITEMS = [
  { title: "Home", url: "/dashboard", icon: LayoutDashboard, exact: true },
  { title: "Interviews", url: "/dashboard/interviews", icon: Mic },
  { title: "Documents", url: "/dashboard/documents", icon: FileText },
  { title: "Profile prep", url: "/dashboard/profile", icon: UserRoundCheck },
  { title: "Settings", url: "/dashboard/settings", icon: Settings2 },
]

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & { user: SessionUser }) {
  const pathname = usePathname() ?? ""

  const items = NAV_ITEMS.map((item) => ({
    ...item,
    isActive: item.exact
      ? pathname === item.url
      : pathname.startsWith(item.url),
  }))

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Podcast className="size-4" />
                </div>
                <span className="truncate font-semibold">
                  {siteConfig.name}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={items} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
