import { FormEvent, useEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  ActivityIcon,
  BotIcon,
  CommandIcon,
  CopyIcon,
  CpuIcon,
  FolderKanbanIcon,
  InboxIcon,
  LayoutDashboardIcon,
  MoonStarIcon,
  PanelLeftIcon,
  RefreshCcwIcon,
  SearchIcon,
  SendIcon,
  Settings2Icon,
  ShieldCheckIcon,
  SparklesIcon,
  SunMediumIcon,
  WorkflowIcon,
} from 'lucide-react'
import type {
  AppSnapshot,
  BindDeviceInput,
  CommandTemplate,
  EnqueueTaskInput,
  PythonRunnerHealth,
  QueueTask,
} from '../shared/contracts'
import { buildAssistantReply, type AssistantReply } from './lib/assistant'
import { knowledgeBase } from './data/knowledgeBase'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

type TabKey = 'overview' | 'command' | 'ai' | 'device'
type TaskFilterKey = 'all' | 'active' | 'wechat' | 'completed' | 'stopped' | 'failed'
type TaskSortKey = 'updated_desc' | 'created_desc' | 'name_asc' | 'status_priority'
type ThemeMode = 'light' | 'dark'
type AccentTone = 'blue' | 'cyan' | 'green' | 'violet' | 'amber' | 'rose'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: string[]
  suggestion?: AssistantReply['suggestion']
}

interface AutoReplyTaskFormState {
  targetName: string
  targetKind: 'contact' | 'group'
  welcome: string
  fallbackReply: string
  keywordRepliesText: string
  pollIntervalSeconds: string
  duplicateCooldownSeconds: string
  enabled: boolean
  dryRun: boolean
}

interface TabDefinition {
  key: TabKey
  label: string
  description: string
  icon: LucideIcon
}

const tabs: TabDefinition[] = [
  {
    key: 'overview',
    label: '执行总览',
    description: '看清设备在线、工作流进度和当前任务压力。',
    icon: LayoutDashboardIcon,
  },
  {
    key: 'command',
    label: '指令中心',
    description: '下发模板、处理收件箱，并创建微信守护任务。',
    icon: CommandIcon,
  },
  {
    key: 'ai',
    label: 'AI / RAG',
    description: '让 AI 根据本地知识和设备状态生成执行建议。',
    icon: BotIcon,
  },
  {
    key: 'device',
    label: '设备管理',
    description: '维护绑定信息、系统开关和执行环境巡检。',
    icon: Settings2Icon,
  },
]

const tabGroups: Array<{ title: string; tabs: TabDefinition[] }> = [
  {
    title: '控制台',
    tabs: tabs.filter((tab) => tab.key === 'overview' || tab.key === 'command'),
  },
  {
    title: '智能层',
    tabs: tabs.filter((tab) => tab.key === 'ai'),
  },
  {
    title: '系统',
    tabs: tabs.filter((tab) => tab.key === 'device'),
  },
]

const taskFilters: Array<{ key: TaskFilterKey; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '运行中' },
  { key: 'wechat', label: '微信' },
  { key: 'completed', label: '已完成' },
  { key: 'stopped', label: '已停止' },
  { key: 'failed', label: '失败' },
]

const themeStorageKey = 'myclaw-desktop-theme'

function formatJson(value: Record<string, unknown>) {
  return JSON.stringify(value, null, 2)
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

function createAssistantWelcome(): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content:
      '这里是 MyClaw Desktop 内置 AI 助手。我会结合本地知识库、当前设备状态和任务队列，帮你生成执行建议；如果建议成立，你可以直接把它塞进任务队列。',
    citations: ['AI 智能对话与 RAG 策略', '设备绑定与远程指令机制'],
  }
}

function getTemplatePayload(snapshot: AppSnapshot | null, templateId: string) {
  const template = snapshot?.templates.find((item) => item.id === templateId)
  return template ? formatJson(template.payloadTemplate) : '{}'
}

function findTemplate(snapshot: AppSnapshot, templateId: string): CommandTemplate | undefined {
  return snapshot.templates.find((item) => item.id === templateId)
}

function queueCount(tasks: QueueTask[]) {
  return tasks.filter((task) => task.status === 'queued' || task.status === 'running').length
}

function getTemplateHint(template?: CommandTemplate, runnerHealth?: PythonRunnerHealth | null) {
  if (!template) {
    return null
  }

  if (template.platforms.includes('微信')) {
    const hint = []

    if (template.id === 'auto_reply') {
      hint.push('自动回复守护默认走 computer use：先识别当前微信会话，再回到目标聊天，并基于历史上下文生成回复。')
    } else if (template.id === 'moments_campaign') {
      hint.push('朋友圈营销当前是 hybrid 辅助执行：会准备草稿和剪贴板，但仍建议人工确认发布。')
    } else if (template.id === 'tag_management') {
      hint.push('标签管理会先更新本地台账，再辅助定位联系人，暂时不是微信原生标签的全自动流。')
    } else {
      hint.push('微信任务首次建议保留 dryRun: true，并先确认 Terminal 或桌面客户端已有辅助功能和自动化权限。')
    }

    if (runnerHealth?.wechat) {
      hint.push(`当前巡检：${runnerHealth.wechat.detail}`)
    }

    return hint.join(' ')
  }

  return null
}

function isActiveTask(task: QueueTask) {
  return task.backgroundActive || task.status === 'queued' || task.status === 'running'
}

function taskMatchesFilter(task: QueueTask, filter: TaskFilterKey) {
  if (filter === 'all') {
    return true
  }
  if (filter === 'active') {
    return isActiveTask(task)
  }
  if (filter === 'wechat') {
    return task.platforms.includes('微信')
  }
  if (filter === 'completed') {
    return task.status === 'completed'
  }
  if (filter === 'stopped') {
    return task.status === 'stopped'
  }
  return task.status === 'failed'
}

function getTaskFilterCount(tasks: QueueTask[], filter: TaskFilterKey) {
  return tasks.filter((task) => taskMatchesFilter(task, filter)).length
}

function getTaskStatusPriority(task: QueueTask) {
  if (task.backgroundActive) {
    return 0
  }
  if (task.status === 'running') {
    return 1
  }
  if (task.status === 'queued') {
    return 2
  }
  if (task.status === 'failed') {
    return 3
  }
  if (task.status === 'stopped') {
    return 4
  }
  return 5
}

function sortTasks(tasks: QueueTask[], sortKey: TaskSortKey) {
  const cloned = [...tasks]
  if (sortKey === 'created_desc') {
    return cloned.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }
  if (sortKey === 'name_asc') {
    return cloned.sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
  }
  if (sortKey === 'status_priority') {
    return cloned.sort((left, right) => {
      const byStatus = getTaskStatusPriority(left) - getTaskStatusPriority(right)
      if (byStatus !== 0) {
        return byStatus
      }
      return right.updatedAt.localeCompare(left.updatedAt)
    })
  }
  return cloned.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

function createAutoReplyTaskForm(payload?: Record<string, unknown>): AutoReplyTaskFormState {
  return {
    targetName: String(payload?.targetName || payload?.contacts?.[0] || '鲲鹏'),
    targetKind: String(payload?.targetKind || 'contact') === 'group' ? 'group' : 'contact',
    welcome: String(payload?.welcome || '你好，我是小云，先把你的需求发我，我来帮你安排。'),
    fallbackReply: String(payload?.fallbackReply || '我先帮你记下需求，稍后给你一个明确回复。'),
    keywordRepliesText: JSON.stringify(payload?.keywordReplies || {}, null, 2),
    pollIntervalSeconds: String(payload?.pollIntervalSeconds || 4),
    duplicateCooldownSeconds: String(payload?.duplicateCooldownSeconds || 600),
    enabled: payload?.enabled !== false,
    dryRun: payload?.dryRun === true,
  }
}

function getTaskBadge(task: QueueTask) {
  if (task.backgroundActive) {
    return {
      label: '守护中',
      variant: 'default' as const,
    }
  }

  if (task.status === 'queued') {
    return { label: '排队中', variant: 'outline' as const }
  }
  if (task.status === 'running') {
    return { label: '执行中', variant: 'default' as const }
  }
  if (task.status === 'completed') {
    return { label: '已完成', variant: 'secondary' as const }
  }
  if (task.status === 'stopped') {
    return { label: '已停止', variant: 'outline' as const }
  }
  return { label: '失败', variant: 'destructive' as const }
}

function getInboxBadge(status: AppSnapshot['inbox'][number]['status']) {
  if (status === 'pending') {
    return { label: '待拉取', variant: 'outline' as const }
  }
  if (status === 'ingested') {
    return { label: '已入队', variant: 'secondary' as const }
  }
  return { label: '已拒绝', variant: 'destructive' as const }
}

function canStopTask(task: QueueTask) {
  return task.backgroundActive || task.status === 'queued' || task.status === 'running'
}

function describeRunnerMode(mode?: PythonRunnerHealth['mode']) {
  if (mode === 'live') {
    return '真实执行'
  }
  if (mode === 'hybrid') {
    return '混合执行'
  }
  if (mode === 'mock') {
    return '模拟执行'
  }
  return '未巡检'
}

function formatCapabilityLabel(capability: string) {
  const mapping: Record<string, string> = {
    playwright: 'Playwright',
    'playwright-missing': 'Playwright 缺失',
    'ui-automation': 'Windows UI Automation',
    'ui-automation-missing': 'Windows UI Automation 缺失',
    'mac-wechat-ui': 'mac 微信可用',
    'mac-wechat-ui-missing': 'mac 微信未发现',
    'mac-wechat-ui-permission-missing': 'mac 微信待授权',
    'remote-json-command': '远程 JSON 指令',
    'sop-orchestration': 'SOP 编排',
  }

  return mapping[capability] || capability
}

function getInitialThemeMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'dark'
  }

  const storedTheme = window.localStorage.getItem(themeStorageKey)
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getTintClass(tone: AccentTone) {
  const mapping: Record<AccentTone, string> = {
    blue: 'app-tint-blue',
    cyan: 'app-tint-cyan',
    green: 'app-tint-green',
    violet: 'app-tint-violet',
    amber: 'app-tint-amber',
    rose: 'app-tint-rose',
  }

  return mapping[tone]
}

function getModuleTone(accent: string): AccentTone {
  if (accent === 'emerald') {
    return 'green'
  }
  if (accent === 'amber') {
    return 'amber'
  }
  if (accent === 'violet') {
    return 'violet'
  }
  return 'blue'
}

function getWorkflowTone(status: AppSnapshot['workflow'][number]['status']): AccentTone {
  if (status === 'done') {
    return 'green'
  }
  if (status === 'running') {
    return 'blue'
  }
  return 'violet'
}

function getTaskTone(task: QueueTask): AccentTone {
  if (task.status === 'failed') {
    return 'rose'
  }
  if (task.status === 'completed') {
    return 'green'
  }
  if (task.status === 'stopped') {
    return 'amber'
  }
  if (task.backgroundActive) {
    return 'violet'
  }
  return 'blue'
}

function getWechatGuardBlockedMessage(runnerHealth?: PythonRunnerHealth | null) {
  if (!runnerHealth) {
    return '微信执行环境还没完成巡检，请先点击“重新巡检”，确认微信自动化环境可用。'
  }

  if (runnerHealth.wechat?.available === false) {
    return `微信自动回复暂时无法启动：${runnerHealth.wechat.detail}`
  }

  if (!runnerHealth.ok) {
    return `Python RPA 当前不可用：${runnerHealth.detail}`
  }

  return null
}

function getAutoReplyLaunchSummary(form: AutoReplyTaskFormState) {
  if (!form.enabled) {
    return '当前只会保存守护配置，不会启动后台自动回复。'
  }

  if (form.dryRun) {
    return '当前是 dryRun 演练模式，会打开微信并检查流程，但不会实际自动回复。'
  }

  return '当前会真实启动后台守护，命中新消息后会自动回复。'
}

export default function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getInitialThemeMode())
  const [selectedTemplateId, setSelectedTemplateId] = useState('broadcast_message')
  const [payloadText, setPayloadText] = useState('{}')
  const [remoteCommand, setRemoteCommand] = useState(
    '{"command":"publish_video","title":"新品演示剪辑","platforms":["抖音","快手","小红书"]}',
  )
  const [deviceForm, setDeviceForm] = useState<BindDeviceInput>({
    alias: '',
    workspace: '',
    operatorName: '',
  })
  const [autoReplyTaskForm, setAutoReplyTaskForm] = useState<AutoReplyTaskFormState>(
    createAutoReplyTaskForm(),
  )
  const [chatInput, setChatInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([createAssistantWelcome()])
  const [notice, setNotice] = useState('MyClaw Desktop 已准备就绪。')
  const [taskFilter, setTaskFilter] = useState<TaskFilterKey>('all')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [taskQuery, setTaskQuery] = useState('')
  const [taskSort, setTaskSort] = useState<TaskSortKey>('updated_desc')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const surfacedFailedTaskIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false

    window.desktop.getSnapshot().then((nextSnapshot) => {
      if (cancelled || !nextSnapshot) {
        return
      }

      setSnapshot(nextSnapshot)
      setSelectedTemplateId((current) => current || nextSnapshot.templates[0]?.id || 'broadcast_message')
      setPayloadText((current) =>
        current === '{}' ? getTemplatePayload(nextSnapshot, 'broadcast_message') : current,
      )
      setDeviceForm({
        alias: nextSnapshot.device.alias,
        workspace: nextSnapshot.device.workspace,
        operatorName: nextSnapshot.device.operatorName,
      })
      setAutoReplyTaskForm(createAutoReplyTaskForm(nextSnapshot.autoReplyPayload))
    })

    const unsubscribe = window.desktop.subscribe((nextSnapshot) => {
      if (cancelled) {
        return
      }
      setSnapshot(nextSnapshot)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', themeMode === 'dark')
    root.style.colorScheme = themeMode
    window.localStorage.setItem(themeStorageKey, themeMode)
  }, [themeMode])

  useEffect(() => {
    if (!snapshot) {
      return
    }

    if (selectedTaskId && snapshot.queue.some((task) => task.id === selectedTaskId)) {
      return
    }

    setSelectedTaskId(snapshot.queue[0]?.id || null)
  }, [snapshot, selectedTaskId])

  useEffect(() => {
    if (!snapshot) {
      return
    }

    const failedTask = [...snapshot.queue]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .find((task) => task.status === 'failed' && !surfacedFailedTaskIdsRef.current.has(task.id))

    if (!failedTask) {
      return
    }

    surfacedFailedTaskIdsRef.current.add(failedTask.id)
    setNotice(`${failedTask.name} 执行失败：${failedTask.result || '请展开任务详情查看日志。'}`)
  }, [snapshot])

  async function applySnapshot(promise: Promise<AppSnapshot | undefined>, successText: string) {
    const nextSnapshot = await promise
    if (nextSnapshot) {
      setSnapshot(nextSnapshot)
      setNotice(successText)
    }
  }

  async function handleTemplateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!snapshot) {
      return
    }

    try {
      const payload = JSON.parse(payloadText) as Record<string, unknown>
      const template = findTemplate(snapshot, selectedTemplateId)
      await applySnapshot(
        window.desktop.enqueueTask({
          templateId: selectedTemplateId,
          payload,
          source: 'manual',
          name: template?.name,
        }),
        '任务已加入桌面队列。',
      )
    } catch {
      setNotice('JSON 载荷格式不合法，请检查后再提交。')
    }
  }

  async function handleRemoteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await applySnapshot(window.desktop.pushRemoteCommand(remoteCommand), '远程指令已进入收件箱，等待自动轮询。')
  }

  async function handleBindSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await applySnapshot(window.desktop.updateDevice(deviceForm), '设备绑定信息已更新。')
  }

  async function handleToggleSetting(key: 'autoPolling' | 'autoReply', value: boolean) {
    await applySnapshot(
      window.desktop.toggleSetting(key, value),
      `已更新 ${key === 'autoPolling' ? '自动轮询' : '自动回复'} 开关。`,
    )
  }

  async function handleStopTask(taskId: string) {
    await applySnapshot(window.desktop.stopTask(taskId), '任务已停止。')
  }

  async function handleRetryTask(task: QueueTask) {
    await applySnapshot(
      window.desktop.enqueueTask({
        templateId: task.templateId,
        source: 'manual',
        name: `${task.name} · 再执行`,
        payload: task.payload,
      }),
      '任务已重新加入桌面队列。',
    )
  }

  async function handleCopyText(value: string, successText: string) {
    const copied = await window.desktop.copyText(value)
    if (copied) {
      setNotice(successText)
    }
  }

  async function handleAutoReplyTaskSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!snapshot) {
      return
    }

    const blockedMessage = getWechatGuardBlockedMessage(snapshot.runnerHealth)
    if (blockedMessage) {
      setNotice(blockedMessage)
      return
    }

    try {
      const keywordReplies = JSON.parse(autoReplyTaskForm.keywordRepliesText || '{}') as Record<
        string,
        string
      >
      await applySnapshot(
        window.desktop.enqueueTask({
          templateId: 'auto_reply',
          source: 'manual',
          name: `微信自动回复守护 · ${autoReplyTaskForm.targetName || '未命名目标'}`,
          payload: {
            enabled: autoReplyTaskForm.enabled,
            targetName: autoReplyTaskForm.targetName.trim(),
            targetKind: autoReplyTaskForm.targetKind,
            welcome: autoReplyTaskForm.welcome.trim(),
            fallbackReply: autoReplyTaskForm.fallbackReply.trim(),
            keywordReplies,
            readMode: 'computer_use',
            pollIntervalSeconds: Number(autoReplyTaskForm.pollIntervalSeconds) || 4,
            duplicateCooldownSeconds: Number(autoReplyTaskForm.duplicateCooldownSeconds) || 600,
            maxUnreadSessions: 1,
            bootstrapOnly: true,
            dryRun: autoReplyTaskForm.dryRun,
          },
        }),
        autoReplyTaskForm.enabled
          ? autoReplyTaskForm.dryRun
            ? '微信自动回复守护任务已创建，当前为 dryRun 演练模式。'
            : '微信自动回复守护任务已创建，已准备进入后台自动回复。'
          : '微信自动回复配置已保存，当前未启动后台守护。',
      )
    } catch {
      setNotice('关键词回复 JSON 不合法，请检查后再创建守护任务。')
    }
  }

  async function handleSuggestion(task: EnqueueTaskInput) {
    await applySnapshot(window.desktop.enqueueTask(task), 'AI 建议已加入执行队列。')
  }

  async function handleClearHistory() {
    await applySnapshot(window.desktop.clearHistory(), '历史记录已整理。')
  }

  async function handleRerunDoctor() {
    await applySnapshot(window.desktop.rerunDoctor(), '已重新完成 Python RPA 巡检。')
  }

  function handleTemplateChange(templateId: string) {
    setSelectedTemplateId(templateId)
    setPayloadText(getTemplatePayload(snapshot, templateId))
  }

  function handleAskAssistant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!snapshot || !chatInput.trim()) {
      return
    }

    const question = chatInput.trim()
    const reply = buildAssistantReply(question, snapshot)

    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: 'user',
        content: question,
      },
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: reply.content,
        citations: reply.citations.map((item) => item.title),
        suggestion: reply.suggestion,
      },
    ])
    setChatInput('')
    setNotice('AI 已生成建议，可以直接下发任务。')
  }

  if (!snapshot) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>MyClaw Desktop 初始化中</CardTitle>
            <CardDescription>正在加载本地设备状态、任务队列和 AI 助手上下文。</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const currentTab = tabs.find((tab) => tab.key === activeTab) || tabs[0]
  const runningTasks = snapshot.queue.filter((task) => task.status === 'queued' || task.status === 'running')
  const filteredTasks = sortTasks(
    snapshot.queue.filter((task) => {
      if (!taskMatchesFilter(task, taskFilter)) {
        return false
      }

      const normalizedQuery = taskQuery.trim().toLowerCase()
      if (!normalizedQuery) {
        return true
      }

      return [task.name, task.sopCode, task.templateId, task.platforms.join(' '), task.result || '']
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    }),
    taskSort,
  )
  const selectedTask = filteredTasks.find((task) => task.id === selectedTaskId) || filteredTasks[0] || null
  const selectedTemplate = findTemplate(snapshot, selectedTemplateId)
  const activeAutoReplyTask = snapshot.activeAutoReplyTaskId
    ? snapshot.queue.find((task) => task.id === snapshot.activeAutoReplyTaskId) || null
    : null
  const latestAssistant = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant' && message.suggestion)
  const surfaceStats = [
    {
      label: '当前设备',
      value: snapshot.device.alias,
      detail: `${snapshot.device.workspace} · ${snapshot.device.online ? '在线' : '离线'}`,
      icon: ActivityIcon,
      tone: 'blue' as AccentTone,
    },
    {
      label: '运行队列',
      value: `${getTaskFilterCount(snapshot.queue, 'active')} 条`,
      detail: `${snapshot.queue.length} 条任务已进入桌面队列`,
      icon: FolderKanbanIcon,
      tone: 'green' as AccentTone,
    },
    {
      label: '执行环境',
      value: describeRunnerMode(snapshot.runnerHealth?.mode),
      detail: snapshot.runnerHealth?.detail || '尚未返回 Python RPA 巡检结果',
      icon: CpuIcon,
      tone: 'violet' as AccentTone,
    },
    {
      label: '最近心跳',
      value: formatDateTime(snapshot.device.heartbeatAt),
      detail: `CPU ${snapshot.device.cpuLoad}% · 内存 ${snapshot.device.memoryUsage}%`,
      icon: ShieldCheckIcon,
      tone: 'cyan' as AccentTone,
    },
  ]

  return (
    <div className="min-h-screen">
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <div className="flex h-screen overflow-hidden">
          <aside className="hidden h-screen w-80 shrink-0 border-r bg-sidebar/80 backdrop-blur xl:flex">
            <WorkspaceNavigation
              activeTab={activeTab}
              onSelect={(tabKey) => setActiveTab(tabKey)}
              snapshot={snapshot}
            />
          </aside>

          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as TabKey)}
            className="flex min-h-0 flex-1 flex-col gap-0"
          >
            <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-xl">
              <div className="flex flex-col gap-4 px-4 py-4 md:px-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="xl:hidden"
                      onClick={() => setMobileNavOpen(true)}
                    >
                      <PanelLeftIcon />
                    </Button>
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                        MyClaw Desktop
                      </p>
                      <h1 className="truncate text-2xl font-semibold tracking-tight md:text-3xl">
                        {currentTab.label}
                      </h1>
                      <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
                        {currentTab.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <div className="hidden items-center gap-3 rounded-full border bg-card/70 px-3 py-2 md:flex">
                      <SunMediumIcon className="size-4 text-muted-foreground" />
                      <Switch
                        checked={themeMode === 'dark'}
                        onCheckedChange={(checked) => setThemeMode(checked ? 'dark' : 'light')}
                        aria-label="切换深色模式"
                      />
                      <MoonStarIcon className="size-4 text-muted-foreground" />
                    </div>
                    <Badge variant="outline">{snapshot.device.bindCode}</Badge>
                  </div>
                </div>

                <Alert className="app-tint-blue app-status-glow">
                  <SparklesIcon />
                  <AlertTitle>{notice}</AlertTitle>
                  <AlertDescription>
                    当前绑定设备 {snapshot.device.alias}，AI 员工昵称为 {snapshot.device.operatorName}。
                  </AlertDescription>
                </Alert>

                <TabsList variant="line" className="w-full justify-start overflow-x-auto">
                  {tabs.map((tab) => (
                    <TabsTrigger key={tab.key} value={tab.key} className="flex-none">
                      <tab.icon />
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </header>

            <main className="min-h-0 flex-1">
              <ScrollArea className="h-full">
                <div className="flex flex-col gap-6 px-4 py-4 md:px-6 md:py-6">
                  <section className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                    <Card className="app-shell-card app-hero-panel overflow-hidden">
                      <CardHeader>
                        <CardTitle>控制面焦点</CardTitle>
                        <CardDescription>
                          一张桌面里同时承接设备状态、任务流转、AI 建议和微信执行器。
                        </CardDescription>
                        <CardAction>
                          <Badge variant="secondary">{themeMode === 'dark' ? 'Dark' : 'Light'}</Badge>
                        </CardAction>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-4">
                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="app-hero-chip app-tint-blue rounded-xl border p-4">
                            <p className="text-sm text-muted-foreground">当前视图</p>
                            <p className="mt-2 text-lg font-semibold">{currentTab.label}</p>
                          </div>
                          <div className="app-hero-chip app-tint-green rounded-xl border p-4">
                            <p className="text-sm text-muted-foreground">自动轮询</p>
                            <p className="mt-2 text-lg font-semibold">
                              {snapshot.device.autoPolling ? '开启' : '关闭'}
                            </p>
                          </div>
                          <div className="app-hero-chip app-tint-violet rounded-xl border p-4">
                            <p className="text-sm text-muted-foreground">自动回复</p>
                            <p className="mt-2 text-lg font-semibold">
                              {snapshot.device.autoReply ? '开启' : '关闭'}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">队列负载</span>
                            <span className="font-medium">{runningTasks.length} / {snapshot.queue.length || 1}</span>
                          </div>
                          <Progress
                            value={snapshot.queue.length ? (runningTasks.length / snapshot.queue.length) * 100 : 0}
                          />
                        </div>
                      </CardContent>
                    </Card>

                    <div className="grid gap-4 md:grid-cols-2">
                      {surfaceStats.map((item) => (
                        <Card key={item.label} size="sm" className={cn('app-shell-card', getTintClass(item.tone))}>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-sm">
                              <item.icon className="size-4 text-muted-foreground" />
                              {item.label}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="flex flex-col gap-1">
                            <div className="text-xl font-semibold tracking-tight">{item.value}</div>
                            <p className="text-sm text-muted-foreground">{item.detail}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </section>

                  <TabsContent value="overview" className="mt-0 flex flex-col gap-4">
                    <div className="grid gap-4 xl:grid-cols-12">
                      <Card className="app-shell-card xl:col-span-7">
                        <CardHeader>
                          <CardTitle>核心执行模块</CardTitle>
                          <CardDescription>按能力分层整理，便于你看清当前桌面端已经打通哪些链路。</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                          {snapshot.modules.map((module) => (
                            <Card
                              key={module.id}
                              size="sm"
                              className={cn('app-shell-card', getTintClass(getModuleTone(module.accent)))}
                            >
                              <CardHeader>
                                <CardTitle className="text-sm">{module.name}</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <p className="text-sm text-muted-foreground">{module.description}</p>
                              </CardContent>
                            </Card>
                          ))}
                        </CardContent>
                      </Card>

                      <Card className="app-shell-card xl:col-span-5">
                        <CardHeader>
                          <CardTitle>执行器巡检摘要</CardTitle>
                          <CardDescription>重点关注 Python RPA、微信可用性和当前模式。</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                          <div className="app-tint-cyan rounded-xl border p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex flex-col gap-1">
                                <span className="text-sm text-muted-foreground">当前模式</span>
                                <span className="text-lg font-semibold">
                                  {describeRunnerMode(snapshot.runnerHealth?.mode)}
                                </span>
                              </div>
                              <Badge variant={snapshot.runnerHealth?.ok ? 'secondary' : 'outline'}>
                                {snapshot.runnerHealth?.ok ? '已就绪' : '待检查'}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {snapshot.runnerHealth?.capabilities.map((capability) => (
                              <Badge key={capability} variant="outline">
                                {formatCapabilityLabel(capability)}
                              </Badge>
                            ))}
                          </div>
                          <Alert
                            className={cn(
                              snapshot.runnerHealth?.wechat?.available ? 'app-tint-green' : 'app-tint-rose',
                            )}
                            variant={snapshot.runnerHealth?.wechat?.available ? 'default' : 'destructive'}
                          >
                            <ShieldCheckIcon />
                            <AlertTitle>
                              {snapshot.runnerHealth?.wechat?.available ? '微信执行环境可用' : '微信执行环境待处理'}
                            </AlertTitle>
                            <AlertDescription>
                              {snapshot.runnerHealth?.wechat?.detail || '尚未返回 mac 微信巡检结果。'}
                            </AlertDescription>
                          </Alert>
                        </CardContent>
                      </Card>

                      <Card className="app-shell-card xl:col-span-7">
                        <CardHeader>
                          <CardTitle>AI 员工班次与工作流</CardTitle>
                          <CardDescription>把当前排班流转整理成时间轴，方便定位下一步动作。</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                          {snapshot.workflow.map((step, index) => (
                            <div key={step.id} className="flex flex-col gap-4">
                              <div className="grid gap-3 md:grid-cols-[100px_minmax(0,1fr)]">
                                <div className="text-sm font-medium text-muted-foreground">{step.time}</div>
                                <div
                                  className={cn(
                                    'flex flex-col gap-2 rounded-xl border p-4',
                                    getTintClass(getWorkflowTone(step.status)),
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="font-medium">{step.title}</p>
                                    <Badge variant={step.status === 'running' ? 'default' : 'outline'}>
                                      {step.status === 'running'
                                        ? '进行中'
                                        : step.status === 'done'
                                          ? '已完成'
                                          : '待开始'}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{step.detail}</p>
                                </div>
                              </div>
                              {index < snapshot.workflow.length - 1 ? <Separator /> : null}
                            </div>
                          ))}
                        </CardContent>
                      </Card>

                      <Card className="app-shell-card app-tint-violet xl:col-span-5">
                        <CardHeader>
                          <CardTitle>当前执行队列</CardTitle>
                          <CardDescription>优先展示排队、执行和最近更新的任务。</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3">
                          {snapshot.queue.slice(0, 4).map((task) => (
                            <TaskPreviewCard
                              key={task.id}
                              task={task}
                              onStop={handleStopTask}
                              onSelect={() => {
                                setActiveTab('command')
                                setSelectedTaskId(task.id)
                              }}
                            />
                          ))}
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="command" className="mt-0 flex flex-col gap-4">
                    <div className="grid gap-4 xl:grid-cols-12">
                      <Card className="app-shell-card app-tint-blue xl:col-span-7">
                        <CardHeader>
                          <CardTitle>快速下发任务</CardTitle>
                          <CardDescription>基于模板整理 payload，再直接推到本地任务队列。</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <form className="flex flex-col gap-5" onSubmit={handleTemplateSubmit}>
                            <FieldGroup>
                              <Field>
                                <FieldLabel htmlFor="template-select">选择模板</FieldLabel>
                                <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
                                  <SelectTrigger id="template-select" className="w-full">
                                    <SelectValue placeholder="选择任务模板" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectGroup>
                                      {snapshot.templates.map((template) => (
                                        <SelectItem key={template.id} value={template.id}>
                                          {template.name} · {template.category}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  </SelectContent>
                                </Select>
                                <FieldDescription>
                                  {selectedTemplate?.description || '选择一个模板来快速生成任务载荷。'}
                                </FieldDescription>
                              </Field>

                              <div className="grid gap-4 md:grid-cols-3">
                                <Card size="sm" className="app-shell-card app-tint-violet">
                                  <CardHeader>
                                    <CardTitle className="text-sm">SOP</CardTitle>
                                  </CardHeader>
                                  <CardContent>{selectedTemplate?.sopCode || '-'}</CardContent>
                                </Card>
                                <Card size="sm" className="app-shell-card app-tint-cyan">
                                  <CardHeader>
                                    <CardTitle className="text-sm">平台</CardTitle>
                                  </CardHeader>
                                  <CardContent>{selectedTemplate?.platforms.join(' / ') || '-'}</CardContent>
                                </Card>
                                <Card size="sm" className="app-shell-card app-tint-amber">
                                  <CardHeader>
                                    <CardTitle className="text-sm">预计时长</CardTitle>
                                  </CardHeader>
                                  <CardContent>{selectedTemplate?.estimatedSeconds ?? 0} 秒</CardContent>
                                </Card>
                              </div>

                              <Field>
                                <FieldLabel htmlFor="payload-textarea">JSON 载荷</FieldLabel>
                                <Textarea
                                  id="payload-textarea"
                                  rows={12}
                                  value={payloadText}
                                  onChange={(event) => setPayloadText(event.target.value)}
                                />
                                {getTemplateHint(selectedTemplate, snapshot.runnerHealth) ? (
                                  <FieldDescription>
                                    {getTemplateHint(selectedTemplate, snapshot.runnerHealth)}
                                  </FieldDescription>
                                ) : null}
                              </Field>
                            </FieldGroup>

                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex flex-wrap gap-2">
                                {selectedTemplate?.platforms.map((platform) => (
                                  <Badge key={platform} variant="outline">
                                    {platform}
                                  </Badge>
                                ))}
                              </div>
                              <Button type="submit">
                                <SendIcon data-icon="inline-start" />
                                加入桌面队列
                              </Button>
                            </div>
                          </form>
                        </CardContent>
                      </Card>

                      <div className="flex flex-col gap-4 xl:col-span-5">
                        <Card className="app-shell-card app-tint-cyan">
                          <CardHeader>
                            <CardTitle>远程收件箱</CardTitle>
                            <CardDescription>模拟手机端发来的原始文字或 JSON 指令。</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <form className="flex flex-col gap-5" onSubmit={handleRemoteSubmit}>
                              <FieldGroup>
                                <Field>
                                  <FieldLabel htmlFor="remote-command">远程指令</FieldLabel>
                                  <Textarea
                                    id="remote-command"
                                    rows={6}
                                    value={remoteCommand}
                                    onChange={(event) => setRemoteCommand(event.target.value)}
                                  />
                                </Field>
                                <Field orientation="horizontal">
                                  <FieldContent>
                                    <FieldLabel htmlFor="auto-polling">自动轮询</FieldLabel>
                                    <FieldDescription>定时从远程收件箱拉取并转成桌面任务。</FieldDescription>
                                  </FieldContent>
                                  <Switch
                                    id="auto-polling"
                                    checked={snapshot.device.autoPolling}
                                    onCheckedChange={(checked) => handleToggleSetting('autoPolling', checked)}
                                  />
                                </Field>
                              </FieldGroup>

                              <Button type="submit" variant="secondary">
                                <InboxIcon data-icon="inline-start" />
                                投递到远程收件箱
                              </Button>
                            </form>
                          </CardContent>
                        </Card>

                        <Card className="app-shell-card">
                          <CardHeader>
                            <CardTitle>最近收件记录</CardTitle>
                            <CardDescription>看清每条指令是待拉取、已入队还是被拒绝。</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <ScrollArea className="h-72">
                              <div className="flex flex-col gap-3 pr-4">
                                {snapshot.inbox.slice(0, 8).map((item) => {
                                  const badge = getInboxBadge(item.status)
                                  return (
                                    <div
                                      key={item.id}
                                      className={cn(
                                        'flex flex-col gap-2 rounded-xl border p-4',
                                        item.status === 'pending'
                                          ? 'app-tint-blue'
                                          : item.status === 'ingested'
                                            ? 'app-tint-green'
                                            : 'app-tint-rose',
                                      )}
                                    >
                                      <div className="flex items-center justify-between gap-3">
                                        <Badge variant={badge.variant}>{badge.label}</Badge>
                                        <span className="text-xs text-muted-foreground">
                                          {formatDateTime(item.createdAt)}
                                        </span>
                                      </div>
                                      <p className="line-clamp-3 text-sm">{item.raw}</p>
                                      <p className="text-sm text-muted-foreground">{item.detail}</p>
                                    </div>
                                  )
                                })}
                              </div>
                            </ScrollArea>
                          </CardContent>
                        </Card>
                      </div>

                      <Card className="app-shell-card xl:col-span-12">
                        <CardHeader>
                          <CardTitle>微信自动回复守护</CardTitle>
                          <CardDescription>用一张表单配置目标对象、欢迎语、关键词回复和执行模式。</CardDescription>
                          {activeAutoReplyTask ? (
                            <CardAction>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => handleStopTask(activeAutoReplyTask.id)}
                              >
                                停止守护
                              </Button>
                            </CardAction>
                          ) : null}
                        </CardHeader>
                        <CardContent>
                          <form className="flex flex-col gap-5" onSubmit={handleAutoReplyTaskSubmit}>
                            <FieldGroup>
                              <div className="grid gap-4 md:grid-cols-2">
                                <Field>
                                  <FieldLabel htmlFor="target-name">守护对象</FieldLabel>
                                  <Input
                                    id="target-name"
                                    value={autoReplyTaskForm.targetName}
                                    onChange={(event) =>
                                      setAutoReplyTaskForm((current) => ({
                                        ...current,
                                        targetName: event.target.value,
                                      }))
                                    }
                                  />
                                </Field>
                                <Field>
                                  <FieldLabel htmlFor="target-kind">对象类型</FieldLabel>
                                  <Select
                                    value={autoReplyTaskForm.targetKind}
                                    onValueChange={(value) =>
                                      setAutoReplyTaskForm((current) => ({
                                        ...current,
                                        targetKind: value as 'contact' | 'group',
                                      }))
                                    }
                                  >
                                    <SelectTrigger id="target-kind" className="w-full">
                                      <SelectValue placeholder="选择守护对象类型" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectGroup>
                                        <SelectItem value="contact">好友</SelectItem>
                                        <SelectItem value="group">群聊</SelectItem>
                                      </SelectGroup>
                                    </SelectContent>
                                  </Select>
                                </Field>
                              </div>

                              <div className="grid gap-4 md:grid-cols-2">
                                <Field>
                                  <FieldLabel htmlFor="welcome-message">欢迎语</FieldLabel>
                                  <Textarea
                                    id="welcome-message"
                                    rows={4}
                                    value={autoReplyTaskForm.welcome}
                                    onChange={(event) =>
                                      setAutoReplyTaskForm((current) => ({
                                        ...current,
                                        welcome: event.target.value,
                                      }))
                                    }
                                  />
                                </Field>
                                <Field>
                                  <FieldLabel htmlFor="fallback-reply">兜底回复</FieldLabel>
                                  <Textarea
                                    id="fallback-reply"
                                    rows={4}
                                    value={autoReplyTaskForm.fallbackReply}
                                    onChange={(event) =>
                                      setAutoReplyTaskForm((current) => ({
                                        ...current,
                                        fallbackReply: event.target.value,
                                      }))
                                    }
                                  />
                                </Field>
                              </div>

                              <Field>
                                <FieldLabel htmlFor="keyword-replies">关键词回复 JSON</FieldLabel>
                                <Textarea
                                  id="keyword-replies"
                                  rows={8}
                                  value={autoReplyTaskForm.keywordRepliesText}
                                  onChange={(event) =>
                                    setAutoReplyTaskForm((current) => ({
                                      ...current,
                                      keywordRepliesText: event.target.value,
                                    }))
                                  }
                                />
                              </Field>

                              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <Field>
                                  <FieldLabel htmlFor="poll-interval">轮询间隔（秒）</FieldLabel>
                                  <Input
                                    id="poll-interval"
                                    value={autoReplyTaskForm.pollIntervalSeconds}
                                    onChange={(event) =>
                                      setAutoReplyTaskForm((current) => ({
                                        ...current,
                                        pollIntervalSeconds: event.target.value,
                                      }))
                                    }
                                  />
                                </Field>
                                <Field>
                                  <FieldLabel htmlFor="duplicate-window">去重窗口（秒）</FieldLabel>
                                  <Input
                                    id="duplicate-window"
                                    value={autoReplyTaskForm.duplicateCooldownSeconds}
                                    onChange={(event) =>
                                      setAutoReplyTaskForm((current) => ({
                                        ...current,
                                        duplicateCooldownSeconds: event.target.value,
                                      }))
                                    }
                                  />
                                </Field>
                                <Field orientation="horizontal">
                                  <FieldContent>
                                    <FieldLabel htmlFor="guard-enabled">启用守护</FieldLabel>
                                    <FieldDescription>创建后立即进入后台监听。</FieldDescription>
                                  </FieldContent>
                                  <Switch
                                    id="guard-enabled"
                                    checked={autoReplyTaskForm.enabled}
                                    onCheckedChange={(checked) =>
                                      setAutoReplyTaskForm((current) => ({
                                        ...current,
                                        enabled: checked,
                                      }))
                                    }
                                  />
                                </Field>
                                <Field orientation="horizontal">
                                  <FieldContent>
                                    <FieldLabel htmlFor="guard-dry-run">dryRun</FieldLabel>
                                    <FieldDescription>打开后只演练流程，不会真的回复。</FieldDescription>
                                  </FieldContent>
                                  <Switch
                                    id="guard-dry-run"
                                    checked={autoReplyTaskForm.dryRun}
                                    onCheckedChange={(checked) =>
                                      setAutoReplyTaskForm((current) => ({
                                        ...current,
                                        dryRun: checked,
                                      }))
                                    }
                                  />
                                </Field>
                              </div>
                            </FieldGroup>

                            <Alert className="app-tint-violet">
                              <WorkflowIcon />
                              <AlertTitle>守护执行逻辑</AlertTitle>
                              <AlertDescription>
                                任务会先截图当前微信聊天界面，确认是否就是目标会话；如果不是，再搜索切回目标，然后结合历史聊天与最后一条待回复消息生成回复。
                              </AlertDescription>
                            </Alert>

                            <Alert className={cn(autoReplyTaskForm.enabled && !autoReplyTaskForm.dryRun ? 'app-tint-green' : 'app-tint-amber')}>
                              <ShieldCheckIcon />
                              <AlertTitle>
                                {autoReplyTaskForm.enabled
                                  ? autoReplyTaskForm.dryRun
                                    ? '当前为演练模式'
                                    : '当前为真实执行模式'
                                  : '当前未启用守护'}
                              </AlertTitle>
                              <AlertDescription>{getAutoReplyLaunchSummary(autoReplyTaskForm)}</AlertDescription>
                            </Alert>

                            <div className="flex flex-wrap items-center justify-between gap-3">
                              {activeAutoReplyTask ? (
                                <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                                  <span>当前守护中：{String(activeAutoReplyTask.payload.targetName || '未命名目标')}</span>
                                  <span>{activeAutoReplyTask.result || '后台守护正在运行中。'}</span>
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  当前没有正在运行的微信自动回复守护任务。
                                </span>
                              )}
                              <Button type="submit">
                                <ShieldCheckIcon data-icon="inline-start" />
                                创建守护任务
                              </Button>
                            </div>
                          </form>
                        </CardContent>
                      </Card>

                      <Card className="app-shell-card xl:col-span-12">
                        <CardHeader>
                          <CardTitle>任务中心</CardTitle>
                          <CardDescription>用筛选、搜索和详情面板一起定位任务状态与问题原因。</CardDescription>
                          <CardAction>
                            <Button type="button" variant="outline" size="sm" onClick={handleClearHistory}>
                              整理历史
                            </Button>
                          </CardAction>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-5">
                          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <SummaryTile
                              label="全部任务"
                              value={String(snapshot.queue.length)}
                              detail="已入列的桌面任务总数"
                              tone="blue"
                            />
                            <SummaryTile
                              label="运行中"
                              value={String(getTaskFilterCount(snapshot.queue, 'active'))}
                              detail="排队、执行和后台守护"
                              tone="green"
                            />
                            <SummaryTile
                              label="微信任务"
                              value={String(getTaskFilterCount(snapshot.queue, 'wechat'))}
                              detail="含群发、守护和 SOP"
                              tone="violet"
                            />
                            <SummaryTile
                              label="异常 / 已停"
                              value={String(
                                getTaskFilterCount(snapshot.queue, 'failed') +
                                  getTaskFilterCount(snapshot.queue, 'stopped'),
                              )}
                              detail="需要人工关注的任务"
                              tone="rose"
                            />
                          </div>

                          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                            <div className="flex flex-wrap gap-2">
                              {taskFilters.map((filter) => (
                                <Button
                                  key={filter.key}
                                  type="button"
                                  variant={taskFilter === filter.key ? 'secondary' : 'ghost'}
                                  size="sm"
                                  onClick={() => {
                                    setTaskFilter(filter.key)
                                    const nextSelected = snapshot.queue.find((task) =>
                                      taskMatchesFilter(task, filter.key),
                                    )
                                    setSelectedTaskId(nextSelected?.id || null)
                                  }}
                                >
                                  {filter.label}
                                  <Badge variant="outline" className="ml-1">
                                    {getTaskFilterCount(snapshot.queue, filter.key)}
                                  </Badge>
                                </Button>
                              ))}
                            </div>

                            <div className="grid gap-4 md:grid-cols-[minmax(0,260px)_180px]">
                              <div className="relative">
                                <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                  className="pl-9"
                                  value={taskQuery}
                                  onChange={(event) => setTaskQuery(event.target.value)}
                                  placeholder="按任务名、SOP、平台或结果搜索"
                                />
                              </div>
                              <Select
                                value={taskSort}
                                onValueChange={(value) => setTaskSort(value as TaskSortKey)}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="排序方式" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    <SelectItem value="updated_desc">最近更新</SelectItem>
                                    <SelectItem value="created_desc">最近创建</SelectItem>
                                    <SelectItem value="status_priority">按状态优先级</SelectItem>
                                    <SelectItem value="name_asc">按名称</SelectItem>
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
                            <Card size="sm" className="app-shell-card app-tint-blue">
                              <CardHeader>
                                <CardTitle className="text-sm">任务列表</CardTitle>
                                <CardDescription>选择一条任务查看完整 payload、日志和产物。</CardDescription>
                              </CardHeader>
                              <CardContent>
                                <ScrollArea className="h-[520px]">
                                  <div className="flex flex-col gap-3 pr-4">
                                    {filteredTasks.length ? (
                                      filteredTasks.map((task) => (
                                        <button
                                          key={task.id}
                                          type="button"
                                          className={cn(
                                            'rounded-xl border p-4 text-left transition-colors',
                                            selectedTask?.id === task.id
                                              ? 'app-tint-blue bg-secondary text-secondary-foreground'
                                              : 'bg-background hover:bg-muted/70',
                                          )}
                                          onClick={() => setSelectedTaskId(task.id)}
                                        >
                                          <div className="flex flex-col gap-2">
                                            <div className="flex items-start justify-between gap-3">
                                              <div className="min-w-0">
                                                <p className="truncate font-medium">{task.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                  {task.sopCode}
                                                </p>
                                              </div>
                                              <Badge variant={getTaskBadge(task).variant}>
                                                {getTaskBadge(task).label}
                                              </Badge>
                                            </div>
                                            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                              <span className="truncate">{task.platforms.join(' / ')}</span>
                                              <span>{formatDateTime(task.updatedAt)}</span>
                                            </div>
                                          </div>
                                        </button>
                                      ))
                                    ) : (
                                      <Empty>
                                        <EmptyHeader>
                                          <EmptyMedia variant="icon">
                                            <SearchIcon />
                                          </EmptyMedia>
                                          <EmptyTitle>这个筛选下还没有任务</EmptyTitle>
                                          <EmptyDescription>
                                            你可以先创建一条模板任务，或者切换筛选查看其他任务状态。
                                          </EmptyDescription>
                                        </EmptyHeader>
                                      </Empty>
                                    )}
                                  </div>
                                </ScrollArea>
                              </CardContent>
                            </Card>

                            {selectedTask ? (
                              <TaskDetailCard
                                task={selectedTask}
                                onStop={handleStopTask}
                                onRetry={handleRetryTask}
                                onCopyPayload={(task) =>
                                  handleCopyText(formatJson(task.payload), '任务载荷已复制到剪贴板。')
                                }
                                onCopyLogs={(task) =>
                                  handleCopyText(task.logs.join('\n'), '任务日志已复制到剪贴板。')
                                }
                              />
                            ) : (
                              <Card className="app-shell-card">
                                <CardContent className="flex min-h-[520px] items-center justify-center">
                                  <Empty>
                                    <EmptyHeader>
                                      <EmptyMedia variant="icon">
                                        <FolderKanbanIcon />
                                      </EmptyMedia>
                                      <EmptyTitle>还没有选中任务</EmptyTitle>
                                      <EmptyDescription>
                                        从左侧任务列表选一条，就能查看 payload、日志、结果和停止操作。
                                      </EmptyDescription>
                                    </EmptyHeader>
                                  </Empty>
                                </CardContent>
                              </Card>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="ai" className="mt-0 flex flex-col gap-4">
                    <div className="grid gap-4 xl:grid-cols-12">
                      <Card className="app-shell-card app-tint-violet xl:col-span-7">
                        <CardHeader>
                          <CardTitle>AI 执行助理</CardTitle>
                          <CardDescription>根据你的业务目标、当前设备状态和知识库上下文生成下一步动作。</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                          <ScrollArea className="h-[540px] rounded-xl border bg-muted/30">
                            <div className="flex flex-col gap-3 p-4">
                              {messages.map((message) => (
                                <div
                                  key={message.id}
                                  className={cn(
                                    'flex flex-col gap-3 rounded-2xl border p-4',
                                    message.role === 'assistant' ? 'app-tint-blue' : 'app-tint-cyan',
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="font-medium">
                                      {message.role === 'assistant' ? 'AI 助手' : '你'}
                                    </p>
                                    {message.suggestion ? <Badge variant="secondary">可执行建议</Badge> : null}
                                  </div>
                                  <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                                  {message.citations?.length ? (
                                    <div className="flex flex-wrap gap-2">
                                      {message.citations.map((citation) => (
                                        <Badge key={citation} variant="outline">
                                          {citation}
                                        </Badge>
                                      ))}
                                    </div>
                                  ) : null}
                                  {message.suggestion ? (
                                    <div className="app-tint-violet flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
                                      <div className="min-w-0">
                                        <p className="truncate font-medium">{message.suggestion.task.name}</p>
                                        <p className="text-sm text-muted-foreground">
                                          AI 已经把建议整理成可执行任务。
                                        </p>
                                      </div>
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => handleSuggestion(message.suggestion!.task)}
                                      >
                                        <SparklesIcon data-icon="inline-start" />
                                        {message.suggestion.label}
                                      </Button>
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </ScrollArea>

                          <form className="flex flex-col gap-4" onSubmit={handleAskAssistant}>
                            <FieldGroup>
                              <Field>
                                <FieldLabel htmlFor="assistant-input">告诉 AI 你的业务目标</FieldLabel>
                                <Textarea
                                  id="assistant-input"
                                  rows={4}
                                  value={chatInput}
                                  onChange={(event) => setChatInput(event.target.value)}
                                  placeholder="例如：帮我给高意向客户群发今晚直播提醒，并把自动回复一起开起来。"
                                />
                              </Field>
                            </FieldGroup>
                            <div className="flex justify-end">
                              <Button type="submit">
                                <SendIcon data-icon="inline-start" />
                                生成建议
                              </Button>
                            </div>
                          </form>
                        </CardContent>
                      </Card>

                      <div className="flex flex-col gap-4 xl:col-span-5">
                        <Card className="app-shell-card app-tint-cyan">
                          <CardHeader>
                            <CardTitle>本地知识命中</CardTitle>
                            <CardDescription>知识库会作为上下文来源，帮助 AI 更准确地生成执行建议。</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="flex flex-col gap-3">
                              {knowledgeBase.map((doc) => (
                                <Card key={doc.id} size="sm" className="app-shell-card app-tint-cyan">
                                  <CardHeader>
                                    <CardTitle className="text-sm">{doc.title}</CardTitle>
                                  </CardHeader>
                                  <CardContent className="flex flex-col gap-3">
                                    <p className="text-sm text-muted-foreground">{doc.summary}</p>
                                    <div className="flex flex-wrap gap-2">
                                      {doc.keywords.map((keyword) => (
                                        <Badge key={keyword} variant="outline">
                                          {keyword}
                                        </Badge>
                                      ))}
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="app-shell-card app-tint-violet">
                          <CardHeader>
                            <CardTitle>AI 推荐的下一步</CardTitle>
                            <CardDescription>把最近一条带 suggestion 的回复提炼成一条动作卡。</CardDescription>
                          </CardHeader>
                          <CardContent>
                            {latestAssistant?.suggestion ? (
                              <div className="flex flex-col gap-4">
                                <Alert className="app-tint-violet">
                                  <BotIcon />
                                  <AlertTitle>{latestAssistant.suggestion.task.name}</AlertTitle>
                                  <AlertDescription>
                                    最近一条 AI 建议已经生成了可执行任务，可以直接下发到队列。
                                  </AlertDescription>
                                </Alert>
                                <div className="app-tint-violet rounded-xl border p-4">
                                  <pre className="text-xs leading-6 text-muted-foreground">
                                    {formatJson(
                                      (latestAssistant.suggestion.task.payload ?? {}) as Record<string, unknown>,
                                    )}
                                  </pre>
                                </div>
                                <Button type="button" onClick={() => handleSuggestion(latestAssistant.suggestion!.task)}>
                                  <SparklesIcon data-icon="inline-start" />
                                  执行这条建议
                                </Button>
                              </div>
                            ) : (
                              <Empty>
                                <EmptyHeader>
                                  <EmptyMedia variant="icon">
                                    <BotIcon />
                                  </EmptyMedia>
                                  <EmptyTitle>还没有新的执行建议</EmptyTitle>
                                  <EmptyDescription>
                                    先向 AI 描述你的业务目标，例如扫描评论区并私信高意向用户。
                                  </EmptyDescription>
                                </EmptyHeader>
                              </Empty>
                            )}
                          </CardContent>
                          <CardFooter className="justify-between gap-3">
                            <div className="text-sm text-muted-foreground">
                              设备 {snapshot.device.alias}
                            </div>
                            <Badge variant="outline">{runningTasks.length} 条正在执行 / 待执行</Badge>
                          </CardFooter>
                        </Card>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="device" className="mt-0 flex flex-col gap-4">
                    <div className="grid gap-4 xl:grid-cols-12">
                      <Card className="app-shell-card app-tint-blue xl:col-span-4">
                        <CardHeader>
                          <CardTitle>设备绑定与身份信息</CardTitle>
                          <CardDescription>修改设备名、工作区和 AI 员工昵称，写回本地状态。</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <form className="flex flex-col gap-5" onSubmit={handleBindSubmit}>
                            <FieldGroup>
                              <Field>
                                <FieldLabel htmlFor="device-alias">设备名称</FieldLabel>
                                <Input
                                  id="device-alias"
                                  value={deviceForm.alias}
                                  onChange={(event) =>
                                    setDeviceForm((current) => ({ ...current, alias: event.target.value }))
                                  }
                                />
                              </Field>
                              <Field>
                                <FieldLabel htmlFor="device-workspace">所属工作区</FieldLabel>
                                <Input
                                  id="device-workspace"
                                  value={deviceForm.workspace}
                                  onChange={(event) =>
                                    setDeviceForm((current) => ({ ...current, workspace: event.target.value }))
                                  }
                                />
                              </Field>
                              <Field>
                                <FieldLabel htmlFor="device-operator">AI 员工昵称</FieldLabel>
                                <Input
                                  id="device-operator"
                                  value={deviceForm.operatorName}
                                  onChange={(event) =>
                                    setDeviceForm((current) => ({
                                      ...current,
                                      operatorName: event.target.value,
                                    }))
                                  }
                                />
                              </Field>
                            </FieldGroup>
                            <Button type="submit">
                              <SendIcon data-icon="inline-start" />
                              更新绑定信息
                            </Button>
                          </form>
                        </CardContent>
                      </Card>

                      <Card className="app-shell-card app-tint-cyan xl:col-span-4">
                        <CardHeader>
                          <CardTitle>执行器开关</CardTitle>
                          <CardDescription>开关级别的配置都放在这里，避免散落在多个页面里。</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                          <Field orientation="horizontal">
                            <FieldContent>
                              <FieldLabel htmlFor="setting-polling">远程自动轮询</FieldLabel>
                              <FieldDescription>定时拉取手机端或后台下发的远程指令。</FieldDescription>
                            </FieldContent>
                            <Switch
                              id="setting-polling"
                              checked={snapshot.device.autoPolling}
                              onCheckedChange={(checked) => handleToggleSetting('autoPolling', checked)}
                            />
                          </Field>
                          <Separator />
                          <Field orientation="horizontal">
                            <FieldContent>
                              <FieldLabel htmlFor="setting-reply">AI 自动回复守护</FieldLabel>
                              <FieldDescription>保持微信自动回复、欢迎语和知识库问答在线。</FieldDescription>
                            </FieldContent>
                            <Switch
                              id="setting-reply"
                              checked={snapshot.device.autoReply}
                              onCheckedChange={(checked) => handleToggleSetting('autoReply', checked)}
                            />
                          </Field>
                          <Separator />
                          <div className="grid gap-3 sm:grid-cols-3">
                            <SummaryTile label="绑定码" value={snapshot.device.bindCode} detail="用于设备绑定" tone="blue" />
                            <SummaryTile
                              label="最后心跳"
                              value={formatDateTime(snapshot.device.heartbeatAt)}
                              detail="最近一次状态回传"
                              tone="green"
                            />
                            <SummaryTile label="系统版本" value={snapshot.device.version} detail={snapshot.device.os} tone="violet" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="app-shell-card app-tint-violet xl:col-span-4">
                        <CardHeader>
                          <CardTitle>mac 微信执行环境巡检</CardTitle>
                          <CardDescription>查看 Python 环境、执行模式和微信可用性。</CardDescription>
                          <CardAction>
                            <Button type="button" variant="outline" size="sm" onClick={handleRerunDoctor}>
                              <RefreshCcwIcon data-icon="inline-start" />
                              重新巡检
                            </Button>
                          </CardAction>
                        </CardHeader>
                        <CardContent>
                          {snapshot.runnerHealth ? (
                            <div className="flex flex-col gap-4">
                              <Alert className="app-tint-blue">
                                <CpuIcon />
                                <AlertTitle>{describeRunnerMode(snapshot.runnerHealth.mode)}</AlertTitle>
                                <AlertDescription>{snapshot.runnerHealth.detail}</AlertDescription>
                              </Alert>

                              <div className="app-tint-cyan flex flex-col gap-3 rounded-xl border p-4">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-sm text-muted-foreground">mac 微信</span>
                                  <Badge
                                    variant={
                                      snapshot.runnerHealth.wechat?.available ? 'secondary' : 'destructive'
                                    }
                                  >
                                    {snapshot.runnerHealth.wechat?.available ? '可执行' : '待处理'}
                                  </Badge>
                                </div>
                                <p className="text-sm">{snapshot.runnerHealth.wechat?.detail || '待探测'}</p>
                                <p className="text-sm text-muted-foreground">
                                  Python: {snapshot.runnerHealth.pythonBinary}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {snapshot.runnerHealth.capabilities.map((capability) => (
                                    <Badge key={capability} variant="outline">
                                      {formatCapabilityLabel(capability)}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <Empty>
                              <EmptyHeader>
                                <EmptyMedia variant="icon">
                                  <CpuIcon />
                                </EmptyMedia>
                                <EmptyTitle>巡检结果尚未返回</EmptyTitle>
                                <EmptyDescription>
                                  主进程启动后会自动巡检 Python RPA 和 mac 微信环境，也可以手动重新巡检。
                                </EmptyDescription>
                              </EmptyHeader>
                            </Empty>
                          )}
                        </CardContent>
                      </Card>

                      <Card className="app-shell-card xl:col-span-12">
                        <CardHeader>
                          <CardTitle>最近活动</CardTitle>
                          <CardDescription>保留一条短时间窗，方便回看哪些操作刚刚在桌面端发生。</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-64">
                            <div className="flex flex-col gap-3 pr-4">
                              {snapshot.activityFeed.map((entry, index) => (
                                <div
                                  key={`${entry}-${index}`}
                                  className={cn(
                                    'flex items-start gap-3 rounded-xl border p-4',
                                    index % 3 === 0 ? 'app-tint-blue' : index % 3 === 1 ? 'app-tint-green' : 'app-tint-violet',
                                  )}
                                >
                                  <ActivityIcon className="mt-0.5 size-4 text-muted-foreground" />
                                  <p className="text-sm leading-6">{entry}</p>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>
                </div>
              </ScrollArea>
            </main>
          </Tabs>
        </div>

        <SheetContent side="left" className="w-[22rem] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>主导航</SheetTitle>
            <SheetDescription>切换 MyClaw Desktop 的主要工作区。</SheetDescription>
          </SheetHeader>
          <WorkspaceNavigation
            activeTab={activeTab}
            onSelect={(tabKey) => {
              setActiveTab(tabKey)
              setMobileNavOpen(false)
            }}
            snapshot={snapshot}
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}

function WorkspaceNavigation({
  activeTab,
  onSelect,
  snapshot,
}: {
  activeTab: TabKey
  onSelect: (tabKey: TabKey) => void
  snapshot: AppSnapshot
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-4 p-4">
        <div className="app-sidebar-brand flex items-center gap-3 rounded-2xl border p-4">
          <Avatar className="size-11 rounded-2xl">
            <AvatarFallback>MC</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">MyClaw Desktop</p>
            <p className="truncate text-base font-semibold">桌面执行工作台</p>
            <p className="text-sm text-muted-foreground">设备、队列、AI 建议在一个界面协同。</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
          <Card size="sm" className="app-shell-card app-tint-blue">
            <CardContent className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">在线状态</span>
                <Badge variant={snapshot.device.online ? 'secondary' : 'outline'}>
                  {snapshot.device.online ? '运行中' : '离线'}
                </Badge>
              </div>
              <p className="font-medium">{snapshot.device.alias}</p>
              <p className="text-sm text-muted-foreground">{snapshot.device.workspace}</p>
            </CardContent>
          </Card>

          <Card size="sm" className="app-shell-card app-tint-cyan">
            <CardContent className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">队列任务</span>
              <p className="font-medium">{queueCount(snapshot.queue)} 条</p>
              <p className="text-sm text-muted-foreground">
                CPU {snapshot.device.cpuLoad}% · 内存 {snapshot.device.memoryUsage}%
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-6 p-4">
          {tabGroups.map((group) => (
            <div key={group.title} className="flex flex-col gap-2">
              <p className="px-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">{group.title}</p>
              <div className="flex flex-col gap-1">
                {group.tabs.map((tab) => (
                  <Button
                    key={tab.key}
                    type="button"
                    variant={tab.key === activeTab ? 'secondary' : 'ghost'}
                    className="h-auto w-full justify-start rounded-xl px-3 py-3"
                    onClick={() => onSelect(tab.key)}
                  >
                    <tab.icon data-icon="inline-start" />
                    <div className="min-w-0 text-left">
                      <div className="truncate text-sm font-medium">{tab.label}</div>
                      <div className="truncate text-xs text-muted-foreground">{tab.description}</div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="border-t p-4">
        <Card size="sm" className="app-shell-card app-tint-violet">
          <CardContent className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">AI 员工</p>
              <p className="truncate font-medium">{snapshot.device.operatorName}</p>
            </div>
            <Badge variant="outline">{snapshot.device.bindCode}</Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SummaryTile({
  label,
  value,
  detail,
  tone = 'blue',
}: {
  label: string
  value: string
  detail: string
  tone?: AccentTone
}) {
  return (
    <Card size="sm" className={cn('app-shell-card', getTintClass(tone))}>
      <CardHeader>
        <CardTitle className="text-sm">{label}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <p className="text-xl font-semibold tracking-tight">{value}</p>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}

function TaskPreviewCard({
  task,
  onStop,
  onSelect,
}: {
  task: QueueTask
  onStop?: (taskId: string) => void
  onSelect?: () => void
}) {
  const badge = getTaskBadge(task)

  return (
    <Card size="sm" className={cn('app-shell-card', getTintClass(getTaskTone(task)))}>
      <CardHeader>
        <CardTitle className="flex items-start justify-between gap-3 text-sm">
          <span className="truncate">{task.name}</span>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </CardTitle>
        <CardDescription>
          {task.platforms.join(' / ')} · {task.sopCode}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Progress value={task.progress} />
        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          <span>{formatDateTime(task.updatedAt)}</span>
          <span>{task.result || task.logs.at(-1) || '等待新的执行反馈。'}</span>
        </div>
      </CardContent>
      <CardFooter className="justify-between gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onSelect}>
          查看详情
        </Button>
        {canStopTask(task) ? (
          <Button type="button" variant="destructive" size="sm" onClick={() => onStop?.(task.id)}>
            停止
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  )
}

function TaskDetailCard({
  task,
  onStop,
  onRetry,
  onCopyPayload,
  onCopyLogs,
}: {
  task: QueueTask
  onStop?: (taskId: string) => void
  onRetry?: (task: QueueTask) => void
  onCopyPayload?: (task: QueueTask) => void
  onCopyLogs?: (task: QueueTask) => void
}) {
  const badge = getTaskBadge(task)
  const artifactSummary = task.artifacts
    ? Object.entries(task.artifacts).filter((entry): entry is [string, Record<string, unknown>] => {
        return typeof entry[1] === 'object' && entry[1] !== null
      })
    : []

  return (
    <Card className={cn('app-shell-card', getTintClass(getTaskTone(task)))}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-3">
          <span className="truncate">{task.name}</span>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </CardTitle>
        <CardDescription>
          {task.source.toUpperCase()} · {task.sopCode} · {task.platforms.join(' / ')}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryTile label="创建时间" value={formatDateTime(task.createdAt)} detail="进入桌面队列时间" tone="blue" />
          <SummaryTile label="最近更新" value={formatDateTime(task.updatedAt)} detail="最近一次任务反馈" tone="cyan" />
          <SummaryTile label="进度" value={`${task.progress}%`} detail={task.engineMode || '等待执行模式回传'} tone="green" />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">执行进度</span>
            <span className="font-medium">{task.progress}%</span>
          </div>
          <Progress value={task.progress} />
        </div>

        {task.result ? (
          <Alert className={cn(getTintClass(getTaskTone(task)))}>
            <SparklesIcon />
            <AlertTitle>当前结果</AlertTitle>
            <AlertDescription>{task.result}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2">
          <Card size="sm" className="app-shell-card app-tint-blue">
            <CardHeader>
              <CardTitle className="text-sm">任务载荷</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="app-tint-blue rounded-xl border p-4">
                <pre className="text-xs leading-6 text-muted-foreground">{formatJson(task.payload)}</pre>
              </div>
            </CardContent>
          </Card>

          <Card size="sm" className="app-shell-card app-tint-cyan">
            <CardHeader>
              <CardTitle className="text-sm">最近日志</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="app-tint-cyan h-64 rounded-xl border">
                <div className="flex flex-col gap-3 p-4">
                  {task.logs.slice().reverse().map((log, index) => (
                    <p key={`${task.id}-detail-log-${index}`} className="text-sm leading-6">
                      {log}
                    </p>
                  ))}
                  {task.engineMode ? (
                    <p className="text-sm text-muted-foreground">执行模式：{task.engineMode}</p>
                  ) : null}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {artifactSummary.length ? (
          <Card size="sm" className="app-shell-card app-tint-violet">
            <CardHeader>
              <CardTitle className="text-sm">步骤产物</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {artifactSummary.map(([key, artifact]) => (
                <div key={key} className="app-tint-violet rounded-xl border p-4">
                  <p className="font-medium">{key}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {String(artifact.summary || artifact.driver || '已记录产物')}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </CardContent>
      <CardFooter className="flex flex-wrap justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onRetry?.(task)}>
            <RefreshCcwIcon data-icon="inline-start" />
            重新执行
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onCopyPayload?.(task)}>
            <CopyIcon data-icon="inline-start" />
            复制载荷
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onCopyLogs?.(task)}>
            <CopyIcon data-icon="inline-start" />
            复制日志
          </Button>
        </div>
        {canStopTask(task) ? (
          <Button type="button" variant="destructive" size="sm" onClick={() => onStop?.(task.id)}>
            停止任务
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  )
}
