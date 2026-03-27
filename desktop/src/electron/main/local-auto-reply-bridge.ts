import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFileSync } from 'node:fs'
import { extname } from 'node:path'
import type { AddressInfo } from 'node:net'
import {
  ServerAutoReplyService,
  type WechatAutoReplyRequest,
} from './server-auto-reply'
import {
  ServerComputerUseService,
  type WechatComputerUseReadResponse,
} from './server-computer-use'

function readJsonBody(request: IncomingMessage) {
  return new Promise<unknown>((resolve, reject) => {
    let raw = ''

    request.setEncoding('utf8')
    request.on('data', (chunk: string) => {
      raw += chunk
    })
    request.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch (error) {
        reject(error)
      }
    })
    request.on('error', (error) => {
      reject(error)
    })
  })
}

function writeJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(JSON.stringify(payload))
}

function inferImageMimeType(path: string) {
  const ext = extname(path).toLowerCase()
  if (ext === '.jpg' || ext === '.jpeg') {
    return 'image/jpeg'
  }
  if (ext === '.webp') {
    return 'image/webp'
  }
  return 'image/png'
}

function fileToDataUrl(path: string) {
  const mimeType = inferImageMimeType(path)
  const buffer = readFileSync(path)
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}

interface WechatComputerUseBridgeRequest {
  screenshotPath: string
  sourceHint?: string
  sourceTypeHint?: 'user' | 'group'
  deviceId?: string
  deviceAlias?: string
}

export class LocalAutoReplyBridge {
  private server?: ReturnType<typeof createServer>
  private baseUrl = ''

  constructor(
    private readonly autoReplyUpstream: ServerAutoReplyService,
    private readonly computerUseUpstream: ServerComputerUseService,
    private readonly host = '127.0.0.1',
    private readonly port = Number(process.env.MYCLAW_LOCAL_BRIDGE_PORT || 0),
  ) {}

  async start() {
    if (this.server && this.baseUrl) {
      return this.baseUrl
    }

    this.server = createServer(async (request, response) => {
      try {
        if (request.method === 'GET' && request.url === '/health') {
          writeJson(response, 200, {
            ok: true,
            bridgeUrl: this.baseUrl,
            upstreamUrl: this.autoReplyUpstream.getBaseUrl(),
            computerUseUpstreamUrl: this.computerUseUpstream.getBaseUrl(),
          })
          return
        }

        if (request.method === 'POST' && request.url === '/wechat-auto-reply') {
          const body = (await readJsonBody(request)) as WechatAutoReplyRequest
          const data = await this.autoReplyUpstream.requestReply(body)
          writeJson(response, 200, { data })
          return
        }

        if (request.method === 'POST' && request.url === '/computer-use/wechat/read-messages') {
          const body = (await readJsonBody(request)) as WechatComputerUseBridgeRequest
          const data: WechatComputerUseReadResponse =
            await this.computerUseUpstream.readWechatConversation({
              screenshotDataUrl: fileToDataUrl(body.screenshotPath),
              sourceHint: body.sourceHint,
              sourceTypeHint: body.sourceTypeHint,
              deviceId: body.deviceId,
              deviceAlias: body.deviceAlias,
            })
          writeJson(response, 200, { data })
          return
        }

        writeJson(response, 404, {
          error: 'Not found',
        })
      } catch (error) {
        writeJson(response, 500, {
          error: error instanceof Error ? error.message : '本地自动回复桥执行失败',
        })
      }
    })

    await new Promise<void>((resolve, reject) => {
      this.server?.once('error', reject)
      this.server?.listen(this.port, this.host, () => {
        this.server?.off('error', reject)
        resolve()
      })
    })

    const address = this.server.address() as AddressInfo | null
    if (!address) {
      throw new Error('本地自动回复桥启动失败，未获取到监听地址。')
    }

    this.baseUrl = `http://${this.host}:${address.port}`
    return this.baseUrl
  }

  getBaseUrl() {
    return this.baseUrl
  }

  stop() {
    if (!this.server) {
      return
    }

    const active = this.server
    this.server = undefined
    this.baseUrl = ''
    active.close()
  }
}
