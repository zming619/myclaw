import { Metadata } from "next"

import { LoginForm } from "@/components/auth/login-form"

export const metadata: Metadata = {
  title: "登录 - MyClaw 管理后台",
  description: "登录您的账号以管理您的 AI + RPA 自动化引擎。",
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-6 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_32%),radial-gradient(circle_at_bottom,rgba(191,219,254,0.36),transparent_42%)]" />
      <div className="bg-grid-fine absolute inset-0 opacity-40" />
      <div className="absolute left-1/2 top-1/2 size-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-blue-100/80" />
      <div className="absolute left-1/2 top-1/2 size-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-blue-50" />
      <div className="absolute top-20 left-1/2 size-56 -translate-x-[18rem] rounded-full bg-blue-200/40 blur-3xl" />
      <div className="absolute bottom-20 left-1/2 size-64 translate-x-[14rem] rounded-full bg-sky-200/50 blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <LoginForm />
      </div>
    </div>
  )
}
