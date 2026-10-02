import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import {
  UnsupportedFileError,
  extractDocumentText,
  normalizeText,
  titleFromFileName,
} from "./extract"

const fixture = (name: string) =>
  new Uint8Array(readFileSync(path.join(__dirname, "__fixtures__", name)))

describe("extractDocumentText", () => {
  it.each(["cv.txt", "cv.docx", "cv.pdf"])("reads %s", async (name) => {
    const { title, content } = await extractDocumentText({
      name,
      bytes: fixture(name),
    })
    expect(title).toBe("cv")
    expect(content).toContain("Jane Doe")
    expect(content).toContain("Built payment APIs with NestJS.")
  })

  it("rejects other file types", async () => {
    await expect(
      extractDocumentText({ name: "photo.png", bytes: new Uint8Array(4) })
    ).rejects.toBeInstanceOf(UnsupportedFileError)
  })
})

describe("text helpers", () => {
  it("normalizes line endings, trailing spaces and blank runs", () => {
    expect(normalizeText("A  \r\nB\r\n\r\n\r\n\r\nC\n")).toBe("A\nB\n\nC")
  })

  it("derives a title from the file name", () => {
    expect(titleFromFileName("Jane_Doe_CV.PDF")).toBe("Jane Doe CV")
    expect(titleFromFileName("notes")).toBe("notes")
  })
})
