import { describe, expect, it } from "vitest"

import { isLocalHost, normalizeEmail } from "./auth-local"

describe("isLocalHost", () => {
  it("accepts loopback hosts with or without a port", () => {
    for (const host of [
      "localhost",
      "localhost:3000",
      "127.0.0.1:3000",
      "[::1]:3000",
      "LOCALHOST:3000",
    ]) {
      expect(isLocalHost(host)).toBe(true)
    }
  })

  it("rejects LAN addresses, other domains and missing hosts", () => {
    for (const host of [
      "192.168.1.20:3000",
      "10.0.0.5",
      "example.com",
      "localhost.evil.com",
      "",
      null,
    ]) {
      expect(isLocalHost(host)).toBe(false)
    }
  })
})

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Me@Example.COM ")).toBe("me@example.com")
  })
})
