"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/audit";
import { deletePhotoFile, isJpeg, MAX_PHOTO_BYTES, photoPath, sha256Hex, writePhoto } from "@/lib/photos";

const Id = z.string().uuid();
type Result = { error?: string; duplicate?: boolean };

/** Member + initiator + report DRAFT + item belongs to this report's tenancy. Returns the entry. */
async function guard(tenancyId: string, reportId: string, itemId: string) {
  const { user } = await requireMember(Id.parse(tenancyId));
  const row = db()
    .prepare(
      `select e.id as entry_id, i.name as item_name, r.status, r.created_by
       from reports r join entries e on e.report_id = r.id join items i on i.id = e.item_id join rooms ro on ro.id = i.room_id
       where r.id = ? and r.tenancy_id = ? and i.id = ? and ro.tenancy_id = r.tenancy_id`,
    )
    .get(Id.parse(reportId), tenancyId, Id.parse(itemId)) as
    | { entry_id: string; item_name: string; status: string; created_by: string }
    | undefined;
  if (!row) throw new Error("Item not found");
  if (row.status !== "DRAFT" || row.created_by !== user.id) throw new Error("Only the initiator can change a draft report.");
  return { user, ...row };
}

const Entry = z.object({
  rating: z.number().int().min(1).max(6).nullable(),
  notes: z.string().max(1000).transform((s) => s.trim() || null),
});

export async function saveEntry(tenancyId: string, reportId: string, itemId: string, input: unknown): Promise<Result> {
  const g = await guard(tenancyId, reportId, itemId);
  const v = Entry.safeParse(input);
  if (!v.success) return { error: "Pick a rating and keep notes under 1000 characters." };
  db().prepare("update entries set rating = ?, notes = ?, reviewer_comment = null, updated_at = ? where id = ?")
    .run(v.data.rating, v.data.notes, new Date().toISOString(), g.entry_id);
  revalidatePath(`/t/${tenancyId}/r/${reportId}`, "layout");
  return {};
}

const Upload = z.object({
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  capturedAt: z.string().datetime().nullable(),
  source: z.enum(["camera", "dev_upload"]),
});

export async function uploadPhoto(tenancyId: string, reportId: string, itemId: string, form: FormData): Promise<Result> {
  const g = await guard(tenancyId, reportId, itemId);
  const v = Upload.safeParse({ sha256: form.get("sha256"), capturedAt: form.get("capturedAt") || null, source: form.get("source") });
  const file = form.get("photo");
  if (!v.success || !(file instanceof Blob)) return { error: "Bad upload. Please retake the photo." };
  if (v.data.source === "dev_upload" && process.env.NEXT_PUBLIC_ALLOW_DEV_UPLOAD !== "true") return { error: "Only live camera photos are allowed." };
  if (file.size > MAX_PHOTO_BYTES) return { error: "Photo too large. Please retake." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  // Integrity: recompute on the server; a mismatching photo is never stored.
  if (!isJpeg(bytes) || sha256Hex(bytes) !== v.data.sha256) return { error: "Photo failed integrity check, please retake." };

  const dup = db().prepare("select 1 from photos where entry_id = ? and sha256 = ?").get(g.entry_id, v.data.sha256);
  if (dup) return { duplicate: true };

  const rel = photoPath(tenancyId, v.data.sha256);
  await writePhoto(rel, bytes);
  db().prepare("insert into photos (id, entry_id, sha256, path, source, captured_at) values (?, ?, ?, ?, ?, ?)")
    .run(randomUUID(), g.entry_id, v.data.sha256, rel, v.data.source, v.data.capturedAt);
  logEvent(tenancyId, g.user.id, "photo.added", { item: g.item_name, sha256: v.data.sha256 });
  revalidatePath(`/t/${tenancyId}/r/${reportId}`, "layout");
  return {};
}

export async function deletePhoto(tenancyId: string, reportId: string, itemId: string, photoId: string): Promise<Result> {
  const g = await guard(tenancyId, reportId, itemId);
  const p = db().prepare("select path, sha256 from photos where id = ? and entry_id = ?").get(Id.parse(photoId), g.entry_id) as
    | { path: string; sha256: string }
    | undefined;
  if (!p) return { error: "Photo not found" };
  db().prepare("delete from photos where id = ?").run(photoId);
  // Same file may back another entry of this tenancy (content-addressed); only delete when unused.
  const stillUsed = db().prepare("select 1 from photos where path = ?").get(p.path);
  if (!stillUsed) await deletePhotoFile(p.path);
  logEvent(tenancyId, g.user.id, "photo.deleted", { item: g.item_name, sha256: p.sha256 });
  revalidatePath(`/t/${tenancyId}/r/${reportId}`, "layout");
  return {};
}
