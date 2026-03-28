"use client";

import { MessageSquare, Video, RefreshCw, Users, Settings, Smartphone, Monitor, Zap, ShieldCheck, Layers } from "lucide-react";

const commands = [
  "群发消息", "视频发布", "朋友圈营销", "自动回复", "SOP推送", 
  "公域获客", "主动激活", "标签管理", "视频批量编辑", "剪映草稿生成", 
  "自动曝光", "设备状态查询"
];

const stats = [
  { label: "N台", desc: "同时绑定多台设备", icon: Monitor },
  { label: "实时", desc: "心跳监控在线状态", icon: Zap },
  { label: "12+", desc: "可远程执行的指令类型", icon: Layers },
  { label: "全自动", desc: "轮询队列自动拉取", icon: ShieldCheck },
];

export function RemoteCommand() {
  return (
    <section className="py-24 bg-navy text-white overflow-hidden">
      <div className="container mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Dashboard Mockup */}
          <div className="relative order-2 lg:order-1">
            <div className="relative rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold opacity-60">显示各指标</span>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px] font-bold">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                    3台在线
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
               {[
                 { icon: MessageSquare, label: "群发消息", detail: "批量发送至指定好友" },
                 { icon: Video, label: "发布视频", detail: "抖音、快手、小红书" },
                 { icon: RefreshCw, label: "自动回复", detail: "AI + 关键词 + 欢迎语" },
                 { icon: Users, label: "公域获客", detail: "评论区扫描、自动私信" },
                 { icon: Settings, label: "执行SOP", detail: "自动化客户触达流程" },
               ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer group">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-[#2563eb]/20 flex items-center justify-center text-[#2563eb]">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold">{item.label}</div>
                      <div className="text-xs text-slate-400">{item.detail}</div>
                    </div>
                  </div>
                  <Smartphone className="h-4 w-4 text-slate-500 group-hover:text-[#2563eb] transition-colors" />
                </div>
               ))}
              </div>
            </div>
            
            {/* Background Glow */}
            <div className="absolute -left-20 -bottom-20 -z-10 h-80 w-80 rounded-full bg-brand/20 blur-[100px]" />
          </div>

          {/* Content */}
          <div className="space-y-10 order-1 lg:order-2">
            <div className="space-y-4">
              <div className="inline-flex items-center rounded-full bg-brand/10 px-3 py-1 text-sm font-medium text-brand border border-brand/20">
                REMOTE COMMAND
              </div>
              <h2 className="text-4xl font-bold tracking-tight sm:text-5xl leading-tight">
                手机下指令 <br />
                电脑自动执行
              </h2>
              <p className="text-lg text-slate-400 leading-relaxed">
                通过设备绑定机制，一台手机可以同时控制多台电脑。发送文字或JSON指令，电脑端 Electron 客户端自动拉取执行任务清单。
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {stats.map((stat, i) => (
                <div key={i} className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold text-[#2563eb]">{stat.label}</div>
                    <stat.icon className="h-5 w-5 text-slate-500" />
                  </div>
                  <div className="text-xs text-slate-400">{stat.desc}</div>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <div className="text-sm font-bold text-slate-500 uppercase tracking-widest">支持的远程指令</div>
              <div className="flex flex-wrap gap-2">
                {commands.map((cmd, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-lg bg-navy-light border border-white/5 text-xs text-slate-300 hover:border-brand/40 transition-colors cursor-default">
                    {cmd}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
