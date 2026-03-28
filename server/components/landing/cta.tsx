"use client";

import { QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faWindows,
  faWeixin
} from "@fortawesome/free-brands-svg-icons";

export function CTA() {
  return (
    <section className="py-24 bg-surface">
      <div className="container mx-auto px-4 sm:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">
            立即开始使用
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed italic">
            提供 Windows 桌面端控制端和微信小程序移动指挥端
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Windows Download */}
          <div className="p-10 rounded-3xl bg-white border border-border shadow-lg flex flex-col items-center text-center space-y-6">
            <div className="h-16 w-16 rounded-2xl text-brand flex items-center justify-center">
              {/* <Download className="h-8 w-8" /> */}
              <FontAwesomeIcon icon={faWindows} className="text-5xl text-blue-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold">Windows 客户端</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                支持 Win10 / Win11，用于电脑端稳定挂机执行 RPA 与微信自动化任务。
              </p>
            </div>
            <Button size="lg" className="bg-brand hover:bg-brand/90 px-8 text-lg font-bold">
              立即下载 (.exe)
            </Button>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">版本: v1.3.22 | 大小: 1.58GB</div>
          </div>

          {/* Mobile Command (WeChat Mini Program) */}
          <div className="p-10 rounded-3xl bg-white border border-border shadow-lg flex flex-col items-center text-center space-y-6">
            <div className="h-16 w-16 rounded-2xl text-green-600 flex items-center justify-center">
              {/* <Smartphone className="h-8 w-8" /> */}
              <FontAwesomeIcon icon={faWeixin} className="text-5xl text-green-400" />
            </div>
            <div className="space-y-4">
              <h3 className="text-2xl font-bold">移动指挥端 (小程序)</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                无需安装，微信扫码即用。随时查看电脑端任务状态，一部手机控制全局。
              </p>
              <div className="relative h-32 w-32 border border-border/50 rounded-xl p-2 bg-slate-50 flex items-center justify-center mx-auto">
                 <QrCode className="h-24 w-24 text-slate-300" />
                 <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-white/80 px-2 py-1 rounded text-[10px] font-bold text-slate-500 backdrop-blur">扫码访问</div>
                 </div>
              </div>
              <div className="text-xs text-slate-400 font-bold">微信扫一扫，体验手机遥控</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
