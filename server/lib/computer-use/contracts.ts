import { z } from "zod"

import { wechatConversationMessageSchema } from "@/lib/wechat-auto-replies/contracts"

export const internalWechatComputerUseReadRequestSchema = z.object({
  screenshotDataUrl: z.string().trim().min(32).startsWith("data:image/"),
  sourceHint: z.string().trim().max(120).optional(),
  sourceTypeHint: z.enum(["user", "group"]).optional(),
  deviceId: z.string().trim().min(1).optional(),
  deviceAlias: z.string().trim().min(1).optional(),
})

export type InternalWechatComputerUseReadRequest = z.infer<
  typeof internalWechatComputerUseReadRequestSchema
>

export interface InternalWechatComputerUseReadResponse {
  status: "read" | "misconfigured" | "failed"
  reason?: string
  provider: string | null
  visionModel: string
  sourceName: string | null
  sourceType: "user" | "group" | null
  latestUserMessage: string | null
  conversationMessages: Array<z.infer<typeof wechatConversationMessageSchema>>
  observationText: string | null
}
