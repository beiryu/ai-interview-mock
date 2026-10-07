import { describe, expect, it } from "vitest"

import { pcm16Rms, toPcm16 } from "./rms"

describe("pcm16Rms", () => {
  it("is 0 for silence, 1 at full scale, and tracks quiet levels", () => {
    expect(pcm16Rms(new Int16Array(1920))).toBe(0)
    const half = new Int16Array(1920).map((_, i) => (i % 2 ? 0x7fff : -0x8000))
    expect(pcm16Rms(half)).toBeCloseTo(1, 5)
    const quiet = new Int16Array(1920).fill(Math.round(0.02 * 0x7fff))
    expect(pcm16Rms(quiet)).toBeCloseTo(0.02, 3)
  })
})

describe("toPcm16", () => {
  it("reads unaligned little-endian bytes", () => {
    const bytes = new Uint8Array([0, 0x10, 0x00, 0xff, 0x7f]).subarray(1)
    expect(Array.from(toPcm16(bytes))).toEqual([0x10, 0x7fff])
  })
})
