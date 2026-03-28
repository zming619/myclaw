"use client";

import { 
  LayoutDashboard, BarChart3, MessageSquare, UserCircle, 
  PenTool, FolderHeart, Zap, Users, 
  Flame, Image as ImageIcon, Send, MessageCircleReply, 
  ListTodo, Tags, BookOpen, GitBranch,
  Monitor, Activity, Link, CreditCard
} from "lucide-react";

const modules = [
  { name: "工作台", icon: LayoutDashboard, color: "text-blue-500", bg: "bg-blue-50" },
  { name: "数据分析", icon: BarChart3, color: "text-cyan-500", bg: "bg-cyan-50" },
  { name: "智能体对话", icon: MessageSquare, color: "text-purple-500", bg: "bg-purple-50" },
  { name: "AI员工", icon: UserCircle, color: "text-orange-500", bg: "bg-orange-50" },
  { name: "创作中心", icon: PenTool, color: "text-pink-500", bg: "bg-pink-50" },
  { name: "素材库/作品库", icon: FolderHeart, color: "text-red-500", bg: "bg-red-50" },
  { name: "自动曝光", icon: Zap, color: "text-yellow-500", bg: "bg-yellow-50" },
  { name: "公域获客", icon: Users, color: "text-indigo-500", bg: "bg-indigo-50" },
  { name: "主动激活", icon: Flame, color: "text-orange-600", bg: "bg-orange-100" },
  { name: "朋友圈营销", icon: ImageIcon, color: "text-green-500", bg: "bg-green-50" },
  { name: "智能群发", icon: Send, color: "text-blue-600", bg: "bg-blue-100" },
  { name: "微信自动回复", icon: MessageCircleReply, color: "text-emerald-500", bg: "bg-emerald-50" },
  { name: "SOP自助推送", icon: ListTodo, color: "text-violet-500", bg: "bg-violet-50" },
  { name: "好友标签管理", icon: Tags, color: "text-amber-500", bg: "bg-amber-50" },
  { name: "知识库", icon: BookOpen, color: "text-rose-500", bg: "bg-rose-50" },
  { name: "自动工作流", icon: GitBranch, color: "text-teal-500", bg: "bg-teal-50" },
  { name: "设备管理", icon: Monitor, color: "text-blue-700", bg: "bg-blue-100" },
  { name: "任务监控", icon: Activity, color: "text-indigo-700", bg: "bg-indigo-100" },
  { name: "账号绑定", icon: Link, color: "text-amber-700", bg: "bg-amber-100" },
  { name: "卡密兑换/AI充值", icon: CreditCard, color: "text-purple-700", bg: "bg-purple-100" },
];

export function AllModules() {
  return (
    <section id="modules" className="py-24 bg-white">
      <div className="container mx-auto px-4 sm:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-600 uppercase tracking-widest">
            ALL MODULES
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            全部功能模块一览
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed italic">
            系统覆盖运营全场景，每个模块独立运行又协同联动
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 sm:gap-6">
          {modules.map((mod, i) => (
            <div
              key={i}
              className="group flex items-center gap-4 p-5 rounded-2xl bg-surface border border-border/50 hover:bg-white hover:border-brand/40 hover:shadow-lg transition-all cursor-pointer"
            >
              <div className={`h-10 w-10 flex-shrink-0 rounded-xl ${mod.bg} ${mod.color} flex items-center justify-center transition-transform group-hover:scale-110`}>
                <mod.icon className="h-5 w-5" />
              </div>
              <div className="text-sm font-bold text-foreground group-hover:text-brand transition-colors">
                {mod.name}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
