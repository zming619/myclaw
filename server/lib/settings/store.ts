import { eq, inArray, sql } from "drizzle-orm"

import { ensureAppDatabase } from "@/lib/db/bootstrap"
import { getDb } from "@/lib/db/client"
import { settings } from "@/lib/db/schema"
import {
  defaultModelSettings,
  defaultWechatAutoReplySettings,
  modelProviderMeta,
  modelProviders,
  type ModelProvider,
  type ModelSettingValue,
  type WechatAutoReplySystemSettingValue,
  wechatAutoReplySettingKey,
} from "@/lib/settings/contracts"

function parseTextValue<T>(value: string | null | undefined, fallback: T) {
  if (!value) {
    return fallback
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export async function listRawSettings() {
  await ensureAppDatabase()
  const db = getDb()

  return db.select().from(settings)
}

export async function upsertSettingRecord(input: {
  title: string
  key: string
  value: string
}) {
  await ensureAppDatabase()
  const db = getDb()

  await db
    .insert(settings)
    .values({
      title: input.title,
      k: input.key,
      v: input.value,
    })
    .onConflictDoUpdate({
      target: settings.k,
      set: {
        title: input.title,
        v: input.value,
        updatedAt: sql`now()`,
      },
    })
}

export async function getModelSettingsSnapshot() {
  await ensureAppDatabase()
  const db = getDb()
  const keys = modelProviders.map((provider) => modelProviderMeta[provider].key)
  const rows = await db.select().from(settings).where(inArray(settings.k, keys))

  const snapshot = {} as Record<ModelProvider, ModelSettingValue>

  for (const provider of modelProviders) {
    const row = rows.find((item) => item.k === modelProviderMeta[provider].key)
    snapshot[provider] = {
      ...defaultModelSettings[provider],
      ...parseTextValue<ModelSettingValue>(row?.v, defaultModelSettings[provider]),
      provider,
    }
  }

  return snapshot
}

export async function saveModelSettings(provider: ModelProvider, payload: ModelSettingValue) {
  await upsertSettingRecord({
    title: payload.title,
    key: modelProviderMeta[provider].key,
    value: JSON.stringify(payload, null, 2),
  })

  return payload
}

export async function getWechatAutoReplySystemSetting() {
  await ensureAppDatabase()
  const db = getDb()
  const row = await db.query.settings.findFirst({
    where: eq(settings.k, wechatAutoReplySettingKey),
  })

  return {
    ...defaultWechatAutoReplySettings,
    ...parseTextValue<WechatAutoReplySystemSettingValue>(
      row?.v,
      defaultWechatAutoReplySettings
    ),
  }
}

export async function saveWechatAutoReplySystemSetting(
  payload: WechatAutoReplySystemSettingValue
) {
  await upsertSettingRecord({
    title: payload.title,
    key: wechatAutoReplySettingKey,
    value: JSON.stringify(payload, null, 2),
  })

  return payload
}
