export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'stopped'
export type TaskSource = 'mobile' | 'manual' | 'ai'
export type SettingKey = 'autoPolling' | 'autoReply'
export type RunnerMode = 'mock' | 'hybrid' | 'live'

export interface DeviceState {
  id: string
  alias: string
  workspace: string
  operatorName: string
  bindCode: string
  online: boolean
  heartbeatAt: string
  cpuLoad: number
  memoryUsage: number
  autoPolling: boolean
  autoReply: boolean
  version: string
  os: string
}

export interface MetricCard {
  label: string
  value: string
  detail: string
  tone: 'neutral' | 'accent' | 'success' | 'warning'
}

export interface CommandTemplate {
  id: string
  name: string
  description: string
  category: string
  estimatedSeconds: number
  sopCode: string
  platforms: string[]
  payloadTemplate: Record<string, unknown>
}

export interface QueueTask {
  id: string
  templateId: string
  sopCode: string
  name: string
  source: TaskSource
  status: TaskStatus
  progress: number
  createdAt: string
  updatedAt: string
  platforms: string[]
  payload: Record<string, unknown>
  rawCommand?: string
  result?: string
  engineMode?: 'mock' | 'hybrid' | 'live'
  backgroundActive?: boolean
  artifacts?: Record<string, unknown>
  logs: string[]
}

export interface RemoteCommand {
  id: string
  raw: string
  status: 'pending' | 'ingested' | 'rejected'
  createdAt: string
  detail: string
}

export interface WorkflowStep {
  id: string
  time: string
  title: string
  status: 'done' | 'running' | 'pending'
  detail: string
}

export interface ModuleCard {
  id: string
  name: string
  description: string
  accent: string
}

export interface MacWechatHealth {
  available: boolean
  detail: string
  reason: string
  appPath?: string
  appName?: string
  processName?: string
  osascriptPath?: string
}

export interface PythonRunnerHealth {
  ok: boolean
  mode: RunnerMode
  pythonBinary: string
  capabilities: string[]
  detail: string
  liveRequested?: boolean
  wechat?: MacWechatHealth
}

export interface AppSnapshot {
  device: DeviceState
  metrics: MetricCard[]
  templates: CommandTemplate[]
  queue: QueueTask[]
  inbox: RemoteCommand[]
  workflow: WorkflowStep[]
  modules: ModuleCard[]
  runnerHealth: PythonRunnerHealth | null
  activityFeed: string[]
  autoReplyPayload: Record<string, unknown>
  activeAutoReplyTaskId: string | null
}

export interface EnqueueTaskInput {
  templateId: string
  payload?: Record<string, unknown>
  source?: TaskSource
  name?: string
  rawCommand?: string
}

export interface BindDeviceInput {
  alias: string
  workspace: string
  operatorName: string
}

export interface DesktopBridge {
  getSnapshot: () => Promise<AppSnapshot>
  subscribe: (listener: (snapshot: AppSnapshot) => void) => () => void
  enqueueTask: (input: EnqueueTaskInput) => Promise<AppSnapshot>
  stopTask: (taskId: string) => Promise<AppSnapshot>
  copyText: (value: string) => Promise<boolean>
  pushRemoteCommand: (raw: string) => Promise<AppSnapshot>
  updateDevice: (input: BindDeviceInput) => Promise<AppSnapshot>
  toggleSetting: (key: SettingKey, value: boolean) => Promise<AppSnapshot>
  rerunDoctor: () => Promise<AppSnapshot>
  clearHistory: () => Promise<AppSnapshot>
}
