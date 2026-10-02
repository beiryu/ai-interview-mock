/** Pure helpers for the email-only sign-in (kept apart for unit tests). */

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"])

/** "localhost:3000" / "127.0.0.1" / "[::1]:3000" → true; LAN IPs, domains → false */
export function isLocalHost(host: string | null | undefined) {
  if (!host) return false
  const value = host.trim().toLowerCase()
  const hostname = value.startsWith("[")
    ? value.slice(0, value.indexOf("]") + 1)
    : value.split(":")[0]
  return LOCAL_HOSTNAMES.has(hostname)
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}
