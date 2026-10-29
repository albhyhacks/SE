import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { type StateCode, refundDueDate } from "@/lib/india-rules";
import { refundCountdownText, settlementStatus, summarise } from "@/lib/settlement";
import type { DeductionRow } from "@/lib/tenancies";

const LABEL: Record<string, string> = {
  NO_DEDUCTIONS: "No deductions",
  PENDING: "Deductions pending",
  DISPUTED: "Deductions disputed",
  SETTLED: "Settled",
};


const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const REASON: Record<string, string> = { CLEANING: "Cleaning", DAMAGE: "Damage", MISSING: "Missing", OTHER: "Other" };
const STATUS_LABEL: Record<string, string> = { PROPOSED: "Pending", ACCEPTED: "Accepted", DISPUTED: "Disputed", WITHDRAWN: "Withdrawn" };
const STATUS_CLS: Record<string, string> = {
  PROPOSED: "bg-yellow-100 text-yellow-900",
  ACCEPTED: "bg-emerald-100 text-emerald-900",
  DISPUTED: "bg-red-100 text-red-900",
  WITHDRAWN: "bg-muted text-muted-foreground line-through",
};

export function SettlementCard({ deposit, deductions, stateCode, moveOutDate, tenancyId }: {
  deposit: number; deductions: DeductionRow[]; stateCode: StateCode; moveOutDate: string | null; tenancyId: string;
}) {
  const s = summarise(deposit, deductions);
  const status = settlementStatus(deductions);
  const due = moveOutDate && stateCode === "TN" ? refundDueDate(stateCode, moveOutDate) : null;
  const countdown = due ? refundCountdownText(due, new Date().toISOString().slice(0, 10)) : null;

  return (
    <Card className="space-y-3 p-4 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Deposit settlement</h2>
        <Badge variant={status === "SETTLED" || status === "NO_DEDUCTIONS" ? "default" : "secondary"}>{LABEL[status]}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <span className="text-muted-foreground">Deposit</span><span className="text-right font-medium">{inr(deposit)}</span>
        <span className="text-muted-foreground">Accepted deductions</span><span className="text-right font-medium">{inr(s.accepted)}</span>
        <span className="text-muted-foreground">Proposed (pending)</span><span className="text-right font-medium">{inr(s.proposed)}</span>
        <span className="text-muted-foreground">Disputed</span><span className="text-right font-medium">{inr(s.disputed)}</span>
        <span className="text-muted-foreground">Refund if all accepted</span><span className="text-right font-medium">{inr(s.refundIfAllAccepted)}</span>
        <span className="font-medium">Refund now</span><span className="text-right font-semibold">{inr(s.refundNow)}</span>
      </div>
      {due ? (
        <p className={countdown?.startsWith("Refund overdue") ? "rounded bg-red-50 p-2 text-red-900" : "rounded bg-muted p-2"}>
          {countdown} <span className="text-muted-foreground">({due})</span> — Tamil Nadu’s law says the deposit should be refunded within a month of vacating. This is information, not legal advice.
        </p>
      ) : (
        <p className="rounded bg-muted p-2 text-muted-foreground">Check your agreement for the refund timeline.</p>
      )}
      {deductions.length > 0 && (
        <table className="w-full text-xs">
          <thead className="text-left text-muted-foreground">
            <tr><th className="py-1 font-normal">Item</th><th className="font-normal">Reason</th><th className="text-right font-normal">Amount</th><th className="pl-2 font-normal">Status</th></tr>
          </thead>
          <tbody className="divide-y">
            {deductions.map((d) => (
              <tr key={d.id} className="align-top">
                <td className="py-1.5 pr-1">
                  <Link href={`/t/${tenancyId}/compare`} className="underline">{d.item_name}</Link>
                  {d.owner_note && <p className="text-muted-foreground">Owner: {d.owner_note}</p>}
                  {d.tenant_note && <p className="text-muted-foreground">Tenant: {d.tenant_note}</p>}
                </td>
                <td>{REASON[d.reason] ?? d.reason}</td>
                <td className="text-right font-medium">{inr(d.amount)}</td>
                <td className="pl-2"><span className={`rounded px-1 py-0.5 ${STATUS_CLS[d.status] ?? ""}`}>{STATUS_LABEL[d.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

