import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { DeviceState, QueueTask, PythonRunnerHealth, RunnerMode } from '../../shared/contracts'

export interface PythonRunnerEvent {
  type: 'run_started' | 'step_started' | 'step_completed' | 'run_completed' | 'run_failed'
  message: string
  progress?: number
  stepId?: string
  engineMode?: RunnerMode
  artifacts?: Record<string, unknown>
  summary?: string
}

export interface PythonRunnerResult {
  status: 'completed' | 'failed'
  summary: string
  engineMode: RunnerMode
  artifacts: Record<string, unknown>
}

interface TaskEnvelope {
  taskId: string
  templateId: string
  taskName: string
  sopCode: string
  platforms: string[]
  payload: Record<string, unknown>
  rawCommand?: string
  device: DeviceState
}

export class PythonRpaService {
  private readonly pythonBinary: string
  private readonly rpaRoot: string
  private runtimeEnv: Record<string, string> = {}
  private currentChild: ReturnType<typeof spawn> | null = null

  constructor(projectRoot: string) {
    this.rpaRoot = join(projectRoot, 'rpa')
    this.pythonBinary = this.resolvePythonBinary()
  }

  setRuntimeEnv(nextEnv: Record<string, string>) {
    this.runtimeEnv = Object.fromEntries(
      Object.entries({
        ...this.runtimeEnv,
        ...nextEnv,
      }).filter((entry): entry is [string, string] => Boolean(entry[0] && entry[1])),
    )
  }

  async doctor(): Promise<PythonRunnerHealth> {
    if (!existsSync(this.rpaRoot)) {
      return {
        ok: false,
        mode: 'mock',
        pythonBinary: this.pythonBinary,
        capabilities: [],
        detail: `RPA 目录不存在：${this.rpaRoot}`,
      }
    }

    try {
      const output = await this.runCommand(['-m', 'nebula_rpa.cli', 'doctor'])
      const parsed = JSON.parse(output.stdout.trim()) as PythonRunnerHealth
      return parsed
    } catch (error) {
      return {
        ok: false,
        mode: 'mock',
        pythonBinary: this.pythonBinary,
        capabilities: [],
        detail: error instanceof Error ? error.message : 'RPA 引擎巡检失败',
      }
    }
  }

  async executeTask(
    task: QueueTask,
    device: DeviceState,
    onEvent: (event: PythonRunnerEvent) => void,
  ): Promise<PythonRunnerResult> {
    if (!existsSync(this.rpaRoot)) {
      throw new Error(`RPA 目录不存在：${this.rpaRoot}`)
    }

    const envelope: TaskEnvelope = {
      taskId: task.id,
      templateId: task.templateId,
      taskName: task.name,
      sopCode: task.sopCode,
      platforms: task.platforms,
      payload: task.payload,
      rawCommand: task.rawCommand,
      device,
    }

    return new Promise<PythonRunnerResult>((resolve, reject) => {
      const child = spawn(this.pythonBinary, ['-m', 'nebula_rpa.cli', 'execute'], {
        cwd: this.rpaRoot,
        env: {
          ...process.env,
          ...this.runtimeEnv,
          PYTHONIOENCODING: 'utf-8',
          MYCLAW_RPA_HEADLESS: process.env.MYCLAW_RPA_HEADLESS || '0',
        },
      })
      this.currentChild = child

      let stdoutBuffer = ''
      let stderrBuffer = ''
      let completedResult: PythonRunnerResult | null = null
      let failureMessage: string | null = null

      child.stdout.on('data', (chunk: Buffer) => {
        stdoutBuffer += chunk.toString('utf8')

        let lineBreak = stdoutBuffer.indexOf('\n')
        while (lineBreak >= 0) {
          const line = stdoutBuffer.slice(0, lineBreak).trim()
          stdoutBuffer = stdoutBuffer.slice(lineBreak + 1)
          if (line) {
            this.handleStdoutLine(
              line,
              onEvent,
              (result) => {
                completedResult = result
              },
              (message) => {
                failureMessage = message
              },
            )
          }
          lineBreak = stdoutBuffer.indexOf('\n')
        }
      })

      child.stderr.on('data', (chunk: Buffer) => {
        stderrBuffer += chunk.toString('utf8')
      })

      child.on('error', (error) => {
        reject(error)
      })

      child.on('close', (code) => {
        if (this.currentChild === child) {
          this.currentChild = null
        }
        if (code === 0 && completedResult) {
          resolve(completedResult)
          return
        }

        if (code === 0 && !completedResult) {
          resolve({
            status: 'completed',
            summary: 'Python RPA 已执行，但未返回结构化结果。',
            engineMode: 'mock',
            artifacts: {},
          })
          return
        }

        reject(
          new Error(
            failureMessage ||
            stderrBuffer.trim() ||
              `Python RPA 执行失败，退出码 ${code ?? 'unknown'}`,
          ),
        )
      })

      child.stdin.write(JSON.stringify(envelope))
      child.stdin.end()
    })
  }

  stopCurrentTask() {
    if (!this.currentChild || this.currentChild.killed) {
      return false
    }

    this.currentChild.kill('SIGTERM')
    return true
  }

  private handleStdoutLine(
    line: string,
    onEvent: (event: PythonRunnerEvent) => void,
    onCompleted: (result: PythonRunnerResult) => void,
    onFailed: (message: string) => void,
  ) {
    try {
      const event = JSON.parse(line) as PythonRunnerEvent
      onEvent(event)

      if (event.type === 'run_completed') {
        onCompleted({
          status: 'completed',
          summary: event.summary || event.message,
          engineMode: event.engineMode || 'mock',
          artifacts: event.artifacts || {},
        })
      }
      if (event.type === 'run_failed') {
        onFailed(event.message)
      }
      return
    } catch {
      onEvent({
        type: 'step_completed',
        message: line,
      })
    }
  }

  private runCommand(args: string[]) {
    return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const child = spawn(this.pythonBinary, args, {
        cwd: this.rpaRoot,
        env: {
          ...process.env,
          ...this.runtimeEnv,
          PYTHONIOENCODING: 'utf-8',
          MYCLAW_RPA_HEADLESS: process.env.MYCLAW_RPA_HEADLESS || '0',
        },
      })

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8')
      })

      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8')
      })

      child.on('error', (error) => {
        reject(error)
      })

      child.on('close', (code) => {
        if (this.currentChild === child) {
          this.currentChild = null
        }
        if (code === 0) {
          resolve({ stdout, stderr })
          return
        }

        reject(new Error(stderr.trim() || `Python 命令失败，退出码 ${code ?? 'unknown'}`))
      })
    })
  }

  private resolvePythonBinary() {
    const preferred = process.env.MYCLAW_PYTHON_BIN
    if (preferred) {
      return preferred
    }

    const venvUnix = join(this.rpaRoot, '.venv', 'bin', 'python3')
    const venvWindows = join(this.rpaRoot, '.venv', 'Scripts', 'python.exe')

    if (existsSync(venvUnix)) {
      return venvUnix
    }

    if (existsSync(venvWindows)) {
      return venvWindows
    }

    return 'python3'
  }
}
