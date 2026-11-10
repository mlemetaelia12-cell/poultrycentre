import "dotenv/config";
import postgres from "postgres";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is missing. Copy .env.example to .env and configure it.");
  const sql = postgres(url, { max: 1, prepare: false, ssl: url.includes("localhost") ? false : "require" });
  try {
    await sql`CREATE TABLE IF NOT EXISTS _app_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
    const dir = path.join(process.cwd(), "drizzle");
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      const contents = await readFile(path.join(dir, file), "utf8");
      const normalized = contents.replace(/^\s*BEGIN;\s*/i, "").replace(/\s*COMMIT;\s*$/i, "");
      const applied = await sql.begin(async (tx) => {
        await tx`SELECT pg_advisory_xact_lock(741852963)`;
        const exists = await tx`SELECT name FROM _app_migrations WHERE name = ${file}`;
        if (exists.length) return false;
        await tx.unsafe(normalized);
        await tx`INSERT INTO _app_migrations(name) VALUES (${file})`;
        return true;
      });
      console.log(applied ? `Applied: ${file}` : `Already applied: ${file}`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => { console.error(error); process.exit(1); });
