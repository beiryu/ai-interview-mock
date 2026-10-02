import { describe, expect, it } from "vitest"

import { parseMagicLink } from "./magic-link"

const origin = "http://localhost:3000"

describe("parseMagicLink", () => {
  it("accepts this app's verify link", () => {
    const link = `${origin}/api/auth/magic-link/verify?token=abc&callbackURL=%2Fdashboard`
    expect(parseMagicLink(`  ${link} `, origin)).toBe(link)
  })

  it("rejects other origins, paths and missing tokens", () => {
    expect(
      parseMagicLink(
        "https://evil.test/api/auth/magic-link/verify?token=a",
        origin
      )
    ).toBeNull()
    expect(parseMagicLink(`${origin}/dashboard?token=a`, origin)).toBeNull()
    expect(
      parseMagicLink(`${origin}/api/auth/magic-link/verify`, origin)
    ).toBeNull()
    expect(parseMagicLink("not a url", origin)).toBeNull()
  })
})
