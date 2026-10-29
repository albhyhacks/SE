// Demo: try to tamper with a LOCKED report and print the database error.
// Run: node scripts/try-tamper.mjs               — self-contained, in-memory DB
//      node scripts/try-tamper.mjs <reportId>    — against the real DB (web/data or MOVEPROOF_DATA_DIR)
// Expected: MoveProof: report is locked and cannot be changed
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import path from "node:path";

const reportId = process.argv[2];
let db, target;
if (reportId) {
  db = new DatabaseSync(path.join(process.env.MOVEPROOF_DATA_DIR || path.join(process.cwd(), "data"), "moveproof.db"));
  const r = db.prepare("select status from reports where id = ?").get(reportId);
  if (!r) { console.error("report not found"); process.exit(2); }
  if (r.status !== "LOCKED") { console.error(`report is ${r.status}, lock it first`); process.exit(2); }
  target = reportId;
} else {
  db = new DatabaseSync(":memory:");
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
  target = "rep1";
}

const attempts = [
  ["change a rating", "update entries set rating = 1, notes = 'tampered by try-tamper.mjs' where report_id = ?"],
  ["delete its photos", "delete from photos where entry_id in (select id from entries where report_id = ?)"],
  ["unlock the report", "update reports set status = 'DRAFT' where id = ?"],
];
let broken = false;
for (const [what, sql] of attempts) {
  try {
    const { changes } = db.prepare(sql).run(target);
    // A statement that matched no rows proves nothing (row triggers never fired).
    console.log(changes ? `try-tamper: ${what}: UNEXPECTED SUCCESS — lock broken!` : `try-tamper: ${what}: no rows matched (nothing to test)`);
    if (changes) broken = true;
  } catch (err) {
    console.log(`try-tamper: ${what}: refused by the database: ${err.message}`);
  }
}
process.exit(broken ? 1 : 0);
