import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { itemDone, photoRequired, ratingInfo } from "@/lib/ratings";
import { loadReport } from "@/lib/reports";
import { AppHeader } from "@/components/app-header";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import { ChecklistEditor } from "./checklist-editor";

export default async function ReportPage({ params }: PageProps<"/t/[id]/r/[reportId]">) {
  const { id, reportId } = await params;
  const { user } = await requireMember(id);
  const data = loadReport(id, reportId);
  if (!data) notFound();
  const { report, rooms } = data;
  const isInitiator = report.created_by === user.id;
  const canCapture = report.status === "DRAFT" && isInitiator;
  const canEditChecklist = canCapture && report.type === "MOVE_IN";
  const items = rooms.flatMap((r) => r.items.map((i) => ({ ...i, room: r.name })));
  const done = items.filter(itemDone).length;
  const missing = items.filter((i) => !itemDone(i));
  const base = `/t/${id}/r/${reportId}`;

  return (
    <>
      <AppHeader user={user} />
      <Link href={`/t/${id}`} className="text-sm text-muted-foreground">← Tenancy</Link>
      <div className="mb-3 mt-1 flex items-center justify-between">
        <h1 className="text-xl font-bold">{report.type === "MOVE_IN" ? "Move-in report" : "Move-out report"}</h1>
        <StatusBadge status={report.status} />
      </div>

      <div className="mb-5 space-y-1">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
        </div>
        <p className="text-sm text-muted-foreground">{done} of {items.length} items done</p>
        {!canCapture && report.status === "DRAFT" && (
          <p className="text-sm text-muted-foreground">The other party is filling this report. You can review it once it is submitted.</p>
        )}
      </div>

      <div className="mb-6 space-y-2">
        {rooms.map((room) => {
          const roomDone = room.items.filter(itemDone).length;
          return (
            <details key={room.id} className="rounded-lg border" open={rooms.length === 1}>
              <summary className="flex cursor-pointer items-center justify-between p-3">
                <span className="font-medium">{room.name}</span>
                <span className={cn("text-sm", roomDone === room.items.length ? "text-emerald-700" : "text-muted-foreground")}>
                  {roomDone}/{room.items.length}
                </span>
              </summary>
              <ul className="divide-y border-t">
                {room.items.map((item) => {
                  const r = ratingInfo(item.rating);
                  return (
                    <li key={item.id}>
                      <Link href={`${base}/item/${item.id}`} className="flex min-h-12 items-center justify-between gap-2 px-3 py-2">
                        <span className="flex items-center gap-2">
                          <span className={itemDone(item) ? "text-emerald-700" : "text-muted-foreground"}>{itemDone(item) ? "✓" : "○"}</span>
                          {item.name}
                        </span>
                        <span className="flex shrink-0 items-center gap-2 text-xs">
                          {item.photos.length > 0 && <span className="text-muted-foreground">📷 {item.photos.length}</span>}
                          {r && <span className={cn("rounded px-2 py-0.5", r.className)}>{r.label}</span>}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}
      </div>

      {canCapture && missing.length > 0 && (
        <section className="mb-6 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <h2 className="mb-2 font-semibold">Still to do ({missing.length})</h2>
          <ul className="space-y-1">
            {missing.map((i) => (
              <li key={i.id}>
                <Link href={`${base}/item/${i.id}`} className="underline">{i.room} · {i.name}</Link>
                {" — "}{i.rating === null ? "needs a rating" : photoRequired(i.rating, !!i.is_overview) ? "needs a photo" : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {canEditChecklist && (
        <details className="mb-6">
          <summary className="cursor-pointer font-semibold">Edit checklist (rooms and items)</summary>
          <div className="mt-3"><ChecklistEditor tenancyId={id} rooms={rooms} /></div>
        </details>
      )}
    </>
  );
}
