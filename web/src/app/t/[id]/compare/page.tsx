import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { compare } from "@/lib/comparison";
import { loadReport } from "@/lib/reports";
import { getTenancy } from "@/lib/tenancies";
import { AppHeader } from "@/components/app-header";
import { StatusBadge } from "@/components/status-badge";
import { ComparisonList } from "./comparison-list";

export default async function ComparePage({ params }: PageProps<"/t/[id]/compare">) {
  const { id } = await params;
  const { user } = await requireMember(id);
  const data = getTenancy(id);
  if (!data) notFound();
  const { moveIn, moveOut } = data;
  const inTree = moveIn ? loadReport(id, moveIn.id) : null;
  const outTree = moveOut ? loadReport(id, moveOut.id) : null;
  if (!inTree || !outTree) notFound();
  const comparison = compare(inTree, outTree);

  return (
    <>
      <AppHeader user={user} />
      <Link href={`/t/${id}`} className="text-sm text-muted-foreground">← Tenancy</Link>
      <h1 className="mt-1 text-xl font-bold">Move-in vs move-out</h1>
      <div className="mb-3 flex items-center gap-2">
        <StatusBadge status={moveOut?.status as "DRAFT" | "REVIEW" | "LOCKED" ?? null} selfAttested={!!moveOut?.self_attested} />
        <span className="text-sm text-muted-foreground">move-out</span>
      </div>
      {moveOut?.status !== "LOCKED" && (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          ⚠️ Move-out not locked yet — the comparison may change until both parties sign it.
        </p>
      )}

      <div className="mb-4 grid grid-cols-4 gap-2 text-center text-xs">
        <div className="rounded-lg border p-2"><span className="block text-lg font-semibold">{comparison.counts.unchanged}</span>same</div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-2"><span className="block text-lg font-semibold text-red-800">{comparison.counts.worse}</span>worse</div>
        <div className="rounded-lg border border-zinc-300 bg-zinc-800 p-2 text-white"><span className="block text-lg font-semibold">{comparison.counts.missing}</span>missing</div>
        <div className="rounded-lg border p-2"><span className="block text-lg font-semibold text-muted-foreground">{comparison.counts.notCaptured}</span>not captured</div>
      </div>

      <ComparisonList
        tenancyId={id}
        items={comparison.items.map((c) => ({ ...c, in: { ...c.in }, out: c.out && { ...c.out } }))}
      />
    </>
  );
}
