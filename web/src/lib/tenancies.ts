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

const AUDIT_LABELS: Record<string, string> = {
  "tenancy.created": "Tenancy created",
  "member.joined": "joined",
  "checklist.edited": "Checklist edited",
  "photo.added": "Photo added",
  "photo.deleted": "Photo deleted",
  "comment.added": "Review comment added",
  "report.submitted": "Report submitted and signed",
  "report.changes_requested": "Changes requested",
  "report.locked": "Report countersigned and locked",
  "report.self_locked": "Report locked (self-attested)",
  "moveout.started": "Move-out report started",
  "deduction.proposed": "Deduction proposed",
  "deduction.accepted": "Deduction accepted",
  "deduction.disputed": "Deduction disputed",
  "deduction.withdrawn": "Deduction withdrawn",
};

export function listAudit(tenancyId: string) {
  const rows = db()
    .prepare(
      `select a.action, a.detail, a.created_at, m.display_name, m.role
       from audit_events a left join members m on m.tenancy_id = a.tenancy_id and m.user_id = a.actor_id
       where a.tenancy_id = ? order by a.id desc limit 20`,
    )
    .all(tenancyId) as { action: string; detail: string; created_at: string; display_name: string | null; role: Role | null }[];
  return rows.map((r) => ({
    at: r.created_at,
    text:
      r.action === "member.joined"
        ? `${r.role ? roleLabel(r.role) : "Someone"} joined`
        : `${AUDIT_LABELS[r.action] ?? r.action}${r.display_name ? ` by ${r.display_name}` : ""}`,
  }));
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
