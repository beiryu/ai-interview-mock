/** The Electron bridge, or undefined in a normal browser (and on the server). */
export function getDesktop(): DesktopBridge | undefined {
  return typeof window === "undefined" ? undefined : window.desktop
}
