import { useSyncExternalStore } from "react"

import { getDesktop } from "@/lib/desktop"

const noSubscribe = () => () => {}

/**
 * The desktop bridge for rendering decisions. The server (and the first
 * client render) see `undefined`, so desktop-only UI doesn't cause a
 * hydration mismatch.
 */
export function useDesktop() {
  return useSyncExternalStore(noSubscribe, getDesktop, () => undefined)
}
