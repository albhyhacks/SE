"use server";
// Start the move-out report (SPEC F14). Only after the move-in report is LOCKED; created by
// whichever member clicks (either party). Entries are created per existing item — the
// checklist itself is frozen by DB triggers at this stage, so there is nothing to clone.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { redirect } from "next/navigation";
import { logEvent } from "@/lib/audit";
import { requireMember } from "@/lib/auth";
import { db, tx } from "@/lib/db";

export type StartMoveOutResult = { error?: string };

// Real calendar dates only (2026-02-30 is refused).
const Date_ = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((d) => {
  const t = Date.parse(`${d}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().startsWith(d);
});

export async function createMoveOut(tenancyId: string, _prev: StartMoveOutResult, form: FormData): Promise<StartMoveOutResult> {
  const { user } = await requireMember(z.string().uuid().parse(tenancyId));

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

  const reportId = randomUUID();
  tx(() => {
    db().prepare("insert into reports (id, tenancy_id, type, created_by) values (?, ?, 'MOVE_OUT', ?)")
      .run(reportId, tenancyId, user.id);
    // One entry per existing item (rooms/items are frozen after the move-in lock).
    const items = db().prepare(
      "select id from items where room_id in (select id from rooms where tenancy_id = ?)",
    ).all(tenancyId) as { id: string }[];
    const ins = db().prepare("insert into entries (id, report_id, item_id) values (?, ?, ?)");
    for (const item of items) ins.run(randomUUID(), reportId, item.id);
    db().prepare("update tenancies set move_out_date = ? where id = ? and move_out_date is null")
      .run(outDate, tenancyId);
  });
  logEvent(tenancyId, user.id, "moveout.started", { reportId, date: outDate });
  redirect(`/t/${tenancyId}/r/${reportId}`);
}
