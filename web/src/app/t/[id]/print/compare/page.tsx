import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { compare, isChanged, type Side } from "@/lib/comparison";
import { qrDataUrl, verifyUrl } from "@/lib/qr";
import { ratingInfo } from "@/lib/ratings";
import { loadReport } from "@/lib/reports";
import { summarise, settlementStatus } from "@/lib/settlement";
import { getTenancy, listDeductions } from "@/lib/tenancies";
import { PrintButton } from "@/components/print-button";
import { PrintFooter, PrintParties, PrintReportMeta } from "@/components/print-header";
import { inr } from "@/lib/format";

export const metadata: Metadata = { title: "Move-out comparison · MoveProof" };
const STATUS: Record<string, string> = { NO_DEDUCTIONS: "No deductions", PENDING: "Pending", DISPUTED: "Disputed", SETTLED: "Settled" };

export default async function PrintCompare({ params, searchParams }: PageProps<"/t/[id]/print/compare">) {
  const { id } = await params;
  const all = (await searchParams).all === "1";
  await requireMember(id);
  const t = getTenancy(id);
  if (!t?.moveIn || !t.moveOut) notFound();
  const inTree = loadReport(id, t.moveIn.id);
  const outTree = loadReport(id, t.moveOut.id);
  if (!inTree || !outTree) notFound();
  const items = compare(inTree, outTree).items.filter((c) => all || isChanged(c));
  const deductions = listDeductions(id);
  const s = summarise(t.tenancy.deposit, deductions);
  const metas = await Promise.all([inTree, outTree].map(async (tree) => {
    const url = await verifyUrl(tree.report.id);
    return { tree, url, qr: await qrDataUrl(url) };
  }));

  return (
    <div className="space-y-4">
      <div className="no-print flex justify-between text-sm">
        <Link href={`/t/${id}/compare`} className="text-muted-foreground">← Back</Link>
        <Link href={all ? "?" : "?all=1"} className="underline">{all ? "Only changed items" : "Show all items"}</Link>
      </div>
      <header className="space-y-1">
        <h1 className="text-xl font-bold">MoveProof move-out comparison</h1>
        <p className="font-medium">{t.tenancy.address}</p>
        <PrintParties members={t.members} />
      </header>
      <div className="grid gap-2 sm:grid-cols-2 print:grid-cols-2">
        {metas.map(({ tree, url, qr }) => (
          <PrintReportMeta key={tree.report.id} label={tree.report.type === "MOVE_IN" ? "Move-in report" : "Move-out report"}
            lockedAt={tree.report.locked_at} selfAttested={!!tree.report.self_attested} hash={tree.report.content_hash}
            qr={qr} verifyUrl={url} />
        ))}
      </div>
      <PrintButton />

      <section className="print-avoid space-y-2 rounded border p-3 text-sm">
        <h2 className="font-semibold">Deposit settlement · {STATUS[settlementStatus(deductions)]}</h2>
        <div className="grid grid-cols-2 gap-x-3 text-xs">
          <span>Deposit</span><span className="text-right">{inr(t.tenancy.deposit)}</span>
          <span>Accepted</span><span className="text-right">{inr(s.accepted)}</span>
          <span>Disputed</span><span className="text-right">{inr(s.disputed)}</span>
          <span>Pending</span><span className="text-right">{inr(s.proposed)}</span>
          <span className="font-semibold">Refund now</span><span className="text-right font-semibold">{inr(s.refundNow)}</span>
        </div>
        {deductions.length > 0 && (
          <table className="w-full text-xs">
            <thead className="text-left"><tr><th>Item</th><th>Reason</th><th className="text-right">Amount</th><th className="pl-2">Status</th></tr></thead>
            <tbody>
              {deductions.map((d) => (
                <tr key={d.id} className="border-t align-top">
                  <td>{d.item_name}{d.owner_note && <div className="text-muted-foreground">Owner: {d.owner_note}</div>}{d.tenant_note && <div className="text-muted-foreground">Tenant: {d.tenant_note}</div>}</td>
                  <td>{d.reason.toLowerCase()}</td><td className="text-right">{inr(d.amount)}</td><td className="pl-2">{d.status.toLowerCase()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <h2 className="font-semibold">{all ? "All items" : "Changed items"} ({items.length})</h2>
      {items.map((c) => (
        <div key={c.itemId} className="print-avoid space-y-1 rounded border p-2 text-sm">
          <p className="font-medium">
            {c.roomName} · {c.itemName}
            {c.flags.worse && <span className="ml-2 rounded bg-red-100 px-1 text-xs text-red-900">Worse</span>}
            {c.flags.missing && <span className="ml-2 rounded bg-zinc-800 px-1 text-xs text-white">Missing</span>}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <SideCol tenancyId={id} label="Move-in" side={c.in} />
            <SideCol tenancyId={id} label="Move-out" side={c.out} />
          </div>
        </div>
      ))}
      <PrintFooter />
    </div>
  );
}

function SideCol({ tenancyId, label, side }: { tenancyId: string; label: string; side: Side | null }) {
  const r = side && ratingInfo(side.rating);
  return (
    <div className="space-y-1 text-xs">
      <p><span className="text-muted-foreground">{label}:</span> {r ? `${r.value} · ${r.label}` : "Not rated"}</p>
      {side?.notes && <p>{side.notes}</p>}
      <div className="grid grid-cols-2 gap-1">
        {side?.photos.slice(0, 4).map((p) => (
          // eslint-disable-next-line @next/next/no-img-element -- member-checked photo route
          <img key={p.id} src={`/t/${tenancyId}/photo/${p.id}`} alt={label} className="aspect-[4/3] w-full rounded object-cover" />
        ))}
      </div>
    </div>
  );
}
