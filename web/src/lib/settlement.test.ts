import { describe, expect, it } from "vitest";
import { refundDueDate } from "./india-rules";
import { canAddDeduction, refundCountdownText, settlementStatus, summarise } from "./settlement";

const d = (status: string, amount: number) => ({ status, amount });

describe("summarise", () => {
  it("totals by status with correct refunds", () => {
    const s = summarise(30000, [d("ACCEPTED", 500), d("PROPOSED", 1200), d("DISPUTED", 300), d("WITHDRAWN", 900)]);
    expect(s).toMatchObject({ accepted: 500, proposed: 1200, disputed: 300, withdrawn: 900, refundNow: 29500, refundIfAllAccepted: 28000 });
  });

  it("empty list means the full deposit back in both senses", () => {
    const s = summarise(30000, []);
    expect(s.refundNow).toBe(30000);
    expect(s.refundIfAllAccepted).toBe(30000);
  });
});

describe("settlementStatus", () => {
  it("follows SPEC §7", () => {
    expect(settlementStatus([])).toBe("NO_DEDUCTIONS");
    expect(settlementStatus([d("PROPOSED", 100)])).toBe("PENDING");
    expect(settlementStatus([d("ACCEPTED", 100), d("PROPOSED", 100)])).toBe("PENDING");
    expect(settlementStatus([d("ACCEPTED", 100), d("DISPUTED", 100)])).toBe("DISPUTED");
    expect(settlementStatus([d("ACCEPTED", 100), d("WITHDRAWN", 100)])).toBe("SETTLED");
    expect(settlementStatus([d("WITHDRAWN", 100)])).toBe("NO_DEDUCTIONS");
  });
});

describe("canAddDeduction", () => {
  it("refuses anything that would push live deductions past the deposit", () => {
    expect(canAddDeduction(30000, [], 30000)).toBe(true);
    expect(canAddDeduction(30000, [], 30001)).toBe(false);
    expect(canAddDeduction(30000, [d("PROPOSED", 29000)], 1000)).toBe(true);
    expect(canAddDeduction(30000, [d("PROPOSED", 29000)], 1001)).toBe(false);
    expect(canAddDeduction(30000, [d("WITHDRAWN", 29000)], 30000)).toBe(true); // withdrawn doesn't count
  });
});

describe("refundCountdownText", () => {
  it("counts down and switches to overdue wording", () => {
    expect(refundCountdownText("2026-11-10", "2026-10-29")).toBe("Refund due in 12 days");
    expect(refundCountdownText("2026-10-30", "2026-10-29")).toBe("Refund due tomorrow");
    expect(refundCountdownText("2026-10-29", "2026-10-29")).toBe("Refund due today");
    expect(refundCountdownText("2026-10-28", "2026-10-29")).toBe("Refund overdue by 1 day");
    expect(refundCountdownText("2026-10-19", "2026-10-29")).toBe("Refund overdue by 10 days");
  });

  it("TN tenancy with move-out date 10 days ago is due in about 3 weeks", () => {
    // move-out 2026-10-19 → due 2026-11-19; today 2026-10-29.
    expect(refundCountdownText(refundDueDate("TN", "2026-10-19")!, "2026-10-29")).toBe("Refund due in 21 days");
  });
});
