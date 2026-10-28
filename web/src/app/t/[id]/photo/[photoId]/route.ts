// Serves a photo to members of its tenancy only (replaces short-lived signed URLs).
import { getMembership, getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readPhoto } from "@/lib/photos";

export async function GET(_: Request, ctx: RouteContext<"/t/[id]/photo/[photoId]">) {
  const { id, photoId } = await ctx.params;
  const user = await getUser();
  if (!user || !getMembership(id, user.id)) return new Response("Not found", { status: 404 });
  const row = db()
    .prepare(
      `select p.path from photos p join entries e on e.id = p.entry_id join reports r on r.id = e.report_id
       where p.id = ? and r.tenancy_id = ?`,
    )
    .get(photoId, id) as { path: string } | undefined;
  if (!row) return new Response("Not found", { status: 404 });
  const bytes = await readPhoto(row.path).catch(() => null);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=600, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
