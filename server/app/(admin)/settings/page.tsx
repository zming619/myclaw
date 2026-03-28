import { PageHeader } from "@/components/admin/page-header"
import { SystemSettingsTabs } from "@/components/admin/system-settings-tabs"
import { getWechatAutoReplySystemSetting } from "@/lib/settings/store"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const settings = await getWechatAutoReplySystemSetting()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="系统设置"
        description="这里配置服务端默认的微信自动回复策略。实际调用时，服务端会读取这里选中的模型，再加载模型设置页里保存的 API 配置。"
      />
      <SystemSettingsTabs settings={settings} />
    </div>
  )
}

