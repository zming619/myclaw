"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

const navLinks = [
  { name: "官网首页", href: "#" },
  { name: "核心能力", href: "#features" },
  { name: "功能模块", href: "#modules" },
  { name: "私有化部署", href: "#" },
  { name: "代理合作", href: "#" },
  { name: "常见问题", href: "#" },
  { name: "即将更新", href: "#" },
  { name: "使用教程", href: "#" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white shadow-lg shadow-brand/20 group-hover:scale-105 transition-transform">
               <span className="text-xl font-bold">C</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              星云 <span className="text-brand">Claw</span>
            </span>
          </Link>
          <nav className="hidden lg:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-brand"
              >
                {link.name}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" className="hidden sm:inline-flex">
            登录
          </Button>
          <Button className="bg-brand hover:bg-brand/90 text-white">
            立即开始
          </Button>
        </div>
      </div>
    </header>
  );
}
