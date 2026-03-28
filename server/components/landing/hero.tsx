import { Reveal } from "@/components/ui/reveal";
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faBoltLightning, 
  faQrcode, 
  faCircleCheck, 
  faCircleNotch, 
  faRobot 
} from "@fortawesome/free-solid-svg-icons";
import { faWindows } from "@fortawesome/free-brands-svg-icons";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-background py-20 lg:py-32 bg-dot-grid">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_50%,var(--color-brand-light)_0%,transparent_80%)] opacity-30" />
      
      <div className="container mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
          <div className="flex flex-col gap-8 text-left">
            <Reveal delay={0}>
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 text-sm font-medium text-[#2563eb]">
                <FontAwesomeIcon icon={faBoltLightning} className="text-xs" />
                AI + RPA 全链路自动化运营平台
              </div>
            </Reveal>
            
            <Reveal delay={100}>
              <div className="flex flex-col gap-4">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 leading-[1.1] sm:text-6xl lg:text-7xl">
                  一部手机 <br />
                  <span className="text-[#0ea5e9]">控制多台电脑干活</span>
                </h1>
                <p className="max-w-xl text-lg text-slate-500 sm:text-lg">
                  集 RPA流程自动化、AI智能对话、公域获客、私域运营、全网矩阵分发 及 RAG知识库 于一体的企业级<span className="font-bold">超级</span>数字员工。
                </p>
              </div>
            </Reveal>

            <div className="flex flex-col gap-6">
              <Reveal delay={200} className="flex flex-wrap gap-4">
                <Button size="lg" className="h-16 gap-3 bg-[#2563eb] text-white px-8 text-lg font-bold hover:bg-[#2563eb]/90 border-0 rounded-xl shadow-lg shadow-blue-500/20">
                  <FontAwesomeIcon icon={faWindows} className="text-xl" />
                  Windows 客户端下载
                </Button>
                <Button size="lg" variant="outline" className="h-16 gap-3 border-slate-200 px-8 text-lg font-bold hover:bg-slate-50 rounded-xl">
                  <FontAwesomeIcon icon={faQrcode} className="text-lg" />
                  手机移动端控制
                </Button>
              </Reveal>
              
              <Reveal delay={300} className="flex flex-wrap gap-6">
                {[
                  { label: "版本 v1.3.22" },
                  { label: "大小 1.58GB" },
                  { label: "支持 Win10/11" }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm font-bold text-slate-500">
                    <FontAwesomeIcon icon={faCircleCheck} className="text-[#10b981] text-base" />
                    {item.label}
                  </div>
                ))}
              </Reveal>
            </div>
          </div>

          <Reveal delay={400} className="relative">
            <div className="relative h-[480px] w-full max-w-[640px] perspective-[1000px]">
              {/* Task Monitor Mockup */}
              <div className="absolute right-0 top-10 w-[520px] rounded-3xl bg-slate-950 p-8 shadow-2xl border border-white/10 space-y-6">
                <div className="flex items-center gap-2">
                  <div className="flex gap-2">
                    <div className="h-3 w-3 rounded-full bg-[#ff5f56]" />
                    <div className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
                    <div className="h-3 w-3 rounded-full bg-[#27c93f]" />
                  </div>
                  <span className="text-sm text-slate-500 font-medium ml-4">Task Monitor</span>
                </div>
                <div className="space-y-4">
                  {[
                    { text: "WeChat 自动回复 · 运行中", icon: faCircleCheck, color: "text-[#10b981]", bg: "bg-emerald-500/20" },
                    { 
                      text: "抖音视频发布 · 排队中", 
                      icon: faCircleNotch, 
                      spin: true,
                      color: "text-blue-400", 
                      bg: "bg-blue-400/20" 
                    },
                    { text: "公域获客扫描 · 执行中", icon: faCircleCheck, color: "text-[#10b981]", bg: "bg-emerald-500/20" },
                    { text: "AI员工 · 每日任务执行", icon: faRobot, color: "text-blue-500", bg: "bg-blue-500/20" },
                    { text: "朋友圈营销 · 已完成", icon: faCircleCheck, color: "text-[#10b981]", bg: "bg-emerald-500/20" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3 text-slate-300">
                        <div className={`flex h-5 w-5 items-center justify-center rounded-full ${item.bg} ${item.color}`}>
                          <FontAwesomeIcon icon={item.icon} spin={item.spin} className="text-[12px]" />
                        </div>
                        {item.text}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart Mockup */}
              <div className="absolute left-0 bottom-10 w-[240px] rounded-3xl bg-white p-7 shadow-2xl border border-slate-100 transform -translate-x-4">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-500">
                    <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24"><path d="M19 3H5c-1.103 0-2 .897-2 2v14c0 1.103.897 2 2 2h14c1.103 0 2-.897 2-2V5c0-1.103-.897-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">今日转化</span>
                    <div className="text-2xl font-bold text-slate-900">386</div>
                  </div>
                </div>
                <div className="flex items-end gap-2 h-16">
                    <div className="w-2.5 bg-emerald-400 rounded-full animate-bar-grow" style={{ height: '40%' }} />
                    <div className="w-2.5 bg-emerald-400 rounded-full animate-bar-grow" style={{ height: '60%' }} />
                    <div className="w-2.5 bg-emerald-400 rounded-full animate-bar-grow" style={{ height: '30%' }} />
                    <div className="w-2.5 bg-emerald-400 rounded-full animate-bar-grow" style={{ height: '80%' }} />
                    <div className="w-2.5 bg-emerald-400 rounded-full animate-bar-grow" style={{ height: '50%' }} />
                    <div className="w-2.5 bg-emerald-400 rounded-full animate-bar-grow" style={{ height: '90%' }} />
                    <div className="w-2.5 bg-emerald-400 rounded-full animate-bar-grow" style={{ height: '70%' }} />
                </div>
              </div>
            </div>
            
            {/* Background Blob */}
            <div className="absolute -right-20 -bottom-20 -z-20 h-80 w-80 rounded-full bg-[#2563eb]/20 blur-[100px]" />
            <div className="absolute -left-20 -top-20 -z-20 h-80 w-80 rounded-full bg-blue-50 blur-[100px]" />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
