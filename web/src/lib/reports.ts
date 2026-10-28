// Load full report tree for UI and hashing.
import "server-only";
import { db } from "@/lib/db";
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
