// Phase 4 demo test: try to tamper with an entry of a LOCKED report and print the database error.
// Run: node scripts/try-tamper.mjs
// Expected: MoveProof: report is locked and cannot be changed
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

const db = new DatabaseSync(":memory:");
db.exec("pragma foreign_keys = on;" + readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
db.exec(`
  insert into users (id, email) values ('u1','o@x.in'), ('u2','t@x.in');
  insert into tenancies (id, created_by, address, monthly_rent, deposit, invite_code) values ('t1','u1','Addr',10000,30000,'c1');
  insert into rooms (id, tenancy_id, name) values ('r1','t1','Bedroom');
  insert into items (id, room_id, name) values ('i1','r1','Fan');
  insert into reports (id, tenancy_id, type, created_by) values ('rep1','t1','MOVE_IN','u1');
  insert into entries (id, report_id, item_id, rating) values ('e1','rep1','i1',2);
  update reports set status = 'LOCKED', content_hash = '${"a".repeat(64)}', locked_at = '2026-10-28T00:00:00Z' where id = 'rep1';
`);

try {
  db.exec("update entries set rating = 1, notes = 'tampered by try-tamper.mjs' where id = 'e1'");
  console.error("try-tamper: UNEXPECTED SUCCESS — the lock triggers did not stop this write!");
  process.exit(1);
} catch (err) {
  console.log("try-tamper: update refused by the database:", err.message);
}
