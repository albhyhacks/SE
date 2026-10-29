"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db, tx } from "@/lib/db";
import { createReport } from "@/lib/reports";
import { initiatorRole } from "@/lib/state";
import { logEvent } from "@/lib/audit";

const Join = z.object({ code: z.string().min(1).max(20), name: z.string().trim().min(2, "Enter your name").max(60) });

export async function joinTenancy(_: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const user = await requireUser();
  const p = Join.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const t = db().prepare("select id from tenancies where invite_code = ?").get(p.data.code) as { id: string } | undefined;
  if (!t) return { error: "This invite link is not valid." };
  // The free role is decided here, never trusted from the form. unique(tenancy_id, role) stops races.
  const taken = db().prepare("select user_id, role from members where tenancy_id = ?").all(t.id) as { user_id: string; role: string }[];
  if (!taken.some((m) => m.user_id === user.id)) {
    const role = ["OWNER", "TENANT"].find((r) => !taken.some((m) => m.role === r));
    if (!role) return { error: "Both owner and tenant have already joined this tenancy." };
    try {
      tx(() => {
        db().prepare("insert into members (tenancy_id, user_id, role, display_name) values (?, ?, ?, ?)").run(t.id, user.id, role, p.data.name);
        // Owner-created tenancy: the move-in report starts now, owned by the tenant who records it.
        const hasMoveIn = db().prepare("select 1 from reports where tenancy_id = ? and type = 'MOVE_IN'").get(t.id);
        if (!hasMoveIn && role === initiatorRole("MOVE_IN", true)) createReport(t.id, "MOVE_IN", user.id);
      });
    } catch {
      return { error: "Someone else just joined. Refresh and try again." };
    }
    logEvent(t.id, user.id, "member.joined", { role });
  }
  redirect(`/t/${t.id}`);
}
