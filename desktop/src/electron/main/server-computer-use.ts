export interface WechatComputerUseReadRequest {
  screenshotDataUrl: string
  sourceHint?: string
  sourceTypeHint?: 'user' | 'group'
  deviceId?: string
  deviceAlias?: string
}

export interface WechatComputerUseReadResponse {
  status: 'read' | 'misconfigured' | 'failed'
  reason?: string
  provider: string | null
  visionModel: string
  sourceName: string | null
  sourceType: 'user' | 'group' | null
  latestUserMessage: string | null
  conversationMessages: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
  observationText: string | null
}

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, '')
}

export class ServerComputerUseService {
  private readonly serverBaseUrl: string

  constructor(serverBaseUrl = process.env.MYCLAW_SERVER_URL || 'http://127.0.0.1:3000') {
    this.serverBaseUrl = normalizeBaseUrl(serverBaseUrl)
  }

  getBaseUrl() {
    return this.serverBaseUrl
  }

  async readWechatConversation(
    input: WechatComputerUseReadRequest,
  ): Promise<WechatComputerUseReadResponse> {
    const response = await fetch(
      `${this.serverBaseUrl}/api/internal/wechat-computer-use/read-messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      },
    )

    const payload = (await response.json()) as {
      data?: WechatComputerUseReadResponse
      error?: string
    }

    if (!response.ok || !payload.data) {
      throw new Error(payload.error || `服务端截图读消息接口失败：HTTP ${response.status}`)
    }

    return payload.data
  }
}
