export interface KnowledgeDoc {
  id: string
  title: string
  summary: string
  keywords: string[]
  content: string
  recommendedTemplateId?: string
}

export const knowledgeBase: KnowledgeDoc[] = [
  {
    id: 'kb-rpa-wechat',
    title: '微信自动化执行规范',
    summary: '消息收发、群发、标签、朋友圈、SOP 推送统一由 MyClaw Desktop 调度。',
    keywords: ['微信', '群发', '标签', '朋友圈', 'SOP', '自动回复'],
    content:
      '微信侧任务默认走桌面端执行队列。执行前先检查登录态、标签筛选条件和消息模板，再决定是否进入批量群发或 SOP 链路。自动回复守护建议在工作时段持续开启，并结合关键词和知识库命中结果回复。',
    recommendedTemplateId: 'broadcast_message',
  },
  {
    id: 'kb-public-leads',
    title: '公域获客机器人作业流',
    summary: '评论区扫描、关键词过滤、点赞关注、自动私信与 CRM 回传。',
    keywords: ['获客', '评论区', '私信', '关键词', '抖音', '小红书', '快手'],
    content:
      '公域获客任务推荐先确定平台、关键词和最大扫描量。MyClaw Desktop 拉取远程任务后，会先执行评论区扫描，再根据关键词做线索筛选，随后触发评论、关注和私信动作。适合在非高峰时段批量执行。',
    recommendedTemplateId: 'lead_capture',
  },
  {
    id: 'kb-ai-rag',
    title: 'AI 智能对话与 RAG 策略',
    summary: '优先检索知识库，再决定是否生成回复或触发 Function Calling。',
    keywords: ['AI', 'RAG', '知识库', 'Function Calling', '客服', '问答'],
    content:
      'AI 对话先命中知识库条目，再结合当前设备状态和任务上下文生成建议。如果用户意图是执行操作，例如群发、发布、自动回复、SOP 推送，应直接生成可执行任务建议，并允许一键加入桌面任务队列。',
    recommendedTemplateId: 'auto_reply',
  },
  {
    id: 'kb-video-matrix',
    title: '视频创作与矩阵分发 SOP',
    summary: '视频去水印、去字幕、增强、剪映草稿、全网矩阵发布。',
    keywords: ['视频', '剪映', '矩阵', '抖音', '快手', '小红书', '分发'],
    content:
      '视频类任务建议拆成两个阶段：先做去水印、去字幕和超分处理，再生成剪映草稿并提交矩阵分发。桌面端适合承接草稿生成、平台登录态检查和多平台发布执行。',
    recommendedTemplateId: 'publish_video',
  },
  {
    id: 'kb-private-domain',
    title: '私域精细化运营手册',
    summary: '主动激活、标签管理、朋友圈营销和 SOP 触达的节奏控制。',
    keywords: ['私域', '激活', '标签', '营销', '朋友圈', '客户'],
    content:
      '私域运营要把客户分层：新加好友、已咨询未成交、30 日沉默和高意向复购。桌面端执行器更适合处理打标签、群发、SOP 推送和朋友圈营销四类任务。沉默客户激活要控制频率，避免连续骚扰。',
    recommendedTemplateId: 'activate_customers',
  },
  {
    id: 'kb-device-center',
    title: '设备绑定与远程指令机制',
    summary: '手机端发送文字或 JSON 指令，桌面端轮询并执行。',
    keywords: ['设备', '绑定', '手机', '远程', 'JSON', '状态'],
    content:
      '每台 MyClaw Desktop 都需要独立的绑定码和心跳状态。手机端发来的文字或 JSON 指令先进入远程收件箱，再由自动轮询模块拉取并解析成标准任务。无法识别的指令应标记为拒绝并提示补充信息。',
    recommendedTemplateId: 'device_status_query',
  },
]
