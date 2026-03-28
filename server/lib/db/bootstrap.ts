import { getSqlClient } from "@/lib/db/client"

let bootstrapPromise: Promise<void> | null = null

async function initializeSchema() {
  const sql = getSqlClient()

  await sql`create extension if not exists vector`

  await sql`
    create table if not exists settings (
      id bigserial primary key,
      title varchar(255) not null,
      k varchar(191) not null unique,
      v text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `

  await sql`
    create index if not exists settings_created_at_idx
    on settings (created_at desc)
  `

  await sql`
    create table if not exists wechat_auto_reply_records (
      id bigserial primary key,
      source_type varchar(24) not null,
      source_name varchar(255) not null,
      message_content text not null,
      message_time timestamptz not null,
      auto_reply_model varchar(128) not null,
      prompt_tokens integer,
      completion_tokens integer,
      total_tokens integer,
      reply_content text,
      reply_time timestamptz,
      created_at timestamptz not null default now()
    )
  `

  await sql`
    create index if not exists wechat_auto_reply_records_created_at_idx
    on wechat_auto_reply_records (created_at desc)
  `

  await sql`
    create index if not exists wechat_auto_reply_records_message_time_idx
    on wechat_auto_reply_records (message_time desc)
  `

  await sql`
    create table if not exists wechat_auto_reply_task_executions (
      id bigserial primary key,
      record_id bigint not null references wechat_auto_reply_records(id) on delete cascade,
      task_type varchar(64) not null,
      task_status varchar(24) not null,
      task_title varchar(255) not null,
      task_input jsonb not null default '{}'::jsonb,
      task_output jsonb not null default '{}'::jsonb,
      error_message text,
      started_at timestamptz not null,
      finished_at timestamptz,
      created_at timestamptz not null default now()
    )
  `

  await sql`
    create index if not exists wechat_auto_reply_task_executions_record_id_idx
    on wechat_auto_reply_task_executions (record_id)
  `

  await sql`
    create index if not exists wechat_auto_reply_task_executions_created_at_idx
    on wechat_auto_reply_task_executions (created_at desc)
  `

  await sql`
    create index if not exists wechat_auto_reply_task_executions_task_type_idx
    on wechat_auto_reply_task_executions (task_type)
  `

  await sql`
    create table if not exists rag_knowledge_bases (
      id bigserial primary key,
      title varchar(255) not null,
      slug varchar(191) not null unique,
      description text,
      embedding_provider varchar(64),
      embedding_model varchar(128),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `

  await sql`
    create table if not exists rag_documents (
      id bigserial primary key,
      knowledge_base_id integer not null references rag_knowledge_bases(id) on delete cascade,
      title varchar(255) not null,
      source varchar(255),
      content text not null,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `

  await sql`
    create index if not exists rag_documents_knowledge_base_idx
    on rag_documents (knowledge_base_id)
  `

  await sql`
    create table if not exists rag_chunks (
      id bigserial primary key,
      knowledge_base_id integer not null references rag_knowledge_bases(id) on delete cascade,
      document_id integer not null references rag_documents(id) on delete cascade,
      content text not null,
      chunk_index integer not null,
      metadata jsonb not null default '{}'::jsonb,
      embedding vector,
      created_at timestamptz not null default now()
    )
  `

  await sql`
    create index if not exists rag_chunks_document_idx
    on rag_chunks (document_id)
  `

  await sql`
    create index if not exists rag_chunks_knowledge_base_idx
    on rag_chunks (knowledge_base_id)
  `
}

export async function ensureAppDatabase() {
  if (!bootstrapPromise) {
    bootstrapPromise = initializeSchema()
  }

  return bootstrapPromise
}
