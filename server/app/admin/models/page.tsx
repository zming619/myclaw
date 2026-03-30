import { ModelSettingsTabs } from "@/components/admin/model-settings-tabs"
import { PageHeader } from "@/components/admin/page-header"
import { getModelSettingsSnapshot } from "@/lib/settings/store"

export const dynamic = "force-dynamic"

export default async function ModelsPage() {
  const settings = await getModelSettingsSnapshot()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="模型设置"
        description="集中维护 OpenAI、通义千问、DeepSeek 的接口地址、密钥和模型参数。后续微信自动回复统一从这里读取模型配置。"
        badge="3 个模型服务商"
      />
      <ModelSettingsTabs settings={settings} />
    </div>
  )
}

