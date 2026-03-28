import { NextResponse } from "next/server"

import { internalWechatComputerUseReadRequestSchema } from "@/lib/computer-use/contracts"
import { readWechatConversationFromScreenshot } from "@/lib/computer-use/wechat-reader"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const body = await request.json()
  const payload = internalWechatComputerUseReadRequestSchema.parse(body)
  const data = await readWechatConversationFromScreenshot(payload)

  return NextResponse.json({ data })
}
