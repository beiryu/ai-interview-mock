import { NextResponse } from "next/server"

import { env } from "@/env.mjs"
import { getGatewayCredits } from "@/lib/ai/models"
import { getCurrentUser } from "@/lib/session"

const DAYS = 30

/** AI Gateway credit balance + recent Soniox (voice) spend, for the gear menu. */
async function gateway() {
  try {
    const { balance, totalUsed } = await getGatewayCredits()
    return { balance, totalUsed }
  } catch {
    return null
  }
}

async function soniox() {
  // Soniox has no "remaining balance" API — only usage. Show recent spend.
  if (!env.SONIOX_API_KEY) return null
  try {
    const end = new Date()
    const start = new Date(end.getTime() - DAYS * 24 * 60 * 60 * 1000)
    const url =
      "https://api.soniox.com/v1/usage/summary" +
      `?start_time=${start.toISOString()}&end_time=${end.toISOString()}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${env.SONIOX_API_KEY}` },
    })
    if (!res.ok) return null
    const data = await res.json()
    return {
      days: DAYS,
      spentUsd: Number(data?.total?.total_cost_usd ?? 0),
      requests: Number(data?.total?.total_num_requests ?? 0),
    }
  } catch {
    return null
  }
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return new NextResponse("Unauthorized", { status: 401 })

  const [gatewayData, sonioxData] = await Promise.all([gateway(), soniox()])
  return NextResponse.json({ gateway: gatewayData, soniox: sonioxData })
}
