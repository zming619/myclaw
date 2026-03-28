"use server"

import { revalidatePath } from "next/cache"
import { ZodError } from "zod"

import { type AdminFormActionState } from "@/lib/admin/form-action-state"
import {
  saveModelSettings,
  saveWechatAutoReplySystemSetting,
} from "@/lib/settings/store"
import {
  buildModelSettingPayload,
  buildWechatAutoReplySettingPayload,
  formDataToModelSettingsInput,
  formDataToWechatAutoReplySettingsInput,
} from "@/lib/settings/validators"

function toActionErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "提交的数据格式不正确，请检查后重试。"
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return "保存失败，请稍后重试。"
}

export async function saveModelSettingsAction(
  _prevState: AdminFormActionState,
  formData: FormData
): Promise<AdminFormActionState> {
  try {
    const payload = buildModelSettingPayload(
      formDataToModelSettingsInput(formData)
    )

    await saveModelSettings(payload.provider, payload)
    revalidatePath("/models")
    revalidatePath("/settings")

    return {
      status: "success",
      message: `${payload.title}已保存。`,
      submittedAt: Date.now(),
    }
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error),
      submittedAt: Date.now(),
    }
  }
}

export async function saveWechatAutoReplySettingsAction(
  _prevState: AdminFormActionState,
  formData: FormData
): Promise<AdminFormActionState> {
  try {
    const payload = buildWechatAutoReplySettingPayload(
      formDataToWechatAutoReplySettingsInput(formData)
    )

    await saveWechatAutoReplySystemSetting(payload)
    revalidatePath("/settings")

    return {
      status: "success",
      message: "微信自动回复设置已保存。",
      submittedAt: Date.now(),
    }
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error),
      submittedAt: Date.now(),
    }
  }
}
