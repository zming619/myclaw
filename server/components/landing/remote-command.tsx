import { Reveal } from "@/components/ui/reveal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faDesktop, 
  faBolt, 
  faLayerGroup, 
  faShieldHalved, 
  faCommentDots, 
  faVideo, 
  faRotate, 
  faUsers, 
  faGears, 
  faMobileScreenButton 
} from "@fortawesome/free-solid-svg-icons";

const commands = [
  "群发消息", "视频发布", "朋友圈营销", "自动回复", "SOP推送", 
  "公域获客", "主动激活", "标签管理", "视频批量编辑", "剪映草稿生成", 
  "自动曝光", "设备状态查询"
];

const stats = [
  { label: "N台", desc: "同时绑定多台设备", icon: faDesktop },
  { label: "实时", desc: "心跳监控在线状态", icon: faBolt },
  { label: "12+", desc: "可远程执行的指令类型", icon: faLayerGroup },
  { label: "全自动", desc: "轮询队列自动拉取", icon: faShieldHalved },
];

export function RemoteCommand() {
  return (
    <section className="py-24 bg-navy text-white overflow-hidden">
      <div className="container mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Dashboard Mockup */}
          <Reveal className="relative order-2 lg:order-1" direction="left">
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
                  { icon: faCommentDots, label: "群发消息", detail: "批量发送至指定好友" },
                  { icon: faVideo, label: "发布视频", detail: "抖音、快手、小红书" },
                  { icon: faRotate, label: "自动回复", detail: "AI + 关键词 + 欢迎语" },
                  { icon: faUsers, label: "公域获客", detail: "评论区扫描、自动私信" },
                  { icon: faGears, label: "执行SOP", detail: "自动化客户触达流程" },
                ].map((item, i) => (
                 <Reveal key={i} delay={200 + i * 100} threshold={0.1}>
                   <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer group">
                     <div className="flex items-center gap-4">
                       <div className="h-10 w-10 rounded-lg bg-[#2563eb]/20 flex items-center justify-center text-[#2563eb]">
                         <FontAwesomeIcon icon={item.icon} className="text-base" />
                       </div>
                       <div>
                         <div className="text-sm font-bold">{item.label}</div>
                         <div className="text-xs text-slate-400">{item.detail}</div>
                       </div>
                     </div>
                     <FontAwesomeIcon icon={faMobileScreenButton} className="text-sm text-slate-500 group-hover:text-[#2563eb] transition-colors" />
                   </div>
                 </Reveal>
                ))}
               </div>
            </div>
          </Reveal>

          {/* Content */}
          <div className="space-y-10 order-1 lg:order-2">
            <Reveal className="space-y-4">
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
            </Reveal>

            <div className="grid grid-cols-2 gap-4">
              {stats.map((stat, i) => (
                <Reveal key={i} delay={200 + i * 100} threshold={0.1}>
                  <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-2 h-full">
                    <div className="flex items-center justify-between">
                      <div className="text-2xl font-bold text-[#2563eb]">{stat.label}</div>
                      <FontAwesomeIcon icon={stat.icon} className="text-lg text-slate-500" />
                    </div>
                    <div className="text-xs text-slate-400">{stat.desc}</div>
                  </div>
                </Reveal>
              ))}
            </div>

            <div className="space-y-4">
              <Reveal delay={600}>
                <div className="text-sm font-bold text-slate-500 uppercase tracking-widest">支持的远程指令</div>
              </Reveal>
              <div className="flex flex-wrap gap-2">
                {commands.map((cmd, i) => (
                  <Reveal key={i} delay={700 + i * 50} threshold={0.1} direction="up" duration={300}>
                    <span className="px-3 py-1.5 rounded-lg bg-navy-light border border-white/5 text-xs text-slate-300 hover:border-brand/40 transition-colors cursor-default">
                      {cmd}
                    </span>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
