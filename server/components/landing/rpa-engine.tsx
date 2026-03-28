import { Reveal } from "@/components/ui/reveal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faFire, 
  faBookOpen, 
  faCirclePlay, 
  faDesktop, 
  faRobot 
} from "@fortawesome/free-solid-svg-icons";
import { 
  faTiktok, 
  faWeixin 
} from "@fortawesome/free-brands-svg-icons";

const platforms = [
  { name: "抖音", icon: faTiktok, desc: "发布 · 互动 · 获客", color: "text-slate-900" },
  { name: "快手", icon: faFire, desc: "发布 · 互动 · 获客", color: "text-orange-500" },
  { name: "小红书", icon: faBookOpen, desc: "发布 · 互动 · 获客", color: "text-red-500" },
  { name: "微信", icon: faWeixin, desc: "消息 · 朋友圈 · SOP", color: "text-emerald-500" },
  { name: "视频号", icon: faCirclePlay, desc: "发布 · 登录", color: "text-orange-600" },
  { name: "B站", icon: faDesktop, desc: "视频发布", color: "text-blue-400" },
];

export function RPAEngine() {
  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <Reveal className="space-y-10">
            <div className="space-y-4">
              <div className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-600">
                RPA ENGINE
              </div>
              <h2 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                全平台RPA <br />
                <span className="text-brand">自动化操作引擎</span>
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                基于 Python + UI Automation + Playwright 打造的跨平台 RPA 引擎，覆盖主流社交和短视频平台。
              </p>
            </div>

            <div className="space-y-8">
              <Reveal delay={100} className="flex gap-4">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                  <FontAwesomeIcon icon={faWeixin} className="text-lg" />
                </div>
                <div>
                  <h4 className="text-lg font-bold mb-1">微信自动化</h4>
                  <p className="text-muted-foreground text-sm">消息收发、批量群发、自动回复、好友添加/接受、标签管理、朋友圈发布、SOP自动推送、主动激活</p>
                </div>
              </Reveal>
              
              <Reveal delay={200} className="flex gap-4">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-pink-50 flex items-center justify-center text-pink-600">
                  <FontAwesomeIcon icon={faCirclePlay} className="text-lg" />
                </div>
                <div>
                  <h4 className="text-lg font-bold mb-1">短视频平台</h4>
                  <p className="text-muted-foreground text-sm">抖音、快手、小红书、视频号、B站——自动登录、点击、点赞、评论、关注、浏览</p>
                </div>
              </Reveal>
              
              <Reveal delay={300} className="flex gap-4">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                  <FontAwesomeIcon icon={faRobot} className="text-lg" />
                </div>
                <div>
                  <h4 className="text-lg font-bold mb-1">公域获客机器人</h4>
                  <p className="text-muted-foreground text-sm">评论区关键词扫描、自动评论/关注/私信、线索自动回传、多平台批量执行</p>
                </div>
              </Reveal>
            </div>
          </Reveal>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {platforms.map((platform, i) => (
              <Reveal key={platform.name} delay={i * 100} threshold={0.1}>
                <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-surface border border-border group hover:border-brand/40 hover:bg-white hover:shadow-lg transition-all">
                  <div className="h-12 w-12 mb-4 bg-white rounded-xl shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FontAwesomeIcon icon={platform.icon} className={`${platform.color} text-2xl`} />
                  </div>
                  <div className="text-lg font-bold mb-1">{platform.name}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest text-center">{platform.desc}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
