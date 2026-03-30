import { Metadata } from "next"
import { LoginForm } from "@/components/auth/login-form"
import { LoginSplash } from "@/components/auth/login-splash"

export const metadata: Metadata = {
  title: "登录 - MyClaw 管理后台",
  description: "登录您的账号以管理您的 AI + RPA 自动化引擎。",
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      {/* Form Side */}
      <div className="flex w-full flex-col justify-center bg-background px-6 py-12 lg:w-[480px] xl:w-[600px]">
         <LoginForm />
      </div>

      {/* Visual Splash Side */}
      <LoginSplash />
    </div>
  )
}
