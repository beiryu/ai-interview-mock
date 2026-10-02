const VERIFY_PATH = "/api/auth/magic-link/verify"

/**
 * In the desktop app the magic link opens in the system browser, so the
 * session cookie lands there. The user pastes the link instead; only links
 * to this app's own verify endpoint are followed.
 */
export function parseMagicLink(input: string, origin: string): string | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.origin !== origin || url.pathname !== VERIFY_PATH) return null
  if (!url.searchParams.get("token")) return null
  return url.toString()
}
