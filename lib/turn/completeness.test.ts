import { describe, expect, it } from "vitest"

import { scoreCompleteness } from "./completeness"

describe("scoreCompleteness", () => {
  it.each([
    "Tell me about a time you disagreed with your manager.",
    "What is the difference between a process and a thread?",
    "Can you walk me through your last project",
    "Why do you want to leave your current job",
    "Em kể về dự án gần nhất của em đi được không",
    "Tại sao em muốn chuyển việc",
    "Em đã từng làm việc với Kubernetes chưa",
    "Hệ thống đó scale như thế nào",
    "Em nghĩ sao về microservices?",
  ])("complete: %s", (text) => {
    expect(scoreCompleteness(text)).toBe("complete")
  })

  it.each([
    "Tell me about a time when you and",
    "So the next thing I want to ask is, um",
    "What would you do if",
    "Em kể về dự án mà",
    "Trong dự án đó thì",
    "Ở công ty cũ em làm backend và",
    "Anh muốn hỏi về cái",
    "Let me think,",
  ])("incomplete: %s", (text) => {
    expect(scoreCompleteness(text)).toBe("incomplete")
  })

  it.each(["Okay", "Great, thanks", "Ừ được", ""])("unknown: %s", (text) => {
    expect(scoreCompleteness(text)).toBe("unknown")
  })
})
