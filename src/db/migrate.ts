/**
 * Applies all pending Drizzle migrations to the local SQLite database.
 * Run with: npm run db:migrate
 *
 * Uses the sqlite-proxy migrator so this stays consistent with the
 * node:sqlite-backed client in client.ts (see the comment there for why
 * better-sqlite3 was replaced).
 */
import "dotenv/config";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { migrate } from "drizzle-orm/sqlite-proxy/migrator";
import path from "path";
import fs from "fs";

const dbFileName = (process.env.DATABASE_URL ?? "file:./data/app.db")
  .replace("file:", "")
  .replace(/^\.?\/?data\//, "");
const resolvedPath = path.resolve(process.cwd(), `./data/${dbFileName}`);

fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

const sqlite = new DatabaseSync(resolvedPath);
sqlite.exec("PRAGMA foreign_keys = ON;");

async function proxyCallback(
  sql: string,
  params: unknown[],
  method: "run" | "all" | "values" | "get"
) {
  const stmt = sqlite.prepare(sql);
  if (method === "run") {
    stmt.run(...(params as never[]));
    return { rows: [] };
  }
  if (method === "get") {
    const row = stmt.get(...(params as never[])) as
      | Record<string, unknown>
      | undefined;
    return { rows: row ? Object.values(row) : undefined } as {
      rows: unknown[];
    };
  }
  const rows = stmt.all(...(params as never[])) as Record<string, unknown>[];
  return { rows: rows.map((r) => Object.values(r)) };
}

const db = drizzle(proxyCallback);

async function main() {
  await migrate(
    db,
    async (queries) => {
      for (const query of queries) {
        sqlite.exec(query);
      }
    },
    { migrationsFolder: path.resolve(process.cwd(), "src/db/migrations") }
  );
  console.log(`Migrations applied to ${resolvedPath}`);
  sqlite.close();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
