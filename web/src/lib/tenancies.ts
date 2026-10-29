// Tenancy queries shared by dashboard, tenancy home and join pages.
import "server-only";
import { db } from "@/lib/db";
import type { StateCode } from "@/lib/india-rules";

export type Role = "OWNER" | "TENANT";
export type ReportStatus = "DRAFT" | "REVIEW" | "LOCKED";
export type Tenancy = {
  id: string; address: string; state_code: StateCode; monthly_rent: number; deposit: number;
  move_out_date: string | null; invite_code: string; created_by: string;
};
export type Member = { user_id: string; role: Role; display_name: string };
export type ReportRow = { id: string; type: "MOVE_IN" | "MOVE_OUT"; status: ReportStatus; created_by: string; self_attested: number };

export const otherRole = (r: Role): Role => (r === "OWNER" ? "TENANT" : "OWNER");
export const roleLabel = (r: Role) => (r === "OWNER" ? "Owner" : "Tenant");

export function getTenancy(id: string) {
  const d = db();
  const tenancy = d.prepare("select * from tenancies where id = ?").get(id) as Tenancy | undefined;
  if (!tenancy) return null;
  const members = d.prepare("select user_id, role, display_name from members where tenancy_id = ?").all(id) as Member[];
  const reports = d.prepare("select id, type, status, created_by, self_attested from reports where tenancy_id = ?").all(id) as ReportRow[];
  return {
    tenancy,
    members,
    moveIn: reports.find((r) => r.type === "MOVE_IN") ?? null,
    moveOut: reports.find((r) => r.type === "MOVE_OUT") ?? null,
  };
}

export function listTenancies(userId: string) {
  return db()
    .prepare(
      `select t.id, t.address, m.role,
         (select status from reports where tenancy_id = t.id and type = 'MOVE_IN') as move_in,
         (select status from reports where tenancy_id = t.id and type = 'MOVE_OUT') as move_out
       from members m join tenancies t on t.id = m.tenancy_id
       where m.user_id = ? order by t.created_at desc`,
    )
    .all(userId) as { id: string; address: string; role: Role; move_in: ReportStatus | null; move_out: ReportStatus | null }[];
}

type AuditDetail = { type?: string; item?: string; amount?: number; role?: Role; what?: string };

/** One plain sentence per audit action, e.g. "Priya signed the move-in report". */
function auditSentence(action: string, who: string, d: AuditDetail) {
  const report = d.type === "MOVE_OUT" ? "the move-out report" : d.type === "MOVE_IN" ? "the move-in report" : "the report";
  const amt = d.amount ? ` of ₹${d.amount.toLocaleString("en-IN")}` : "";
  const on = d.item ? ` on ${d.item}` : "";
  switch (action) {
    case "tenancy.created": return `${who} created the tenancy`;
    case "member.joined": return `${who} joined as ${d.role ? roleLabel(d.role).toLowerCase() : "member"}`;
    case "checklist.edited": return `${who} edited the checklist${d.what ? ` (${d.what})` : ""}`;
    case "photo.added": return `${who} added a photo${on}`;
    case "photo.deleted": return `${who} deleted a photo${on}`;
    case "comment.added": return `${who} commented${on}`;
    case "report.submitted": return `${who} submitted and signed ${report}`;
    case "report.changes_requested": return `${who} asked for changes to ${report}`;
    case "report.locked": return `${who} signed ${report} — now locked`;
    case "report.self_locked": return `${who} locked ${report} alone (self-attested)`;
    case "moveout.started": return `${who} started the move-out report`;
    case "deduction.proposed": return `${who} proposed a deduction${amt}${on}`;
    case "deduction.accepted": return `${who} accepted a deduction${amt}`;
    case "deduction.disputed": return `${who} disputed a deduction${amt}`;
    case "deduction.withdrawn": return `${who} withdrew a deduction${amt}`;
    default: return `${who}: ${action}`;
  }
}

export function listAudit(tenancyId: string) {
  const rows = db()
    .prepare(
      `select a.action, a.detail, a.created_at, m.display_name, m.role
       from audit_events a left join members m on m.tenancy_id = a.tenancy_id and m.user_id = a.actor_id
       where a.tenancy_id = ? order by a.id desc limit 20`,
    )
    .all(tenancyId) as { action: string; detail: string; created_at: string; display_name: string | null; role: Role | null }[];
  return rows.map((r) => {
    let detail: AuditDetail = {};
    try { detail = JSON.parse(r.detail); } catch { /* keep empty */ }
    return { at: r.created_at, text: auditSentence(r.action, r.display_name ?? "Someone", detail) };
  });
}

export type DeductionRow = {
  id: string; item_id: string; item_name: string; amount: number; reason: string;
  status: "PROPOSED" | "ACCEPTED" | "DISPUTED" | "WITHDRAWN"; owner_note: string | null; tenant_note: string | null;
};

export function listDeductions(tenancyId: string) {
  return db()
    .prepare(
      `select d.id, d.item_id, i.name as item_name, d.amount, d.reason, d.status, d.owner_note, d.tenant_note
       from deductions d join items i on i.id = d.item_id where d.tenancy_id = ? order by d.rowid`,
    )
    .all(tenancyId)
    .map((r) => ({ ...r })) as DeductionRow[];
}
