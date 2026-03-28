import { z } from "zod"

import {
  type ModelProvider,
  type ModelSettingValue,
  type WechatAutoReplySystemSettingValue,
  modelProviderMeta,
  modelProviders,
} from "@/lib/settings/contracts"

export const modelProviderSchema = z.enum(modelProviders)

const modelSettingsSchema = z.object({
  provider: modelProviderSchema,
  baseUrl: z.string().trim().min(1),
  apiKey: z.string().trim().default(""),
  model: z.string().trim().min(1),
  visionModel: z.string().trim().default(""),
  embeddingModel: z.string().trim().default(""),
  enabled: z.boolean().default(false),
  timeoutSeconds: z.coerce.number().int().min(1).max(300),
})

const wechatAutoReplySettingsSchema = z.object({
  enabled: z.boolean().default(false),
  modelProvider: modelProviderSchema,
  pollIntervalSeconds: z.coerce.number().int().min(1).max(30),
  knowledgeBaseSlug: z.string().trim().min(1),
  topK: z.coerce.number().int().min(1).max(20),
  maxContextMessages: z.coerce.number().int().min(1).max(50),
  systemPrompt: z.string().trim().min(1),
})

export function buildModelSettingPayload(input: unknown): ModelSettingValue {
  const parsed = modelSettingsSchema.parse(input)
  const meta = modelProviderMeta[parsed.provider]

  return {
    ...parsed,
    title: `${meta.title} 模型设置`,
  }
}

export function buildWechatAutoReplySettingPayload(
  input: unknown
): WechatAutoReplySystemSettingValue {
  const parsed = wechatAutoReplySettingsSchema.parse(input)

  return {
    ...parsed,
    title: "微信自动回复设置",
  }
}

export function toBoolean(value: FormDataEntryValue | null) {
  return value === "on" || value === "true" || value === "1"
}

export function formDataToModelSettingsInput(formData: FormData): {
  provider: ModelProvider
  baseUrl: string
  apiKey: string
  model: string
  visionModel: string
  embeddingModel: string
  enabled: boolean
  timeoutSeconds: number
} {
  return {
    provider: modelProviderSchema.parse(formData.get("provider")),
    baseUrl: String(formData.get("baseUrl") ?? ""),
    apiKey: String(formData.get("apiKey") ?? ""),
    model: String(formData.get("model") ?? ""),
    visionModel: String(formData.get("visionModel") ?? ""),
    embeddingModel: String(formData.get("embeddingModel") ?? ""),
    enabled: toBoolean(formData.get("enabled")),
    timeoutSeconds: Number(formData.get("timeoutSeconds") ?? 60),
  }
}

export function formDataToWechatAutoReplySettingsInput(formData: FormData) {
  return {
    enabled: toBoolean(formData.get("enabled")),
    modelProvider: modelProviderSchema.parse(formData.get("modelProvider")),
    pollIntervalSeconds: Number(formData.get("pollIntervalSeconds") ?? 3),
    knowledgeBaseSlug: String(formData.get("knowledgeBaseSlug") ?? ""),
    topK: Number(formData.get("topK") ?? 6),
    maxContextMessages: Number(formData.get("maxContextMessages") ?? 8),
    systemPrompt: String(formData.get("systemPrompt") ?? ""),
  }
}
