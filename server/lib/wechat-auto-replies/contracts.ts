import { z } from "zod"

export const wechatConversationMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1),
})

export const internalWechatAutoReplyRequestSchema = z.object({
  sourceType: z.enum(["user", "group"]),
  sourceName: z.string().trim().min(1),
  messageContent: z.string().trim().min(1),
  messageTime: z.coerce.date().optional(),
  conversationMessages: z.array(wechatConversationMessageSchema).max(50).optional(),
  deviceId: z.string().trim().min(1).optional(),
  deviceAlias: z.string().trim().min(1).optional(),
})

export type InternalWechatAutoReplyRequest = z.infer<
  typeof internalWechatAutoReplyRequestSchema
>

export interface WechatAutoReplyTaskExecutionPayload {
  id: number | null
  taskType: string
  taskStatus: "succeeded" | "failed" | "needs_clarification"
  taskTitle: string
  errorMessage: string | null
  startedAt: string | null
  finishedAt: string | null
  taskInput: Record<string, unknown>
  taskOutput: Record<string, unknown>
}

export interface InternalWechatAutoReplyResponse {
  status: "answered" | "disabled" | "misconfigured" | "failed"
  reason?: string
  replyContent: string | null
  autoReplyModel: string
  provider: string | null
  knowledgeBaseSlug: string | null
  knowledgeMatched: boolean
  knowledgeCount: number
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
  replyTime: string | null
  recordId: number | null
  taskExecutions: WechatAutoReplyTaskExecutionPayload[]
}
