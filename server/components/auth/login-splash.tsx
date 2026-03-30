"use client"

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCircleCheck, faCloud, faRobot, faShieldHalved } from "@fortawesome/free-solid-svg-icons"

export function LoginSplash() {
  return (
    <div className="relative hidden w-0 flex-1 overflow-hidden lg:block">
      <div className="brand-gradient absolute inset-0 flex items-center justify-center">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-1/4 left-1/4 h-64 w-64 rounded-full bg-brand/20 blur-[120px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-navy/40 blur-[150px] animate-pulse" />
        </div>

        {/* Floating Glassmorphism Cards */}
        <div className="relative z-10 space-y-6">
          <div className="glass-card animate-slow-spin absolute -top-40 -left-40 size-80 rounded-full border border-white/5 opacity-20" />
          
          <div className="glass-card transform rounded-3xl p-8 shadow-2xl transition-all duration-700 hover:scale-[1.02]">
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/30 text-brand shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                <FontAwesomeIcon icon={faRobot} className="size-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">AI 控制中心</h3>
                <p className="text-xs text-white/60">实时自动化指令集运行中</p>
              </div>
            </div>

            <div className="space-y-4">
              {[
                { label: "RPA 引擎状态", value: "运行中", color: "text-emerald-400", icon: faCircleCheck },
                { label: "连接设备数", value: "1,248台", color: "text-brand-light", icon: faCloud },
                { label: "安全协议", value: "v2.4.1", color: "text-brand-light", icon: faShieldHalved },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-white/5 p-4 py-3">
                  <div className="flex items-center gap-3">
                    <FontAwesomeIcon icon={item.icon} className="size-4 text-white/40" />
                    <span className="text-sm font-medium text-white/80">{item.label}</span>
                  </div>
                  <span className={`text-sm font-bold ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 flex gap-2">
               <div className="h-1.5 flex-1 rounded-full bg-brand" />
               <div className="h-1.5 w-12 rounded-full bg-brand/20" />
               <div className="h-1.5 w-4 rounded-full bg-white/20" />
            </div>
          </div>

          <div className="glass-card absolute -bottom-24 -right-12 space-y-3 rounded-2xl p-5 shadow-xl animate-bounce duration-[3000ms]">
            <div className="flex items-center gap-3">
               <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-xs font-semibold text-white/90">正在执行: 微信朋友圈 SOP</span>
            </div>
            <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
               <div className="h-full w-2/3 bg-emerald-500 rounded-full" />
            </div>
          </div>
        </div>

        {/* Brand Text Quote Overlay */}
        <div className="absolute bottom-12 left-12 right-12 text-center lg:text-left">
          <blockquote className="space-y-2">
            <p className="text-lg font-medium text-white">
              "这是未来，就在这里。MyClaw 彻底改变了我们扩展营销运营的方式。"
            </p>
            <footer className="text-sm text-white/50">
              运营总监, 星云科技
            </footer>
          </blockquote>
        </div>
      </div>
    </div>
  )
}
