"use server";
// Deductions and responses (SPEC F16–F17). The owner proposes; the tenant accepts or disputes
// per item; the owner withdraws. Every action re-checks role, MOVE_OUT lock state, membership
// and the deposit ceiling server-side — the hidden buttons are never the only defence.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { logEvent } from "@/lib/audit";
import { requireMember } from "@/lib/auth";
import { db, now, tx } from "@/lib/db";
import { canAddDeduction } from "@/lib/settlement";

const Id = z.string().uuid();
// Form values arrive as strings.
const Amount = z.coerce.number().int().min(1).max(10_000_000);
const Reason = z.enum(["CLEANING", "DAMAGE", "MISSING", "OTHER"]);
const Note = z.string().trim().max(1000).transform((s) => s || null);

export type Result = { error?: string };

function refresh(tenancyId: string) {
  revalidatePath(`/t/${tenancyId}/compare`, "layout");
  revalidatePath(`/t/${tenancyId}`, "layout");
}

/** Context shared by all deduction actions: tenancy + both statuses + the user's role. */
async function guard(tenancyId: string) {
  const tenancy = db()
    .prepare("select id, deposit from tenancies where id = ?")
    .get(tenancyId) as { id: string; deposit: number } | undefined;
  if (!tenancy) throw new Error("Tenancy not found");
  const { user, membership } = await requireMember(tenancyId);
  const moveOut = db()
    .prepare("select id, status from reports where tenancy_id = ? and type = 'MOVE_OUT'")
    .get(tenancyId) as { id: string; status: string } | undefined;
  return { user, membership, tenancy, moveOut };
}

/** Propose a deduction on an item of this tenancy (owner, MOVE_OUT LOCKED). */
export async function proposeDeduction(tenancyId: string, itemId: string, amount: unknown, reason: unknown, note: unknown): Promise<Result> {
  const g = await guard(tenancyId);
  if (g.membership.role !== "OWNER") return { error: "Only the owner can propose deductions." };
  if (!g.moveOut || g.moveOut.status !== "LOCKED") {
    return { error: "Deductions can only be proposed once the move-out report is locked." };
  }
  const item = db()
    .prepare("select i.id, i.name from items i join rooms r on r.id = i.room_id where i.id = ? and r.tenancy_id = ?")
    .get(Id.parse(itemId), tenancyId) as { id: string; name: string } | undefined;
  if (!item) return { error: "Item not found" };

  const a = Amount.safeParse(amount);
  const re = Reason.safeParse(reason);
  const n = Note.safeParse(note);
  if (!a.success) return { error: "Enter the amount in whole rupees (₹1 or more)." };
  if (!re.success) return { error: "Pick a reason." };
  if (!n.success) return { error: "Keep the note under 1000 characters." };

  // Check and insert in one write transaction so two quick proposals can't both pass the deposit check.
  const ok = tx(() => {
    const existing = db().prepare("select status, amount from deductions where tenancy_id = ?").all(tenancyId) as { status: string; amount: number }[];
    if (!canAddDeduction(g.tenancy.deposit, existing, a.data)) return false;
    db().prepare(
      "insert into deductions (id, tenancy_id, item_id, amount, reason, owner_note, status) values (?, ?, ?, ?, ?, ?, 'PROPOSED')",
    ).run(randomUUID(), tenancyId, item.id, a.data, re.data, n.data);
    return true;
  });
  if (!ok) return { error: "These deductions would add up to more than the deposit. Withdraw or accept some first." };
  logEvent(tenancyId, g.user.id, "deduction.proposed", { item: item.name, amount: a.data, reason: re.data });
  refresh(tenancyId);
  return {};
}

/** Tenant responds to one deduction: accept, or dispute with a required note. */
export async function respondDeduction(tenancyId: string, deductionId: string, response: "ACCEPTED" | "DISPUTED", note: unknown): Promise<Result> {
  const g = await guard(tenancyId);
  if (g.membership.role !== "TENANT") return { error: "Only the tenant can accept or dispute a deduction." };

  const d = db()
    .prepare("select id, item_id, amount, status from deductions where id = ? and tenancy_id = ?")
    .get(Id.parse(deductionId), tenancyId) as { id: string; item_id: string; amount: number; status: string } | undefined;
  if (!d) return { error: "Deduction not found" };
  if (d.status !== "PROPOSED") return { error: "This deduction was already handled." };

  if (response !== "ACCEPTED" && response !== "DISPUTED") return { error: "Pick accept or dispute." };
  const n = Note.safeParse(note);
  if (!n.success) return { error: "Keep the note under 1000 characters." };
  if (response === "DISPUTED" && !n.data) return { error: "Write a note explaining the dispute." };

  const changed = db().prepare("update deductions set status = ?, tenant_note = ?, responded_at = ? where id = ? and status = 'PROPOSED'")
    .run(response, n.data, now(), d.id).changes;
  if (!changed) return { error: "This deduction was already handled." };
  logEvent(tenancyId, g.user.id, response === "ACCEPTED" ? "deduction.accepted" : "deduction.disputed", { amount: d.amount, note: n.data });
  refresh(tenancyId);
  return {};
}

/** Owner withdraws a PROPOSED or DISPUTED deduction. Amount changes = withdraw + propose anew. */
export async function withdrawDeduction(tenancyId: string, deductionId: string): Promise<Result> {
  const g = await guard(tenancyId);
  if (g.membership.role !== "OWNER") return { error: "Only the owner can withdraw a deduction." };
  const d = db()
    .prepare("select id, amount, status from deductions where id = ? and tenancy_id = ?")
    .get(Id.parse(deductionId), tenancyId) as { id: string; amount: number; status: string } | undefined;
  if (!d) return { error: "Deduction not found" };
  if (d.status !== "PROPOSED" && d.status !== "DISPUTED") return { error: "Only proposed or disputed deductions can be withdrawn." };

  const changed = db().prepare("update deductions set status = 'WITHDRAWN', responded_at = ? where id = ? and status in ('PROPOSED','DISPUTED')")
    .run(now(), d.id).changes;
  if (!changed) return { error: "This deduction was already handled." };
  logEvent(tenancyId, g.user.id, "deduction.withdrawn", { amount: d.amount });
  refresh(tenancyId);
  return {};
}
