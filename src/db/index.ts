import postgres, { type Sql } from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

let client: Sql | undefined;
let database: PostgresJsDatabase<typeof schema> | undefined;

export function getDb(): PostgresJsDatabase<typeof schema> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");
  if (!client || !database) {
    client = postgres(connectionString, {
      max: 1,
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: connectionString.includes("localhost") ? false : "require",
    });
    database = drizzle(client, { schema });
  }
  return database;
}
