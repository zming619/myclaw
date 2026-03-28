import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "@/lib/db/schema"

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:111111@localhost:5432/myclaw"

type SqlClient = ReturnType<typeof postgres>
type DatabaseClient = ReturnType<typeof drizzle<typeof schema>>

const globalForDatabase = globalThis as typeof globalThis & {
  __myclawSqlClient?: SqlClient
  __myclawDbClient?: DatabaseClient
}

export function getSqlClient() {
  if (!globalForDatabase.__myclawSqlClient) {
    globalForDatabase.__myclawSqlClient = postgres(databaseUrl, {
      prepare: false,
      max: 5,
    })
  }

  return globalForDatabase.__myclawSqlClient
}

export function getDb() {
  if (!globalForDatabase.__myclawDbClient) {
    globalForDatabase.__myclawDbClient = drizzle(getSqlClient(), {
      schema,
    })
  }

  return globalForDatabase.__myclawDbClient
}

