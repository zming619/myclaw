import { NextResponse } from "next/server"
import { z } from "zod"

import {
  createWechatAutoReplyRecord,
  listWechatAutoReplyRecords,
} from "@/lib/wechat-auto-replies/store"

export const dynamic = "force-dynamic"

const createRecordSchema = z.object({
  sourceType: z.enum(["user", "group"]),
  sourceName: z.string().trim().min(1),
  messageContent: z.string().trim().min(1),
  messageTime: z.coerce.date(),
  autoReplyModel: z.string().trim().min(1),
  promptTokens: z.number().int().nullable().optional(),
  completionTokens: z.number().int().nullable().optional(),
  totalTokens: z.number().int().nullable().optional(),
  replyContent: z.string().trim().nullable().optional(),
  replyTime: z.coerce.date().nullable().optional(),
})

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limitValue = Number(searchParams.get("limit") ?? 50)
  const limit = Number.isFinite(limitValue) ? Math.min(Math.max(limitValue, 1), 200) : 50
  const data = await listWechatAutoReplyRecords(limit)

  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const body = await request.json()
  const payload = createRecordSchema.parse(body)
  const data = await createWechatAutoReplyRecord(payload)

  return NextResponse.json({ data }, { status: 201 })
}

