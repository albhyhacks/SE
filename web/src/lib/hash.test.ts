import { describe, expect, it } from "vitest";
import { canonicalJson, reportHash, sha256Hex } from "./hash";
import type { HashTree } from "./hash";

describe("canonicalJson", () => {
  it("sorts keys recursively, no whitespace", () => {
    expect(canonicalJson({ b: 1, a: { y: 2, x: [3, 1] } })).toBe('{"a":{"x":[3,1],"y":2},"b":1}');
  });

  it("drops undefined object values", () => {
    expect(canonicalJson({ a: undefined, b: null, c: 0 })).toBe('{"b":null,"c":0}');
  });

  it("throws on non-finite numbers", () => {
    expect(() => canonicalJson({ a: Number.POSITIVE_INFINITY })).toThrow(/finite/);
    expect(() => canonicalJson({ a: NaN })).toThrow(/finite/);
  });
});

describe("sha256Hex", () => {
  it("matches the known digest of an empty string", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
});

const tree = (item?: Partial<Parameters<typeof reportHash>[0]["rooms"][number]["items"][number]>): HashTree => ({
  report: { id: "report-1", tenancy_id: "tenancy-1", type: "MOVE_IN" },
  rooms: [
    {
      id: "room-2", name: "Bedroom", sort: 1,
      items: [
        { id: "item-2", name: "Fan", is_overview: 0, sort: 0, entry_id: "e2", rating: 5, notes: "cracked blade", 
          reviewer_comment: null, photos: [{ id: "p2", sha256: "b".repeat(64) }] },
        { id: "item-1", name: "Room overview", is_overview: 1, sort: 0, entry_id: "e1", rating: 2, notes: null,
          reviewer_comment: null, photos: [{ id: "p1", sha256: "a".repeat(64) }], ...item },
      ],
    } as HashTree["rooms"][number],
    { id: "room-1", name: "Hall", sort: 0, items: [] },
  ],
});

describe("reportHash", () => {
  const FIXTURE = "60cd7a629a7c10b3d470070475cbb620893c65c91d660ebfce23c02e40d540cd";
  it("known fixture → pinned hash", () => {
    expect(reportHash(tree())).toBe(FIXTURE);
  });

  it("changing one rating changes the hash", () => {
    const t = tree();
    t.rooms[0].items[1].rating = 5;
    expect(reportHash(t)).not.toBe(FIXTURE);
  });

  it("changing one note changes the hash; trimming whitespace does not", () => {
    // Fan (items[0]) carries the note "cracked blade" in the fixture.
    const t = tree();
    t.rooms[0].items[0].notes = " cracked blade ";
    expect(reportHash(t)).toBe(FIXTURE);
    const t2 = tree();
    t2.rooms[0].items[0].notes = "cracked  blade";
    expect(reportHash(t2)).not.toBe(FIXTURE);
  });

  it("changing one photo hash changes the hash; photo order within an item does not", () => {
    const t = tree();
    t.rooms[0].items[0].photos = [{ id: "p1", sha256: "c".repeat(64) }];
    expect(reportHash(t)).not.toBe(FIXTURE);
    const mk = (reversed: boolean) => {
      const t2 = tree();
      t2.rooms[0].items[0].photos = reversed
        ? [{ id: "p1", sha256: "a".repeat(64) }, { id: "p2", sha256: "b".repeat(64) }]
        : [{ id: "p2", sha256: "b".repeat(64) }, { id: "p1", sha256: "a".repeat(64) }];
      return reportHash(t2);
    };
    expect(mk(true)).toBe(mk(false));
  });

  it("reviewer_comment is not part of the hash", () => {
    const t = tree();
    t.rooms[0].items[0].reviewer_comment = "please replace";
    expect(reportHash(t)).toBe(FIXTURE);
  });
});
