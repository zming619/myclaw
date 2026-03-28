"use client"

import { startTransition, useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { saveModelSettingsAction } from "@/app/actions/admin"
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
import { Switch } from "@/components/ui/switch"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import type {
  ModelProvider,
  ModelSettingValue,
} from "@/lib/settings/contracts"
import {
  modelProviderMeta,
  modelProviders,
} from "@/lib/settings/contracts"
import { initialAdminFormActionState } from "@/lib/admin/form-action-state"

interface ModelSettingsTabsProps {
  settings: Record<ModelProvider, ModelSettingValue>
}

export function ModelSettingsTabs({ settings }: ModelSettingsTabsProps) {
  const [activeProvider, setActiveProvider] = useState<ModelProvider>(
    modelProviders[0]
  )

  return (
    <Tabs
      value={activeProvider}
      onValueChange={(value) => setActiveProvider(value as ModelProvider)}
      className="gap-6"
    >
      <TabsList variant="line">
        {modelProviders.map((provider) => (
          <TabsTrigger key={provider} value={provider}>
            {modelProviderMeta[provider].title}
          </TabsTrigger>
        ))}
      </TabsList>

      {modelProviders.map((provider) => {
        const config = settings[provider]

        return (
          <TabsContent key={provider} value={provider}>
            <ModelSettingsForm
              key={JSON.stringify(config)}
              provider={provider}
              config={config}
            />
          </TabsContent>
        )
      })}
    </Tabs>
  )
}

interface ModelSettingsFormProps {
  provider: ModelProvider
  config: ModelSettingValue
}

function ModelSettingsForm({ provider, config }: ModelSettingsFormProps) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(config.enabled)
  const [state, formAction, pending] = useActionState(
    saveModelSettingsAction,
    initialAdminFormActionState
  )

  useEffect(() => {
    if (state.status !== "success" || !state.submittedAt) {
      return
    }

    startTransition(() => {
      router.refresh()
    })
  }, [router, state.status, state.submittedAt])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{modelProviderMeta[provider].title}</CardTitle>
        <CardDescription>{modelProviderMeta[provider].description}</CardDescription>
      </CardHeader>
      <form action={formAction}>
        <input type="hidden" name="provider" value={provider} />
        <input type="hidden" name="enabled" value={String(enabled)} />
        <CardContent className="flex flex-col gap-6">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${provider}-enabled`}>启用接口</FieldLabel>
              <FieldContent>
                <div className="flex items-center gap-3">
                  <Switch
                    id={`${provider}-enabled`}
                    checked={enabled}
                    onCheckedChange={setEnabled}
                  />
                  <FieldDescription>
                    启用后，系统才会允许调用这个模型配置。
                  </FieldDescription>
                </div>
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor={`${provider}-base-url`}>Base URL</FieldLabel>
              <FieldContent>
                <Input
                  id={`${provider}-base-url`}
                  name="baseUrl"
                  defaultValue={config.baseUrl}
                />
                <FieldDescription>
                  填写服务端要调用的 OpenAI 兼容或原生 API 地址。
                </FieldDescription>
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor={`${provider}-api-key`}>API Key</FieldLabel>
              <FieldContent>
                <Input
                  id={`${provider}-api-key`}
                  name="apiKey"
                  type="password"
                  defaultValue={config.apiKey}
                />
                <FieldDescription>
                  当前直接存入 settings 表，后续可切到密钥服务。
                </FieldDescription>
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor={`${provider}-model`}>对话模型</FieldLabel>
              <FieldContent>
                <Input
                  id={`${provider}-model`}
                  name="model"
                  defaultValue={config.model}
                />
                <FieldDescription>
                  微信自动回复默认会调用这里配置的对话模型。
                </FieldDescription>
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor={`${provider}-vision-model`}>
                视觉模型
              </FieldLabel>
              <FieldContent>
                <Input
                  id={`${provider}-vision-model`}
                  name="visionModel"
                  defaultValue={config.visionModel}
                />
                <FieldDescription>
                  用于 computer use 截图读消息；留空时默认复用对话模型。
                </FieldDescription>
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor={`${provider}-embedding-model`}>
                Embedding 模型
              </FieldLabel>
              <FieldContent>
                <Input
                  id={`${provider}-embedding-model`}
                  name="embeddingModel"
                  defaultValue={config.embeddingModel}
                />
                <FieldDescription>
                  用于后续 pgvector 知识库的向量化。
                </FieldDescription>
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor={`${provider}-timeout-seconds`}>
                超时时间
              </FieldLabel>
              <FieldContent>
                <Input
                  id={`${provider}-timeout-seconds`}
                  name="timeoutSeconds"
                  type="number"
                  min={1}
                  max={300}
                  defaultValue={config.timeoutSeconds}
                />
                <FieldDescription>
                  单次模型调用超时秒数，建议控制在 30 到 90 秒。
                </FieldDescription>
              </FieldContent>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex items-center justify-between gap-4">
          <FormStatusMessage status={state.status} message={state.message} />
          <Button type="submit" disabled={pending}>
            {pending ? "保存中..." : `保存 ${modelProviderMeta[provider].title} 配置`}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
