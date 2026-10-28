import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadReport } from "@/lib/reports";
import { AppHeader } from "@/components/app-header";
import { ItemCapture } from "./item-capture";

export default async function ItemPage({ params }: PageProps<"/t/[id]/r/[reportId]/item/[itemId]">) {
  const { id, reportId, itemId } = await params;
  const { user } = await requireMember(id);
  const data = loadReport(id, reportId);
  if (!data) notFound();
  const { report, rooms } = data;
  const flat = rooms.flatMap((room) => room.items.map((item) => ({ room, item })));
  const idx = flat.findIndex((x) => x.item.id === itemId);
  if (idx < 0) notFound();
  const { room, item } = flat[idx];
  const next = flat[idx + 1];
  const reportHref = `/t/${id}/r/${reportId}`;
  const photos = db()
    .prepare("select id, uploaded_at, source from photos where entry_id = ? order by uploaded_at")
    .all(item.entry_id) as { id: string; uploaded_at: string; source: string }[];

  return (
    <>
      <AppHeader user={user} />
      <Link href={reportHref} className="text-sm text-muted-foreground">← All rooms</Link>
      <p className="mt-2 text-sm text-muted-foreground">{room.name} · item {idx + 1} of {flat.length}</p>
      <h1 className="mb-4 text-2xl font-bold">{item.name}</h1>
      <ItemCapture
        key={item.id}
        ids={{ tenancyId: id, reportId, itemId }}
        isOverview={!!item.is_overview}
        rating={item.rating}
        notes={item.notes}
        photos={photos}
        canEdit={report.status === "DRAFT" && report.created_by === user.id}
        nextHref={next ? `${reportHref}/item/${next.item.id}` : reportHref}
      />
    </>
  );
}
