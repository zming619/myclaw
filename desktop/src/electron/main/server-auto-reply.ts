export interface WechatConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface WechatAutoReplyRequest {
  sourceType: 'user' | 'group'
  sourceName: string
  messageContent: string
  messageTime?: string
  conversationMessages?: WechatConversationMessage[]
  deviceId?: string
  deviceAlias?: string
}

export interface WechatAutoReplyResponse {
  status: 'answered' | 'disabled' | 'misconfigured' | 'failed'
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
  taskExecutions?: Array<{
    id: number | null
    taskType: string
    taskStatus: 'succeeded' | 'failed' | 'needs_clarification'
    taskTitle: string
    errorMessage: string | null
    startedAt: string | null
    finishedAt: string | null
    taskInput: Record<string, unknown>
    taskOutput: Record<string, unknown>
  }>
}

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, '')
}

export class ServerAutoReplyService {
  private readonly serverBaseUrl: string

  constructor(serverBaseUrl = process.env.MYCLAW_SERVER_URL || 'http://127.0.0.1:3000') {
    this.serverBaseUrl = normalizeBaseUrl(serverBaseUrl)
  }

  getBaseUrl() {
    return this.serverBaseUrl
  }

  async requestReply(input: WechatAutoReplyRequest): Promise<WechatAutoReplyResponse> {
    const response = await fetch(`${this.serverBaseUrl}/api/internal/wechat-auto-reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    })

    const payload = (await response.json()) as {
      data?: WechatAutoReplyResponse
      error?: string
    }

    if (!response.ok || !payload.data) {
      throw new Error(payload.error || `服务端自动回复接口失败：HTTP ${response.status}`)
    }

    return payload.data
  }
}
