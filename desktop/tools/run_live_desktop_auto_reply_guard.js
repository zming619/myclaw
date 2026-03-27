const { mkdirSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join, resolve } = require('node:path')
const { DesktopStore } = require('../out/electron/main/store.js')

function sleep(ms) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms)
  })
}

async function waitFor(predicate, timeoutMs, intervalMs = 500) {
  const startedAt = Date.now()
  while (Date.now() - startedAt <= timeoutMs) {
    const value = predicate()
    if (value) {
      return value
    }
    await sleep(intervalMs)
  }
  return null
}

async function main() {
  const targetName = process.argv[2] || '吉米哥'
  const targetKind = process.argv[3] === 'group' ? 'group' : 'contact'
  const userDataDir = join(tmpdir(), `myclaw-live-desktop-guard-${Date.now()}`)
  const projectRoot = resolve(__dirname, '..')
  mkdirSync(userDataDir, { recursive: true })
  writeFileSync(
    join(userDataDir, 'desktop-state.json'),
    JSON.stringify(
      {
        device: {
          id: 'dev-xingyun-01',
          alias: '星云执行器-01',
          workspace: '华东增长组',
          operatorName: '小云',
          bindCode: 'XINGYUN-3817',
          autoPolling: false,
          autoReply: false,
        },
        autoReplyPayload: {},
        autoReplyConfigured: false,
        activeAutoReplyTaskId: null,
        queue: [],
        inbox: [],
        activityFeed: [],
      },
      null,
      2,
    ),
  )
  const store = new DesktopStore(userDataDir, projectRoot)

  let stopped = false

  async function shutdown(reason) {
    if (stopped) {
      return
    }
    stopped = true

    try {
      const snapshot = store.getSnapshot()
      if (snapshot.activeAutoReplyTaskId) {
        store.stopTask(snapshot.activeAutoReplyTaskId)
        await sleep(600)
      }
      store.stop()
      const stoppedSnapshot = store.getSnapshot()
      console.log(
        JSON.stringify(
          {
            status: 'stopped',
            reason,
            targetName,
            userDataDir,
            activeAutoReplyTaskId: stoppedSnapshot.activeAutoReplyTaskId,
            queue: stoppedSnapshot.queue.slice(0, 3).map((task) => ({
              id: task.id,
              name: task.name,
              status: task.status,
              backgroundActive: task.backgroundActive,
              result: task.result,
            })),
          },
          null,
          2,
        ),
      )
    } finally {
      process.exit(0)
    }
  }

  process.on('SIGINT', () => {
    void shutdown('sigint')
  })
  process.on('SIGTERM', () => {
    void shutdown('sigterm')
  })

  await store.start()

  store.enqueueTask({
    templateId: 'auto_reply',
    source: 'manual',
    name: `微信自动回复守护 · ${targetName}`,
    payload: {
      enabled: true,
      targetName,
      targetKind,
      welcome: '你好，我是小云，先把你的需求发我，我来帮你安排。',
      fallbackReply: '我先帮你记下需求，稍后给你一个明确回复。',
      keywordReplies: {
        在吗: '我在，直接说你的问题就行。',
      },
      readMode: 'computer_use',
      pollIntervalSeconds: 4,
      duplicateCooldownSeconds: 600,
      maxUnreadSessions: 1,
      bootstrapOnly: true,
      dryRun: false,
    },
  })

  const activeTask = await waitFor(() => {
    const snapshot = store.getSnapshot()
    if (!snapshot.activeAutoReplyTaskId) {
      return null
    }
    const task = snapshot.queue.find((item) => item.id === snapshot.activeAutoReplyTaskId)
    if (!task || !task.backgroundActive) {
      return null
    }
    return task
  }, 30_000)

  if (!activeTask) {
    await shutdown('guard_not_started')
    return
  }

  console.log(
    JSON.stringify(
      {
        status: 'started',
        targetName,
        targetKind,
        userDataDir,
        activeAutoReplyTaskId: activeTask.id,
        task: {
          id: activeTask.id,
          status: activeTask.status,
          backgroundActive: activeTask.backgroundActive,
          result: activeTask.result,
          artifacts: activeTask.artifacts || {},
        },
      },
      null,
      2,
    ),
  )

  setInterval(() => {
    const snapshot = store.getSnapshot()
    const task = snapshot.activeAutoReplyTaskId
      ? snapshot.queue.find((item) => item.id === snapshot.activeAutoReplyTaskId) || null
      : null

    console.log(
      JSON.stringify(
        {
          status: 'heartbeat',
          targetName,
          activeAutoReplyTaskId: snapshot.activeAutoReplyTaskId,
          task: task
            ? {
                id: task.id,
                status: task.status,
                backgroundActive: task.backgroundActive,
                result: task.result,
                logs: task.logs.slice(-4),
              }
            : null,
        },
        null,
        2,
      ),
    )
  }, 20_000)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
