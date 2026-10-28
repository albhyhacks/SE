// Report state machine and guards (SPEC §7). Pure module — tested and reused by server actions.
import type { ReportStatus } from "@/lib/tenancies";

export const REPORT_EVENTS = ["submit", "request_changes", "countersign", "self_lock"] as const;
export type ReportEvent = (typeof REPORT_EVENTS)[number];

const TRANSITIONS: { from: ReportStatus; event: ReportEvent; to: ReportStatus }[] = [
  { from: "DRAFT", event: "submit", to: "REVIEW" },
  { from: "REVIEW", event: "request_changes", to: "DRAFT" },
  { from: "REVIEW", event: "countersign", to: "LOCKED" },
  { from: "DRAFT", event: "self_lock", to: "LOCKED" },
  { from: "REVIEW", event: "self_lock", to: "LOCKED" },
];

/** Target status, or null when this status has no such event. */
export function targetStatus(status: ReportStatus, event: ReportEvent): ReportStatus | null {
  return TRANSITIONS.find((t) => t.from === status && t.event === event)?.to ?? null;
}

/** Throws unless the status has exactly this event. */
export function assertTransition(status: ReportStatus, event: ReportEvent): ReportStatus {
  const to = targetStatus(status, event);
  if (!to) throw new Error(`MoveProof: "${event}" is not allowed while the report is ${status}`);
  return to;
}

// Guards used by server actions, all mirroring SPEC §7.

/** submit: initiator, while DRAFT. */
export const canSubmit = (status: ReportStatus, isInitiator: boolean) => status === "DRAFT" && isInitiator;

/** request_changes / countersign: only the other member, while REVIEW. */
export const canReview = (status: ReportStatus, isInitiator: boolean) => status === "REVIEW" && !isInitiator;

/** self_lock: initiator, other party has not joined the tenancy, report not LOCKED. */
export function canSelfLock(
  tree: { report: { status: ReportStatus; created_by: string } },
  membership: { user_id: string } | null,
  otherJoined: boolean,
): boolean {
  const isInitiator = membership?.user_id === tree.report.created_by;
  return tree.report.status !== "LOCKED" && isInitiator && !otherJoined;
}
