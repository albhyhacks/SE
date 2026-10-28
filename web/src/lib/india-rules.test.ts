import { describe, expect, it } from "vitest";
import { depositCapMonths, depositWarning, refundDueDate } from "./india-rules";

describe("india-rules", () => {
  it("caps", () => {
    expect(depositCapMonths("TN")).toBe(3);
    expect(depositCapMonths("MTA")).toBe(2);
    expect(depositCapMonths("OTHER")).toBeNull();
  });
  it("warns only above the cap", () => {
    expect(depositWarning("TN", 10000, 30000)).toBeNull();
    expect(depositWarning("TN", 10000, 50000)).toMatch(/5 months.*Tamil Nadu.*3 months/);
    expect(depositWarning("MTA", 10000, 25000)).toMatch(/Model Tenancy Act/);
    expect(depositWarning("OTHER", 10000, 900000)).toBeNull();
    expect(depositWarning("TN", 10000, 50000)).not.toMatch(/illegal/i);
  });
  it("refund due one month later in TN", () => {
    expect(refundDueDate("TN", "2026-05-15")).toBe("2026-06-15");
    expect(refundDueDate("TN", "2026-01-31")).toBe("2026-02-28");
    expect(refundDueDate("TN", "2026-12-10")).toBe("2027-01-10");
    expect(refundDueDate("MTA", "2026-05-15")).toBeNull();
  });
});
