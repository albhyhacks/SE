import { describe, expect, it } from "vitest";
import { compare, isChanged } from "./comparison";
import type { RoomNode } from "./reports";

// RoomNode["items"] shape helper: id/name/is_overview/sort/entry_id/rating/notes/photos
const item = (id: string, rating: number | null, notes: string | null = null, photos: string[] = []): RoomNode["items"][number] =>
  ({ id, name: `Item ${id}`, is_overview: 0, sort: 0, entry_id: `e-${id}`, rating, notes,
    reviewer_comment: null, photos: photos.map((s) => ({ id: `p-${s}`, sha256: s })) });

const room = (id: string, items: RoomNode["items"][number][]): RoomNode => ({ id, name: "Hall", sort: 0, items });

const G = "g".repeat(64);
const D = "d".repeat(64);

describe("compare", () => {
  it("flags Good→Damaged as worse, Good→Missing as missing, unchanged otherwise", () => {
    const inTree = { rooms: [room("r1", [item("a", 2), item("b", 2), item("c", 2)])] };
    const outTree = { rooms: [room("r1", [item("a", 5), item("b", 6), item("c", 2)])] };
    const r = compare(inTree, outTree);
    expect(r.counts).toEqual({ unchanged: 1, worse: 1, missing: 1, notCaptured: 0, total: 3 });
    expect(r.items.find((c) => c.itemId === "a")!.flags.worse).toBe(true);
    expect(r.items.find((c) => c.itemId === "a")!.flags.missing).toBe(false);
    expect(r.items.find((c) => c.itemId === "b")!.flags.missing).toBe(true);
    expect(r.items.find((c) => c.itemId === "b")!.flags.worse).toBe(false);
    expect(r.items.find((c) => c.itemId === "c")!.flags).toEqual({ worse: false, missing: false, newNote: false });
  });

  it("newNote flags a different new note on the move-out side", () => {
    const r = compare(
      { rooms: [room("r1", [item("a", 2)])] },
      { rooms: [room("r1", [item("a", 2, "ceiling stain appeared")])] },
    );
    expect(r.items[0].flags.newNote).toBe(true);
    expect(r.items[0].flags.worse).toBe(false);
    expect(isChanged(r.items[0])).toBe(true);
  });

  it("a note added at move-out on an already-worse item counts both", () => {
    const r = compare(
      { rooms: [room("r1", [item("a", 2)])] },
      { rooms: [room("r1", [item("a", 5, "cracked")])] },
    );
    expect(r.items[0].flags).toEqual({ worse: true, missing: false, newNote: true });
  });

  it("missing photos are not their own flag; photo lists come from each side", () => {
    const inTree = { rooms: [room("r1", [item("a", 2, null, [G]), item("b", 3, null, [G])])] };
    const outTree = { rooms: [room("r1", [item("a", 2, null, [D]), item("b", 2)])] };
    const r = compare(inTree, outTree);
    expect(r.items[0].in.photos[0].sha256).toBe(G);
    expect(r.items[0].out!.photos[0].sha256).toBe(D);
  });

  it("items with no move-out entry (null tree or new item) count as not captured", () => {
    const inTree = { rooms: [room("r1", [item("a", 2), item("b", 2)])] };
    expect(compare(inTree, null).counts).toEqual({ unchanged: 0, worse: 0, missing: 0, notCaptured: 2, total: 2 });
    const partial = { rooms: [room("r1", [item("a", 2)])] };
    const r = compare(inTree, partial);
    expect(r.counts.notCaptured).toBe(1);
    expect(r.items.find((c) => c.itemId === "a")!.out!.rating).toBe(2);
    expect(r.items.find((c) => c.itemId === "b")!.flags.worse).toBe(false);
  });

  it("an item unrated at move-in never flags worse (no baseline; submit requires all ratings anyway)", () => {
    const inTree = { rooms: [room("r1", [item("a", null)])] };
    const r = compare(inTree, { rooms: [room("r1", [item("a", 5)])] });
    expect(r.items[0].flags.worse).toBe(false);
    expect(r.items[0].flags.missing).toBe(false);
  });
});
