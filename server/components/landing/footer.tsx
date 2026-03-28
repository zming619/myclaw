"use client";

import Link from "next/link";

const footerLinks = [
  {
    title: "快速链接",
    links: [
      { name: "官网首页", href: "#" },
      { name: "私有化部署", href: "#" },
      { name: "代理合作", href: "#" },
    ],
  },
  {
    title: "产品服务",
    links: [
      { name: "Windows 客户端", href: "#" },
      { name: "移动端小程序", href: "#" },
    ],
  },
  {
    title: "关于我们",
    links: [
      { name: "联系我们", href: "#" },
      { name: "合作咨询", href: "#" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-navy text-white py-16 border-t border-white/5">
      <div className="container mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          <div className="space-y-6 text-left">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563eb] text-white shadow-lg shadow-[#2563eb]/20 group-hover:scale-105 transition-transform">
                <span className="text-xl font-bold">C</span>
              </div>
              <span className="text-xl font-bold tracking-tight text-white">
                星云 <span className="text-[#2563eb]">Claw</span>
              </span>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed">
              AI + RPA 全链路自动运营平台。一部手机控制多台电脑干活。
            </p>
          </div>
          
          {footerLinks.map((group, i) => (
            <div key={i} className="space-y-6">
              <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest">{group.title}</h4>
              <ul className="space-y-4">
                {group.links.map((link, j) => (
                  <li key={j}>
                    <Link href={link.href} className="text-sm text-slate-400 hover:text-brand transition-colors">
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-white/5 text-center text-[10px] text-slate-600 font-bold uppercase tracking-widest">
          <p>© {new Date().getFullYear()} 星云 Claw. 天津九度星火科技技术支持</p>
          <p className="mt-2">津ICP备2021006557号-5</p>
        </div>
      </div>
    </footer>
  );
}
