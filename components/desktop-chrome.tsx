"use client"

import { useEffect } from "react"

import { useDesktop } from "@/hooks/use-desktop"

/**
 * Desktop window chrome. On macOS the Electron window has a hidden title bar
 * (desktop/main.ts), so this draws a draggable strip under the traffic
 * lights and marks `<html data-desktop>`, which pushes the page below it
 * (app/globals.css). Renders nothing on the web.
 */
export function DesktopChrome() {
  const desktop = useDesktop()

  useEffect(() => {
    if (!desktop) return
    const root = document.documentElement
    root.dataset.desktop = desktop.platform
    return () => {
      delete root.dataset.desktop
    }
  }, [desktop])

  if (desktop?.platform !== "darwin") return null
  return (
    <div
      aria-hidden
      className="app-drag fixed inset-x-0 top-0 z-[60] h-[--titlebar] bg-sidebar"
    />
  )
}
