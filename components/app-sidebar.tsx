"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import {
  BookOpen,
  Bot,
  Frame,
  Fullscreen,
  LifeBuoy,
  Map,
  PieChart,
  Podcast,
  Send,
  Settings2,
} from "lucide-react"

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
import { NavProjects } from "@/components/nav-projects"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"

const data = {
  navMain: [
    {
      title: "Interview",
      url: "/dashboard/interviews",
      icon: Fullscreen,
      items: [
        {
          title: "Interview Sessions",
          url: "/dashboard/interviews",
        },
      ],
    },
    {
      title: "AI Tools",
      url: "/dashboard/tools",
      icon: Bot,
      items: [
        {
          title: "Speak with Buddy",
          url: "/dashboard/tools",
        },
      ],
    },
    {
      title: "Documentation",
      url: "/dashboard/documents",
      icon: BookOpen,
      items: [
        {
          title: "Resource Center",
          url: "/dashboard/documents",
        },
      ],
    },
    {
      title: "Settings",
      url: "/dashboard/settings",
      icon: Settings2,
      items: [
        {
          title: "General",
          url: "/dashboard/settings",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Support",
      url: "#",
      icon: LifeBuoy,
    },
    {
      title: "Feedback",
      url: "#",
      icon: Send,
    },
  ],
  projects: [
    {
      name: "Design Engineering",
      url: "#",
      icon: Frame,
    },
    {
      name: "Sales & Marketing",
      url: "#",
      icon: PieChart,
    },
    {
      name: "Travel",
      url: "#",
      icon: Map,
    },
  ],
}

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & { user: SessionUser }) {
  const pathname = usePathname()

  // Dynamically determine which navigation item is active based on current path
  const navMainWithActiveState = data.navMain.map((item) => ({
    ...item,
    isActive: pathname
      ? (item.url !== "#" && pathname.startsWith(item.url)) ||
        (item.items &&
          item.items.some(
            (subItem) => subItem.url !== "#" && pathname.startsWith(subItem.url)
          ))
      : false,
  }))

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Podcast className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    Let&apos;s Talk Wise
                  </span>
                  <span className="truncate text-xs">Enterprise</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMainWithActiveState} />
        <NavProjects projects={data.projects} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
