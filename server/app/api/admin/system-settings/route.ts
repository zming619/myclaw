import { NextResponse } from "next/server"

import {
  getWechatAutoReplySystemSetting,
  saveWechatAutoReplySystemSetting,
} from "@/lib/settings/store"
import { buildWechatAutoReplySettingPayload } from "@/lib/settings/validators"

export const dynamic = "force-dynamic"

export async function GET() {
  const data = await getWechatAutoReplySystemSetting()

  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const body = await request.json()
  const payload = buildWechatAutoReplySettingPayload(body)
  const data = await saveWechatAutoReplySystemSetting(payload)

  return NextResponse.json({ data })
}

