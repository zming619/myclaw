import {
  getModelSettingsSnapshot,
  getWechatAutoReplySystemSetting,
} from "@/lib/settings/store"
import type { ModelProvider, ModelSettingValue } from "@/lib/settings/contracts"
import type {
  InternalWechatComputerUseReadRequest,
  InternalWechatComputerUseReadResponse,
} from "@/lib/computer-use/contracts"

type ChatMessage =
  | {
      role: "system"
      content: string
    }
  | {
      role: "user"
      content: Array<
        | {
            type: "text"
            text: string
          }
        | {
            type: "image_url"
            image_url: {
              url: string
            }
          }
      >
    }

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "")
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

function buildFailureResponse(
  status: "misconfigured" | "failed",
  reason: string,
  visionModel: string,
  provider: ModelProvider | null
): InternalWechatComputerUseReadResponse {
  return {
    status,
    reason,
    provider,
    visionModel,
    sourceName: null,
    sourceType: null,
    latestUserMessage: null,
    conversationMessages: [],
    observationText: null,
  }
}

function extractJsonObject(text: string) {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error("视觉模型返回了空内容。")
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/i)
  const candidate = fencedMatch?.[1] ?? trimmed
  const start = candidate.indexOf("{")
  const end = candidate.lastIndexOf("}")
  if (start < 0 || end <= start) {
    throw new Error("视觉模型没有返回可解析的 JSON 结构。")
  }
  return JSON.parse(candidate.slice(start, end + 1)) as {
    sourceName?: unknown
    sourceType?: unknown
    latestUserMessage?: unknown
    conversationMessages?: unknown
    observationText?: unknown
  }
}

function normalizeConversationMessages(input: unknown) {
  if (!Array.isArray(input)) {
    return []
  }

  return input
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null
      }
      const role =
        item &&
        typeof item === "object" &&
        "role" in item &&
        (item.role === "user" || item.role === "assistant")
          ? item.role
          : null
      const content =
        item &&
        typeof item === "object" &&
        "content" in item &&
        typeof item.content === "string"
          ? item.content.trim()
          : ""

      if (!role || !content) {
        return null
      }
      return { role, content }
    })
    .filter((item): item is { role: "user" | "assistant"; content: string } =>
      Boolean(item)
    )
    .slice(-12)
}

function buildVisionMessages(
  input: InternalWechatComputerUseReadRequest
): ChatMessage[] {
  const sourceHintBlock = input.sourceHint?.trim()
    ? `当前会话或目标提示：${input.sourceHint}`
    : "当前没有额外的会话提示。"
  const sourceTypeHintBlock = input.sourceTypeHint
    ? `会话类型提示：当前目标更可能是 ${input.sourceTypeHint === "group" ? "微信群聊" : "微信好友私聊"}。`
    : "当前没有额外的会话类型提示。"

  return [
    {
      role: "system",
      content: [
        "你是 MyClaw 的微信桌面截图识别器。",
        "你会收到一张微信桌面端聊天窗口截图。",
        "只提取当前打开会话的标题、会话类型、最近一条需要回复的用户消息，以及最多 8 条最近上下文。",
        "如果无法确认某个字段，请返回空字符串或空数组，不要编造。",
        "严格只返回 JSON，不要输出解释或 Markdown。",
        'JSON 结构必须是 {"sourceName":"","sourceType":"user|group","latestUserMessage":"","conversationMessages":[{"role":"user|assistant","content":""}],"observationText":""}',
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: [
            "请读取这张微信桌面截图。",
            sourceHintBlock,
            sourceTypeHintBlock,
            "要求：",
            "1. sourceName 是当前会话标题。",
            '2. sourceType 只能是 "user" 或 "group"。',
            "3. latestUserMessage 是最近一条来自对方、且值得自动回复的文本。",
            "4. conversationMessages 只保留最近上下文，按时间顺序输出。",
            "5. observationText 用一句话概括截图里你看到的聊天情况。",
          ].join("\n"),
        },
        {
          type: "image_url",
          image_url: {
            url: input.screenshotDataUrl,
          },
        },
      ],
    },
  ]
}

function normalizeSourceType(
  input: InternalWechatComputerUseReadRequest,
  parsedSourceType: unknown,
  sourceName: string,
  conversationMessages: Array<{ role: "user" | "assistant"; content: string }>
) {
  if (input.sourceTypeHint) {
    return input.sourceTypeHint
  }

  if (parsedSourceType === "group" || parsedSourceType === "user") {
    return parsedSourceType
  }

  if (/[（(]\d+[）)]/.test(sourceName) || /群|讨论组|项目组|测试组/.test(sourceName)) {
    return "group" as const
  }

  const hasSpeakerPrefix = conversationMessages.some((item) =>
    /^[^:\n]{1,20}[:：]\s*\S/.test(item.content)
  )
  if (hasSpeakerPrefix) {
    return "group" as const
  }

  return null
}

async function requestVisionCompletion(
  settings: ModelSettingValue,
  visionModel: string,
  messages: ChatMessage[]
) {
  const response = await fetch(
    `${normalizeBaseUrl(settings.baseUrl)}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: visionModel,
        temperature: 0,
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
  }

  if (!response.ok) {
    throw new Error(payload.error?.message || "截图识别模型调用失败")
  }

  const content = extractAssistantText(payload.choices?.[0]?.message?.content)
  if (!content) {
    throw new Error("截图识别模型返回了空内容。")
  }
  return content
}

export async function readWechatConversationFromScreenshot(
  input: InternalWechatComputerUseReadRequest
): Promise<InternalWechatComputerUseReadResponse> {
  const systemSettings = await getWechatAutoReplySystemSetting()
  const modelSettingsSnapshot = await getModelSettingsSnapshot()
  const provider = systemSettings.modelProvider
  const settings = modelSettingsSnapshot[provider]
  const visionModel = settings.visionModel.trim() || settings.model.trim()

  if (!settings.enabled) {
    return buildFailureResponse(
      "misconfigured",
      "当前系统设置选中的模型服务商未启用，无法执行截图读消息。",
      visionModel,
      provider
    )
  }

  if (!settings.apiKey.trim()) {
    return buildFailureResponse(
      "misconfigured",
      "当前模型配置缺少 API Key，无法执行截图读消息。",
      visionModel,
      provider
    )
  }

  if (!visionModel) {
    return buildFailureResponse(
      "misconfigured",
      "当前模型配置缺少 visionModel 或对话模型，无法执行截图读消息。",
      visionModel,
      provider
    )
  }

  try {
    const raw = await requestVisionCompletion(
      settings,
      visionModel,
      buildVisionMessages(input)
    )
    const parsed = extractJsonObject(raw)
    const sourceName =
      typeof parsed.sourceName === "string" ? parsed.sourceName.trim() : ""
    const latestUserMessage =
      typeof parsed.latestUserMessage === "string"
        ? parsed.latestUserMessage.trim()
        : ""
    const observationText =
      typeof parsed.observationText === "string"
        ? parsed.observationText.trim()
        : raw.trim()
    const conversationMessages = normalizeConversationMessages(
      parsed.conversationMessages
    )
    const sourceType = normalizeSourceType(
      input,
      parsed.sourceType,
      sourceName,
      conversationMessages
    )

    if (
      !sourceName &&
      !latestUserMessage &&
      conversationMessages.length === 0 &&
      !observationText
    ) {
      return buildFailureResponse(
        "failed",
        "视觉模型没有从截图中提取到会话内容，请确认当前模型支持图片输入，并优先在模型设置里填写 visionModel。",
        visionModel,
        provider
      )
    }

    return {
      status: "read",
      provider,
      visionModel,
      sourceName: sourceName || null,
      sourceType,
      latestUserMessage: latestUserMessage || null,
      conversationMessages,
      observationText: observationText || null,
    }
  } catch (error) {
    return buildFailureResponse(
      "failed",
      error instanceof Error ? error.message : "截图读消息失败",
      visionModel,
      provider
    )
  }
}
