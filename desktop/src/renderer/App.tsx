import { FormEvent, useEffect, useState } from 'react'
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

type TabKey = 'overview' | 'command' | 'ai' | 'device'
type TaskFilterKey = 'all' | 'active' | 'wechat' | 'completed' | 'stopped' | 'failed'
type TaskSortKey = 'updated_desc' | 'created_desc' | 'name_asc' | 'status_priority'
type ThemeMode = 'light' | 'dark'

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

const tabs: Array<{ key: TabKey; label: string; description: string }> = [
  { key: 'overview', label: '执行总览', description: '设备、队列和运营模块状态' },
  { key: 'command', label: '指令中心', description: '模板下发、远程收件箱和执行进度' },
  { key: 'ai', label: 'AI / RAG', description: '知识命中、策略建议和任务生成' },
  { key: 'device', label: '设备管理', description: '绑定信息、开关项和活动日志' },
]

const tabGroups: Array<{
  title: string
  tabs: Array<{ key: TabKey; label: string; description: string }>
}> = [
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
      hint.push('自动回复守护当前默认走 computer use：先截图识别当前聊天，如果不是目标好友 / 群，再搜索切回目标，然后按截图里识别出的历史聊天和最后一条待回复消息生成回复。')
    } else if (template.id === 'moments_campaign') {
      hint.push('朋友圈营销当前为 hybrid 辅助执行：会切到朋友圈、准备剪贴板和草稿，但仍需要你最终确认发布。')
    } else if (template.id === 'tag_management') {
      hint.push('标签管理当前会写入本地标签台账，并尝试逐个定位联系人供确认，还不是 WeChat 内原生标签的全自动点击流。')
    } else {
      hint.push('mac 微信当前按 contacts / groups / recipients / messages 执行。首次建议保留 dryRun: true，并先在系统设置中给 Terminal 或桌面客户端开启辅助功能和自动化权限。')
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
      tone: 'badge-running',
      label: '守护中',
    }
  }

  if (task.status === 'queued') {
    return { tone: 'badge-queued', label: '排队中' }
  }
  if (task.status === 'running') {
    return { tone: 'badge-running', label: '执行中' }
  }
  if (task.status === 'completed') {
    return { tone: 'badge-completed', label: '已完成' }
  }
  if (task.status === 'stopped') {
    return { tone: 'badge-stopped', label: '已停止' }
  }
  return { tone: 'badge-failed', label: '失败' }
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

  useEffect(() => {
    let cancelled = false

    window.desktop.getSnapshot().then((nextSnapshot) => {
      if (cancelled || !nextSnapshot) {
        return
      }

      setSnapshot(nextSnapshot)
      setSelectedTemplateId((current) => current || nextSnapshot.templates[0]?.id || 'broadcast_message')
      setPayloadText((current) => (current === '{}' ? getTemplatePayload(nextSnapshot, 'broadcast_message') : current))
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
    document.documentElement.dataset.theme = themeMode
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
    await applySnapshot(window.desktop.toggleSetting(key, value), `已更新 ${key === 'autoPolling' ? '自动轮询' : '自动回复'} 开关。`)
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

    try {
      const keywordReplies = JSON.parse(autoReplyTaskForm.keywordRepliesText || '{}') as Record<string, string>
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
        '微信自动回复守护任务已创建。',
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
    return <div className="loading-shell">MyClaw Desktop 初始化中...</div>
  }

  const runningTasks = snapshot.queue.filter(
    (task) => task.status === 'queued' || task.status === 'running',
  )
  const filteredTasks = sortTasks(
    snapshot.queue.filter((task) => {
      if (!taskMatchesFilter(task, taskFilter)) {
        return false
      }

      const normalizedQuery = taskQuery.trim().toLowerCase()
      if (!normalizedQuery) {
        return true
      }

      return [
        task.name,
        task.sopCode,
        task.templateId,
        task.platforms.join(' '),
        task.result || '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    }),
    taskSort,
  )
  const selectedTask =
    filteredTasks.find((task) => task.id === selectedTaskId) || filteredTasks[0] || null
  const selectedTemplate = findTemplate(snapshot, selectedTemplateId)
  const activeAutoReplyTask = snapshot.activeAutoReplyTaskId
    ? snapshot.queue.find((task) => task.id === snapshot.activeAutoReplyTaskId) || null
    : null
  const latestAssistant = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant' && message.suggestion)
  const currentTab = tabs.find((tab) => tab.key === activeTab) || tabs[0]
  const workspaceHighlights = [
    {
      label: '当前设备',
      value: snapshot.device.alias,
      detail: snapshot.device.online ? '在线并持续回传心跳' : '当前离线，等待恢复连接',
    },
    {
      label: '运行队列',
      value: `${queueCount(snapshot.queue)} 条`,
      detail: `${getTaskFilterCount(snapshot.queue, 'active')} 条任务处于运行或守护中`,
    },
    {
      label: '执行环境',
      value: describeRunnerMode(snapshot.runnerHealth?.mode),
      detail: snapshot.runnerHealth?.detail || 'Python RPA 巡检结果待返回',
    },
  ]

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-card">
          <div className="brand-badge">MYCLAW DESKTOP</div>
          <div className="brand-lockup">
            <MyClawMark />
            <div className="brand-copy">
              <h1>MyClaw Desktop</h1>
              <p>一个桌面控制台，承接远程指令、RPA 执行和 AI 策略建议。</p>
            </div>
          </div>
        </div>

        <div className="device-summary">
          <div className="device-pill">
            <span className="status-dot status-live"></span>
            {snapshot.device.alias}
          </div>
          <strong>{snapshot.device.workspace}</strong>
          <div className="device-summary-meta">
            <span>绑定码 {snapshot.device.bindCode}</span>
            <span>CPU {snapshot.device.cpuLoad}% · 内存 {snapshot.device.memoryUsage}%</span>
            <span>AI 员工 {snapshot.device.operatorName}</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="功能导航">
          {tabGroups.map((group) => (
            <section key={group.title} className="nav-group">
              <div className="nav-group-title">{group.title}</div>
              <div className="nav-group-list">
                {group.tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={tab.key === activeTab ? 'nav-item nav-item-active' : 'nav-item'}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    <strong>{tab.label}</strong>
                    <span>{tab.description}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div>
            <span>在线状态</span>
            <strong>{snapshot.device.online ? '运行中' : '离线'}</strong>
          </div>
          <div>
            <span>队列任务</span>
            <strong>{queueCount(snapshot.queue)} 条</strong>
          </div>
          <div>
            <span>外观模式</span>
            <strong>{themeMode === 'dark' ? '暗色' : '亮色'}</strong>
          </div>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div className="topbar-copy-block">
            <p className="eyebrow">
              MYCLAW OPERATOR / {themeMode === 'dark' ? 'NIGHT SHIFT' : 'DAY SHIFT'}
            </p>
            <h2>{currentTab.label}</h2>
            <p className="topbar-description">{currentTab.description}</p>
          </div>
          <div className="topbar-actions">
            <div className="theme-switch" role="tablist" aria-label="外观模式">
              <button
                type="button"
                className={themeMode === 'light' ? 'theme-switch-button is-active' : 'theme-switch-button'}
                onClick={() => setThemeMode('light')}
              >
                亮色
              </button>
              <button
                type="button"
                className={themeMode === 'dark' ? 'theme-switch-button is-active' : 'theme-switch-button'}
                onClick={() => setThemeMode('dark')}
              >
                暗色
              </button>
            </div>
            <div className="notice-card">{notice}</div>
          </div>
        </header>

        <section className="workspace-band">
          <div className="workspace-band-copy">
            <p className="eyebrow">CONTROL SURFACE</p>
            <h3>把设备、队列、AI 建议和微信执行器放在同一张桌面上</h3>
            <p className="hero-copy">
              这一版界面改成了更偏桌面工作台的层级：左侧固定导航，右侧是当前任务视图，亮色和暗色共用一套语义化配色变量，切换时不会丢状态。
            </p>
          </div>
          <div className="workspace-band-grid">
            {workspaceHighlights.map((item) => (
              <article key={item.label} className="workspace-stat">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.detail}</small>
              </article>
            ))}
          </div>
        </section>

        {activeTab === 'overview' ? (
          <section className="page-grid">
            <div className="hero-panel">
              <div>
                <p className="eyebrow">REMOTE COMMAND + RPA</p>
                <h3>手机下指令，桌面端自动轮询并执行</h3>
                <p className="hero-copy">
                  这版桌面端已经打通本地任务队列、远程收件箱、设备心跳、AI 建议和知识命中。后续接真实
                  PHP API、Python RPA、微信自动化时，只需要替换主进程里的数据源。
                </p>
              </div>
              <div className="hero-stats">
                {snapshot.metrics.map((metric) => (
                  <article key={metric.label} className={`metric-card tone-${metric.tone}`}>
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                    <small>{metric.detail}</small>
                  </article>
                ))}
              </div>
            </div>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">CAPABILITIES</p>
                  <h3>核心执行模块</h3>
                </div>
              </div>
              <div className="module-grid">
                {snapshot.modules.map((item) => (
                  <article key={item.id} className={`module-card accent-${item.accent}`}>
                    <strong>{item.name}</strong>
                    <p>{item.description}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">WORKFLOW</p>
                  <h3>AI 员工班次与工作流</h3>
                </div>
              </div>
              <div className="timeline">
                {snapshot.workflow.map((step) => (
                  <article key={step.id} className={`timeline-item status-${step.status}`}>
                    <div className="timeline-time">{step.time}</div>
                    <div className="timeline-body">
                      <strong>{step.title}</strong>
                      <p>{step.detail}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">QUEUE</p>
                  <h3>当前执行队列</h3>
                </div>
              </div>
              <div className="task-list">
                {snapshot.queue.slice(0, 4).map((task) => (
                  <TaskCard key={task.id} task={task} onStop={handleStopTask} />
                ))}
              </div>
            </section>
          </section>
        ) : null}

        {activeTab === 'command' ? (
          <section className="page-grid command-grid">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">TEMPLATES</p>
                  <h3>快速下发任务</h3>
                </div>
              </div>

              <form className="stack-form" onSubmit={handleTemplateSubmit}>
                <label>
                  <span>选择模板</span>
                  <select
                    value={selectedTemplateId}
                    onChange={(event) => handleTemplateChange(event.target.value)}
                  >
                    {snapshot.templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} · {template.category}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="template-meta">
                  <strong>{selectedTemplate?.description}</strong>
                  <span>SOP: {selectedTemplate?.sopCode}</span>
                  <span>
                    平台：{selectedTemplate?.platforms.join(' / ')}
                  </span>
                  <span>
                    预计执行 {selectedTemplate?.estimatedSeconds ?? 0} 秒
                  </span>
                </div>

                <label>
                  <span>JSON 载荷</span>
                  <textarea
                    rows={9}
                    value={payloadText}
                    onChange={(event) => setPayloadText(event.target.value)}
                  />
                </label>
                {getTemplateHint(selectedTemplate, snapshot.runnerHealth) ? (
                  <p className="form-hint">{getTemplateHint(selectedTemplate, snapshot.runnerHealth)}</p>
                ) : null}

                <button type="submit" className="primary-button">
                  加入桌面队列
                </button>
              </form>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">REMOTE INBOX</p>
                  <h3>模拟手机端下发指令</h3>
                </div>
              </div>

              <form className="stack-form" onSubmit={handleRemoteSubmit}>
                <label>
                  <span>文字或 JSON 指令</span>
                  <textarea
                    rows={7}
                    value={remoteCommand}
                    onChange={(event) => setRemoteCommand(event.target.value)}
                  />
                </label>

                <div className="toggle-row">
                  <span>自动轮询</span>
                  <button
                    type="button"
                    className={snapshot.device.autoPolling ? 'toggle is-on' : 'toggle'}
                    onClick={() => handleToggleSetting('autoPolling', !snapshot.device.autoPolling)}
                  >
                    {snapshot.device.autoPolling ? '开启' : '关闭'}
                  </button>
                </div>

                <button type="submit" className="primary-button primary-button-secondary">
                  投递到远程收件箱
                </button>
              </form>

              <div className="inbox-list">
                {snapshot.inbox.slice(0, 6).map((item) => (
                  <article key={item.id} className={`inbox-card inbox-${item.status}`}>
                    <div className="inbox-head">
                      <strong>{item.status === 'pending' ? '待拉取' : item.status === 'ingested' ? '已入队' : '已拒绝'}</strong>
                      <span>{formatDateTime(item.createdAt)}</span>
                    </div>
                    <p>{item.raw}</p>
                    <small>{item.detail}</small>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">WECHAT GUARD</p>
                  <h3>微信自动回复守护</h3>
                </div>
                {activeAutoReplyTask ? (
                  <button
                    type="button"
                    className="ghost-button ghost-button-danger"
                    onClick={() => handleStopTask(activeAutoReplyTask.id)}
                  >
                    停止守护
                  </button>
                ) : null}
              </div>

              <form className="stack-form" onSubmit={handleAutoReplyTaskSubmit}>
                <div className="field-grid">
                  <label>
                    <span>守护对象</span>
                    <input
                      value={autoReplyTaskForm.targetName}
                      onChange={(event) =>
                        setAutoReplyTaskForm((current) => ({
                          ...current,
                          targetName: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span>对象类型</span>
                    <select
                      value={autoReplyTaskForm.targetKind}
                      onChange={(event) =>
                        setAutoReplyTaskForm((current) => ({
                          ...current,
                          targetKind: event.target.value as 'contact' | 'group',
                        }))
                      }
                    >
                      <option value="contact">好友</option>
                      <option value="group">群聊</option>
                    </select>
                  </label>
                </div>

                <label>
                  <span>欢迎语</span>
                  <textarea
                    rows={3}
                    value={autoReplyTaskForm.welcome}
                    onChange={(event) =>
                      setAutoReplyTaskForm((current) => ({
                        ...current,
                        welcome: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  <span>兜底回复</span>
                  <textarea
                    rows={3}
                    value={autoReplyTaskForm.fallbackReply}
                    onChange={(event) =>
                      setAutoReplyTaskForm((current) => ({
                        ...current,
                        fallbackReply: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  <span>关键词回复 JSON</span>
                  <textarea
                    rows={6}
                    value={autoReplyTaskForm.keywordRepliesText}
                    onChange={(event) =>
                      setAutoReplyTaskForm((current) => ({
                        ...current,
                        keywordRepliesText: event.target.value,
                      }))
                    }
                  />
                </label>

                <div className="field-grid">
                  <label>
                    <span>轮询间隔（秒）</span>
                    <input
                      value={autoReplyTaskForm.pollIntervalSeconds}
                      onChange={(event) =>
                        setAutoReplyTaskForm((current) => ({
                          ...current,
                          pollIntervalSeconds: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span>去重窗口（秒）</span>
                    <input
                      value={autoReplyTaskForm.duplicateCooldownSeconds}
                      onChange={(event) =>
                        setAutoReplyTaskForm((current) => ({
                          ...current,
                          duplicateCooldownSeconds: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>

                <div className="toggle-row">
                  <span>启用守护</span>
                  <button
                    type="button"
                    className={autoReplyTaskForm.enabled ? 'toggle is-on' : 'toggle'}
                    onClick={() =>
                      setAutoReplyTaskForm((current) => ({
                        ...current,
                        enabled: !current.enabled,
                      }))
                    }
                  >
                    {autoReplyTaskForm.enabled ? '开启' : '关闭'}
                  </button>
                </div>

                <div className="toggle-row">
                  <span>仅演练（dryRun）</span>
                  <button
                    type="button"
                    className={autoReplyTaskForm.dryRun ? 'toggle' : 'toggle is-on'}
                    onClick={() =>
                      setAutoReplyTaskForm((current) => ({
                        ...current,
                        dryRun: !current.dryRun,
                      }))
                    }
                  >
                    {autoReplyTaskForm.dryRun ? '演练' : '真实执行'}
                  </button>
                </div>

                <p className="form-hint">
                  这条守护任务会先截图当前微信聊天界面，识别当前是否就是目标会话；如果不是，再搜索切回目标，再基于截图里识别出的历史聊天和最后一条待回复消息生成回复。
                </p>

                {activeAutoReplyTask ? (
                  <div className="template-meta">
                    <strong>当前守护中：{String(activeAutoReplyTask.payload.targetName || '未命名目标')}</strong>
                    <span>
                      模式：{activeAutoReplyTask.payload.dryRun ? 'dryRun 演练' : '真实执行'}
                    </span>
                    <span>{activeAutoReplyTask.result || '后台守护运行中'}</span>
                  </div>
                ) : null}

                <button type="submit" className="primary-button">
                  创建守护任务
                </button>
              </form>
            </section>

            <section className="panel panel-span-2">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">TASK CENTER</p>
                  <h3>任务中心</h3>
                </div>
                <button type="button" className="ghost-button" onClick={handleClearHistory}>
                  整理历史
                </button>
              </div>

              <div className="task-summary-grid">
                <article className="task-summary-card">
                  <span>全部任务</span>
                  <strong>{snapshot.queue.length}</strong>
                  <small>已入列的桌面任务总数</small>
                </article>
                <article className="task-summary-card">
                  <span>运行中</span>
                  <strong>{getTaskFilterCount(snapshot.queue, 'active')}</strong>
                  <small>排队、执行和后台守护</small>
                </article>
                <article className="task-summary-card">
                  <span>微信任务</span>
                  <strong>{getTaskFilterCount(snapshot.queue, 'wechat')}</strong>
                  <small>含群发、守护、SOP 等</small>
                </article>
                <article className="task-summary-card">
                  <span>异常 / 已停</span>
                  <strong>
                    {getTaskFilterCount(snapshot.queue, 'failed') + getTaskFilterCount(snapshot.queue, 'stopped')}
                  </strong>
                  <small>需要人工关注的任务</small>
                </article>
              </div>

              <div className="task-filter-row" role="tablist" aria-label="任务筛选">
                {([
                  ['all', '全部'],
                  ['active', '运行中'],
                  ['wechat', '微信'],
                  ['completed', '已完成'],
                  ['stopped', '已停止'],
                  ['failed', '失败'],
                ] as Array<[TaskFilterKey, string]>).map(([filterKey, label]) => (
                  <button
                    key={filterKey}
                    type="button"
                    className={taskFilter === filterKey ? 'task-filter-chip is-active' : 'task-filter-chip'}
                    onClick={() => {
                      setTaskFilter(filterKey)
                      const nextSelected = snapshot.queue.find((task) =>
                        taskMatchesFilter(task, filterKey),
                      )
                      setSelectedTaskId(nextSelected?.id || null)
                    }}
                  >
                    <span>{label}</span>
                    <strong>{getTaskFilterCount(snapshot.queue, filterKey)}</strong>
                  </button>
                ))}
              </div>

              <div className="task-toolbar">
                <label className="task-toolbar-field">
                  <span>搜索任务</span>
                  <input
                    value={taskQuery}
                    onChange={(event) => setTaskQuery(event.target.value)}
                    placeholder="按任务名、SOP、平台或结果搜索"
                  />
                </label>
                <label className="task-toolbar-field task-toolbar-field-compact">
                  <span>排序方式</span>
                  <select
                    value={taskSort}
                    onChange={(event) => setTaskSort(event.target.value as TaskSortKey)}
                  >
                    <option value="updated_desc">最近更新</option>
                    <option value="created_desc">最近创建</option>
                    <option value="status_priority">按状态优先级</option>
                    <option value="name_asc">按名称</option>
                  </select>
                </label>
              </div>

              <div className="task-center">
                <div className="task-center-list">
                  {filteredTasks.length ? (
                    filteredTasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        className={
                          selectedTask?.id === task.id
                            ? 'task-list-item is-selected'
                            : 'task-list-item'
                        }
                        onClick={() => setSelectedTaskId(task.id)}
                      >
                        <div className="task-list-item-head">
                          <strong>{task.name}</strong>
                          <span className={`task-badge ${getTaskBadge(task).tone}`}>
                            {getTaskBadge(task).label}
                          </span>
                        </div>
                        <span>{task.platforms.join(' / ')}</span>
                        <span>{task.sopCode}</span>
                        <div className="task-list-item-meta">
                          <span>{formatDateTime(task.createdAt)}</span>
                          <span>{task.source.toUpperCase()}</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="empty-card">
                      <strong>这个筛选下还没有任务</strong>
                      <p>你可以先在左侧创建微信任务，或者切换筛选查看别的任务状态。</p>
                    </div>
                  )}
                </div>

                <div className="task-detail-shell">
                  {selectedTask ? (
                    <TaskDetailPanel
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
                    <div className="empty-card task-detail-empty">
                      <strong>还没有选中任务</strong>
                      <p>从左侧任务列表选一条，就能查看 payload、日志、结果和停止操作。</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </section>
        ) : null}

        {activeTab === 'ai' ? (
          <section className="page-grid ai-grid">
            <section className="panel chat-panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">AI COPILOT</p>
                  <h3>让 AI 帮你生成执行建议</h3>
                </div>
              </div>

              <div className="chat-list">
                {messages.map((message) => (
                  <article
                    key={message.id}
                    className={message.role === 'assistant' ? 'chat-bubble assistant' : 'chat-bubble user'}
                  >
                    <strong>{message.role === 'assistant' ? 'AI 助手' : '你'}</strong>
                    <p>{message.content}</p>
                    {message.citations?.length ? (
                      <div className="citation-list">
                        {message.citations.map((citation) => (
                          <span key={citation}>{citation}</span>
                        ))}
                      </div>
                    ) : null}
                    {message.suggestion ? (
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => handleSuggestion(message.suggestion!.task)}
                      >
                        {message.suggestion.label}
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>

              <form className="chat-form" onSubmit={handleAskAssistant}>
                <textarea
                  rows={4}
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="例如：帮我给高意向客户群发今晚直播提醒，并把自动回复一起开起来。"
                />
                <button type="submit" className="primary-button">
                  生成建议
                </button>
              </form>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">RAG RETRIEVAL</p>
                  <h3>本地知识库命中</h3>
                </div>
              </div>

              <div className="knowledge-list">
                {knowledgeBase.map((doc) => (
                  <article key={doc.id} className="knowledge-card">
                    <strong>{doc.title}</strong>
                    <p>{doc.summary}</p>
                    <div className="citation-list">
                      {doc.keywords.map((keyword) => (
                        <span key={keyword}>{keyword}</span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">FUNCTION CALLING</p>
                  <h3>AI 推荐的下一步</h3>
                </div>
              </div>

              {latestAssistant?.suggestion ? (
                <div className="suggestion-card">
                  <strong>{latestAssistant.suggestion.task.name}</strong>
                  <p>最近一条 AI 建议已经生成了可执行任务，可以直接下发到队列。</p>
                  <pre>{formatJson((latestAssistant.suggestion.task.payload ?? {}) as Record<string, unknown>)}</pre>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => handleSuggestion(latestAssistant.suggestion!.task)}
                  >
                    执行这条建议
                  </button>
                </div>
              ) : (
                <div className="empty-card">
                  <strong>还没有生成新的执行建议</strong>
                  <p>先向 AI 描述你的业务目标，例如“扫描小红书评论区并私信高意向用户”。</p>
                </div>
              )}

              <div className="status-strip">
                <div>
                  <span>设备在线</span>
                  <strong>{snapshot.device.alias}</strong>
                </div>
                <div>
                  <span>任务队列</span>
                  <strong>{runningTasks.length} 条执行中 / 待执行</strong>
                </div>
              </div>
            </section>
          </section>
        ) : null}

        {activeTab === 'device' ? (
          <section className="page-grid device-grid">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">BINDING</p>
                  <h3>设备绑定与身份信息</h3>
                </div>
              </div>

              <form className="stack-form" onSubmit={handleBindSubmit}>
                <label>
                  <span>设备名称</span>
                  <input
                    value={deviceForm.alias}
                    onChange={(event) =>
                      setDeviceForm((current) => ({ ...current, alias: event.target.value }))
                    }
                  />
                </label>
                <label>
                  <span>所属工作区</span>
                  <input
                    value={deviceForm.workspace}
                    onChange={(event) =>
                      setDeviceForm((current) => ({ ...current, workspace: event.target.value }))
                    }
                  />
                </label>
                <label>
                  <span>AI 员工昵称</span>
                  <input
                    value={deviceForm.operatorName}
                    onChange={(event) =>
                      setDeviceForm((current) => ({
                        ...current,
                        operatorName: event.target.value,
                      }))
                    }
                  />
                </label>

                <button type="submit" className="primary-button">
                  更新绑定信息
                </button>
              </form>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">SETTINGS</p>
                  <h3>执行器开关</h3>
                </div>
              </div>

              <div className="settings-list">
                <SettingCard
                  title="远程自动轮询"
                  description="定时拉取手机端或后台下发的远程指令。"
                  enabled={snapshot.device.autoPolling}
                  onToggle={() => handleToggleSetting('autoPolling', !snapshot.device.autoPolling)}
                />
                <SettingCard
                  title="AI 自动回复守护"
                  description="保持微信自动回复、欢迎语和知识库问答在线。"
                  enabled={snapshot.device.autoReply}
                  onToggle={() => handleToggleSetting('autoReply', !snapshot.device.autoReply)}
                />
              </div>

              <div className="status-strip">
                <div>
                  <span>绑定码</span>
                  <strong>{snapshot.device.bindCode}</strong>
                </div>
                <div>
                  <span>最后心跳</span>
                  <strong>{formatDateTime(snapshot.device.heartbeatAt)}</strong>
                </div>
                <div>
                  <span>系统版本</span>
                  <strong>{snapshot.device.version}</strong>
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">PYTHON RPA</p>
                  <h3>mac 微信执行环境巡检</h3>
                </div>
                <button type="button" className="ghost-button" onClick={handleRerunDoctor}>
                  重新巡检
                </button>
              </div>

              {snapshot.runnerHealth ? (
                <div className="health-grid">
                  <article className="setting-card">
                    <div className="health-row">
                      <strong>运行模式</strong>
                      <span className="task-badge badge-running">
                        {describeRunnerMode(snapshot.runnerHealth.mode)}
                      </span>
                    </div>
                    <p>{snapshot.runnerHealth.detail}</p>
                    <div className="citation-list">
                      {snapshot.runnerHealth.capabilities.map((capability) => (
                        <span key={capability}>{formatCapabilityLabel(capability)}</span>
                      ))}
                    </div>
                    <div className="health-meta">
                      <span>Python</span>
                      <strong>{snapshot.runnerHealth.pythonBinary}</strong>
                    </div>
                  </article>

                  <article className="setting-card">
                    <div className="health-row">
                      <strong>mac 微信</strong>
                      <span
                        className={
                          snapshot.runnerHealth.wechat?.available
                            ? 'task-badge badge-completed'
                            : 'task-badge badge-failed'
                        }
                      >
                        {snapshot.runnerHealth.wechat?.available ? '可执行' : '待处理'}
                      </span>
                    </div>
                    <p>{snapshot.runnerHealth.wechat?.detail || '尚未返回 mac 微信探测结果。'}</p>
                    <div className="health-meta">
                      <span>应用路径</span>
                      <strong>{snapshot.runnerHealth.wechat?.appPath || '未发现'}</strong>
                    </div>
                    <div className="health-meta">
                      <span>进程名</span>
                      <strong>{snapshot.runnerHealth.wechat?.processName || '待探测'}</strong>
                    </div>
                    <div className="health-meta">
                      <span>建议</span>
                      <strong>
                        {snapshot.runnerHealth.wechat?.available
                          ? '先用 dryRun 校验联系人和文案，再正式发送。'
                          : '先启动并登录微信，再检查辅助功能和自动化权限。'}
                      </strong>
                    </div>
                  </article>
                </div>
              ) : (
                <div className="empty-card">
                  <strong>巡检结果尚未返回</strong>
                  <p>主进程启动后会自动巡检 Python RPA 和 mac 微信环境，也可以手动重新巡检。</p>
                </div>
              )}
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">ACTIVITY</p>
                  <h3>最近活动</h3>
                </div>
              </div>

              <div className="activity-list">
                {snapshot.activityFeed.map((entry) => (
                  <article key={entry} className="activity-item">
                    {entry}
                  </article>
                ))}
              </div>
            </section>
          </section>
        ) : null}
      </main>
    </div>
  )
}

function TaskCard({
  task,
  onStop,
}: {
  task: QueueTask
  onStop?: (taskId: string) => void
}) {
  const artifactSummary = task.artifacts
    ? Object.values(task.artifacts)
        .filter((artifact): artifact is Record<string, unknown> => typeof artifact === 'object' && artifact !== null)
        .map((artifact) => String(artifact.summary || artifact.driver || '').trim())
        .filter(Boolean)
    : []
  const badge = getTaskBadge(task)
  const stoppable = canStopTask(task) && onStop

  return (
    <article className={`task-card task-${task.status}`}>
      <div className="task-topline">
        <div>
          <strong>{task.name}</strong>
          <span>
            {task.source.toUpperCase()} · {formatDateTime(task.createdAt)}
          </span>
          <span>
            SOP {task.sopCode} · {task.platforms.join(' / ')}
          </span>
        </div>
        <div className="task-actions">
          <span className={`task-badge ${badge.tone}`}>{badge.label}</span>
          {stoppable ? (
            <button
              type="button"
              className="ghost-button ghost-button-danger"
              onClick={() => onStop?.(task.id)}
            >
              {task.backgroundActive ? '停止守护' : '停止任务'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="progress-track">
        <div className="progress-bar" style={{ width: `${task.progress}%` }}></div>
      </div>

      <div className="task-meta">
        <pre>{formatJson(task.payload)}</pre>
        <div className="task-log-list">
          {task.logs.slice(-3).map((log, index) => (
            <p key={`${task.id}-summary-log-${index}`}>{log}</p>
          ))}
          {task.engineMode ? <p>执行模式：{task.engineMode}</p> : null}
          {artifactSummary.length ? <p>步骤结果：{artifactSummary.join(' / ')}</p> : null}
          {task.result ? <strong>{task.result}</strong> : null}
        </div>
      </div>
    </article>
  )
}

function TaskDetailPanel({
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
  const stoppable = canStopTask(task) && onStop
  const artifactSummary = task.artifacts
    ? Object.entries(task.artifacts).filter((entry): entry is [string, Record<string, unknown>] => {
        return typeof entry[1] === 'object' && entry[1] !== null
      })
    : []

  return (
    <article className="task-detail-panel">
      <div className="task-detail-head">
        <div>
          <p className="eyebrow">SELECTED TASK</p>
          <h4>{task.name}</h4>
          <span className="task-detail-subtitle">
            {task.source.toUpperCase()} · {task.sopCode} · {task.platforms.join(' / ')}
          </span>
        </div>
        <div className="task-actions">
          <span className={`task-badge ${badge.tone}`}>{badge.label}</span>
          <button
            type="button"
            className="ghost-button"
            onClick={() => onRetry?.(task)}
          >
            重新执行
          </button>
          {stoppable ? (
            <button
              type="button"
              className="ghost-button ghost-button-danger"
              onClick={() => onStop?.(task.id)}
            >
              {task.backgroundActive ? '停止守护' : '停止任务'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="task-detail-stats">
        <div>
          <span>创建时间</span>
          <strong>{formatDateTime(task.createdAt)}</strong>
        </div>
        <div>
          <span>最近更新</span>
          <strong>{formatDateTime(task.updatedAt)}</strong>
        </div>
        <div>
          <span>进度</span>
          <strong>{task.progress}%</strong>
        </div>
      </div>

      <div className="progress-track">
        <div className="progress-bar" style={{ width: `${task.progress}%` }}></div>
      </div>

      {task.result ? (
        <div className="task-detail-highlight">
          <span>当前结果</span>
          <strong>{task.result}</strong>
        </div>
      ) : null}

      <div className="task-detail-toolbar">
        <button type="button" className="ghost-button" onClick={() => onCopyPayload?.(task)}>
          复制载荷
        </button>
        <button type="button" className="ghost-button" onClick={() => onCopyLogs?.(task)}>
          复制日志
        </button>
      </div>

      <div className="task-detail-grid">
        <section className="task-detail-block">
          <div className="task-detail-block-head">
            <strong>任务载荷</strong>
          </div>
          <pre>{formatJson(task.payload)}</pre>
        </section>

        <section className="task-detail-block">
          <div className="task-detail-block-head">
            <strong>最近日志</strong>
          </div>
          <div className="task-log-list">
            {task.logs.slice().reverse().map((log, index) => (
              <p key={`${task.id}-detail-log-${index}`}>{log}</p>
            ))}
            {task.engineMode ? <p>执行模式：{task.engineMode}</p> : null}
          </div>
        </section>
      </div>

      {artifactSummary.length ? (
        <section className="task-detail-block">
          <div className="task-detail-block-head">
            <strong>步骤产物</strong>
          </div>
          <div className="task-artifact-list">
            {artifactSummary.map(([key, artifact]) => (
              <article key={key} className="task-artifact-item">
                <strong>{key}</strong>
                <p>{String(artifact.summary || artifact.driver || '已记录产物')}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  )
}

function SettingCard({
  title,
  description,
  enabled,
  onToggle,
}: {
  title: string
  description: string
  enabled: boolean
  onToggle: () => void
}) {
  return (
    <article className="setting-card">
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <button type="button" className={enabled ? 'toggle is-on' : 'toggle'} onClick={onToggle}>
        {enabled ? '开启' : '关闭'}
      </button>
    </article>
  )
}

function MyClawMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="myclaw-brand-gradient" x1="18" y1="16" x2="96" y2="98">
            <stop offset="0%" stopColor="#ff9d86" />
            <stop offset="48%" stopColor="#ff4b4b" />
            <stop offset="100%" stopColor="#bb1328" />
          </linearGradient>
        </defs>
        <path
          d="M39 92C45 97 55 100 67 97C80 93 88 84 91 72C93 64 91 55 87 47L79 49C81 54 82 59 81 64C79 73 73 80 63 83C56 85 50 83 45 79L39 92Z"
          fill="url(#myclaw-brand-gradient)"
        />
        <path
          d="M58 29C46 18 28 17 18 29C10 39 10 54 19 64C24 70 31 73 39 73C44 73 49 72 54 69L49 57C45 60 39 61 34 58C28 54 26 46 30 40C35 33 45 33 52 39L58 29Z"
          fill="url(#myclaw-brand-gradient)"
        />
        <path
          d="M79 24C65 17 50 19 41 31C34 40 34 54 41 63C47 70 57 74 69 73L70 61C61 61 55 58 52 53C49 49 49 44 53 39C58 33 67 33 76 38L79 24Z"
          fill="url(#myclaw-brand-gradient)"
        />
        <path
          d="M41 30C47 27 54 27 60 30"
          stroke="#ffd8d8"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M46 87L55 68"
          stroke="#ffccd4"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}
