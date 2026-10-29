import { describe, expect, it } from "vitest";
import { REPORT_EVENTS, assertTransition, canReview, canSelfLock, canSubmit, initiatorRole, targetStatus } from "./state";
import type { ReportStatus } from "@/lib/tenancies";

const STATUSES: ReportStatus[] = ["DRAFT", "REVIEW", "LOCKED"];
const ALLOWED: Record<ReportStatus, Partial<Record<(typeof REPORT_EVENTS)[number], ReportStatus>>> = {
  DRAFT: { submit: "REVIEW", self_lock: "LOCKED" },
  REVIEW: { request_changes: "DRAFT", countersign: "LOCKED", self_lock: "LOCKED" },
  LOCKED: {},
};

describe("transition table", () => {
  it("every allowed status × event passes; every other combination throws", () => {
    for (const status of STATUSES) {
      for (const event of REPORT_EVENTS) {
        expect(targetStatus(status, event)).toBe(ALLOWED[status][event] ?? null);
        if (ALLOWED[status][event]) {
          expect(assertTransition(status, event)).toBe(ALLOWED[status][event]);
        } else {
          expect(() => assertTransition(status, event)).toThrow(/not allowed/);
        }
      }
    }
  });
});

describe("guards", () => {
  it("canSubmit: initiator while DRAFT only", () => {
    expect(canSubmit("DRAFT", true)).toBe(true);
    expect(canSubmit("DRAFT", false)).toBe(false);
    expect(canSubmit("REVIEW", true)).toBe(false);
    expect(canSubmit("LOCKED", true)).toBe(false);
  });

  it("canReview: only the other member while REVIEW", () => {
    expect(canReview("REVIEW", false)).toBe(true);
    expect(canReview("REVIEW", true)).toBe(false);
    expect(canReview("DRAFT", false)).toBe(false);
    expect(canReview("LOCKED", false)).toBe(false);
  });

  it("canSelfLock: initiator, other party not joined, not locked", () => {
    const tree = (status: ReportStatus, created_by = "u1") =>
      ({ report: { status, created_by } });
    expect(canSelfLock(tree("DRAFT"), { user_id: "u1" }, false)).toBe(true);
    expect(canSelfLock(tree("REVIEW"), { user_id: "u1" }, false)).toBe(true);
    expect(canSelfLock(tree("LOCKED"), { user_id: "u1" }, false)).toBe(false);
    expect(canSelfLock(tree("DRAFT"), { user_id: "u1" }, true)).toBe(false);
    expect(canSelfLock(tree("DRAFT"), { user_id: "u2" }, false)).toBe(false);
  });
});

describe("initiatorRole", () => {
  it("tenant records move-in, owner records move-out", () => {
    expect(initiatorRole("MOVE_IN", true)).toBe("TENANT");
    expect(initiatorRole("MOVE_IN", false)).toBe("TENANT");
    expect(initiatorRole("MOVE_OUT", true)).toBe("OWNER");
  });
  it("tenant may record move-out when no owner ever joined", () => {
    expect(initiatorRole("MOVE_OUT", false)).toBe("TENANT");
  });
});
