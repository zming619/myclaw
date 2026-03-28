import { NextResponse } from "next/server"

import { getModelSettingsSnapshot, saveModelSettings } from "@/lib/settings/store"
import { buildModelSettingPayload } from "@/lib/settings/validators"

export const dynamic = "force-dynamic"

export async function GET() {
  const data = await getModelSettingsSnapshot()

  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const body = await request.json()
  const payload = buildModelSettingPayload(body)
  const data = await saveModelSettings(payload.provider, payload)

  return NextResponse.json({ data })
}

