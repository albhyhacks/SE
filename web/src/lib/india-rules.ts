// Deposit caps and refund-due date (information, not legal advice).
export type StateCode = "TN" | "MTA" | "OTHER";

export const STATE_LABELS: Record<StateCode, string> = {
  TN: "Tamil Nadu",
  MTA: "State that adopted the Model Tenancy Act",
  OTHER: "Other state",
};

export function depositCapMonths(state: StateCode): number | null {
  return state === "TN" ? 3 : state === "MTA" ? 2 : null;
}

export function depositWarning(state: StateCode, rent: number, deposit: number): string | null {
  const cap = depositCapMonths(state);
  if (!cap || !(rent > 0) || deposit <= cap * rent) return null;
  const months = Math.round((deposit / rent) * 10) / 10;
  const law =
    state === "TN"
      ? `Tamil Nadu's law caps it at ${cap} months unless your agreement says otherwise.`
      : `The Model Tenancy Act suggests a ${cap}-month cap where your state has adopted it.`;
  return `Your deposit is ${months} months' rent. ${law}`;
}

/** TN: one month after move-out. Others: null ("check your agreement"). Dates are YYYY-MM-DD. */
export function refundDueDate(state: StateCode, moveOutDate: string): string | null {
  if (state !== "TN") return null;
  const [y, m, d] = moveOutDate.split("-").map(Number);
  // Clamp to the last day of next month (31 Jan → 28/29 Feb).
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d, last))).toISOString().slice(0, 10);
}
