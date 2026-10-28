"use server";
// Submit / review / sign / lock server actions (SPEC §3 F09–F12, §7).
// Each: Zod → requireMember → state guard → tx(write) → logEvent → revalidatePath.
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { logEvent } from "@/lib/audit";
import { requireMember } from "@/lib/auth";
import { db, now, tx } from "@/lib/db";
import { reportHash, type HashTree } from "@/lib/hash";
import { itemDone } from "@/lib/ratings";
import { loadReport } from "@/lib/reports";
import { assertTransition } from "@/lib/state";

const Id = z.string().uuid();
// matches the DB check length(trim(typed_name)) > 1
const Name = z.string().trim().min(2).max(80);
const Hash = z.string().regex(/^[0-9a-f]{64}$/);

export type Result = { error?: string; stale?: boolean };

function refresh(tenancyId: string, reportId: string) {
  revalidatePath(`/t/${tenancyId}/r/${reportId}`, "layout");
  revalidatePath(`/t/${tenancyId}`, "layout");
}

/** Loads the tree, enforces the state transition and computes the current hash. */
function guardTransition(
  tenancyId: string,
  reportId: string,
  userId: string,
  event: Parameters<typeof assertTransition>[1],
) {
  const data = loadReport(tenancyId, reportId);
  if (!data) return { error: "Report not found" as const };
  const { report, rooms } = data;
  try {
    assertTransition(report.status as Parameters<typeof assertTransition>[0], event);
  } catch (err) {
    return { error: (err as Error).message as string };
  }
  const isInitiator = report.created_by === userId;
  if (event === "submit" || event === "self_lock") {
    if (!isInitiator) return { error: "Only the initiator can do this." as const };
  } else if (isInitiator) {
    return { error: "The initiator cannot review their own report." as const };
  }
  const tree: HashTree = { report, rooms };
  return { data: { report, rooms }, hash: reportHash(tree) };
}

/** 4.3 Submit (initiator, DRAFT): all items validated, initiator signature, → REVIEW. */
export async function submitReport(tenancyId: string, reportId: string, typedName: unknown): Promise<Result> {
  const { user, membership } = await requireMember(Id.parse(tenancyId));
  const g = guardTransition(tenancyId, reportId, user.id, "submit");
  if ("error" in g) return g as Result;
  const name = Name.safeParse(typedName);
  if (!name.success) return { error: "Type your full name to sign." };

  const pending = g.data.rooms.flatMap((r) => r.items).filter((i) => !itemDone(i));
  if (pending.length > 0) {
    const needingPhotos = pending.filter((i) => i.rating !== null).length;
    return {
      error: `${pending.length} items are not complete yet (${needingPhotos} of them also need photos).`,
    };
  }

  tx(() => {
    db().prepare("insert into signatures (report_id, user_id, role, typed_name, report_hash) values (?, ?, ?, ?, ?)")
      .run(g.data.report.id, user.id, membership.role, name.data, g.hash);
    db().prepare("update reports set status = 'REVIEW', submitted_at = ? where id = ?")
      .run(now(), g.data.report.id);
  });
  logEvent(tenancyId, user.id, "report.submitted", { hash: g.hash });
  refresh(tenancyId, reportId);
  return {};
}

/** 4.5 Request changes (other member, REVIEW): needs ≥1 comment, deletes signatures, → DRAFT. */
export async function requestChanges(tenancyId: string, reportId: string): Promise<Result> {
  const { user } = await requireMember(Id.parse(tenancyId));
  const g = guardTransition(tenancyId, reportId, user.id, "request_changes");
  if ("error" in g) return g as Result;

  const comments = db()
    .prepare("select count(*) as n from entries where report_id = ? and reviewer_comment is not null")
    .get(g.data.report.id) as { n: number };
  if (comments.n === 0) return { error: "Add at least one item comment so the initiator knows what to change." };

  tx(() => {
    // Signature deletes are refused only on a LOCKED report; here status is REVIEW, so fine.
    db().prepare("delete from signatures where report_id = ?").run(g.data.report.id);
    db().prepare("update reports set status = 'DRAFT', submitted_at = null where id = ?")
      .run(g.data.report.id);
  });
  logEvent(tenancyId, user.id, "report.changes_requested", {});
  refresh(tenancyId, reportId);
  return {};
}

/** 4.6 Countersign (other member, REVIEW): hashes must all match, then LOCKED. */
export async function countersign(tenancyId: string, reportId: string, seenHash: unknown, typedName: unknown): Promise<Result> {
  const { user, membership } = await requireMember(Id.parse(tenancyId));
  const g = guardTransition(tenancyId, reportId, user.id, "countersign");
  if ("error" in g) return g as Result;
  const seen = Hash.safeParse(seenHash);
  const name = Name.safeParse(typedName);
  if (!seen.success || !name.success) return { error: "Type your full name to sign." };

  const initiatorsSig = db()
    .prepare("select report_hash from signatures where report_id = ? and user_id = ?")
    .get(g.data.report.id, g.data.report.created_by) as { report_hash: string } | undefined;
  if (!initiatorsSig) return { error: "The initiator has not signed yet." };

  // What the reviewer saw (seenHash), what the DB holds now (g.hash) and what the initiator signed must all match.
  if (seen.data !== g.hash || initiatorsSig.report_hash !== g.hash) {
    return {
      stale: true,
      error: "This report changed while you were reviewing. Please reload and review again.",
    };
  }

  tx(() => {
    db().prepare("insert into signatures (report_id, user_id, role, typed_name, report_hash) values (?, ?, ?, ?, ?)")
      .run(g.data.report.id, user.id, membership.role, name.data, g.hash);
    db().prepare("update reports set status = 'LOCKED', content_hash = ?, locked_at = ? where id = ?")
      .run(g.hash, now(), g.data.report.id);
  });
  logEvent(tenancyId, user.id, "report.locked", { hash: g.hash });
  refresh(tenancyId, reportId);
  return {};
}

/** 4.7 Self-attested lock (initiator, DRAFT or REVIEW, other party never joined). */
export async function selfLock(tenancyId: string, reportId: string, typedName: unknown): Promise<Result> {
  const { user, membership } = await requireMember(Id.parse(tenancyId));
  const g = guardTransition(tenancyId, reportId, user.id, "self_lock");
  if ("error" in g) return g as Result;
  const name = Name.safeParse(typedName);
  if (!name.success) return { error: "Type your full name to sign." };

  const members = db().prepare("select count(*) as n from members where tenancy_id = ?").get(tenancyId) as { n: number };
  if (members.n > 1) return { error: "The other party has joined — the report needs both sign-offs." };

  tx(() => {
    db().prepare(
      "insert into signatures (report_id, user_id, role, typed_name, report_hash) values (?, ?, ?, ?, ?) on conflict(report_id, user_id) do nothing",
    ).run(g.data.report.id, user.id, membership.role, name.data, g.hash);
    db().prepare("update reports set status = 'LOCKED', content_hash = ?, locked_at = ?, self_attested = 1 where id = ?")
      .run(g.hash, now(), g.data.report.id);
  });
  logEvent(tenancyId, user.id, "report.self_locked", { hash: g.hash });
  refresh(tenancyId, reportId);
  return {};
}

/** 4.4 Per-item reviewer comment, allowed only while the report is in REVIEW. */
export async function saveReviewerComment(tenancyId: string, reportId: string, itemId: string, comment: unknown): Promise<Result> {
  const { user } = await requireMember(Id.parse(tenancyId));
  const data = loadReport(tenancyId, reportId);
  if (!data) return { error: "Report not found" };
  if (data.report.created_by === user.id || data.report.status !== "REVIEW") {
    return { error: "Comments are only allowed while the report is in review." };
  }
  const item = data.rooms.flatMap((r) => r.items).find((i) => i.id === Id.parse(itemId));
  if (!item) return { error: "Item not found" };

  const text = z.string().trim().max(1000).safeParse(comment);
  if (!text.success) return { error: "Keep comments under 1000 characters." };
  db().prepare("update entries set reviewer_comment = ?, updated_at = ? where id = ?")
    .run(text.data || null, now(), item.entry_id);
  logEvent(tenancyId, user.id, "comment.added", { item: item.name });
  refresh(tenancyId, reportId);
  return {};
}
