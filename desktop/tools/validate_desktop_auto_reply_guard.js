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
  const targetName = process.argv[2] || '鲲鹏'
  const userDataDir = join(tmpdir(), `myclaw-desktop-guard-${Date.now()}`)
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

  await store.start()

  store.enqueueTask({
    templateId: 'auto_reply',
    source: 'manual',
    name: `微信自动回复守护 · ${targetName}`,
    payload: {
      enabled: true,
      targetName,
      targetKind: 'contact',
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

  const startedTask = await waitFor(() => {
    const snapshot = store.getSnapshot()
    const task = snapshot.queue.find((item) => item.templateId === 'auto_reply')
    if (!task) {
      return null
    }
    if (task.status === 'running' || task.backgroundActive) {
      return task
    }
    return null
  }, 30_000)

  const startedSnapshot = store.getSnapshot()
  let stoppedSnapshot = null

  if (startedTask) {
    store.stopTask(startedTask.id)
    await waitFor(() => {
      const snapshot = store.getSnapshot()
      return snapshot.queue.find((task) => task.id === startedTask.id)?.status === 'stopped'
        ? snapshot
        : null
    }, 10_000)
    stoppedSnapshot = store.getSnapshot()
  }

  store.stop()

  console.log(
    JSON.stringify(
      {
        targetName,
        userDataDir,
        afterCreate: {
          activeAutoReplyTaskId: startedSnapshot.activeAutoReplyTaskId,
          activeTask: startedTask
            ? {
                id: startedTask.id,
                status: startedTask.status,
                backgroundActive: startedTask.backgroundActive,
                result: startedTask.result,
              }
            : null,
        },
        afterStop: stoppedSnapshot
          ? {
              activeAutoReplyTaskId: stoppedSnapshot.activeAutoReplyTaskId,
              task: startedTask
                ? stoppedSnapshot.queue.find((task) => task.id === startedTask.id) || null
                : null,
            }
          : null,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
