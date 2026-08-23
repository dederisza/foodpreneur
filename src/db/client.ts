import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

/**
 * Database driver: Node's built-in `node:sqlite` module (stable in Node 22+),
 * wired into Drizzle via the `sqlite-proxy` driver.
 *
 * Why not `better-sqlite3`? It requires native compilation (`node-gyp`)
 * whenever a `package-lock.json` is present (a long-standing npm quirk
 * where the package's `"gypfile": false` setting is not honored on
 * lockfile-based installs), and that compilation step needs to download
 * Node headers from `nodejs.org` — a domain outside this sandbox's
 * network allowlist, and plausibly outside other restricted or offline
 * environments this project may be exported to. `node:sqlite` ships
 * inside Node itself, so there is nothing to compile or download, ever.
 * This was verified by reproducing the failure across multiple clean
 * `npm ci` / `npm install` runs before switching drivers — see
 * PHASE1_VERIFICATION.md for the full investigation.
 *
 * NOTE: `node:sqlite` is still flagged "experimental" by Node (it logs
 * an ExperimentalWarning), but is functionally stable enough for this
 * phase. If Node stabilizes or changes this API in a future LTS, this
 * file is the only place that needs to change.
 */

// NOTE: kept statically scoped to the `data/` folder (rather than an
// arbitrary DATABASE_URL-derived path) so bundlers can correctly trace
// only what's needed instead of tracing the whole project.
const dbFileName = (process.env.DATABASE_URL ?? "file:./data/app.db")
  .replace("file:", "")
  .replace(/^\.?\/?data\//, "");
const dbPath = `./data/${dbFileName}`;

declare global {
  var __sqlite: DatabaseSync | undefined;
}

function openDatabase(): DatabaseSync {
  const resolved = path.resolve(process.cwd(), dbPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const instance = new DatabaseSync(resolved);
  instance.exec("PRAGMA journal_mode = WAL;");
  instance.exec("PRAGMA foreign_keys = ON;");
  return instance;
}

const sqlite = global.__sqlite ?? openDatabase();

if (process.env.NODE_ENV !== "production") {
  global.__sqlite = sqlite;
}

/**
 * Bridges Drizzle's async sqlite-proxy callback interface onto the
 * synchronous node:sqlite API. Rows are returned as plain arrays
 * (column order) rather than objects, which is what Drizzle expects
 * from a proxy driver.
 */
async function proxyCallback(
  sql: string,
  params: unknown[],
  method: "run" | "all" | "values" | "get"
): Promise<{ rows: unknown[] }> {
  const stmt = sqlite.prepare(sql);

  if (method === "run") {
    stmt.run(...(params as never[]));
    return { rows: [] };
  }

  if (method === "get") {
    const row = stmt.get(...(params as never[])) as
      | Record<string, unknown>
      | undefined;
    // IMPORTANT: for "get", Drizzle's sqlite-proxy expects `rows` to BE
    // the single row's column values directly (not wrapped in another
    // array), and expects a falsy value (undefined) — not an empty
    // array — when there's no match. Returning `rows: []` here is
    // truthy, so Drizzle would treat "no row" as "a row with all
    // undefined fields" instead of correctly returning `undefined`.
    return { rows: row ? Object.values(row) : undefined } as {
      rows: unknown[];
    };
  }

  // "all" | "values"
  const rows = stmt.all(...(params as never[])) as Record<string, unknown>[];
  return { rows: rows.map((row) => Object.values(row)) };
}

export const db = drizzle(proxyCallback, { schema });
export { schema, sqlite };
