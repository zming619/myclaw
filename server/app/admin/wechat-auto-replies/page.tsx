import { MessageSquareTextIcon, UsersIcon } from "lucide-react"

import { PageHeader } from "@/components/admin/page-header"
import { Badge } from "@/components/ui/badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDateTime, formatTokenCount } from "@/lib/format"
import { listWechatAutoReplyRecords } from "@/lib/wechat-auto-replies/store"

export const dynamic = "force-dynamic"

export default async function WechatAutoRepliesPage() {
  const records = await listWechatAutoReplyRecords()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="微信自动回复"
        description="展示自动回复流水，后续 Electron 和 RPA 写回的消息也会统一进这张表，用于审计、复盘和效果分析。"
        badge={`${records.length} 条记录`}
      />

      {records.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessageSquareTextIcon />
            </EmptyMedia>
            <EmptyTitle>还没有自动回复记录</EmptyTitle>
            <EmptyDescription>
              当 Electron 调用服务端接口并完成自动回复后，这里会出现用户/群消息、模型、Token 和回复结果。
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>来源用户 / 群</TableHead>
                <TableHead>消息内容</TableHead>
                <TableHead>消息时间</TableHead>
                <TableHead>自动回复模型</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>回复内容</TableHead>
                <TableHead>回复时间</TableHead>
                <TableHead>记录添加时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="align-top">
                    <div className="flex flex-col gap-2">
                      <div className="font-medium">{record.sourceName}</div>
                      <Badge
                        variant={
                          record.sourceType === "group" ? "secondary" : "outline"
                        }
                      >
                        {record.sourceType === "group" ? (
                          <>
                            <UsersIcon data-icon="inline-start" />
                            群聊
                          </>
                        ) : (
                          "用户"
                        )}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-sm align-top text-sm text-muted-foreground">
                    {record.messageContent}
                  </TableCell>
                  <TableCell className="align-top text-sm text-muted-foreground">
                    {formatDateTime(record.messageTime)}
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-col gap-2">
                      <span className="font-mono text-xs">{record.autoReplyModel}</span>
                      {record.taskExecutions.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {record.taskExecutions.map((taskExecution) => (
                            <Badge
                              key={`${record.id}-${taskExecution.id ?? taskExecution.taskType}`}
                              variant={
                                taskExecution.taskStatus === "succeeded"
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {taskExecution.taskTitle}
                              {" · "}
                              {taskExecution.taskStatus === "succeeded"
                                ? "成功"
                                : taskExecution.taskStatus === "needs_clarification"
                                  ? "待补充"
                                  : "失败"}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="align-top font-mono text-xs text-muted-foreground">
                    {formatTokenCount(
                      record.totalTokens,
                      record.promptTokens,
                      record.completionTokens
                    )}
                  </TableCell>
                  <TableCell className="max-w-sm align-top text-sm text-muted-foreground">
                    {record.replyContent || "未记录"}
                  </TableCell>
                  <TableCell className="align-top text-sm text-muted-foreground">
                    {formatDateTime(record.replyTime)}
                  </TableCell>
                  <TableCell className="align-top text-sm text-muted-foreground">
                    {formatDateTime(record.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
