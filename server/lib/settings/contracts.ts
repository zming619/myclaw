export const modelProviders = ["openai", "qwen", "deepseek"] as const
export type ModelProvider = (typeof modelProviders)[number]

export interface ModelSettingValue {
  provider: ModelProvider
  title: string
  baseUrl: string
  apiKey: string
  model: string
  visionModel: string
  embeddingModel: string
  enabled: boolean
  timeoutSeconds: number
}

export interface WechatAutoReplySystemSettingValue {
  title: string
  enabled: boolean
  modelProvider: ModelProvider
  pollIntervalSeconds: number
  knowledgeBaseSlug: string
  topK: number
  maxContextMessages: number
  systemPrompt: string
}

export const modelProviderMeta: Record<
  ModelProvider,
  { title: string; description: string; key: string }
> = {
  openai: {
    title: "OpenAI",
    description: "适合接 OpenAI 兼容接口，也方便后续接更多兼容服务商。",
    key: "llm.openai",
  },
  qwen: {
    title: "通义千问",
    description: "用于阿里云通义千问和向量模型配置。",
    key: "llm.qwen",
  },
  deepseek: {
    title: "DeepSeek",
    description: "用于 DeepSeek 对话模型配置。",
    key: "llm.deepseek",
  },
}

export const wechatAutoReplySettingKey = "system.wechat_auto_reply"

export const defaultModelSettings: Record<ModelProvider, ModelSettingValue> = {
  openai: {
    provider: "openai",
    title: "OpenAI 模型设置",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4.1-mini",
    visionModel: "",
    embeddingModel: "text-embedding-3-small",
    enabled: false,
    timeoutSeconds: 60,
  },
  qwen: {
    provider: "qwen",
    title: "通义千问模型设置",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    apiKey: "",
    model: "qwen-plus",
    visionModel: "",
    embeddingModel: "text-embedding-v3",
    enabled: false,
    timeoutSeconds: 60,
  },
  deepseek: {
    provider: "deepseek",
    title: "DeepSeek 模型设置",
    baseUrl: "https://api.deepseek.com/v1",
    apiKey: "",
    model: "deepseek-chat",
    visionModel: "",
    embeddingModel: "",
    enabled: false,
    timeoutSeconds: 60,
  },
}

export const defaultWechatAutoReplySettings: WechatAutoReplySystemSettingValue =
  {
    title: "微信自动回复设置",
    enabled: true,
    modelProvider: "openai",
    pollIntervalSeconds: 3,
    knowledgeBaseSlug: "default-wechat-kb",
    topK: 6,
    maxContextMessages: 8,
    systemPrompt:
      "你是企业微信自动回复助手。回复要基于知识库，优先准确、简洁，不能编造事实。",
  }
