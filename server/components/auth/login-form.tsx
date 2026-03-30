"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowRight,
  CircleHelp,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

import { MyClawLogo } from "@/components/brand/myclaw-logo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

export function LoginForm() {
  const [isLoading, setIsLoading] = React.useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)

    setTimeout(() => {
      setIsLoading(false)
    }, 1000)
  }

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col items-center gap-6">
      <MyClawLogo
        showSubtitle
        className="w-fit rounded-full border border-blue-100 bg-white/90 px-4 py-3 shadow-sm shadow-blue-900/5 backdrop-blur"
        subtitleClassName="text-[11px]"
      />

      <Card className="w-full rounded-[28px] border-blue-100/80 bg-white/95 shadow-[0_30px_80px_-32px_rgba(37,99,235,0.28)] backdrop-blur">
        <CardHeader className="items-center gap-4 px-8 pt-8 text-center">
          <Badge
            variant="outline"
            className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700"
          >
            <Sparkles className="size-3.5" />
            MyClaw Workspace
          </Badge>
          <div className="flex flex-col gap-2">
            <CardTitle className="text-3xl font-semibold tracking-tight text-slate-950">
              登录 MyClaw
            </CardTitle>
            <CardDescription className="text-sm leading-6 text-slate-500">
              使用管理员账号进入自动回复、知识库和运营任务控制台。
            </CardDescription>
          </div>
          <div className="flex w-full items-start gap-3 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-white px-4 py-3 text-left">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm shadow-blue-600/30">
              <ShieldCheck className="size-4" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-sm font-medium text-slate-900">
                统一身份验证入口
              </div>
              <div className="text-xs leading-5 text-slate-500">
                支持会话审计、权限校验和设备确认流程。
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-8 pb-8">
          <form onSubmit={onSubmit} className="flex flex-col gap-6">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email" className="gap-2 text-slate-800">
                  <Mail className="size-4 text-blue-600" />
                  邮箱地址
                </FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect="off"
                  disabled={isLoading}
                  className="h-12 rounded-2xl border-blue-100 bg-white shadow-none focus-visible:border-blue-300 focus-visible:ring-blue-200"
                />
                <FieldDescription>
                  推荐使用企业邮箱或具备后台权限的管理员账号
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="password" className="gap-2 text-slate-800">
                  <LockKeyhole className="size-4 text-blue-600" />
                  登录密码
                </FieldLabel>
                <Input
                  id="password"
                  type="password"
                  placeholder="请输入密码"
                  autoCapitalize="none"
                  autoComplete="current-password"
                  disabled={isLoading}
                  className="h-12 rounded-2xl border-blue-100 bg-white shadow-none focus-visible:border-blue-300 focus-visible:ring-blue-200"
                />
                <FieldDescription>
                  若启用双重验证，登录后将继续进行身份确认
                </FieldDescription>
              </Field>
            </FieldGroup>

            <div className="flex items-center justify-between gap-4 rounded-2xl bg-blue-50/70 px-4 py-3">
              <FieldLabel htmlFor="remember" className="cursor-pointer items-center gap-3">
                <Checkbox id="remember" disabled={isLoading} />
                <span className="text-sm font-medium text-slate-700">
                  记住本机登录状态
                </span>
              </FieldLabel>
              <Button asChild variant="link" size="sm" className="h-auto px-0 text-blue-700">
                <Link href="/forgot-password">忘记密码</Link>
              </Button>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={isLoading}
              className="h-12 rounded-2xl bg-blue-600 text-base font-medium text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : null}
              {isLoading ? "正在登录..." : "登录控制台"}
              {!isLoading ? <ArrowRight data-icon="inline-end" /> : null}
            </Button>
          </form>

          <div className="mt-6 flex flex-col gap-5">
            <Separator className="bg-blue-100" />

            <div className="flex flex-wrap items-center justify-center gap-2">
              <Badge className="rounded-full border-0 bg-blue-50 text-blue-700 hover:bg-blue-50">
                企业微信接入
              </Badge>
              <Badge className="rounded-full border-0 bg-blue-50 text-blue-700 hover:bg-blue-50">
                审计可追踪
              </Badge>
              <Badge className="rounded-full border-0 bg-blue-50 text-blue-700 hover:bg-blue-50">
                知识库联动
              </Badge>
            </div>

            <div className="flex flex-col items-center gap-3 text-sm text-slate-500">
              <p>还没有账号？联系管理员开通，或申请试用环境。</p>
              <div className="flex items-center gap-5">
                <Link
                  href="/register"
                  className="font-medium text-blue-700 underline-offset-4 hover:underline"
                >
                  立即注册
                </Link>
                <Link
                  href="/forgot-password"
                  className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-blue-700"
                >
                  <CircleHelp className="size-4" />
                  登录帮助
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-500" />
          全链路会话审计
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-blue-600" />
          传输加密与权限校验
        </span>
      </div>
    </div>
  )
}
