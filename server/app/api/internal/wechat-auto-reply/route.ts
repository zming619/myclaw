import { NextResponse } from "next/server"

import { internalWechatAutoReplyRequestSchema } from "@/lib/wechat-auto-replies/contracts"
import { generateWechatAutoReply } from "@/lib/wechat-auto-replies/service"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const body = await request.json()
  const payload = internalWechatAutoReplyRequestSchema.parse(body)
  const data = await generateWechatAutoReply(payload)

  return NextResponse.json({ data })
}
