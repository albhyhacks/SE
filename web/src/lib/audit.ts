// logEvent(): append-only audit trail per tenancy. Never throws to the caller.
import "server-only";
import { db } from "@/lib/db";

export function logEvent(tenancyId: string, actorId: string | null, action: string, detail: object = {}) {
  try {
    db().prepare("insert into audit_events (tenancy_id, actor_id, action, detail) values (?, ?, ?, ?)").run(
      tenancyId, actorId, action, JSON.stringify(detail),
    );
  } catch (err) {
    console.error("[MoveProof] audit log failed", action, err);
  }
}
