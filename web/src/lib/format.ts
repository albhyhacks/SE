// Display helpers. All times shown in India Standard Time, whatever the server's zone.
export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function fmtIST(iso: string | null | undefined, style: "short" | "medium" = "medium") {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: style, timeStyle: "short" });
}

/** Today's date in India as YYYY-MM-DD (the server may run in UTC). */
export const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
