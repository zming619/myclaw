import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DeviceState, PythonRunnerHealth, QueueTask } from '../../shared/contracts'

function nowIso() {
  return new Date().toISOString()
}

export class DesktopGateway {
  private readonly runtimeDir: string
  private readonly heartbeatPath: string
  private readonly heartbeatLogPath: string
  private readonly taskLogPath: string

  constructor(userDataDir: string) {
    this.runtimeDir = join(userDataDir, 'runtime-gateway')
    this.heartbeatPath = join(this.runtimeDir, 'latest-heartbeat.json')
    this.heartbeatLogPath = join(this.runtimeDir, 'heartbeats.ndjson')
    this.taskLogPath = join(this.runtimeDir, 'task-results.ndjson')
    mkdirSync(this.runtimeDir, { recursive: true })
  }

  reportHeartbeat(input: {
    device: DeviceState
    queueDepth: number
    pendingInbox: number
    runnerHealth: PythonRunnerHealth | null
  }) {
    const payload = {
      reportedAt: nowIso(),
      device: input.device,
      queueDepth: input.queueDepth,
      pendingInbox: input.pendingInbox,
      runnerHealth: input.runnerHealth,
    }

    writeFileSync(this.heartbeatPath, JSON.stringify(payload, null, 2))
    appendFileSync(this.heartbeatLogPath, `${JSON.stringify(payload)}\n`)
  }

  reportTaskResult(task: QueueTask) {
    const payload = {
      reportedAt: nowIso(),
      task,
    }

    appendFileSync(this.taskLogPath, `${JSON.stringify(payload)}\n`)
  }
}
