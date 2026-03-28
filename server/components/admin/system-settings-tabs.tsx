"use client"

import { useActionState, useState } from "react"

import { saveWechatAutoReplySettingsAction } from "@/app/actions/admin"
import { FormStatusMessage } from "@/components/admin/form-status-message"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  type WechatAutoReplySystemSettingValue,
  type ModelProvider,
  modelProviderMeta,
  modelProviders,
} from "@/lib/settings/contracts"
import { initialAdminFormActionState } from "@/lib/admin/form-action-state"

interface SystemSettingsTabsProps {
  settings: WechatAutoReplySystemSettingValue
}

export function SystemSettingsTabs({ settings }: SystemSettingsTabsProps) {
  return (
    <Tabs defaultValue="wechat-auto-reply" className="gap-6">
      <TabsList variant="line">
        <TabsTrigger value="wechat-auto-reply">微信自动回复</TabsTrigger>
        <TabsTrigger value="storage">RAG 与存储</TabsTrigger>
      </TabsList>

      <TabsContent value="wechat-auto-reply">
        <WechatAutoReplySettingsForm
          key={JSON.stringify(settings)}
          settings={settings}
        />
      </TabsContent>

      <TabsContent value="storage">
        <Card>
          <CardHeader>
            <CardTitle>RAG 与存储</CardTitle>
            <CardDescription>
              当前服务端默认使用 PostgreSQL 18 与 pgvector，知识库配置和模型配置都保存在 settings 表。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
            <p>数据库：PostgreSQL 18</p>
            <p>向量插件：pgvector</p>
            <p>配置表：settings(title / k / v)</p>
            <p>
              自动回复记录表：wechat_auto_reply_records，用于后续回放、审计和模型效果分析。
            </p>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}

function WechatAutoReplySettingsForm({
  settings,
}: SystemSettingsTabsProps) {
  const [enabled, setEnabled] = useState(settings.enabled)
  const [modelProvider, setModelProvider] = useState<ModelProvider>(
    settings.modelProvider
  )
  const [state, formAction, pending] = useActionState(
    saveWechatAutoReplySettingsAction,
    initialAdminFormActionState
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>微信自动回复</CardTitle>
        <CardDescription>
          这里控制 Electron / RPA 调服务端接口时要走哪个模型，以及知识库检索策略。
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        <input type="hidden" name="enabled" value={String(enabled)} />
        <input type="hidden" name="modelProvider" value={modelProvider} />
        <CardContent className="flex flex-col gap-6">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="wechat-auto-reply-enabled">
                启用自动回复
              </FieldLabel>
              <FieldContent>
                <div className="flex items-center gap-3">
                  <Switch
                    id="wechat-auto-reply-enabled"
                    checked={enabled}
                    onCheckedChange={setEnabled}
                  />
                  <FieldDescription>
                    关闭后，客户端仍可记录消息，但不会调用大模型自动回复。
                  </FieldDescription>
                </div>
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="wechat-auto-reply-model-provider">
                自动回复模型
              </FieldLabel>
              <FieldContent>
                <Select
                  value={modelProvider}
                  onValueChange={(value) =>
                    setModelProvider(value as ModelProvider)
                  }
                >
                  <SelectTrigger
                    id="wechat-auto-reply-model-provider"
                    className="w-full"
                  >
                    <SelectValue placeholder="选择一个模型服务商" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {modelProviders.map((provider) => (
                        <SelectItem key={provider} value={provider}>
                          {modelProviderMeta[provider].title}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  自动回复接口会读取这里选中的模型，再去 settings 表取对应的 API 配置。
                </FieldDescription>
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="poll-interval-seconds">
                轮询间隔
              </FieldLabel>
              <FieldContent>
                <Input
                  id="poll-interval-seconds"
                  name="pollIntervalSeconds"
                  type="number"
                  min={1}
                  max={30}
                  defaultValue={settings.pollIntervalSeconds}
                />
                <FieldDescription>
                  computer use 守护建议每 2 到 5 秒轮询一次；这里控制默认轮询秒数。
                </FieldDescription>
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="knowledge-base-slug">
                RAG 知识库标识
              </FieldLabel>
              <FieldContent>
                <Input
                  id="knowledge-base-slug"
                  name="knowledgeBaseSlug"
                  defaultValue={settings.knowledgeBaseSlug}
                />
                <FieldDescription>
                  当前先按 slug 关联知识库，后续可扩展为多知识库选择器。
                </FieldDescription>
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="top-k">Top K</FieldLabel>
              <FieldContent>
                <Input
                  id="top-k"
                  name="topK"
                  type="number"
                  min={1}
                  max={20}
                  defaultValue={settings.topK}
                />
                <FieldDescription>
                  每次自动回复最多检索多少条知识片段注入上下文。
                </FieldDescription>
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="max-context-messages">
                上下文消息数
              </FieldLabel>
              <FieldContent>
                <Input
                  id="max-context-messages"
                  name="maxContextMessages"
                  type="number"
                  min={1}
                  max={50}
                  defaultValue={settings.maxContextMessages}
                />
                <FieldDescription>
                  发送给大模型的最近会话消息条数上限。
                </FieldDescription>
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="wechat-system-prompt">系统提示词</FieldLabel>
              <FieldContent>
                <Textarea
                  id="wechat-system-prompt"
                  name="systemPrompt"
                  defaultValue={settings.systemPrompt}
                  rows={6}
                />
                <FieldDescription>
                  这里定义微信自动回复的整体语气、边界和业务规则。
                </FieldDescription>
              </FieldContent>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex items-center justify-between gap-4">
          <FormStatusMessage status={state.status} message={state.message} />
          <Button type="submit" disabled={pending}>
            {pending ? "保存中..." : "保存微信自动回复设置"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
