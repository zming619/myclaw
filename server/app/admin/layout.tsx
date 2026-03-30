import { MyClawLogo } from "@/components/brand/myclaw-logo"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { Badge } from "@/components/ui/badge"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <MyClawLogo
              markClassName="size-9"
              className="gap-2.5"
              titleClassName="text-sm"
            />
          </div>
          <Badge variant="outline">预留登录鉴权</Badge>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
