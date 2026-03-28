import { getSqlClient } from "@/lib/db/client"
import type {
  ModelProvider,
  ModelSettingValue,
} from "@/lib/settings/contracts"
import {
  getModelSettingsSnapshot,
  getWechatAutoReplySystemSetting,
} from "@/lib/settings/store"
import type {
  InternalWechatAutoReplyRequest,
  InternalWechatAutoReplyResponse,
  WechatAutoReplyTaskExecutionPayload,
} from "@/lib/wechat-auto-replies/contracts"
import {
  createWechatAutoReplyRecord,
  createWechatAutoReplyTaskExecution,
} from "@/lib/wechat-auto-replies/store"
import { tryExecuteAutoReplyTask } from "@/lib/wechat-auto-replies/tasks"

type ChatMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

type UsagePayload = {
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
}

type KnowledgeSnippet = {
  content: string
  documentTitle: string | null
  similarity: number | null
}

type KnowledgeContextResult = {
  snippets: KnowledgeSnippet[]
  matched: boolean
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "")
}

function toDate(value: unknown, fallback = new Date()) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }

  return fallback
}

function buildAutoReplyModelLabel(
  provider: ModelProvider,
  settings: ModelSettingValue
) {
  return `${provider}:${settings.model || "unconfigured"}`
}

function buildFailureResponse(
  status: "disabled" | "misconfigured" | "failed",
  reason: string,
  autoReplyModel: string,
  provider: ModelProvider | null,
  knowledgeBaseSlug: string | null
): InternalWechatAutoReplyResponse {
  return {
    status,
    reason,
    replyContent: null,
    autoReplyModel,
    provider,
    knowledgeBaseSlug,
    knowledgeMatched: false,
    knowledgeCount: 0,
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    replyTime: null,
    recordId: null,
    taskExecutions: [],
  }
}

async function persistTaskExecutionForRecord(
  recordId: number,
  execution: {
    taskType: string
    taskStatus: "succeeded" | "failed" | "needs_clarification"
    taskTitle: string
    taskInput: Record<string, unknown>
    taskOutput: Record<string, unknown>
    errorMessage: string | null
    startedAt: Date
    finishedAt: Date
  }
): Promise<WechatAutoReplyTaskExecutionPayload> {
  return createWechatAutoReplyTaskExecution({
    recordId,
    taskType: execution.taskType,
    taskStatus: execution.taskStatus,
    taskTitle: execution.taskTitle,
    taskInput: execution.taskInput,
    taskOutput: execution.taskOutput,
    errorMessage: execution.errorMessage,
    startedAt: execution.startedAt,
    finishedAt: execution.finishedAt,
  })
}

function extractAssistantText(payload: unknown): string {
  if (typeof payload === "string") {
    return payload.trim()
  }

  if (Array.isArray(payload)) {
    return payload
      .map((item) => {
        if (typeof item === "string") {
          return item
        }
        if (
          item &&
          typeof item === "object" &&
          "type" in item &&
          item.type === "text" &&
          "text" in item &&
          typeof item.text === "string"
        ) {
          return item.text
        }
        return ""
      })
      .join("\n")
      .trim()
  }

  return ""
}

async function requestEmbedding(
  settings: ModelSettingValue,
  input: string
): Promise<number[] | null> {
  if (!settings.embeddingModel || !settings.apiKey.trim()) {
    return null
  }

  const response = await fetch(`${normalizeBaseUrl(settings.baseUrl)}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.embeddingModel,
      input,
    }),
    signal: AbortSignal.timeout(settings.timeoutSeconds * 1000),
  })

  if (!response.ok) {
    return null
  }

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>
  }

  const embedding = payload.data?.[0]?.embedding
  return Array.isArray(embedding) ? embedding : null
}

async function fetchKnowledgeContext(
  knowledgeBaseSlug: string,
  query: string,
  topK: number,
  settings: ModelSettingValue
): Promise<KnowledgeContextResult> {
  const sqlClient = getSqlClient()
  const vector = await requestEmbedding(settings, query)

  if (vector?.length) {
    try {
      const vectorLiteral = `[${vector.join(",")}]`
      const rows = await sqlClient<{
        content: string
        documentTitle: string | null
        similarity: number | string | null
      }[]>`
        select
          rc.content,
          rd.title as "documentTitle",
          1 - (rc.embedding <=> ${vectorLiteral}::vector) as similarity
        from rag_chunks rc
        join rag_documents rd on rd.id = rc.document_id
        join rag_knowledge_bases kb on kb.id = rc.knowledge_base_id
        where kb.slug = ${knowledgeBaseSlug}
          and rc.embedding is not null
        order by rc.embedding <=> ${vectorLiteral}::vector
        limit ${topK}
      `

      const snippets = rows.map((row) => ({
        content: row.content,
        documentTitle: row.documentTitle,
        similarity:
          typeof row.similarity === "number"
            ? row.similarity
            : row.similarity
              ? Number(row.similarity)
              : null,
      }))

      if (snippets.length) {
        return { snippets, matched: true }
      }
    } catch {
      // Fall through to the latest-chunks fallback when vector retrieval is unavailable.
    }
  }

  const fallbackRows = await sqlClient<{
    content: string
    documentTitle: string | null
  }[]>`
    select
      rc.content,
      rd.title as "documentTitle"
    from rag_chunks rc
    join rag_documents rd on rd.id = rc.document_id
    join rag_knowledge_bases kb on kb.id = rc.knowledge_base_id
    where kb.slug = ${knowledgeBaseSlug}
    order by rc.created_at desc
    limit ${topK}
  `

  return {
    snippets: fallbackRows.map((row) => ({
      content: row.content,
      documentTitle: row.documentTitle,
      similarity: null,
    })),
    matched: fallbackRows.length > 0,
  }
}

function buildMessages(input: InternalWechatAutoReplyRequest, context: {
  systemPrompt: string
  knowledgeSnippets: KnowledgeSnippet[]
  maxContextMessages: number
}): ChatMessage[] {
  const messages: ChatMessage[] = []
  const knowledgeBlock = context.knowledgeSnippets.length
    ? context.knowledgeSnippets
        .map((snippet, index) => {
          const title = snippet.documentTitle || `知识片段 ${index + 1}`
          return `【${title}】\n${snippet.content}`
        })
        .join("\n\n")
    : ""

  const systemParts = [
    context.systemPrompt,
    "回复要适合微信聊天场景，语气自然、简洁、可信，不要编造业务事实。",
    knowledgeBlock
      ? `可用知识库上下文如下，请优先基于这些内容回答：\n${knowledgeBlock}`
      : "当前没有可用的知识库上下文，如果缺少业务事实，直接明确说明并建议人工跟进。",
  ]

  messages.push({
    role: "system",
    content: systemParts.join("\n\n"),
  })

  const history = (input.conversationMessages || []).slice(
    -Math.max(context.maxContextMessages, 0)
  )

  for (const item of history) {
    messages.push({
      role: item.role,
      content: item.content,
    })
  }

  const latestUserMessage = `来源：${
    input.sourceType === "group" ? "微信群聊" : "微信好友"
  }「${input.sourceName}」\n最新消息：${input.messageContent}`
  const historyLast = history[history.length - 1]

  if (
    !historyLast ||
    historyLast.role !== "user" ||
    historyLast.content.trim() !== input.messageContent.trim()
  ) {
    messages.push({
      role: "user",
      content: latestUserMessage,
    })
  }

  return messages
}

async function requestChatCompletion(
  settings: ModelSettingValue,
  messages: ChatMessage[]
): Promise<{ content: string; usage: UsagePayload }> {
  const response = await fetch(
    `${normalizeBaseUrl(settings.baseUrl)}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages,
      }),
      signal: AbortSignal.timeout(settings.timeoutSeconds * 1000),
    }
  )

  const payload = (await response.json()) as {
    error?: { message?: string }
    choices?: Array<{
      message?: {
        content?: unknown
      }
    }>
    usage?: {
      prompt_tokens?: number
      completion_tokens?: number
      total_tokens?: number
    }
  }

  if (!response.ok) {
    throw new Error(payload.error?.message || "模型调用失败")
  }

  const content = extractAssistantText(payload.choices?.[0]?.message?.content)
  if (!content) {
    throw new Error("模型返回了空内容，未生成可用回复。")
  }

  return {
    content,
    usage: {
      promptTokens: payload.usage?.prompt_tokens ?? null,
      completionTokens: payload.usage?.completion_tokens ?? null,
      totalTokens: payload.usage?.total_tokens ?? null,
    },
  }
}

export async function generateWechatAutoReply(
  input: InternalWechatAutoReplyRequest
): Promise<InternalWechatAutoReplyResponse> {
  const systemSetting = await getWechatAutoReplySystemSetting()
  const modelSnapshot = await getModelSettingsSnapshot()
  const provider = systemSetting.modelProvider
  const modelSetting = modelSnapshot[provider]
  const autoReplyModel = buildAutoReplyModelLabel(provider, modelSetting)
  const messageTime = toDate(input.messageTime)

  if (!systemSetting.enabled) {
    const record = await createWechatAutoReplyRecord({
      sourceType: input.sourceType,
      sourceName: input.sourceName,
      messageContent: input.messageContent,
      messageTime,
      autoReplyModel,
      replyContent: null,
      replyTime: null,
    })

    return {
      ...buildFailureResponse(
        "disabled",
        "系统设置中的微信自动回复当前处于关闭状态。",
        autoReplyModel,
        provider,
        systemSetting.knowledgeBaseSlug
      ),
      recordId: record.id,
    }
  }

  const taskExecution = await tryExecuteAutoReplyTask(input.messageContent)

  if (taskExecution) {
    const replyTime = new Date()
    const record = await createWechatAutoReplyRecord({
      sourceType: input.sourceType,
      sourceName: input.sourceName,
      messageContent: input.messageContent,
      messageTime,
      autoReplyModel: `task:${taskExecution.taskType}`,
      replyContent: taskExecution.replyContent,
      replyTime,
    })
    const persistedExecution = await persistTaskExecutionForRecord(record.id, taskExecution)

    return {
      status: "answered",
      reason: taskExecution.errorMessage ?? undefined,
      replyContent: taskExecution.replyContent,
      autoReplyModel: `task:${taskExecution.taskType}`,
      provider: null,
      knowledgeBaseSlug: null,
      knowledgeMatched: false,
      knowledgeCount: 0,
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      replyTime: replyTime.toISOString(),
      recordId: record.id,
      taskExecutions: [persistedExecution],
    }
  }

  if (!modelSetting.enabled || !modelSetting.apiKey.trim() || !modelSetting.model.trim()) {
    const reason = `${provider} 模型未启用，或缺少 API Key / model 配置。`
    const record = await createWechatAutoReplyRecord({
      sourceType: input.sourceType,
      sourceName: input.sourceName,
      messageContent: input.messageContent,
      messageTime,
      autoReplyModel,
      replyContent: null,
      replyTime: null,
    })

    return {
      ...buildFailureResponse(
        "misconfigured",
        reason,
        autoReplyModel,
        provider,
        systemSetting.knowledgeBaseSlug
      ),
      recordId: record.id,
    }
  }

  try {
    const knowledge = await fetchKnowledgeContext(
      systemSetting.knowledgeBaseSlug,
      input.messageContent,
      systemSetting.topK,
      modelSetting
    )

    const messages = buildMessages(input, {
      systemPrompt: systemSetting.systemPrompt,
      knowledgeSnippets: knowledge.snippets,
      maxContextMessages: systemSetting.maxContextMessages,
    })

    const completion = await requestChatCompletion(modelSetting, messages)
    const replyTime = new Date()
    const record = await createWechatAutoReplyRecord({
      sourceType: input.sourceType,
      sourceName: input.sourceName,
      messageContent: input.messageContent,
      messageTime,
      autoReplyModel,
      promptTokens: completion.usage.promptTokens,
      completionTokens: completion.usage.completionTokens,
      totalTokens: completion.usage.totalTokens,
      replyContent: completion.content,
      replyTime,
    })

    return {
      status: "answered",
      replyContent: completion.content,
      autoReplyModel,
      provider,
      knowledgeBaseSlug: systemSetting.knowledgeBaseSlug,
      knowledgeMatched: knowledge.matched,
      knowledgeCount: knowledge.snippets.length,
      promptTokens: completion.usage.promptTokens,
      completionTokens: completion.usage.completionTokens,
      totalTokens: completion.usage.totalTokens,
      replyTime: replyTime.toISOString(),
      recordId: record.id,
      taskExecutions: [],
    }
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "服务端自动回复生成失败，请检查模型配置。"
    const record = await createWechatAutoReplyRecord({
      sourceType: input.sourceType,
      sourceName: input.sourceName,
      messageContent: input.messageContent,
      messageTime,
      autoReplyModel,
      replyContent: null,
      replyTime: null,
    })

    return {
      ...buildFailureResponse(
        "failed",
        reason,
        autoReplyModel,
        provider,
        systemSetting.knowledgeBaseSlug
      ),
      recordId: record.id,
    }
  }
}
