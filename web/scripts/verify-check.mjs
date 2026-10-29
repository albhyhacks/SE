// Recompute a report's hash straight from the SQLite file (same rules as src/lib/hash.ts, SPEC §6).
// Usage: node scripts/verify-check.mjs <reportId>     (MOVEPROOF_DATA_DIR overrides ./data)
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import path from "node:path";

const reportId = process.argv[2];
if (!reportId) { console.error("usage: node scripts/verify-check.mjs <reportId>"); process.exit(2); }
const dir = process.env.MOVEPROOF_DATA_DIR || path.join(process.cwd(), "data");
const db = new DatabaseSync(path.join(dir, "moveproof.db"), { readOnly: true });

const report = db.prepare("select id, tenancy_id, type, status, content_hash from reports where id = ?").get(reportId);
if (!report) { console.error("report not found"); process.exit(1); }

const byOrder = (a, b) => a.sort - b.sort || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const rooms = db.prepare("select id, name, sort from rooms where tenancy_id = ?").all(report.tenancy_id).sort(byOrder);
const payload = {
  v: 1, reportId: report.id, tenancyId: report.tenancy_id, type: report.type,
  rooms: rooms.map((r) => ({
    id: r.id, name: r.name,
    items: db.prepare(
      `select i.id, i.name, i.sort, e.rating, e.notes, e.id as entry_id
       from items i join entries e on e.item_id = i.id and e.report_id = ? where i.room_id = ?`,
    ).all(report.id, r.id).sort(byOrder).map((i) => ({
      id: i.id, name: i.name, rating: i.rating, notes: i.notes?.trim() || null,
      photos: db.prepare("select sha256 from photos where entry_id = ?").all(i.entry_id).map((p) => p.sha256).sort(),
    })),
  })),
};

const canon = (v) => Array.isArray(v) ? v.map(canon)
  : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => [k, canon(v[k])]))
  : v;
const recomputed = createHash("sha256").update(JSON.stringify(canon(payload))).digest("hex");
const sigs = db.prepare("select role, report_hash from signatures where report_id = ?").all(report.id);

console.log(`report      ${report.id} (${report.type}, ${report.status})`);
console.log(`stored      ${report.content_hash ?? "-"}`);
console.log(`recomputed  ${recomputed}`);
for (const s of sigs) console.log(`signed ${s.role.padEnd(6)} ${s.report_hash} ${s.report_hash === recomputed ? "✓" : "✗"}`);
const match = report.content_hash === recomputed && sigs.length > 0 && sigs.every((s) => s.report_hash === recomputed);
console.log(match ? "MATCH — unchanged since lock" : report.status === "LOCKED" ? "MISMATCH" : "NOT LOCKED");
process.exit(match || report.status !== "LOCKED" ? 0 : 1);
