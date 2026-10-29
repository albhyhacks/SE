import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/auth";
import { reportHash } from "@/lib/hash";
import { itemDone, photoRequired, ratingInfo } from "@/lib/ratings";
import { listSignatures, loadReport } from "@/lib/reports";
import { AppHeader } from "@/components/app-header";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { roleLabel } from "@/lib/tenancies";
import { cn } from "@/lib/utils";
import { ChecklistEditor } from "./checklist-editor";
import { CopyHash } from "./copy-hash";
import { ItemComment } from "./item-comment";
import { RequestChanges } from "./request-changes";
import { SignDialog } from "./sign-dialog";

export default async function ReportPage({ params, searchParams }: PageProps<"/t/[id]/r/[reportId]">) {
  const { id, reportId } = await params;
  const { msg } = await searchParams;
  const { user } = await requireMember(id);
  const data = loadReport(id, reportId);
  if (!data) notFound();
  const { report, rooms } = data;
  const isInitiator = report.created_by === user.id;
  const status = report.status as "DRAFT" | "REVIEW" | "LOCKED";
  const canCapture = status === "DRAFT" && isInitiator;
  const canEditChecklist = canCapture && report.type === "MOVE_IN";
  const isReviewerActing = status === "REVIEW" && !isInitiator;
  const memberCount = (db().prepare("select count(*) as n from members where tenancy_id = ?").get(id) as { n: number }).n;
  const alone = memberCount < 2;
  const items = rooms.flatMap((r) => r.items.map((i) => ({ ...i, room: r.name })));
  const done = items.filter(itemDone).length;
  const missing = items.filter((i) => !itemDone(i));
  const signatures = listSignatures(reportId);
  // The hash this render shows; countersign compares it against a fresh recompute server-side.
  const renderedHash = reportHash({ report, rooms });
  const base = `/t/${id}/r/${reportId}`;

  return (
    // data-hash embeds what this page rendered; needed by the countersign staleness check.
    <div data-report-hash={renderedHash}>
      <AppHeader user={user} />
      <Link href={`/t/${id}`} className="text-sm text-muted-foreground">← Tenancy</Link>
      <div className="mb-3 mt-1 flex items-center justify-between">
        <h1 className="text-xl font-bold">{report.type === "MOVE_IN" ? "Move-in report" : "Move-out report"}</h1>
        <StatusBadge status={status} selfAttested={!!report.self_attested} />
      </div>

  {msg && (
    <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-900">
      {msg === "locked" || msg === "frozen"
        ? "The checklist is frozen after the move-in report was locked and cannot be edited."
        : msg === "not-yours"
          ? "Only the report's initiator can edit the checklist while it is a draft."
          : typeof msg === "string" ? msg : "That action is not allowed."}
    </p>
  )}

      <div className="mb-5 space-y-1">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
        </div>
        <p className="text-sm text-muted-foreground">{done} of {items.length} items done</p>
        {canCapture && (
          <p className="text-sm text-muted-foreground">When every item is done, submit it for the other party to review.</p>
        )}
        {status === "REVIEW" && isInitiator && (
          <p className="rounded-lg bg-muted p-3 text-sm">
            Submitted and signed. Waiting for the other party to review, comment and sign. They can also
            send it back to you with change requests.
          </p>
        )}
        {!canCapture && status === "DRAFT" && (
          <p className="text-sm text-muted-foreground">The other party is filling this report. You can review it once it is submitted.</p>
        )}
      </div>

      {status === "LOCKED" && (
        <section className="mb-6 space-y-2 rounded-lg border-2 border-emerald-200 bg-emerald-50 p-4 text-sm">
          <div className="flex items-center gap-2">
            <span aria-hidden>🔒</span>
            <h2 className="font-semibold">
              Locked {report.locked_at ? new Date(report.locked_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : ""}
            </h2>
          </div>
          <p className="font-mono text-xs break-all">{renderedHash}</p>
          <CopyHash hash={renderedHash} />
          <ul className="space-y-1">
            {signatures.map((s) => (
              <li key={s.user_id}>
                ✍️ {roleLabel(s.role)} — <strong>{s.typed_name}</strong>{" "}
                <span className="text-muted-foreground">signed {new Date(s.signed_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</span>
              </li>
            ))}
          </ul>
          {!!report.self_attested && (
            <p className="rounded bg-amber-100 p-2 text-amber-900">⚠️ Self-attested: only the initiator signed this report.</p>
          )}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Link href={`/t/${id}/print/${reportId}`} className={buttonVariants({ variant: "outline", className: "h-11" })}>Print / PDF</Link>
            <Link href={`/verify/${reportId}`} className={buttonVariants({ variant: "outline", className: "h-11" })}>Verify</Link>
          </div>
          {report.type === "MOVE_OUT" && (
            <Link href={`/t/${id}/compare`} className={buttonVariants({ className: "mt-1" })}>
              Compare with the move-in report →
            </Link>
          )}
        </section>
      )}

      <div className="mb-6 space-y-2">
        {rooms.map((room) => {
          const roomDone = room.items.filter(itemDone).length;
          const showCommentBox = isReviewerActing;
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
                    <li key={item.id} className="px-3 py-2">
                      <div className="flex min-h-6 items-center justify-between gap-2">
                        <Link href={`${base}/item/${item.id}`} className="flex min-w-0 flex-1 items-center gap-2">
                          <span className={itemDone(item) ? "text-emerald-700" : "text-muted-foreground"}>{itemDone(item) ? "✓" : "○"}</span>
                          <span className="min-w-0 flex-1">
                            {item.name}
                            {item.reviewer_comment && (
                              <span className="block text-xs text-orange-700">💬 {item.reviewer_comment}</span>
                            )}
                          </span>
                        </Link>
                        <span className="flex shrink-0 items-center gap-2 text-xs">
                          {item.photos.length > 0 && <span className="text-muted-foreground">📷 {item.photos.length}</span>}
                          {r && <span className={cn("rounded px-2 py-0.5", r.className)}>{r.label}</span>}
                        </span>
                      </div>
                      {showCommentBox && (
                        <ItemComment
                          tenancyId={id} reportId={reportId} itemId={item.id}
                          initial={item.reviewer_comment ?? ""} room={room.name} item={item.name}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}
      </div>

      {canCapture && (
        <div className="sticky bottom-4 space-y-2">
          <SignDialog
            mode="submit" tenancyId={id} reportId={reportId} hash={renderedHash}
            triggerLabel="Submit and sign"
            disabled={missing.length > 0}
          />
          {missing.length > 0 && (
            <p className="text-center text-xs text-muted-foreground">Complete all {missing.length} remaining items to submit.</p>
          )}
          {alone && (
            <SignDialog
              mode="self" tenancyId={id} reportId={reportId} hash={renderedHash}
              triggerLabel="Self-attest and lock now" triggerVariant="outline" disabled={missing.length > 0}
            />
          )}
        </div>
      )}

      {status === "REVIEW" && isInitiator && alone && (
        <div className="mb-6 space-y-2">
          <SignDialog
            mode="self" tenancyId={id} reportId={reportId} hash={renderedHash}
            triggerLabel="Self-attest and lock now" triggerVariant="outline"
          />
        </div>
      )}

      {isReviewerActing && (
        <div className="sticky bottom-4 space-y-2 border-t bg-background pt-3">
          <SignDialog
            mode="countersign" tenancyId={id} reportId={reportId} hash={renderedHash}
            triggerLabel="Sign and lock"
            disabled={signatures.length === 0}
          />
          <RequestChanges tenancyId={id} reportId={reportId} hasComments={items.some((i) => i.reviewer_comment)} />
          {signatures.length === 0 && (
            <p className="text-center text-xs text-muted-foreground">The initiator has not signed yet — you can ask for changes meanwhile.</p>
          )}
        </div>
      )}

      {canCapture && missing.length > 0 && (
        <details className="mb-6 rounded-lg bg-amber-50 p-3 text-sm text-amber-900" open>
          <summary className="cursor-pointer font-semibold">Still to do ({missing.length})</summary>
          <ul className="mt-2 space-y-1">
            {missing.map((i) => (
              <li key={i.id}>
                <Link href={`${base}/item/${i.id}`} className="underline">{i.room} · {i.name}</Link>
                {" — "}{i.rating === null ? "needs a rating" : photoRequired(i.rating, !!i.is_overview) ? "needs a photo" : ""}
              </li>
            ))}
          </ul>
        </details>
      )}

      {canEditChecklist && (
        <details className="mb-6">
          <summary className="cursor-pointer font-semibold">Edit checklist (rooms and items)</summary>
          <div className="mt-3"><ChecklistEditor tenancyId={id} rooms={rooms} /></div>
        </details>
      )}
    </div>
  );
}
