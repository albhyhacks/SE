// Public verification page (no login). Shows no address, photos, emails or notes (N05).
import type { Metadata } from "next";
import Link from "next/link";
import { verifyReport } from "@/lib/reports";
import { Card } from "@/components/ui/card";
import { HashCheck } from "./hash-check";

export const metadata: Metadata = { title: "Verify report · MoveProof", robots: { index: false } };

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");

export default async function VerifyPage({ params }: PageProps<"/verify/[reportId]">) {
  const { reportId } = await params;
  const v = /^[0-9a-f-]{36}$/.test(reportId) ? verifyReport(reportId) : ({ found: false } as const);

  return (
    <div className="space-y-5">
      <Link href="/" className="font-bold">MoveProof</Link>
      <h1 className="text-2xl font-bold">Report verification</h1>
      {!v.found ? (
        <Card className="p-4">
          <p className="font-medium">Report not found.</p>
          <p className="text-sm text-muted-foreground">Check the link or QR code. The report may have been removed or the address mistyped.</p>
        </Card>
      ) : (
        <>
          <div
            data-result={v.result}
            className={
              v.result === "UNCHANGED" ? "rounded-xl bg-emerald-50 p-4 text-emerald-900"
              : v.result === "MISMATCH" ? "rounded-xl bg-red-50 p-4 text-red-900"
              : "rounded-xl bg-muted p-4"
            }
          >
            <p className="text-xl font-bold">
              {v.result === "UNCHANGED" ? `✓ Unchanged since ${fmt(v.lockedAt)}` : v.result === "MISMATCH" ? "✗ Does not match" : "Not locked yet"}
            </p>
            <p className="text-sm">
              {v.result === "UNCHANGED" ? "The contents today produce exactly the hash both parties signed."
                : v.result === "MISMATCH" ? "The contents today do not produce the hash that was signed. Treat this record with caution."
                : "This report is still being prepared or reviewed, so there is nothing final to verify."}
            </p>
          </div>
          {v.selfAttested && (
            <p className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-900">Self-attested: locked by one party only. The other party did not sign.</p>
          )}
          <Card className="grid grid-cols-2 gap-x-3 gap-y-1 p-4 text-sm">
            <span className="text-muted-foreground">Report</span><span>{v.type === "MOVE_IN" ? "Move-in" : "Move-out"}</span>
            <span className="text-muted-foreground">Locked</span><span>{fmt(v.lockedAt)}</span>
            <span className="text-muted-foreground">Items</span><span>{v.itemCount}</span>
            <span className="text-muted-foreground">Photos</span><span>{v.photoCount}</span>
            {v.signers.map((s) => (
              <span key={s.role + s.signedAt} className="contents">
                <span className="text-muted-foreground">{s.role === "OWNER" ? "Owner" : "Tenant"} signed</span>
                <span>{s.firstName} · {fmt(s.signedAt)}</span>
              </span>
            ))}
          </Card>
          <Card className="space-y-2 p-4 text-xs">
            <p className="text-muted-foreground">Stored hash</p>
            <p className="break-all font-mono">{v.storedHash ?? "—"}</p>
            <p className="text-muted-foreground">Recomputed now</p>
            <p className="break-all font-mono">{v.recomputedHash}</p>
          </Card>
          {v.storedHash && <HashCheck hash={v.storedHash} />}
          <p className="text-xs text-muted-foreground">MoveProof produces an evidence record, not a legal contract.</p>
        </>
      )}
    </div>
  );
}
