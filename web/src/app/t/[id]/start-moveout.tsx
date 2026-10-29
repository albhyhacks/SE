"use server";
// Start the move-out report (SPEC F14). Only after the move-in report is LOCKED. The owner records
// move-out (the tenant only if no owner ever joined). Entries are created per existing item — the
// checklist itself is frozen by DB triggers at this stage, so there is nothing to clone.
import { z } from "zod";
import { redirect } from "next/navigation";
import { logEvent } from "@/lib/audit";
import { requireMember } from "@/lib/auth";
import { db, tx } from "@/lib/db";
import { createReport } from "@/lib/reports";
import { initiatorRole } from "@/lib/state";

export type StartMoveOutResult = { error?: string };

// Real calendar dates only (2026-02-30 is refused).
const Date_ = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((d) => {
  const t = Date.parse(`${d}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().startsWith(d);
});

export async function createMoveOut(tenancyId: string, _prev: StartMoveOutResult, form: FormData): Promise<StartMoveOutResult> {
  const { user, membership } = await requireMember(z.string().uuid().parse(tenancyId));
  const ownerJoined = !!db().prepare("select 1 from members where tenancy_id = ? and role = 'OWNER'").get(tenancyId);
  if (membership.role !== initiatorRole("MOVE_OUT", ownerJoined)) return { error: "The owner starts the move-out report." };

  const reports = db()
    .prepare("select id, type, status, created_by from reports where tenancy_id = ?")
    .all(tenancyId) as { id: string; type: "MOVE_IN" | "MOVE_OUT"; status: string; created_by: string }[];
  const moveIn = reports.find((r) => r.type === "MOVE_IN");
  if (!moveIn || moveIn.status !== "LOCKED") {
    return { error: "The move-out report can only start after the move-in report is locked." };
  }
  if (reports.find((r) => r.type === "MOVE_OUT")) return { error: "A move-out report already exists." };

  const parsed = Date_.safeParse(form.get("move_out_date"));
  if (!parsed.success) return { error: "Enter the move-out date." };
  const outDate = parsed.data;

  let reportId = "";
  tx(() => {
    reportId = createReport(tenancyId, "MOVE_OUT", user.id);
    db().prepare("update tenancies set move_out_date = ? where id = ? and move_out_date is null")
      .run(outDate, tenancyId);
  });
  logEvent(tenancyId, user.id, "moveout.started", { reportId, date: outDate });
  redirect(`/t/${tenancyId}/r/${reportId}`);
}
