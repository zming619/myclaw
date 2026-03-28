"use client";

import { Bot, Users, MessageSquare, Smartphone, Video, Heart } from "lucide-react";

const features = [
  {
    title: "RPA流程自动化",
    description: "支持微信、抖音、快手、小红书、视频号、B站等平台的自动化操作——视频发布、消息群发、好友管理、评论互动，全部由电脑RPA代替人工执行。",
    icon: Bot,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    title: "公域获客引擎",
    description: "自动扫描抖音、快手、小红书目标视频评论区，按关键词筛选潜在客户，自动点赞、关注、评论、私信，线索自动回传后台统一管理。",
    icon: Users,
    color: "text-cyan-600",
    bg: "bg-cyan-50",
  },
  {
    title: "AI智能对话",
    description: "接入通义千问、豆包、DeepSeek等大模型，支持 Function Calling和RAG知识库检索，实现微信智能客服自动回复、AI内容生成等场景。",
    icon: MessageSquare,
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
  {
    title: "一部手机指挥多台电脑",
    description: "通过设备绑定和远程任务队列，用手机随时下发指令——群发消息、发布视频、启动自动回复、执行SOP，多台电脑同时响应执行。",
    icon: Smartphone,
    color: "text-orange-600",
    bg: "bg-orange-50",
  },
  {
    title: "视频创作与矩阵分发",
    description: "集成阿里视觉AI与火山引擎，支持去水印、去字幕、画质增强、超分辨率，配合剪映草稿生成，一键全网多平台矩阵分发。",
    icon: Video,
    color: "text-green-600",
    bg: "bg-green-50",
  },
  {
    title: "私域精细化运营",
    description: "微信SOP自动推送、好友标签管理、朋友圈定时营销、主动激活沉默客户，智能群发——全方位盘活私域流量池。",
    icon: Heart,
    color: "text-red-600",
    bg: "bg-red-50",
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 bg-surface">
      <div className="container mx-auto px-4 sm:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            六大核心能力，覆盖全链路运营
          </h2>
          <p className="text-lg text-muted-foreground italic">
            从公域流量获取到私域精细化运营，从内容创作到智能客服，一套系统全部搞定
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative h-full p-8 rounded-2xl bg-white border border-border shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
            >
              <div className={`mb-6 inline-flex p-3 rounded-xl ${feature.bg} ${feature.color}`}>
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-foreground group-hover:text-brand transition-colors">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
