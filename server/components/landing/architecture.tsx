"use client";

import { Server, Layout, Monitor, Terminal } from "lucide-react";

const techStack = [
  {
    title: "PHP 后端",
    desc: "REST API、用户认证、数据库管理、任务调度、AI接口封装、知识库引擎",
    icon: Server,
    color: "text-blue-500",
    bg: "bg-blue-50/50",
    tech: "Laravel / Hyperf"
  },
  {
    title: "Vue 前端",
    desc: "SPA单页应用、响应式UI、模块化路由，覆盖全部业务操作界面",
    icon: Layout,
    color: "text-green-500",
    bg: "bg-green-50/50",
    tech: "Vue 3 / Vite"
  },
  {
    title: "Electron 客户端",
    desc: "桌面端执行容器，远程轮询任务、调用RPA、设备心跳上报、支持文本和JSON指令",
    icon: Monitor,
    color: "text-cyan-500",
    bg: "bg-cyan-50/50",
    tech: "Electron / Node.js"
  },
  {
    title: "Python RPA",
    desc: "Playwright + UI Automation，操控微信和各短视频平台，执行获客和营销动作",
    icon: Terminal,
    color: "text-amber-500",
    bg: "bg-amber-50/50",
    tech: "Python / Playwright"
  },
];

export function Architecture() {
  return (
    <section className="py-24 bg-navy text-white">
      <div className="container mx-auto px-4 sm:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center rounded-full bg-brand/10 px-3 py-1 text-sm font-medium text-brand border border-brand/20 uppercase tracking-widest">
            ARCHITECTURE
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            系统技术架构
          </h2>
          <p className="text-lg text-slate-400 leading-relaxed">
            PHP后端 + Vue前端 + Electron桌面端 + Python RPA引擎，四位一体协同
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {techStack.map((item, i) => (
            <div key={i} className="p-8 rounded-2xl bg-white/5 border border-white/10 space-y-6 hover:bg-white/10 transition-colors">
              <div className={`h-12 w-12 rounded-xl ${item.bg.replace('/50', '/20')} ${item.color} flex items-center justify-center`}>
                <item.icon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-4">{item.desc}</p>
                <div className="text-[10px] text-slate-600 uppercase tracking-widest font-bold">{item.tech}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
