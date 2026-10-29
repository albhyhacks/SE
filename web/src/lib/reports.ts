// Load full report tree for UI and hashing.
import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { reportHash } from "@/lib/hash";
import type { ReportRow } from "@/lib/tenancies";

export type ItemNode = {
  id: string; name: string; is_overview: number; sort: number;
  entry_id: string; rating: number | null; notes: string | null; reviewer_comment: string | null;
  photos: { id: string; sha256: string }[];
};
export type RoomNode = { id: string; name: string; sort: number; items: ItemNode[] };

const byOrder = (a: { sort: number; id: string }, b: { sort: number; id: string }) =>
  a.sort - b.sort || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function loadReport(tenancyId: string, reportId: string) {
  const d = db();
  const report = d
    .prepare("select id, tenancy_id, type, status, created_by, self_attested, content_hash, locked_at from reports where id = ? and tenancy_id = ?")
    .get(reportId, tenancyId) as (ReportRow & { tenancy_id: string; content_hash: string | null; locked_at: string | null }) | undefined;
  if (!report) return null;
  const rooms = d.prepare("select id, name, sort from rooms where tenancy_id = ?").all(tenancyId) as Omit<RoomNode, "items">[];
  const items = d
    .prepare(
      `select i.id, i.room_id, i.name, i.is_overview, i.sort, e.id as entry_id, e.rating, e.notes, e.reviewer_comment
       from items i join rooms r on r.id = i.room_id join entries e on e.item_id = i.id and e.report_id = ?
       where r.tenancy_id = ?`,
    )
    .all(reportId, tenancyId) as (Omit<ItemNode, "photos"> & { room_id: string })[];
  const photos = d
    .prepare("select p.id, p.sha256, p.entry_id from photos p join entries e on e.id = p.entry_id where e.report_id = ? order by p.sha256")
    .all(reportId) as { id: string; sha256: string; entry_id: string }[];

  const tree: RoomNode[] = rooms.sort(byOrder).map((r) => ({
    ...r,
    items: items
      .filter((i) => i.room_id === r.id)
      .sort(byOrder)
      .map((i) => ({ ...i, photos: photos.filter((p) => p.entry_id === i.entry_id).map(({ id, sha256 }) => ({ id, sha256 })) })),
  }));
  return { report, rooms: tree };
}

export type SignatureRow = { user_id: string; role: "OWNER" | "TENANT"; typed_name: string; report_hash: string; signed_at: string };

/** Signatures of a report, oldest first. Used by the locked view and hashing side-checks. */
export function listSignatures(reportId: string): SignatureRow[] {
  return db()
    .prepare("select user_id, role, typed_name, report_hash, signed_at from signatures where report_id = ? order by signed_at")
    .all(reportId) as SignatureRow[];
}

export type Verification =
  | { found: false }
  | {
      found: true; type: "MOVE_IN" | "MOVE_OUT"; status: string; lockedAt: string | null; selfAttested: boolean;
      storedHash: string | null; recomputedHash: string; signaturesMatch: boolean;
      result: "UNCHANGED" | "MISMATCH" | "NOT_LOCKED";
      itemCount: number; photoCount: number;
      signers: { role: "OWNER" | "TENANT"; firstName: string; signedAt: string }[];
    };

/** Public verification (SPEC F21): recompute the hash and compare with the stored and signed hashes. */
export function verifyReport(reportId: string): Verification {
  const row = db().prepare("select tenancy_id from reports where id = ?").get(reportId) as { tenancy_id: string } | undefined;
  const tree = row && loadReport(row.tenancy_id, reportId);
  if (!tree) return { found: false };
  const { report, rooms } = tree;
  const recomputedHash = reportHash(tree);
  const sigs = listSignatures(reportId);
  const signaturesMatch = sigs.length > 0 && sigs.every((s) => s.report_hash === recomputedHash);
  const locked = report.status === "LOCKED";
  const items = rooms.flatMap((r) => r.items);
  return {
    found: true, type: report.type, status: report.status, lockedAt: report.locked_at, selfAttested: !!report.self_attested,
    storedHash: report.content_hash, recomputedHash, signaturesMatch,
    result: !locked ? "NOT_LOCKED" : report.content_hash === recomputedHash && signaturesMatch ? "UNCHANGED" : "MISMATCH",
    itemCount: items.length,
    photoCount: items.reduce((n, i) => n + i.photos.length, 0),
    // N05: first names only.
    signers: sigs.map((s) => ({ role: s.role, firstName: s.typed_name.trim().split(/\s+/)[0], signedAt: s.signed_at })),
  };
}

/** Creates a report with one empty entry per checklist item. Call inside tx(). */
export function createReport(tenancyId: string, type: "MOVE_IN" | "MOVE_OUT", initiatorId: string) {
  const reportId = randomUUID();
  db().prepare("insert into reports (id, tenancy_id, type, created_by) values (?, ?, ?, ?)").run(reportId, tenancyId, type, initiatorId);
  const items = db().prepare("select id from items where room_id in (select id from rooms where tenancy_id = ?)").all(tenancyId) as { id: string }[];
  const ins = db().prepare("insert into entries (id, report_id, item_id) values (?, ?, ?)");
  for (const item of items) ins.run(randomUUID(), reportId, item.id);
  return reportId;
}
