import { Reveal } from "@/components/ui/reveal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faGaugeHigh, 
  faChartSimple, 
  faRobot, 
  faUserTie, 
  faClapperboard, 
  faFolderTree, 
  faBullhorn, 
  faBullseye, 
  faFire, 
  faImage, 
  faPaperPlane, 
  faReplyAll, 
  faListCheck, 
  faTags, 
  faBook, 
  faDiagramProject, 
  faDesktop, 
  faHeartPulse, 
  faLink, 
  faKey 
} from "@fortawesome/free-solid-svg-icons";

const modules = [
  { 
    name: "工作台", 
    desc: "数据概览看板，接待人数、消息处理数、转化人数、视频发布量等核心指标一目了然", 
    icon: faGaugeHigh, 
    color: "text-blue-500", 
    bg: "bg-blue-50" 
  },
  { 
    name: "数据分析", 
    desc: "设备在线状态、视频发布统计、趋势图表，支持7天/30天周期切换", 
    icon: faChartSimple, 
    color: "text-cyan-500", 
    bg: "bg-cyan-50" 
  },
  { 
    name: "智能体对话", 
    desc: "AI聊天对话，支持Function Calling，可调用系统内各模块功能", 
    icon: faRobot, 
    color: "text-purple-500", 
    bg: "bg-purple-50" 
  },
  { 
    name: "AI员工", 
    desc: "设定工作日和工作时段，AI自动执行日常任务——自动回复、接受好友、定时推送", 
    icon: faUserTie, 
    color: "text-orange-500", 
    bg: "bg-orange-50" 
  },
  { 
    name: "创作中心", 
    desc: "视频编辑中枢，结合AI处理能力进行视频加工 and 创作", 
    icon: faClapperboard, 
    color: "text-pink-500", 
    bg: "bg-pink-50" 
  },
  { 
    name: "素材库/作品库", 
    desc: "统一管理素材文件 and 已发布的视频作品", 
    icon: faFolderTree, 
    color: "text-red-500", 
    bg: "bg-red-50" 
  },
  { 
    name: "自动曝光", 
    desc: "自动点赞、评论、关注、浏览等组合操作，提升账号活跃度 and 曝光量", 
    icon: faBullhorn, 
    color: "text-yellow-500", 
    bg: "bg-yellow-50" 
  },
  { 
    name: "公域获客", 
    desc: "扫描目标视频评论区，按关键词筛选线索，自动评论/关注/私信，线索回传CRM", 
    icon: faBullseye, 
    color: "text-indigo-500", 
    bg: "bg-indigo-50" 
  },
  { 
    name: "主动激活", 
    desc: "通过打招呼、内容推送、促销信息等策略主动激活沉默客户", 
    icon: faFire, 
    color: "text-orange-600", 
    bg: "bg-orange-100" 
  },
  { 
    name: "朋友圈营销", 
    desc: "定时发布朋友圈，批量点赞/评论，制定每日发圈计划", 
    icon: faImage, 
    color: "text-green-500", 
    bg: "bg-green-50" 
  },
  { 
    name: "智能群发", 
    desc: "AI智能生成群发文案，按标签/好友分组批量发送微信消息", 
    icon: faPaperPlane, 
    color: "text-blue-600", 
    bg: "bg-blue-100" 
  },
  { 
    name: "微信自动回复", 
    desc: "支持AI回复、关键词匹配、新好友欢迎语，后台守护进程持续运行", 
    icon: faReplyAll, 
    color: "text-emerald-500", 
    bg: "bg-emerald-50" 
  },
  { 
    name: "SOP自动推送", 
    desc: "创建多步骤SOP计划，按时间/事件/手动触发，自动逐步推送内容给客户", 
    icon: faListCheck, 
    color: "text-violet-500", 
    bg: "bg-violet-50" 
  },
  { 
    name: "好友标签管理", 
    desc: "给微信好友打标签，按标签分组管理，配合群发 and SOP精准触达", 
    icon: faTags, 
    color: "text-amber-500", 
    bg: "bg-amber-50" 
  },
  { 
    name: "知识库", 
    desc: "RAG向量检索知识库，分类管理知识条目，自动分块 and Embedding，赋能AI精准回复", 
    icon: faBook, 
    color: "text-rose-500", 
    bg: "bg-rose-50" 
  },
  { 
    name: "自动工作流", 
    desc: "可视化配置触发条件与执行动作——消息触发、关键词触发、定时触发、新关注触发等", 
    icon: faDiagramProject, 
    color: "text-teal-500", 
    bg: "bg-teal-50" 
  },
  { 
    name: "设备管理", 
    desc: "绑定 and 管理多台电脑设备，实时查看在线状态、CPU、内存，远程下发任务", 
    icon: faDesktop, 
    color: "text-blue-700", 
    bg: "bg-blue-100" 
  },
  { 
    name: "任务监控", 
    desc: "实时查看所有任务的排队、执行、完成状态，任务日志全程可追溯", 
    icon: faHeartPulse, 
    color: "text-indigo-700", 
    bg: "bg-indigo-100" 
  },
  { 
    name: "账号绑定", 
    desc: "绑定各平台账号，统一管理抖音、快手、小红书等多平台登录态", 
    icon: faLink, 
    color: "text-amber-700", 
    bg: "bg-amber-100" 
  },
  { 
    name: "卡密兑换/AI充值", 
    desc: "卡密激活系统功能，AI用量余额管理 and 订阅套餐", 
    icon: faKey, 
    color: "text-purple-700", 
    bg: "bg-purple-100" 
  },
];

export function AllModules() {
  return (
    <section id="modules" className="py-24 bg-white">
      <div className="container mx-auto px-4 sm:px-8">
        <Reveal className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-600 uppercase tracking-widest">
            ALL MODULES
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            全部功能模块一览
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed italic">
            系统覆盖运营全场景，每个模块独立运行又协同联动
          </p>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {modules.map((mod, i) => (
            <Reveal key={i} delay={i * 50} threshold={0.1}>
              <div
                className="group p-8 rounded-3xl bg-surface border border-border/50 hover:bg-white hover:border-brand/40 hover:shadow-xl transition-all cursor-pointer h-full"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className={`h-10 w-10 flex-shrink-0 rounded-xl ${mod.bg} ${mod.color} flex items-center justify-center transition-transform group-hover:scale-110`}>
                    <FontAwesomeIcon icon={mod.icon} className="text-lg" />
                  </div>
                  <div className="text-lg font-bold text-foreground group-hover:text-brand transition-colors">
                    {mod.name}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed group-hover:text-slate-600 transition-colors">
                  {mod.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
