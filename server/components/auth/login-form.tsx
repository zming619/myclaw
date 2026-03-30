"use client"

import * as React from "react"
import Link from "next/link"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faGithub, faGoogle } from "@fortawesome/free-brands-svg-icons"
import { faArrowRight, faEnvelope, faLock } from "@fortawesome/free-solid-svg-icons"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MyClawLogo } from "@/components/brand/myclaw-logo"

export function LoginForm() {
  const [isLoading, setIsLoading] = React.useState<boolean>(false)

  async function onSubmit(event: React.SyntheticEvent) {
    event.preventDefault()
    setIsLoading(true)

    setTimeout(() => {
      setIsLoading(false)
    }, 1000)
  }

  return (
    <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[380px]">
      <div className="flex flex-col space-y-4 text-center sm:text-left">
        <MyClawLogo className="mb-2 justify-center sm:justify-start" />
        <h1 className="text-3xl font-bold tracking-tight text-navy">欢迎回来</h1>
        <p className="text-sm text-muted-foreground">
          输入您的凭据以访问管理后台
        </p>
      </div>

      <div className="grid gap-6">
        <form onSubmit={onSubmit}>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">邮箱地址</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <FontAwesomeIcon icon={faEnvelope} className="size-4" />
                </div>
                <Input
                  id="email"
                  placeholder="name@example.com"
                  type="email"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect="off"
                  disabled={isLoading}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">密码</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-brand hover:underline"
                >
                  忘记密码?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <FontAwesomeIcon icon={faLock} className="size-4" />
                </div>
                <Input
                  id="password"
                  type="password"
                  autoCapitalize="none"
                  autoComplete="current-password"
                  disabled={isLoading}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="remember" />
              <label
                htmlFor="remember"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                记住登录状态
              </label>
            </div>
            <Button disabled={isLoading} className="mt-2 w-full bg-brand hover:bg-brand/90 py-6 text-base font-semibold transition-all hover:scale-[1.01]">
              {isLoading && (
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              立即登录
              {!isLoading && <FontAwesomeIcon icon={faArrowRight} className="ml-2 size-4" />}
            </Button>
          </div>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              或者通过以下方式
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Button variant="outline" type="button" disabled={isLoading} className="border-border hover:bg-muted">
            <FontAwesomeIcon icon={faGithub} className="mr-2 h-4 w-4" />
            GitHub
          </Button>
          <Button variant="outline" type="button" disabled={isLoading} className="border-border hover:bg-muted">
            <FontAwesomeIcon icon={faGoogle} className="mr-2 h-4 w-4" />
            Google
          </Button>
        </div>
      </div>

      <p className="px-8 text-center text-sm text-muted-foreground">
        还没有账号?{" "}
        <Link
          href="/register"
          className="font-medium text-brand underline-offset-4 hover:underline"
        >
          立即注册
        </Link>
      </p>
    </div>
  )
}
