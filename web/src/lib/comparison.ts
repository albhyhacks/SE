// Side-by-side comparison of the move-in and move-out report trees (SPEC §3 F15, §5).
// "Got worse" = move-out rating > move-in rating. "Missing" = became Missing (6).
import type { RoomNode } from "@/lib/reports";

export type Side = { rating: number | null; notes: string | null; photos: { id: string; sha256: string }[] };

export type ComparedItem = {
  roomId: string; roomName: string;
  itemId: string; itemName: string; isOverview: boolean;
  in: Side;
  out: Side | null;
  flags: { worse: boolean; missing: boolean; newNote: boolean };
};

export type Comparison = {
  items: ComparedItem[];
  counts: { unchanged: number; worse: number; missing: number; notCaptured: number; total: number };
};

const side = (item: RoomNode["items"][number]): Side => ({
  rating: item.rating,
  notes: item.notes?.trim() || null,
  photos: item.photos.map(({ id, sha256 }) => ({ id, sha256 })),
});

/** Pairs the trees by room/item id (both reports share the tenancy's checklist). */
export function compare(moveInTree: { rooms: RoomNode[] }, moveOutTree: { rooms: RoomNode[] } | null): Comparison {
  const outById = new Map<string, RoomNode["items"][number]>();
  for (const room of moveOutTree?.rooms ?? []) for (const item of room.items) outById.set(item.id, item);

  const items: ComparedItem[] = [];
  for (const room of moveInTree.rooms) {
    for (const itemIn of room.items) {
      const itemOut = outById.get(itemIn.id);
      const si = side(itemIn);
      const so = itemOut ? side(itemOut) : null;
      const missing = so?.rating === 6 && si.rating !== 6;
      // An item that is Missing at move-out but was un-rated at move-in is flagged missing too.
      const worse = so?.rating !== null && so?.rating !== undefined && si.rating !== null && so.rating > si.rating && !missing;
      const newNote = !!so?.notes && so.notes !== si.notes;
      items.push({
        roomId: room.id, roomName: room.name,
        itemId: itemIn.id, itemName: itemIn.name, isOverview: !!itemIn.is_overview,
        in: si, out: so,
        flags: { worse, missing, newNote },
      });
    }
  }

  const counts = { unchanged: 0, worse: 0, missing: 0, notCaptured: 0, total: items.length };
  for (const c of items) {
    if (!c.out || c.out.rating === null) counts.notCaptured++;
    else if (c.flags.missing) counts.missing++;
    else if (c.flags.worse) counts.worse++;
    else counts.unchanged++;
  }
  return { items, counts };
}

/** Changed = got worse, became missing, or has a brand-new note. Drives the "Only changed items" filter. */
export const isChanged = (c: ComparedItem) => c.flags.worse || c.flags.missing || (c.flags.newNote && !!c.out);
