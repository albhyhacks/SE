// Settlement totals and status (SPEC §3 F16–F18, §7). Pure module — tested and reused by server actions.
export type DeductionStatus = "PROPOSED" | "ACCEPTED" | "DISPUTED" | "WITHDRAWN";
export type DeductionLike = { status: string; amount: number };

export type Settlement = {
  proposed: number;  // total ₹ of PROPOSED deductions
  accepted: number;  // total ₹ of ACCEPTED deductions
  disputed: number;  // total ₹ of DISPUTED deductions
  withdrawn: number; // total ₹ of WITHDRAWN deductions
  refundNow: number;          // deposit − accepted
  refundIfAllAccepted: number; // deposit − (accepted + proposed + disputed)
};

export function summarise(deposit: number, deductions: DeductionLike[]): Settlement {
  const sum = (status: string) => deductions.filter((d) => d.status === status).reduce((t, d) => t + d.amount, 0);
  const accepted = sum("ACCEPTED");
  const proposed = sum("PROPOSED");
  const disputed = sum("DISPUTED");
  return {
    proposed, accepted, disputed, withdrawn: sum("WITHDRAWN"),
    refundNow: deposit - accepted,
    refundIfAllAccepted: deposit - (accepted + proposed + disputed),
  };
}

export type SettlementStatus = "NO_DEDUCTIONS" | "PENDING" | "DISPUTED" | "SETTLED";

/** SPEC §7: PENDING while any PROPOSED; DISPUTED when disputes exist and none pending; SETTLED when all accepted/withdrawn. */
export function settlementStatus(deductions: DeductionLike[]): SettlementStatus {
  const live = deductions.filter((d) => d.status !== "WITHDRAWN");
  if (live.length === 0) return "NO_DEDUCTIONS";
  if (live.some((d) => d.status === "PROPOSED")) return "PENDING";
  if (live.some((d) => d.status === "DISPUTED")) return "DISPUTED";
  return "SETTLED";
}

/** Total of non-withdrawn deductions plus this amount must not exceed the deposit. */
export function canAddDeduction(deposit: number, existing: DeductionLike[], amount: number): boolean {
  const committed = existing.filter((d) => d.status !== "WITHDRAWN").reduce((t, d) => t + d.amount, 0);
  return committed + amount <= deposit;
}

const days = (ms: number) => Math.floor(ms / 86_400_000);

/** Countdown text versus today ("today" injectable for tests). due − today; negative = overdue. */
export function refundCountdownText(dueDate: string, today: string): string {
  const due = Date.parse(`${dueDate}T12:00:00Z`);
  const now = Date.parse(`${today}T12:00:00Z`);
  const n = days(due - now);
  if (n > 1) return `Refund due in ${n} days`;
  if (n === 1) return "Refund due tomorrow";
  if (n === 0) return "Refund due today";
  if (n === -1) return "Refund overdue by 1 day";
  return `Refund overdue by ${-n} days`;
}
