// Canonical JSON and the report hash (SPEC §6). Pure module — imported by tests and server code.
// Reviewer comments and signatures are NOT part of the payload: they change during review.
import { createHash } from "node:crypto";
import type { ItemNode, RoomNode } from "@/lib/reports";

/** SHA-256 of the UTF-8 bytes of a string or buffer, lowercase hex. */
export function sha256Hex(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Recursive canonicalisation: object keys sorted, arrays in order, undefined dropped, no non-finite numbers. */
function cursor(value: unknown): unknown {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("canonicalJson: numbers must be finite");
    return value;
  }
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => (v === undefined ? null : cursor(v)));
  const out: Record<string, unknown> = {};
  const source = value as Record<string, unknown>;
  for (const key of Object.keys(source).sort()) {
    const v = cursor(source[key]);
    if (v !== undefined) out[key] = v;
  }
  return out;
}

/** JSON string with object keys sorted recursively and no whitespace. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(cursor(value));
}

export type HashTree = {
  report: { id: string; tenancy_id: string; type: string };
  rooms: RoomNode[];
};

const byOrder = (a: { sort: number; id: string }, b: { sort: number; id: string }) =>
  a.sort - b.sort || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** The exact payload hashed, per SPEC §6. Photos must be sorted ascending (they are, from loadReport). */
export function buildHashPayload(tree: HashTree) {
  return {
    v: 1,
    reportId: tree.report.id,
    tenancyId: tree.report.tenancy_id,
    type: tree.report.type,
    rooms: [...tree.rooms].sort(byOrder).map((room) => ({
      id: room.id,
      name: room.name,
      items: [...room.items].sort(byOrder).map((item: ItemNode) => ({
        id: item.id,
        name: item.name,
        rating: item.rating,
        notes: item.notes?.trim() || null,
        photos: item.photos.map((p) => p.sha256).sort(),
      })),
    })),
  };
}

/** SHA-256 of the canonical payload. Recompute with the same function at sign and verify time. */
export function reportHash(tree: HashTree): string {
  return sha256Hex(canonicalJson(buildHashPayload(tree)));
}
