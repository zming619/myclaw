import { sql } from "drizzle-orm"
import {
  bigserial,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
  customType,
} from "drizzle-orm/pg-core"

const vector = customType<{
  data: number[] | null
  driverData: string | null
}>({
  dataType() {
    return "vector"
  },
  toDriver(value) {
    if (!value?.length) {
      return null
    }

    return `[${value.join(",")}]`
  },
})

export const settings = pgTable(
  "settings",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    k: varchar("k", { length: 191 }).notNull(),
    v: text("v").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("settings_k_unique").on(table.k),
    index("settings_created_at_idx").on(table.createdAt),
  ]
)

export const wechatAutoReplyRecords = pgTable(
  "wechat_auto_reply_records",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sourceType: varchar("source_type", { length: 24 }).notNull(),
    sourceName: varchar("source_name", { length: 255 }).notNull(),
    messageContent: text("message_content").notNull(),
    messageTime: timestamp("message_time", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    autoReplyModel: varchar("auto_reply_model", { length: 128 }).notNull(),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    totalTokens: integer("total_tokens"),
    replyContent: text("reply_content"),
    replyTime: timestamp("reply_time", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("wechat_auto_reply_records_created_at_idx").on(table.createdAt),
    index("wechat_auto_reply_records_message_time_idx").on(table.messageTime),
  ]
)

export const wechatAutoReplyTaskExecutions = pgTable(
  "wechat_auto_reply_task_executions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    recordId: integer("record_id")
      .notNull()
      .references(() => wechatAutoReplyRecords.id, {
        onDelete: "cascade",
      }),
    taskType: varchar("task_type", { length: 64 }).notNull(),
    taskStatus: varchar("task_status", { length: 24 }).notNull(),
    taskTitle: varchar("task_title", { length: 255 }).notNull(),
    taskInput: jsonb("task_input")
      .default(sql`'{}'::jsonb`)
      .notNull(),
    taskOutput: jsonb("task_output")
      .default(sql`'{}'::jsonb`)
      .notNull(),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    finishedAt: timestamp("finished_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("wechat_auto_reply_task_executions_record_id_idx").on(table.recordId),
    index("wechat_auto_reply_task_executions_created_at_idx").on(table.createdAt),
    index("wechat_auto_reply_task_executions_task_type_idx").on(table.taskType),
  ]
)

export const ragKnowledgeBases = pgTable(
  "rag_knowledge_bases",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 191 }).notNull(),
    description: text("description"),
    embeddingProvider: varchar("embedding_provider", { length: 64 }),
    embeddingModel: varchar("embedding_model", { length: 128 }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("rag_knowledge_bases_slug_unique").on(table.slug),
    index("rag_knowledge_bases_created_at_idx").on(table.createdAt),
  ]
)

export const ragDocuments = pgTable(
  "rag_documents",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    knowledgeBaseId: integer("knowledge_base_id")
      .notNull()
      .references(() => ragKnowledgeBases.id, {
        onDelete: "cascade",
      }),
    title: varchar("title", { length: 255 }).notNull(),
    source: varchar("source", { length: 255 }),
    content: text("content").notNull(),
    metadata: jsonb("metadata")
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("rag_documents_knowledge_base_idx").on(table.knowledgeBaseId),
    index("rag_documents_created_at_idx").on(table.createdAt),
  ]
)

export const ragChunks = pgTable(
  "rag_chunks",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    knowledgeBaseId: integer("knowledge_base_id")
      .notNull()
      .references(() => ragKnowledgeBases.id, {
        onDelete: "cascade",
      }),
    documentId: integer("document_id")
      .notNull()
      .references(() => ragDocuments.id, {
        onDelete: "cascade",
      }),
    content: text("content").notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    metadata: jsonb("metadata")
      .default(sql`'{}'::jsonb`)
      .notNull(),
    embedding: vector("embedding"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("rag_chunks_document_idx").on(table.documentId),
    index("rag_chunks_knowledge_base_idx").on(table.knowledgeBaseId),
  ]
)
