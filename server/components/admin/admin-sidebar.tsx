"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BotMessageSquareIcon,
  MessageSquareReplyIcon,
  Settings2Icon,
} from "lucide-react"

import { MyClawLogo } from "@/components/brand/myclaw-logo"
import { Badge } from "@/components/ui/badge"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

const navigation = [
  {
    title: "模型设置",
    href: "/models",
    icon: BotMessageSquareIcon,
  },
  {
    title: "微信自动回复",
    href: "/wechat-auto-replies",
    icon: MessageSquareReplyIcon,
  },
  {
    title: "系统设置",
    href: "/settings",
    icon: Settings2Icon,
  },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <div className="px-2 py-3">
          <MyClawLogo />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>管理菜单</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`)

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex flex-col gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-3 text-xs text-sidebar-foreground/80">
          <div className="font-medium">当前后端基线</div>
          <div>PostgreSQL 18 + pgvector</div>
          <Badge variant="outline">未启用登录校验</Badge>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
