import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { qrDataUrl, verifyUrl } from "@/lib/qr";
import { ratingInfo } from "@/lib/ratings";
import { listSignatures, loadReport } from "@/lib/reports";
import { getTenancy } from "@/lib/tenancies";
import { PrintButton } from "@/components/print-button";
import { fmtPrintDate, PrintFooter, PrintParties, PrintReportMeta } from "@/components/print-header";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Condition report · MoveProof" };

export default async function PrintReport({ params }: PageProps<"/t/[id]/print/[reportId]">) {
  const { id, reportId } = await params;
  await requireMember(id);
  const t = getTenancy(id);
  const data = loadReport(id, reportId);
  if (!t || !data) notFound();
  const { report, rooms } = data;
  const uploaded = new Map(
    (db().prepare("select p.id, p.uploaded_at from photos p join entries e on e.id = p.entry_id where e.report_id = ?").all(reportId) as
      { id: string; uploaded_at: string }[]).map((p) => [p.id, p.uploaded_at]),
  );
  const url = verifyUrl(reportId);
  const label = report.type === "MOVE_IN" ? "Move-in report" : "Move-out report";

  return (
    <div className="space-y-4">
      <div className="no-print flex justify-between text-sm">
        <Link href={`/t/${id}/r/${reportId}`} className="text-muted-foreground">← Back</Link>
      </div>
      <header className="space-y-1">
        <h1 className="text-xl font-bold">MoveProof condition report</h1>
        <p className="font-medium">{label} · {t.tenancy.address}</p>
        <PrintParties members={t.members} />
        <p className="text-xs">Signed by: {listSignatures(reportId).map((s) => `${s.typed_name} (${s.role === "OWNER" ? "Owner" : "Tenant"}, ${fmtPrintDate(s.signed_at)})`).join(" · ") || "—"}</p>
      </header>
      <PrintReportMeta label={label} lockedAt={report.locked_at} selfAttested={!!report.self_attested} hash={report.content_hash} qr={await qrDataUrl(url)} verifyUrl={url} />
      <PrintButton />
      {rooms.map((room) => (
        <section key={room.id} className="space-y-2">
          <h2 className="border-b pb-1 font-semibold">{room.name}</h2>
          {room.items.map((item) => {
            const r = ratingInfo(item.rating);
            return (
              <div key={item.id} className="print-avoid space-y-1 rounded border p-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{item.name}</span>
                  <span className={cn("rounded px-2 text-xs", r?.className)}>{r ? `${r.value} · ${r.label}` : "Not rated"}</span>
                </div>
                {item.notes && <p className="text-xs">{item.notes}</p>}
                {item.photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {item.photos.map((p) => (
                      <figure key={p.id}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- member-checked photo route */}
                        <img src={`/t/${id}/photo/${p.id}`} alt={item.name} className="aspect-[4/3] w-full rounded object-cover" />
                        <figcaption className="text-[9px] leading-tight text-muted-foreground">
                          {fmtPrintDate(uploaded.get(p.id) ?? null)} · {p.sha256.slice(0, 10)}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ))}
      <PrintFooter />
    </div>
  );
}
