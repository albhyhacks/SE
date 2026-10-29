import { describe, expect, it } from "vitest";
import { fmtIST, inr } from "./format";

describe("format", () => {
  it("shows times in IST regardless of server zone", () => {
    // 20:00 UTC = 01:30 next day IST
    expect(fmtIST("2026-10-28T20:00:00Z")).toMatch(/29 Oct 2026.*1:30/);
    expect(fmtIST(null)).toBe("—");
  });
  it("formats rupees with Indian grouping", () => {
    expect(inr(1234567)).toBe("₹12,34,567");
  });
});
