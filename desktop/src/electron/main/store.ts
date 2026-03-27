import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type {
  AppSnapshot,
  BindDeviceInput,
  CommandTemplate,
  DeviceState,
  EnqueueTaskInput,
  MetricCard,
  ModuleCard,
  PythonRunnerHealth,
  QueueTask,
  RemoteCommand,
  SettingKey,
  WorkflowStep,
} from '../../shared/contracts'
import { DesktopGateway } from './desktop-gateway'
import { LocalAutoReplyBridge } from './local-auto-reply-bridge'
import type { PythonRunnerEvent } from './python-rpa'
import { PythonRpaService } from './python-rpa'
import { ServerAutoReplyService } from './server-auto-reply'
import { ServerComputerUseService } from './server-computer-use'

interface PersistedState {
  device: Pick<
    DeviceState,
    'id' | 'alias' | 'workspace' | 'operatorName' | 'bindCode' | 'autoPolling' | 'autoReply'
  >
  autoReplyPayload?: Record<string, unknown>
  autoReplyConfigured?: boolean
  activeAutoReplyTaskId?: string | null
  queue: QueueTask[]
  inbox: RemoteCommand[]
  activityFeed: string[]
}

interface TemplateMatch {
  templateId: string
  detail: string
  payload: Record<string, unknown>
}

const templates: CommandTemplate[] = [
  {
    id: 'broadcast_message',
    name: '指定好友 / 群发消息',
    description: '按好友名或群聊名逐个搜索并发送微信消息，适合活动触达和促活。',
    category: '私域运营',
    estimatedSeconds: 28,
    sopCode: 'wechat.broadcast.standard',
    platforms: ['微信'],
    payloadTemplate: {
      targetTags: ['高意向', '7日沉默'],
      contacts: ['客户A', '客户B'],
      groups: ['测试群'],
      content: '今晚 20:00 直播开场，点击回复 1 获取预约链接。',
      dryRun: true,
    },
  },
  {
    id: 'publish_video',
    name: '矩阵发布',
    description: '向抖音、快手、小红书同步发布同一条视频素材。',
    category: '内容分发',
    estimatedSeconds: 42,
    sopCode: 'content.publish.matrix',
    platforms: ['抖音', '快手', '小红书'],
    payloadTemplate: {
      platforms: ['抖音', '快手', '小红书'],
      title: '老板不在，也能自动跑获客',
      assetId: 'asset-20260325-01',
      removeWatermark: true,
    },
  },
  {
    id: 'auto_reply',
    name: '微信自动回复',
    description: '开启 AI + 关键词 + 欢迎语的守护模式。',
    category: '智能客服',
    estimatedSeconds: 12,
    sopCode: 'wechat.reply.guard',
    platforms: ['微信'],
    payloadTemplate: {
      enabled: true,
      targetName: '鲲鹏',
      targetKind: 'contact',
      welcome: '你好，我是小云，先把你的需求发我，我来帮你安排。',
      fallbackReply: '我先帮你记下需求，稍后给你一个明确回复。',
      strategy: 'AI + 关键词 + 欢迎语',
      readMode: 'computer_use',
      keywordReplies: {
        在吗: '我在，直接说你的问题就行。',
      },
      pollIntervalSeconds: 4,
      duplicateCooldownSeconds: 600,
      maxUnreadSessions: 1,
      bootstrapOnly: true,
      dryRun: false,
    },
  },
  {
    id: 'lead_capture',
    name: '公域获客',
    description: '扫描评论区关键词并自动评论、关注、私信。',
    category: '公域获客',
    estimatedSeconds: 36,
    sopCode: 'public.lead.capture',
    platforms: ['抖音', '快手', '小红书'],
    payloadTemplate: {
      platforms: ['抖音', '小红书'],
      keywords: ['加盟', '怎么做', '报价'],
      maxTargets: 80,
    },
  },
  {
    id: 'push_sop',
    name: 'SOP 推送',
    description: '按联系人执行内容 SOP，适合阶段性触达和追单。',
    category: '私域运营',
    estimatedSeconds: 20,
    sopCode: 'wechat.sop.push',
    platforms: ['微信'],
    payloadTemplate: {
      sopId: 'sop-levelup-03',
      customerTags: ['已咨询', '未下单'],
      contacts: ['客户A'],
      groups: ['VIP 服务群'],
      messages: ['这是第 1 条 SOP 触达消息。', '这是第 2 条 SOP 跟进消息。'],
      batchSize: 50,
      dryRun: true,
    },
  },
  {
    id: 'activate_customers',
    name: '主动激活',
    description: '面向沉默客户发起打招呼、内容推送和促销提醒。',
    category: '私域运营',
    estimatedSeconds: 24,
    sopCode: 'wechat.reactivate.campaign',
    platforms: ['微信'],
    payloadTemplate: {
      targetTags: ['30日沉默'],
      contacts: ['客户A'],
      campaign: '春季福利包',
      style: '温和提醒',
      messages: ['很久没联系了，给你同步一下这周的新活动。'],
      dryRun: true,
    },
  },
  {
    id: 'moments_campaign',
    name: '朋友圈营销',
    description: '定时发圈并触发点赞、评论、素材轮播。',
    category: '社交运营',
    estimatedSeconds: 18,
    sopCode: 'wechat.moments.campaign',
    platforms: ['微信'],
    payloadTemplate: {
      schedule: '14:00',
      copy: '今天到店体验可领数字员工方案清单。',
      likeSeed: 12,
      dryRun: true,
    },
  },
  {
    id: 'tag_management',
    name: '好友标签管理',
    description: '按来源、阶段和意向度自动打标签。',
    category: '私域运营',
    estimatedSeconds: 14,
    sopCode: 'wechat.tag.management',
    platforms: ['微信'],
    payloadTemplate: {
      contacts: ['客户A', '客户B'],
      addTags: ['直播间', '高客单'],
      dryRun: true,
    },
  },
  {
    id: 'video_edit_batch',
    name: '视频批量处理',
    description: '去水印、去字幕、超分与画质增强一键执行。',
    category: '内容生产',
    estimatedSeconds: 32,
    sopCode: 'media.batch.optimize',
    platforms: ['本地素材'],
    payloadTemplate: {
      removeSubtitle: true,
      superResolution: true,
      clips: 6,
    },
  },
  {
    id: 'jianying_draft',
    name: '剪映草稿生成',
    description: '根据素材和字幕模板生成草稿，等待人工确认。',
    category: '内容生产',
    estimatedSeconds: 16,
    sopCode: 'media.jianying.draft',
    platforms: ['剪映'],
    payloadTemplate: {
      template: '招商说明会',
      clipCount: 8,
      subtitleStyle: '明亮商务',
    },
  },
  {
    id: 'auto_exposure',
    name: '自动曝光',
    description: '自动点赞、评论、关注、浏览，提升账号活跃度。',
    category: '账号养成',
    estimatedSeconds: 22,
    sopCode: 'social.auto.exposure',
    platforms: ['抖音', '快手', '小红书'],
    payloadTemplate: {
      platforms: ['抖音', '快手', '小红书'],
      likes: 30,
      follows: 12,
      comments: 10,
    },
  },
  {
    id: 'device_status_query',
    name: '设备状态查询',
    description: '回传当前设备在线状态、CPU、内存和任务队列。',
    category: '设备管理',
    estimatedSeconds: 8,
    sopCode: 'device.status.report',
    platforms: ['设备'],
    payloadTemplate: {},
  },
]

const modules: ModuleCard[] = [
  {
    id: 'rpa',
    name: '全平台 RPA 引擎',
    description: 'Electron 客户端通过 Python + Playwright + macOS/Windows UI Automation 调用平台动作。',
    accent: 'blue',
  },
  {
    id: 'sop',
    name: 'SOP 编排中心',
    description: '把群发、获客、矩阵发布、私域激活统一封装为标准 SOP。',
    accent: 'amber',
  },
  {
    id: 'remote',
    name: '远程指令队列',
    description: '手机端下发文本或 JSON 指令，桌面端自动轮询并执行。',
    accent: 'emerald',
  },
  {
    id: 'rag',
    name: 'AI + RAG 协同',
    description: 'AI 生成建议，RAG 提供业务上下文，最终落到可执行任务。',
    accent: 'violet',
  },
]

function nowIso() {
  return new Date().toISOString()
}

function shortId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function booleanFromUnknown(value: unknown, fallback = false) {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false
    }
  }
  if (typeof value === 'number') {
    return value !== 0
  }
  return fallback
}

function numberFromUnknown(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function firstStringFromUnknownList(value: unknown) {
  if (!Array.isArray(value)) {
    return ''
  }

  const first = value[0]
  return first == null ? '' : String(first)
}

function findTemplate(templateId: string) {
  return templates.find((item) => item.id === templateId)
}

function inferPlatforms(text: string) {
  const supported = ['微信', '抖音', '快手', '小红书', '视频号', 'B站']
  const matched = supported.filter((platform) => text.includes(platform))
  return matched.length ? matched : undefined
}

function createInitialDevice(): DeviceState {
  return {
    id: 'dev-xingyun-01',
    alias: 'MyClaw 执行器-01',
    workspace: '华东增长组',
    operatorName: '小云',
    bindCode: 'MYCLAW-3817',
    online: true,
    heartbeatAt: nowIso(),
    cpuLoad: 22,
    memoryUsage: 46,
    autoPolling: true,
    autoReply: true,
    version: 'desktop 0.1.0',
    os: process.platform === 'darwin' ? 'macOS' : process.platform,
  }
}

function createQueueTask(
  template: CommandTemplate,
  input: Pick<EnqueueTaskInput, 'name' | 'payload' | 'source' | 'rawCommand'> & {
    id?: string
    createdAt?: string
    status?: QueueTask['status']
    progress?: number
    result?: string
    logs?: string[]
    engineMode?: QueueTask['engineMode']
    backgroundActive?: boolean
    artifacts?: QueueTask['artifacts']
  },
): QueueTask {
  const createdAt = input.createdAt || nowIso()
  const payload = { ...template.payloadTemplate, ...input.payload }
  const inferredPlatforms = Array.isArray(payload.platforms)
    ? payload.platforms.map((item) => String(item))
    : template.platforms

  return {
    id: input.id || shortId('task'),
    templateId: template.id,
    sopCode: template.sopCode,
    name: input.name || template.name,
    source: input.source || 'manual',
    status: input.status || 'queued',
    progress: input.progress ?? 0,
    createdAt,
    updatedAt: createdAt,
    platforms: inferredPlatforms,
    payload,
    rawCommand: input.rawCommand,
    result: input.result,
    engineMode: input.engineMode,
    backgroundActive: input.backgroundActive,
    artifacts: input.artifacts,
    logs:
      input.logs ||
      [`任务已创建，来源：${input.source || 'manual'}`, `执行 SOP：${template.sopCode}`],
  }
}

function normalizeTask(task: QueueTask): QueueTask {
  const template = findTemplate(task.templateId)
  if (!template) {
    return task
  }

  return {
    ...createQueueTask(template, {
      id: task.id,
      name: task.name,
      payload: task.payload,
      source: task.source,
      rawCommand: task.rawCommand,
      createdAt: task.createdAt,
      status: task.status,
      progress: task.progress,
      result: task.result,
      logs: task.logs,
      engineMode: task.engineMode,
      backgroundActive: task.backgroundActive,
      artifacts: task.artifacts,
    }),
    updatedAt: task.updatedAt,
  }
}

function defaultQueue(): QueueTask[] {
  const broadcast = findTemplate('broadcast_message')
  const publish = findTemplate('publish_video')

  return [
    createQueueTask(broadcast!, {
      name: '直播预热群发',
      payload: {
        targetTags: ['直播意向'],
        content: '今晚 20:00 直播开场，回 1 获取报名链接。',
      },
      source: 'manual',
      status: 'completed',
      progress: 100,
      result: '微信群发 SOP 已执行完成，等待后台同步送达结果。',
      logs: ['任务已创建', '执行 SOP：wechat.broadcast.standard', '历史任务已完成'],
      engineMode: 'mock',
    }),
    createQueueTask(publish!, {
      name: '招商视频矩阵发布',
      payload: {
        platforms: ['抖音', '快手', '小红书'],
        title: '超级数字员工的一天',
      },
      source: 'mobile',
      status: 'queued',
      progress: 0,
      logs: ['收到手机端指令，等待 Python RPA 执行'],
    }),
  ]
}

function defaultInbox(): RemoteCommand[] {
  const createdAt = nowIso()
  return [
    {
      id: shortId('cmd'),
      raw: '帮我扫描抖音评论区关键词“怎么合作、多少钱”，自动私信前 50 个线索',
      status: 'pending',
      createdAt,
      detail: '等待桌面端轮询拉取',
    },
  ]
}

function loadPersistedState(path: string): PersistedState | null {
  try {
    const raw = readFileSync(path, 'utf8')
    return JSON.parse(raw) as PersistedState
  } catch {
    return null
  }
}

export class DesktopStore {
  private readonly persistPath: string
  private readonly listeners = new Set<(snapshot: AppSnapshot) => void>()
  private readonly runner: PythonRpaService
  private readonly gateway: DesktopGateway
  private readonly serverAutoReply: ServerAutoReplyService
  private readonly serverComputerUse: ServerComputerUseService
  private readonly localAutoReplyBridge: LocalAutoReplyBridge
  private device: DeviceState
  private autoReplyPayload: Record<string, unknown>
  private autoReplyConfigured: boolean
  private activeAutoReplyTaskId: string | null
  private queue: QueueTask[]
  private inbox: RemoteCommand[]
  private activityFeed: string[]
  private runnerHealth: PythonRunnerHealth | null = null
  private runningTaskId: string | null = null
  private autoReplyBusy = false
  private autoReplyStopRequested = false
  private autoReplyLastTickAt = 0
  private autoReplyLastIssue = ''
  private autoReplyLastIssueAt = 0
  private readonly stopRequestedTaskIds = new Set<string>()
  private heartbeatTimer?: NodeJS.Timeout
  private inboxTimer?: NodeJS.Timeout
  private workerTimer?: NodeJS.Timeout
  private autoReplyTimer?: NodeJS.Timeout

  constructor(userDataDir: string, projectRoot: string) {
    this.persistPath = join(userDataDir, 'desktop-state.json')
    this.serverAutoReply = new ServerAutoReplyService()
    this.serverComputerUse = new ServerComputerUseService(this.serverAutoReply.getBaseUrl())
    this.localAutoReplyBridge = new LocalAutoReplyBridge(
      this.serverAutoReply,
      this.serverComputerUse,
    )
    this.runner = new PythonRpaService(projectRoot)
    this.gateway = new DesktopGateway(userDataDir)

    const persisted = loadPersistedState(this.persistPath)

    this.device = {
      ...createInitialDevice(),
      ...persisted?.device,
      online: true,
      heartbeatAt: nowIso(),
      cpuLoad: 22,
      memoryUsage: 46,
      version: 'desktop 0.1.0',
      os: process.platform === 'darwin' ? 'macOS' : process.platform,
    }
    const autoReplyTemplate = findTemplate('auto_reply')
    this.autoReplyPayload = {
      ...(autoReplyTemplate?.payloadTemplate || {}),
      ...(persisted?.autoReplyPayload || {}),
    }
    this.autoReplyConfigured = persisted?.autoReplyConfigured || false
    this.queue = ((persisted?.queue ?? defaultQueue()) as QueueTask[]).map(normalizeTask)
    this.activeAutoReplyTaskId =
      persisted?.activeAutoReplyTaskId && this.queue.some((task) => task.id === persisted.activeAutoReplyTaskId)
        ? persisted.activeAutoReplyTaskId
        : null
    if (this.activeAutoReplyTaskId) {
      this.queue = this.queue.map((task) =>
        task.id === this.activeAutoReplyTaskId ? { ...task, backgroundActive: true } : task,
      )
    }
    this.inbox = persisted?.inbox ?? defaultInbox()
    this.activityFeed =
      persisted?.activityFeed?.length
        ? persisted.activityFeed
        : [
            `${formatTime(nowIso())} 设备已上线，开始心跳上报`,
            `${formatTime(nowIso())} Electron 主进程已接管任务队列`,
          ]
  }

  async start() {
    try {
      const bridgeUrl = await this.localAutoReplyBridge.start()
      this.runner.setRuntimeEnv({
        MYCLAW_LOCAL_BRIDGE_URL: bridgeUrl,
        MYCLAW_SERVER_URL: this.serverAutoReply.getBaseUrl(),
      })
      this.addActivity(`${formatTime(nowIso())} 本地自动回复桥已启动：${bridgeUrl}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : '本地自动回复桥启动失败'
      this.addActivity(`${formatTime(nowIso())} ${message}`)
    }

    this.heartbeatTimer = setInterval(() => {
      const running = Boolean(this.runningTaskId)
      this.device = {
        ...this.device,
        heartbeatAt: nowIso(),
        cpuLoad: clamp(this.device.cpuLoad + (running ? 7 : 2) - 4, 16, 78),
        memoryUsage: clamp(this.device.memoryUsage + (running ? 5 : 1) - 2, 35, 84),
      }
      this.gateway.reportHeartbeat({
        device: this.device,
        queueDepth: this.queue.filter((task) => task.status === 'queued' || task.status === 'running').length,
        pendingInbox: this.inbox.filter((entry) => entry.status === 'pending').length,
        runnerHealth: this.runnerHealth,
      })
      this.emit()
    }, 4000)

    this.inboxTimer = setInterval(() => {
      this.pullInbox()
    }, 3000)

    this.workerTimer = setInterval(() => {
      void this.tickQueue()
    }, 1200)

    this.autoReplyTimer = setInterval(() => {
      void this.tickAutoReplyGuard()
    }, 1000)

    void this.probeRunner()
  }

  stop() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
    }
    if (this.inboxTimer) {
      clearInterval(this.inboxTimer)
    }
    if (this.workerTimer) {
      clearInterval(this.workerTimer)
    }
    if (this.autoReplyTimer) {
      clearInterval(this.autoReplyTimer)
    }
    this.localAutoReplyBridge.stop()
  }

  subscribe(listener: (snapshot: AppSnapshot) => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot(): AppSnapshot {
    return {
      device: this.device,
      metrics: this.buildMetrics(),
      templates,
      queue: [...this.queue].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
      inbox: [...this.inbox].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
      workflow: this.buildWorkflow(),
      modules,
      runnerHealth: this.runnerHealth,
      activityFeed: [...this.activityFeed],
      autoReplyPayload: { ...this.getAutoReplyPayload() },
      activeAutoReplyTaskId: this.activeAutoReplyTaskId,
    }
  }

  enqueueTask(input: EnqueueTaskInput) {
    const template = findTemplate(input.templateId)
    if (!template) {
      throw new Error(`Unknown template: ${input.templateId}`)
    }

    if (template.id === 'auto_reply') {
      this.autoReplyPayload = {
        ...template.payloadTemplate,
        ...(input.payload || {}),
      }
    }

    const task = createQueueTask(template, input)
    this.queue = [task, ...this.queue].slice(0, 24)
    this.addActivity(`${formatTime(task.createdAt)} ${task.name} 已进入任务队列`)
    this.emit()
    return this.getSnapshot()
  }

  stopTask(taskId: string) {
    const task = this.queue.find((item) => item.id === taskId)
    if (!task) {
      return this.getSnapshot()
    }

    if (task.status === 'queued') {
      this.updateTask(task.id, (current) => ({
        ...current,
        status: 'stopped',
        progress: 100,
        updatedAt: nowIso(),
        result: '任务已手动停止，未进入执行阶段。',
        backgroundActive: false,
        logs: [...current.logs, '任务已手动停止'],
      }))
      this.addActivity(`${formatTime(nowIso())} ${task.name} 已从队列中移除`)
      this.emit()
      return this.getSnapshot()
    }

    if (task.templateId === 'auto_reply' && (task.backgroundActive || this.activeAutoReplyTaskId === task.id)) {
      this.stopAutoReplyTask(task.id, '已手动停止微信自动回复守护。')
      return this.getSnapshot()
    }

    if (task.status === 'running') {
      this.stopRequestedTaskIds.add(task.id)
      if (task.templateId === 'auto_reply') {
        this.autoReplyConfigured = false
        this.autoReplyStopRequested = true
        this.autoReplyLastTickAt = 0
        this.device = {
          ...this.device,
          autoReply: false,
          heartbeatAt: nowIso(),
        }
        if (this.activeAutoReplyTaskId === task.id) {
          this.activeAutoReplyTaskId = null
        }
      }
      this.runner.stopCurrentTask()
      this.updateTask(task.id, (current) => ({
        ...current,
        status: 'stopped',
        progress: 100,
        updatedAt: nowIso(),
        backgroundActive: false,
        result: '任务已手动停止。',
        logs: [...current.logs, '任务已手动停止'],
      }))
      this.addActivity(`${formatTime(nowIso())} ${task.name} 已手动停止`)
      this.emit()
      return this.getSnapshot()
    }

    return this.getSnapshot()
  }

  pushRemoteCommand(raw: string) {
    const trimmed = raw.trim()
    if (!trimmed) {
      return this.getSnapshot()
    }

    const entry: RemoteCommand = {
      id: shortId('cmd'),
      raw: trimmed,
      status: 'pending',
      createdAt: nowIso(),
      detail: '等待桌面端轮询拉取',
    }

    this.inbox = [entry, ...this.inbox].slice(0, 20)
    this.addActivity(`${formatTime(entry.createdAt)} 收到新的远程指令`)
    this.emit()
    return this.getSnapshot()
  }

  updateDevice(input: BindDeviceInput) {
    this.device = {
      ...this.device,
      alias: input.alias.trim() || this.device.alias,
      workspace: input.workspace.trim() || this.device.workspace,
      operatorName: input.operatorName.trim() || this.device.operatorName,
      bindCode: `MYCLAW-${Math.floor(Math.random() * 9000 + 1000)}`,
      heartbeatAt: nowIso(),
    }
    this.addActivity(`${formatTime(this.device.heartbeatAt)} 设备绑定信息已更新`)
    this.emit()
    return this.getSnapshot()
  }

  toggleSetting(key: SettingKey, value: boolean) {
    if (key === 'autoReply' && !value && this.activeAutoReplyTaskId) {
      this.stopAutoReplyTask(this.activeAutoReplyTaskId, '已通过桌面开关停止微信自动回复守护。')
      return this.getSnapshot()
    }

    this.device = {
      ...this.device,
      [key]: value,
      heartbeatAt: nowIso(),
    }
    if (key === 'autoReply' && value) {
      this.autoReplyLastTickAt = 0
    }
    const label = key === 'autoPolling' ? '自动轮询' : '自动回复'
    const state = value ? '已开启' : '已关闭'
    this.addActivity(`${formatTime(this.device.heartbeatAt)} ${label}${state}`)
    this.emit()
    return this.getSnapshot()
  }

  async rerunDoctor() {
    await this.probeRunner()
    return this.getSnapshot()
  }

  clearHistory() {
    this.queue = this.queue.filter(
      (task) => task.status === 'running' || task.status === 'queued' || task.backgroundActive,
    )
    this.inbox = this.inbox.filter((entry) => entry.status === 'pending')
    this.activityFeed = this.activityFeed.slice(0, 3)
    this.addActivity(`${formatTime(nowIso())} 历史记录已整理`)
    this.emit()
    return this.getSnapshot()
  }

  private async probeRunner() {
    this.runnerHealth = await this.runner.doctor()
    this.addActivity(
      `${formatTime(nowIso())} Python RPA 已巡检：${this.runnerHealth.mode} · ${this.runnerHealth.detail}`,
    )
    this.emit()
  }

  private pullInbox() {
    if (!this.device.autoPolling) {
      return
    }

    const next = this.inbox.find((entry) => entry.status === 'pending')
    if (!next) {
      return
    }

    const parsed = this.matchTemplateFromRaw(next.raw)
    if (!parsed) {
      this.inbox = this.inbox.map((entry) =>
        entry.id === next.id
          ? { ...entry, status: 'rejected', detail: '无法识别该指令，请补充平台和动作' }
          : entry,
      )
      this.addActivity(`${formatTime(nowIso())} 一条远程指令识别失败`)
      this.emit()
      return
    }

    this.inbox = this.inbox.map((entry) =>
      entry.id === next.id
        ? { ...entry, status: 'ingested', detail: parsed.detail }
        : entry,
    )

    this.enqueueTask({
      templateId: parsed.templateId,
      source: 'mobile',
      rawCommand: next.raw,
      payload: parsed.payload,
    })
  }

  private async tickQueue() {
    if (this.runningTaskId) {
      return
    }

    const nextQueued = this.queue.find((task) => task.status === 'queued')
    if (!nextQueued) {
      return
    }

    this.runningTaskId = nextQueued.id
    this.updateTask(nextQueued.id, (task) => ({
      ...task,
      status: 'running',
      progress: 5,
      updatedAt: nowIso(),
      logs: [...task.logs, 'Electron 已拉起 Python RPA，开始执行 SOP'],
    }))
    this.addActivity(`${formatTime(nowIso())} ${nextQueued.name} 开始执行`)
    this.emit()

    try {
      const result = await this.runner.executeTask(nextQueued, this.device, (event) => {
        this.applyRunnerEvent(nextQueued.id, event)
      })

      if (this.stopRequestedTaskIds.has(nextQueued.id)) {
        return
      }

      this.updateTask(nextQueued.id, (task) => ({
        ...task,
        status: 'completed',
        progress: 100,
        updatedAt: nowIso(),
        result: result.summary,
        engineMode: result.engineMode,
        artifacts: result.artifacts,
        logs: [...task.logs, '所有动作已完成，结果已写回本地网关'],
      }))

      const completedTask = this.queue.find((task) => task.id === nextQueued.id)
      if (completedTask) {
        this.gateway.reportTaskResult(completedTask)
      }

      if (nextQueued.templateId === 'auto_reply') {
        const template = findTemplate('auto_reply')
        const configuredPayload = {
          ...(template?.payloadTemplate || {}),
          ...nextQueued.payload,
        }
        const enabled = booleanFromUnknown(configuredPayload.enabled, true)
        const dryRun = booleanFromUnknown(configuredPayload.dryRun, true)

        this.autoReplyPayload = configuredPayload
        this.autoReplyConfigured = enabled && !dryRun
        this.device = { ...this.device, autoReply: enabled }
        this.autoReplyLastTickAt = 0
        this.autoReplyStopRequested = false

        if (this.autoReplyConfigured) {
          const targetLabel =
            String(configuredPayload.targetName || '').trim() ||
            firstStringFromUnknownList(configuredPayload.contacts) ||
            '未指定'
          this.replaceActiveAutoReplyTask(nextQueued.id)
          this.activeAutoReplyTaskId = nextQueued.id
          this.updateTask(nextQueued.id, (task) => ({
            ...task,
            backgroundActive: true,
            result: `微信自动回复守护已启动，目标：${targetLabel}`,
            logs: [...task.logs, '守护任务已进入后台轮询'],
          }))
          const pollSeconds = clamp(
            numberFromUnknown(configuredPayload.pollIntervalSeconds, 3),
            1,
            30,
          )
          this.addActivity(
            `${formatTime(nowIso())} 微信自动回复守护已进入后台轮询，每 ${pollSeconds} 秒检查一次未读会话`,
          )
        } else {
          this.updateTask(nextQueued.id, (task) => ({
            ...task,
            backgroundActive: false,
          }))
        }
      }

      this.addActivity(`${formatTime(nowIso())} ${nextQueued.name} 执行完成`)
      this.emit()
    } catch (error) {
      if (this.stopRequestedTaskIds.has(nextQueued.id)) {
        return
      }
      const message = error instanceof Error ? error.message : 'Python RPA 执行失败'
      this.updateTask(nextQueued.id, (task) => ({
        ...task,
        status: 'failed',
        progress: 100,
        updatedAt: nowIso(),
        result: message,
        logs: [...task.logs, `执行失败：${message}`],
      }))
      this.addActivity(`${formatTime(nowIso())} ${nextQueued.name} 执行失败`)
      this.emit()
    } finally {
      this.stopRequestedTaskIds.delete(nextQueued.id)
      this.runningTaskId = null
    }
  }

  private applyRunnerEvent(taskId: string, event: PythonRunnerEvent) {
    this.updateTask(taskId, (task) => ({
      ...task,
      progress: event.progress ? clamp(event.progress, task.progress, 100) : task.progress,
      updatedAt: nowIso(),
      engineMode: event.engineMode || task.engineMode,
      artifacts: event.artifacts ? { ...(task.artifacts || {}), ...event.artifacts } : task.artifacts,
      logs: [...task.logs, event.message].slice(-12),
    }))

    if (event.type === 'run_failed') {
      this.updateTask(taskId, (task) => ({
        ...task,
        status: 'failed',
        result: event.message,
      }))
    }

    this.emit()
  }

  private async tickAutoReplyGuard() {
    if (!this.device.autoReply || !this.autoReplyConfigured || this.autoReplyBusy) {
      return
    }
    if (this.runningTaskId) {
      return
    }
    if (this.queue.some((task) => task.status === 'queued' || task.status === 'running')) {
      return
    }
    if (this.runnerHealth?.wechat && !this.runnerHealth.wechat.available) {
      return
    }

    const payload = this.getAutoReplyPayload()
    if (!booleanFromUnknown(payload.enabled, true)) {
      return
    }
    if (booleanFromUnknown(payload.dryRun, true)) {
      return
    }

    const pollIntervalMs = clamp(
      numberFromUnknown(payload.pollIntervalSeconds, 3),
      1,
      30,
    ) * 1000
    if (Date.now() - this.autoReplyLastTickAt < pollIntervalMs) {
      return
    }

    this.autoReplyBusy = true
    this.autoReplyLastTickAt = Date.now()

    try {
      const result = await this.runner.executeTask(
        createQueueTask(findTemplate('auto_reply')!, {
          id: shortId('guard'),
          name: '微信自动回复守护轮询',
          payload: {
            ...payload,
            bootstrapOnly: false,
          },
          source: 'ai',
        }),
        this.device,
        () => {},
      )

      const guardArtifact = result.artifacts?.['reply-guard'] as Record<string, unknown> | undefined
      const processedSessions = numberFromUnknown(
        guardArtifact?.processedSessions,
        0,
      )
      const skippedReplyCount = numberFromUnknown(
        guardArtifact?.skippedReplyCount,
        0,
      )

      if (processedSessions > 0) {
        this.autoReplyLastIssue = ''
        this.autoReplyLastIssueAt = 0
        if (this.activeAutoReplyTaskId) {
          this.updateTask(this.activeAutoReplyTaskId, (task) => ({
            ...task,
            updatedAt: nowIso(),
            logs: [
              ...task.logs,
              `后台轮询已处理 ${processedSessions} 个会话`,
            ].slice(-12),
          }))
        }
        this.addActivity(
          `${formatTime(nowIso())} 自动回复守护本轮已处理 ${processedSessions} 个未读会话`,
        )
        this.emit()
        return
      }

      const firstReason = Array.isArray(guardArtifact?.sessions)
        ? String(
            (
              (guardArtifact.sessions as Array<Record<string, unknown>>).find((session) =>
                typeof session.reason === 'string' && session.reason.trim(),
              ) || {}
            ).reason || '',
          ).trim()
        : ''

      if (skippedReplyCount > 0 && firstReason) {
        if (this.activeAutoReplyTaskId) {
          this.updateTask(this.activeAutoReplyTaskId, (task) => ({
            ...task,
            updatedAt: nowIso(),
            logs: [...task.logs, `守护跳过：${firstReason}`].slice(-12),
          }))
        }
        this.logAutoReplyIssue(`自动回复守护本轮跳过 ${skippedReplyCount} 个会话：${firstReason}`)
      }
    } catch (error) {
      if (this.autoReplyStopRequested) {
        return
      }
      const message = error instanceof Error ? error.message : '自动回复守护后台轮询失败'
      if (this.activeAutoReplyTaskId) {
        this.updateTask(this.activeAutoReplyTaskId, (task) => ({
          ...task,
          updatedAt: nowIso(),
          logs: [...task.logs, `守护异常：${message}`].slice(-12),
        }))
      }
      this.logAutoReplyIssue(`自动回复守护后台轮询失败：${message}`)
    } finally {
      this.autoReplyBusy = false
      if (this.autoReplyStopRequested) {
        this.autoReplyStopRequested = false
      }
    }
  }

  private getAutoReplyPayload() {
    const template = findTemplate('auto_reply')
    return {
      ...(template?.payloadTemplate || {}),
      ...this.autoReplyPayload,
    }
  }

  private logAutoReplyIssue(message: string) {
    const now = Date.now()
    if (message === this.autoReplyLastIssue && now - this.autoReplyLastIssueAt < 60_000) {
      return
    }

    this.autoReplyLastIssue = message
    this.autoReplyLastIssueAt = now
    this.addActivity(`${formatTime(nowIso())} ${message}`)
    this.emit()
  }

  private stopAutoReplyTask(taskId: string, message: string) {
    this.autoReplyConfigured = false
    this.autoReplyStopRequested = true
    this.autoReplyLastTickAt = 0
    this.device = {
      ...this.device,
      autoReply: false,
      heartbeatAt: nowIso(),
    }
    if (this.autoReplyBusy) {
      this.runner.stopCurrentTask()
    }
    if (this.activeAutoReplyTaskId === taskId) {
      this.activeAutoReplyTaskId = null
    }
    this.updateTask(taskId, (task) => ({
      ...task,
      status: 'stopped',
      progress: 100,
      updatedAt: nowIso(),
      backgroundActive: false,
      result: message,
      logs: [...task.logs, message],
    }))
    this.addActivity(`${formatTime(nowIso())} ${message}`)
    this.emit()
  }

  private replaceActiveAutoReplyTask(nextTaskId: string) {
    if (!this.activeAutoReplyTaskId || this.activeAutoReplyTaskId === nextTaskId) {
      return
    }

    const replacedTaskId = this.activeAutoReplyTaskId
    this.updateTask(replacedTaskId, (task) => ({
      ...task,
      status: 'stopped',
      backgroundActive: false,
      updatedAt: nowIso(),
      result: '已被新的微信自动回复守护任务替换。',
      logs: [...task.logs, '已被新的微信自动回复守护任务替换'],
    }))
    this.activeAutoReplyTaskId = null
  }

  private updateTask(taskId: string, update: (task: QueueTask) => QueueTask) {
    this.queue = this.queue.map((task) => (task.id === taskId ? update(task) : task))
  }

  private buildMetrics(): MetricCard[] {
    const today = new Date().toISOString().slice(0, 10)
    const todayTasks = this.queue.filter((task) => task.createdAt.startsWith(today))
    const completed = todayTasks.filter((task) => task.status === 'completed').length
    const queued = this.queue.filter((task) => task.status === 'queued' || task.status === 'running').length
    const pendingInbox = this.inbox.filter((entry) => entry.status === 'pending').length

    return [
      {
        label: '今日指令',
        value: String(todayTasks.length),
        detail: `已完成 ${completed} 条`,
        tone: 'accent',
      },
      {
        label: '队列负载',
        value: `${queued}`,
        detail: `${pendingInbox} 条远程指令待拉取`,
        tone: queued > 2 ? 'warning' : 'neutral',
      },
      {
        label: 'RPA 引擎',
        value: this.runnerHealth?.mode || '巡检中',
        detail: this.runnerHealth?.detail || '等待 Python RPA 巡检完成',
        tone: this.runnerHealth?.mode === 'live' ? 'success' : this.runnerHealth ? 'accent' : 'neutral',
      },
      {
        label: '设备心跳',
        value: formatTime(this.device.heartbeatAt),
        detail: `CPU ${this.device.cpuLoad}% / 内存 ${this.device.memoryUsage}%`,
        tone: 'neutral',
      },
    ]
  }

  private buildWorkflow(): WorkflowStep[] {
    const autoReplyTarget = String(this.getAutoReplyPayload().targetName || '').trim()
    const autoReplyStep: WorkflowStep = {
      id: 'wf-reply',
      time: '09:30',
      title: '微信自动回复守护启动',
      status: this.device.autoReply ? 'running' : 'pending',
      detail: this.device.autoReply
        ? autoReplyTarget
          ? `AI + 关键词规则持续生效，当前守护目标：${autoReplyTarget}`
          : 'AI + 关键词规则持续生效'
        : '当前处于关闭状态',
    }

    const sopDone = this.queue.some(
      (task) => task.templateId === 'push_sop' && task.status === 'completed',
    )
    const momentsRunning = this.queue.some(
      (task) => task.templateId === 'moments_campaign' && task.status === 'running',
    )

    return [
      {
        id: 'wf-friends',
        time: '09:00',
        title: '自动接受好友请求',
        status: 'done',
        detail: '今日已处理 12 人',
      },
      autoReplyStep,
      {
        id: 'wf-sop',
        time: '10:00',
        title: 'SOP 推送第 3 批客户',
        status: sopDone ? 'done' : 'pending',
        detail: sopDone ? '已推送 50 位客户' : '等待业务线索分组',
      },
      {
        id: 'wf-moments',
        time: '14:00',
        title: '朋友圈营销素材发布',
        status: momentsRunning ? 'running' : 'pending',
        detail: momentsRunning ? '正在执行发圈 + 点赞联动' : '等待排程时间到达',
      },
      {
        id: 'wf-report',
        time: '17:00',
        title: '生成每日工作报告',
        status: 'pending',
        detail: '完成后自动回传后台',
      },
    ]
  }

  private matchTemplateFromRaw(raw: string): TemplateMatch | null {
    const text = raw.trim()
    if (!text) {
      return null
    }

    if (text.startsWith('{')) {
      try {
        const payload = JSON.parse(text) as Record<string, unknown>
        const hint = String(payload.command || payload.type || payload.action || '')
        const templateId = this.resolveTemplateId(hint)
        if (!templateId) {
          return null
        }
        const { command, type, action, ...rest } = payload
        return {
          templateId,
          detail: `已解析 JSON 指令：${hint || templateId}`,
          payload: rest,
        }
      } catch {
        return null
      }
    }

    const platforms = inferPlatforms(text)

    if (text.includes('群发') || (text.includes('微信') && text.includes('消息'))) {
      return {
        templateId: 'broadcast_message',
        detail: '已识别为群发消息任务',
        payload: { content: text, targetTags: ['高意向'], platforms },
      }
    }
    if (text.includes('发布视频') || text.includes('矩阵分发')) {
      return {
        templateId: 'publish_video',
        detail: '已识别为视频发布任务',
        payload: { title: text, platforms: platforms || ['抖音', '快手', '小红书'] },
      }
    }
    if (text.includes('自动回复')) {
      return {
        templateId: 'auto_reply',
        detail: '已识别为自动回复任务',
        payload: { enabled: true, strategy: 'AI+关键词' },
      }
    }
    if (text.includes('评论区') || text.includes('获客') || text.includes('私信')) {
      return {
        templateId: 'lead_capture',
        detail: '已识别为公域获客任务',
        payload: {
          platforms: platforms || ['抖音', '快手', '小红书'],
          keywords: ['合作', '报价', '加盟'],
          maxTargets: 50,
        },
      }
    }
    if (text.includes('SOP')) {
      return {
        templateId: 'push_sop',
        detail: '已识别为 SOP 推送任务',
        payload: { sopId: 'sop-levelup-03' },
      }
    }
    if (text.includes('激活')) {
      return {
        templateId: 'activate_customers',
        detail: '已识别为主动激活任务',
        payload: { campaign: '回流唤醒计划' },
      }
    }
    if (text.includes('朋友圈')) {
      return {
        templateId: 'moments_campaign',
        detail: '已识别为朋友圈营销任务',
        payload: { copy: text },
      }
    }
    if (text.includes('标签')) {
      return {
        templateId: 'tag_management',
        detail: '已识别为好友标签管理任务',
        payload: { addTags: ['自动分类'] },
      }
    }
    if (text.includes('状态')) {
      return {
        templateId: 'device_status_query',
        detail: '已识别为设备状态查询任务',
        payload: {},
      }
    }

    return null
  }

  private resolveTemplateId(hint: string) {
    const lookup = hint.trim().toLowerCase()
    const map: Record<string, string> = {
      broadcast: 'broadcast_message',
      broadcast_message: 'broadcast_message',
      publish_video: 'publish_video',
      publish: 'publish_video',
      auto_reply: 'auto_reply',
      reply: 'auto_reply',
      lead_capture: 'lead_capture',
      lead: 'lead_capture',
      sop: 'push_sop',
      push_sop: 'push_sop',
      activate: 'activate_customers',
      activate_customers: 'activate_customers',
      moments: 'moments_campaign',
      moments_campaign: 'moments_campaign',
      tags: 'tag_management',
      tag_management: 'tag_management',
      video_edit: 'video_edit_batch',
      video_edit_batch: 'video_edit_batch',
      draft: 'jianying_draft',
      jianying_draft: 'jianying_draft',
      exposure: 'auto_exposure',
      auto_exposure: 'auto_exposure',
      status: 'device_status_query',
      device_status_query: 'device_status_query',
    }

    return map[lookup] ?? null
  }

  private addActivity(message: string) {
    this.activityFeed = [message, ...this.activityFeed].slice(0, 12)
  }

  private emit() {
    this.save()
    const snapshot = this.getSnapshot()
    for (const listener of this.listeners) {
      listener(snapshot)
    }
  }

  private save() {
    const persisted: PersistedState = {
      device: {
        id: this.device.id,
        alias: this.device.alias,
        workspace: this.device.workspace,
        operatorName: this.device.operatorName,
        bindCode: this.device.bindCode,
        autoPolling: this.device.autoPolling,
        autoReply: this.device.autoReply,
      },
      autoReplyPayload: this.autoReplyPayload,
      autoReplyConfigured: this.autoReplyConfigured,
      activeAutoReplyTaskId: this.activeAutoReplyTaskId,
      queue: this.queue,
      inbox: this.inbox,
      activityFeed: this.activityFeed,
    }

    mkdirSync(dirname(this.persistPath), { recursive: true })
    writeFileSync(this.persistPath, JSON.stringify(persisted, null, 2))
  }
}
