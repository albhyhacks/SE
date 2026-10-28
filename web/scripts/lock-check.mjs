// Self-check for the SQLite lock triggers (replaces supabase/checks/lock_check.sql + rls-check).
// Run: node scripts/lock-check.mjs   — uses an in-memory DB, every tamper must fail.
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const db = new DatabaseSync(":memory:");
db.exec("pragma foreign_keys = on;" + readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
const h = "a".repeat(64);
db.exec(`
  insert into users (id, email) values ('u1','o@x.in'), ('u2','t@x.in');
  insert into tenancies (id, created_by, address, monthly_rent, deposit, invite_code) values ('t1','u1','Addr',10000,30000,'c1'), ('t2','u2','Other',9000,9000,'c2');
  insert into rooms (id, tenancy_id, name) values ('r1','t1','Bedroom'), ('r2','t2','Hall');
  insert into items (id, room_id, name) values ('i1','r1','Fan'), ('i2','r2','Door');
  insert into reports (id, tenancy_id, type, created_by) values ('rep1','t1','MOVE_IN','u1');
  insert into entries (id, report_id, item_id, rating) values ('e1','rep1','i1',2);
  insert into photos (id, entry_id, sha256, path) values ('p1','e1','${h}','t1/${h}.jpg');
  insert into signatures (report_id, user_id, role, typed_name, report_hash) values ('rep1','u1','OWNER','Owner Name','${h}');
  insert into audit_events (tenancy_id, action) values ('t1','test');
`);
const fails = (sql, re) => assert.throws(() => db.exec(sql), re, sql);

fails("insert into entries (id, report_id, item_id) values ('ex','rep1','i2')", /another tenancy/);
fails("insert into deductions (id, tenancy_id, item_id, amount, reason) values ('d1','t1','i2',100,'OTHER')", /another tenancy/);
fails("update audit_events set action = 'x'", /append-only/);
fails("delete from audit_events", /append-only/);

db.exec("update reports set status = 'LOCKED', content_hash = '" + h + "' where id = 'rep1'");
const locked = /locked/;
fails("update entries set notes = 'tampered' where report_id = 'rep1'", locked);
fails("delete from entries where id = 'e1'", locked);
fails("delete from photos where id = 'p1'", locked);
fails("update photos set sha256 = '" + "b".repeat(64) + "'", locked);
fails("insert into signatures (report_id, user_id, role, typed_name, report_hash) values ('rep1','u2','TENANT','Ten Ant','" + h + "')", locked);
fails("delete from signatures", locked);
fails("update reports set status = 'DRAFT' where id = 'rep1'", locked);
fails("delete from reports where id = 'rep1'", locked);
fails("update items set name = 'tampered' where id = 'i1'", /frozen/);
fails("insert into rooms (id, tenancy_id, name) values ('rx','t1','New')", /frozen/);
fails("delete from items where id = 'i1'", /frozen/);
// Other tenancy is unaffected.
db.exec("update items set name = 'Front door' where id = 'i2'");
console.log("lock-check: all tamper attempts were refused ✓");
