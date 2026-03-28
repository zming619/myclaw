import { desc, inArray } from "drizzle-orm"

import { ensureAppDatabase } from "@/lib/db/bootstrap"
import { getDb } from "@/lib/db/client"
import {
  wechatAutoReplyRecords,
  wechatAutoReplyTaskExecutions,
} from "@/lib/db/schema"
import type { WechatAutoReplyTaskExecutionPayload } from "@/lib/wechat-auto-replies/contracts"

export interface CreateWechatAutoReplyRecordInput {
  sourceType: "user" | "group"
  sourceName: string
  messageContent: string
  messageTime: Date
  autoReplyModel: string
  promptTokens?: number | null
  completionTokens?: number | null
  totalTokens?: number | null
  replyContent?: string | null
  replyTime?: Date | null
}

export interface CreateWechatAutoReplyTaskExecutionInput {
  recordId: number
  taskType: string
  taskStatus: "succeeded" | "failed" | "needs_clarification"
  taskTitle: string
  taskInput?: Record<string, unknown>
  taskOutput?: Record<string, unknown>
  errorMessage?: string | null
  startedAt: Date
  finishedAt?: Date | null
}

function serializeTaskExecution(
  taskExecution: typeof wechatAutoReplyTaskExecutions.$inferSelect
): WechatAutoReplyTaskExecutionPayload {
  return {
    id: taskExecution.id,
    taskType: taskExecution.taskType,
    taskStatus: taskExecution.taskStatus as
      | "succeeded"
      | "failed"
      | "needs_clarification",
    taskTitle: taskExecution.taskTitle,
    errorMessage: taskExecution.errorMessage,
    startedAt: taskExecution.startedAt?.toISOString() ?? null,
    finishedAt: taskExecution.finishedAt?.toISOString() ?? null,
    taskInput:
      taskExecution.taskInput && typeof taskExecution.taskInput === "object"
        ? (taskExecution.taskInput as Record<string, unknown>)
        : {},
    taskOutput:
      taskExecution.taskOutput && typeof taskExecution.taskOutput === "object"
        ? (taskExecution.taskOutput as Record<string, unknown>)
        : {},
  }
}

export async function listWechatAutoReplyRecords(limit = 50) {
  await ensureAppDatabase()
  const db = getDb()

  const records = await db
    .select()
    .from(wechatAutoReplyRecords)
    .orderBy(desc(wechatAutoReplyRecords.createdAt))
    .limit(limit)

  if (!records.length) {
    return []
  }

  const executions = await db
    .select()
    .from(wechatAutoReplyTaskExecutions)
    .where(
      inArray(
        wechatAutoReplyTaskExecutions.recordId,
        records.map((record) => record.id)
      )
    )
    .orderBy(desc(wechatAutoReplyTaskExecutions.createdAt))

  const executionsByRecordId = new Map<number, WechatAutoReplyTaskExecutionPayload[]>()

  for (const execution of executions) {
    const group = executionsByRecordId.get(execution.recordId) ?? []
    group.push(serializeTaskExecution(execution))
    executionsByRecordId.set(execution.recordId, group)
  }

  return records.map((record) => ({
    ...record,
    taskExecutions: executionsByRecordId.get(record.id) ?? [],
  }))
}

export async function createWechatAutoReplyRecord(
  input: CreateWechatAutoReplyRecordInput
) {
  await ensureAppDatabase()
  const db = getDb()

  const [created] = await db
    .insert(wechatAutoReplyRecords)
    .values({
      sourceType: input.sourceType,
      sourceName: input.sourceName,
      messageContent: input.messageContent,
      messageTime: input.messageTime,
      autoReplyModel: input.autoReplyModel,
      promptTokens: input.promptTokens ?? null,
      completionTokens: input.completionTokens ?? null,
      totalTokens: input.totalTokens ?? null,
      replyContent: input.replyContent ?? null,
      replyTime: input.replyTime ?? null,
    })
    .returning()

  return created
}

export async function createWechatAutoReplyTaskExecution(
  input: CreateWechatAutoReplyTaskExecutionInput
) {
  await ensureAppDatabase()
  const db = getDb()

  const [created] = await db
    .insert(wechatAutoReplyTaskExecutions)
    .values({
      recordId: input.recordId,
      taskType: input.taskType,
      taskStatus: input.taskStatus,
      taskTitle: input.taskTitle,
      taskInput: input.taskInput ?? {},
      taskOutput: input.taskOutput ?? {},
      errorMessage: input.errorMessage ?? null,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt ?? null,
    })
    .returning()

  return serializeTaskExecution(created)
}
