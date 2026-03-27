import type { AppSnapshot, EnqueueTaskInput } from '../../shared/contracts'
import { knowledgeBase, type KnowledgeDoc } from '../data/knowledgeBase'

export interface AssistantReply {
  content: string
  citations: KnowledgeDoc[]
  suggestion?: {
    label: string
    task: EnqueueTaskInput
  }
}

function scoreDoc(question: string, doc: KnowledgeDoc) {
  return doc.keywords.reduce((score, keyword) => {
    if (question.includes(keyword)) {
      return score + 3
    }
    if (doc.title.includes(keyword) || doc.summary.includes(keyword)) {
      return score + 1
    }
    return score
  }, 0)
}

function findCitations(question: string) {
  const ranked = knowledgeBase
    .map((doc) => ({ doc, score: scoreDoc(question, doc) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((item) => item.doc)

  return ranked.length ? ranked : knowledgeBase.slice(0, 2)
}

function pickSuggestion(question: string): EnqueueTaskInput | null {
  if (question.includes('群发') || (question.includes('微信') && question.includes('消息'))) {
    return {
      templateId: 'broadcast_message',
      payload: {
        targetTags: ['高意向', '未成交'],
        content: question,
      },
      source: 'ai',
      name: 'AI 建议 · 智能群发',
    }
  }

  if (question.includes('发布') && question.includes('视频')) {
    return {
      templateId: 'publish_video',
      payload: {
        title: question,
        platforms: ['抖音', '快手', '小红书'],
      },
      source: 'ai',
      name: 'AI 建议 · 矩阵发布',
    }
  }

  if (question.includes('自动回复') || question.includes('客服')) {
    return {
      templateId: 'auto_reply',
      payload: {
        enabled: true,
        strategy: 'AI+知识库',
      },
      source: 'ai',
      name: 'AI 建议 · 自动回复',
    }
  }

  if (question.includes('获客') || question.includes('评论区') || question.includes('私信')) {
    return {
      templateId: 'lead_capture',
      payload: {
        keywords: ['合作', '多少钱', '怎么做'],
        maxTargets: 50,
      },
      source: 'ai',
      name: 'AI 建议 · 公域获客',
    }
  }

  if (question.includes('SOP')) {
    return {
      templateId: 'push_sop',
      payload: {
        sopId: 'sop-levelup-03',
        customerTags: ['已咨询'],
      },
      source: 'ai',
      name: 'AI 建议 · SOP 推送',
    }
  }

  if (question.includes('激活') || question.includes('沉默客户')) {
    return {
      templateId: 'activate_customers',
      payload: {
        targetTags: ['30日沉默'],
        campaign: '回流唤醒计划',
      },
      source: 'ai',
      name: 'AI 建议 · 主动激活',
    }
  }

  return null
}

export function buildAssistantReply(question: string, snapshot: AppSnapshot): AssistantReply {
  const citations = findCitations(question)
  const suggestion = pickSuggestion(question)
  const queued = snapshot.queue.filter(
    (task) => task.status === 'queued' || task.status === 'running',
  ).length

  const parts = [
    `我先从知识库命中了「${citations.map((item) => item.title).join(' / ')}」。`,
    `当前设备 ${snapshot.device.alias} 在线，队列中还有 ${queued} 条任务，${snapshot.device.autoPolling ? '远程轮询已开启' : '远程轮询当前关闭'}。`,
    `${citations[0].content}`,
  ]

  if (suggestion) {
    parts.push('这类需求已经能落到 MyClaw Desktop，我建议直接生成一条可执行任务并加入队列。')
  } else {
    parts.push('如果你想让我直接生成任务，描述里补上平台、动作和目标对象就够了。')
  }

  return {
    content: parts.join('\n\n'),
    citations,
    suggestion: suggestion
      ? {
          label: '把这条建议加入桌面队列',
          task: suggestion,
        }
      : undefined,
  }
}
