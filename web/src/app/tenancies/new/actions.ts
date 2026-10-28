"use server";
import { randomBytes, randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db, tx } from "@/lib/db";
import { logEvent } from "@/lib/audit";
import { TEMPLATES } from "@/lib/templates";

const Rupees = z.coerce.number().int().min(0).max(100_000_000);
const NewTenancy = z.object({
  address: z.string().trim().min(5, "Enter the full address").max(300),
  state: z.enum(["TN", "MTA", "OTHER"]),
  rent: Rupees.refine((n) => n > 0, "Enter the monthly rent"),
  deposit: Rupees,
  role: z.enum(["OWNER", "TENANT"]),
  name: z.string().trim().min(2, "Enter your name").max(60),
  template: z.enum(TEMPLATES.map((t) => t.id) as [string, ...string[]]),
});

export type FormState = { error?: string };

export async function createTenancy(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const p = NewTenancy.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const v = p.data;
  const template = TEMPLATES.find((t) => t.id === v.template)!;
  const tenancyId = randomUUID();

  tx(() => {
    const d = db();
    d.prepare(
      "insert into tenancies (id, created_by, address, state_code, monthly_rent, deposit, invite_code) values (?, ?, ?, ?, ?, ?, ?)",
    ).run(tenancyId, user.id, v.address, v.state, v.rent, v.deposit, randomBytes(8).toString("base64url").slice(0, 10));
    d.prepare("insert into members (tenancy_id, user_id, role, display_name) values (?, ?, ?, ?)").run(tenancyId, user.id, v.role, v.name);
    const reportId = randomUUID();
    d.prepare("insert into reports (id, tenancy_id, type, created_by) values (?, ?, 'MOVE_IN', ?)").run(reportId, tenancyId, user.id);
    const addRoom = d.prepare("insert into rooms (id, tenancy_id, name, sort) values (?, ?, ?, ?)");
    const addItem = d.prepare("insert into items (id, room_id, name, is_overview, sort) values (?, ?, ?, ?, ?)");
    const addEntry = d.prepare("insert into entries (id, report_id, item_id) values (?, ?, ?)");
    template.rooms.forEach((r, ri) => {
      const roomId = randomUUID();
      addRoom.run(roomId, tenancyId, r.name, ri);
      r.items.forEach((it, ii) => {
        const itemId = randomUUID();
        addItem.run(itemId, roomId, it.name, it.is_overview ? 1 : 0, ii);
        addEntry.run(randomUUID(), reportId, itemId);
      });
    });
  });
  logEvent(tenancyId, user.id, "tenancy.created", { template: template.id, role: v.role });
  redirect(`/t/${tenancyId}`);
}
