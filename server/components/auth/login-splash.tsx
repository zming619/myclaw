"use client"

import {
  Activity,
  Bot,
  ChartNoAxesCombined,
  ChevronRight,
  Cloud,
  DatabaseZap,
  MessagesSquare,
  ShieldCheck,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"

export function LoginSplash() {
  return (
    <div className="relative hidden min-h-screen overflow-hidden lg:flex">
      <div className="absolute inset-0 bg-[#06111f]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(49,130,246,0.24),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(56,189,248,0.18),transparent_22%),radial-gradient(circle_at_55%_75%,rgba(14,165,233,0.12),transparent_30%)]" />
      <div className="bg-grid-fine absolute inset-0 opacity-[0.14]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,17,31,0.12)_0%,rgba(6,17,31,0.72)_100%)]" />

      <div className="absolute left-[8%] top-[12%] size-56 rounded-full bg-sky-400/15 blur-[120px] animate-pulse-glow" />
      <div className="absolute right-[10%] bottom-[14%] size-72 rounded-full bg-brand/20 blur-[140px] animate-float-gentle" />

      <div className="relative z-10 flex w-full flex-col justify-between px-12 py-14 xl:px-16">
        <div className="max-w-[560px]">
          <Badge className="rounded-full border-0 bg-white/10 px-3 py-1 text-white hover:bg-white/10">
            实时运营指挥席
          </Badge>
          <h2 className="mt-6 max-w-[10ch] text-5xl font-semibold leading-[1.08] tracking-tight text-white">
            让自动化运营像中控系统一样稳定运转
          </h2>
          <p className="mt-5 max-w-[32rem] text-[15px] leading-7 text-white/68">
            登录后可统一查看设备在线、任务执行、知识库命中率与异常告警，全链路状态一眼确认。
          </p>
        </div>

        <div className="relative mx-auto my-10 flex w-full max-w-4xl items-center justify-center">
          <div className="absolute inset-x-20 top-10 h-40 rounded-full bg-sky-400/10 blur-[90px]" />
          <div className="relative w-full rounded-[32px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_40px_120px_-36px_rgba(2,12,27,0.95)] backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-white/10 text-white">
                  <Bot className="size-5" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">MyClaw Control Center</div>
                  <div className="mt-1 text-xs text-white/45">自动回复 / 任务执行 / 风险审计</div>
                </div>
              </div>
              <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                华东 3 区域全部可用
              </div>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
              <div className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    { icon: Activity, label: "任务成功率", value: "99.84%" },
                    { icon: MessagesSquare, label: "今日对话数", value: "42,186" },
                    { icon: ShieldCheck, label: "风险拦截", value: "312 次" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-3xl border border-white/8 bg-white/[0.04] px-4 py-4"
                    >
                      <div className="flex items-center gap-2 text-xs text-white/45">
                        <item.icon className="size-4 text-sky-300" />
                        {item.label}
                      </div>
                      <div className="mt-4 text-2xl font-semibold tracking-tight text-white">
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-[28px] border border-white/8 bg-[#08192c]/90 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-white">执行队列</div>
                      <div className="mt-1 text-xs text-white/45">
                        当前所有自动化任务与设备响应情况
                      </div>
                    </div>
                    <Badge className="rounded-full border-0 bg-white/8 text-white/78 hover:bg-white/8">
                      任务 14
                    </Badge>
                  </div>

                  <div className="mt-5 flex flex-col gap-3">
                    {[
                      ["朋友圈 SOP 发布", "星云执行器-01", "进行中 67%", "text-sky-300"],
                      ["自动回复守护", "客服账号组 A", "正常运行", "text-emerald-300"],
                      ["RAG 话术刷新", "知识库 v2.4", "待生效", "text-amber-300"],
                    ].map(([title, owner, status, color]) => (
                      <div
                        key={title}
                        className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"
                      >
                        <div>
                          <div className="text-sm font-medium text-white">{title}</div>
                          <div className="mt-1 text-xs text-white/45">{owner}</div>
                        </div>
                        <div className={`text-sm font-medium ${color}`}>{status}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="rounded-[28px] border border-white/8 bg-white/[0.035] p-5">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <ChartNoAxesCombined className="size-4 text-sky-300" />
                    今日运行概览
                  </div>
                  <div className="mt-5 flex h-44 items-end gap-3">
                    {[38, 56, 44, 78, 64, 88, 72].map((height, index) => (
                      <div key={height} className="flex flex-1 flex-col items-center gap-2">
                        <div
                          className="w-full rounded-full bg-gradient-to-t from-sky-500/25 to-sky-300"
                          style={{ height: `${height}%` }}
                        />
                        <span className="text-[11px] text-white/38">
                          {["一", "二", "三", "四", "五", "六", "日"][index]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/8 bg-white/[0.035] p-5">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <DatabaseZap className="size-4 text-sky-300" />
                    知识库与模型状态
                  </div>
                  <div className="mt-4 flex flex-col gap-3 text-sm">
                    {[
                      ["企业知识库", "最近同步 08:40", "正常"],
                      ["自动回复模型", "gpt-5.4 策略生效", "在线"],
                      ["联系人画像", "标签刷新 2 分钟前", "最新"],
                    ].map(([title, desc, status]) => (
                      <div key={title} className="rounded-2xl bg-white/[0.03] px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-white">{title}</span>
                          <span className="text-xs text-sky-300">{status}</span>
                        </div>
                        <div className="mt-1 text-xs text-white/45">{desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="surface-frost animate-float-gentle absolute -right-6 bottom-8 flex items-center gap-3 rounded-2xl px-4 py-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-sky-400/15 text-sky-300">
              <Cloud className="size-5" />
            </div>
            <div>
              <div className="text-sm font-medium text-white">云端同步完成</div>
              <div className="mt-0.5 text-xs text-white/55">
                朋友圈素材库已同步到全部设备
              </div>
            </div>
            <ChevronRight className="size-4 text-white/40" />
          </div>
        </div>

        <div className="flex items-end justify-between gap-8 text-sm text-white/45">
          <div className="max-w-md leading-6">
            MyClaw 将自动回复、知识库、设备和 SOP 调度统一到一个操作平面，帮助团队在复杂执行链路里仍保持稳定响应。
          </div>
          <div className="hidden items-center gap-6 xl:flex">
            <span>合规审计</span>
            <span>多账号编排</span>
            <span>知识库路由</span>
          </div>
        </div>
      </div>
    </div>
  )
}
