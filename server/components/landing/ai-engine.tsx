import { Reveal } from "@/components/ui/reveal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faDatabase, 
  faFileLines, 
  faMagnifyingGlass, 
  faMessage, 
  faCommentSms, 
  faFilePen, 
  faBrain, 
  faBolt, 
  faPaperPlane, 
  faMicrophoneLines, 
  faChevronRight, 
  faCircleCheck 
} from "@fortawesome/free-solid-svg-icons";

const models = [
  { name: "通义千问 (Qwen)", desc: "qwen-plus · qwen-flash", icon: "Q", color: "text-purple-600", bg: "bg-purple-50" },
  { name: "豆包 (Doubao)", desc: "doubao-1.5-pro · Embedding · TTS · ASR", icon: "D", color: "text-orange-600", bg: "bg-orange-50" },
  { name: "DeepSeek", desc: "deepseek-chat", icon: "DS", color: "text-blue-600", bg: "bg-blue-50" },
  { name: "扣子 (Coze)", desc: "Workflow API · 剪映集成", icon: "C", color: "text-green-600", bg: "bg-green-50" },
  { name: "OpenAI兼容接口", desc: "可接入任何兼容API的模型", icon: "+", color: "text-slate-600", bg: "bg-slate-50" },
];

const ragFeatures = [
  { title: "知识库管理", desc: "支持创建多个知识库，按分类管理，设置关键词和权重。", icon: faDatabase },
  { title: "文本向量化", desc: "支持向量匹配，支持text-embedding-v3 and doubao多模态向量模型。", icon: faFileLines },
  { title: "语义检索", desc: "余弦相似度匹配，自动命中离中最相关的知识片段作为上下文注入AI对话。", icon: faMagnifyingGlass },
  { title: "微信客服融合", desc: "微信自动回复结合RAG知识库，让AI用你自己的业务知识精准回答客户问题。", icon: faMessage },
];

const scenarios = [
  { name: "微信智能客服", icon: faCommentSms },
  { name: "AI内容生成", icon: faFilePen },
  { name: "AI员工定时任务", icon: faBrain },
  { name: "Function Calling", icon: faBolt },
  { name: "智能群发文案", icon: faPaperPlane },
  { name: "语音合成 TTS", icon: faMicrophoneLines },
];

export function AIEngine() {
  return (
    <section className="py-24 bg-surface">
      <div className="container mx-auto px-4 sm:px-8">
        <Reveal className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-600">
            AI ENGINE
          </div>
          <h2 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            多模型AI引擎 + RAG知识库
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            灵活接入主流大模型，结合向量检索和知识库实现精准问答，让AI真正懂你的业务
          </p>
        </Reveal>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Models List */}
          <div className="space-y-6">
            <Reveal duration={500}>
              <h3 className="text-xl font-bold mb-6">已集成AI模型</h3>
            </Reveal>
            <div className="space-y-3">
              {models.map((model, i) => (
                <Reveal key={model.name} delay={i * 100} threshold={0.1}>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-white border border-border group hover:border-brand/40 transition-all cursor-default">
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-lg ${model.bg} ${model.color} flex items-center justify-center font-bold text-sm`}>
                        {model.icon}
                      </div>
                      <div>
                        <div className="text-sm font-bold">{model.name}</div>
                        <div className="text-[10px] text-muted-foreground">{model.desc}</div>
                      </div>
                    </div>
                    <FontAwesomeIcon icon={faChevronRight} className="text-xs text-muted-foreground group-hover:text-brand transition-colors" />
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          {/* RAG Details */}
          <Reveal delay={200} className="p-10 rounded-3xl bg-navy text-white shadow-2xl space-y-10">
            <div>
              <h3 className="text-2xl font-bold mb-6">RAG 知识库检索增强</h3>
              <div className="space-y-8">
                {ragFeatures.map((feature, i) => (
                  <Reveal key={i} delay={300 + i * 100} threshold={0.1} direction="right">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-brand/20 flex items-center justify-center text-brand">
                        <FontAwesomeIcon icon={feature.icon} className="text-sm" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold mb-1">{feature.title}</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">{feature.desc}</p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">AI应用场景</div>
              <div className="grid grid-cols-2 gap-y-3">
                {scenarios.map((s, i) => (
                  <Reveal key={i} delay={600 + i * 50} threshold={0.1}>
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <FontAwesomeIcon icon={faCircleCheck} className="text-[10px] text-brand" />
                      {s.name}
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
