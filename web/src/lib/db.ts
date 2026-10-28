// SQLite database (server only). Replaces the Supabase admin client.
import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const DATA_DIR = path.join(process.cwd(), "data");

export function openDb(file = path.join(DATA_DIR, "moveproof.db")) {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("pragma busy_timeout = 5000; pragma journal_mode = wal; pragma foreign_keys = on;");
  db.exec(readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf8"));
  return db;
}

// One lazily opened connection per server process; survives dev hot reloads.
const g = globalThis as unknown as { __moveproofDb?: DatabaseSync };
export const db = () => (g.__moveproofDb ??= openDb());

export const now = () => new Date().toISOString();
