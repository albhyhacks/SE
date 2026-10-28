"use server";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { db, tx } from "@/lib/db";
import { logEvent } from "@/lib/audit";

const Name = z.string().trim().min(1).max(80);
const Id = z.string().uuid();

/** Only the move-in initiator, only while move-in is DRAFT; stale submissions are sent back with a message. */
async function guard(tenancyId: string) {
  const { user } = await requireMember(tenancyId);
  const r = db()
    .prepare("select id, status, created_by from reports where tenancy_id = ? and type = 'MOVE_IN'")
    .get(tenancyId) as { id: string; status: string; created_by: string } | undefined;
  if (!r) throw new Error("Move-in report not found");
  const back = `/t/${tenancyId}/r/${r.id}`;
  if (r.created_by !== user.id) redirect(`${back}?msg=not-yours`);
  if (r.status !== "DRAFT") redirect(`${back}?msg=locked`);
  return { user, reportId: r.id, back };
}

/** The DB triggers are the last line of defence: a late freeze is caught and shown as a message. */
function protect(back: string, fn: () => void) {
  try {
    fn();
  } catch (err) {
    if (/frozen|another tenancy|locked/.test((err as Error).message ?? "")) redirect(`${back}?msg=locked`);
    throw err;
  }
}

function done(tenancyId: string, userId: string, what: string) {
  logEvent(tenancyId, userId, "checklist.edited", { what });
  revalidatePath(`/t/${tenancyId}`, "layout");
}

const nextSort = (sql: string, id: string) => ((db().prepare(sql).get(id) as { s: number | null }).s ?? -1) + 1;

export async function addRoom(tenancyId: string, form: FormData) {
  const { user, reportId, back } = await guard(Id.parse(tenancyId));
  const name = Name.parse(form.get("name"));
  tx(() => protect(back, () => {
    const roomId = randomUUID();
    const itemId = randomUUID();
    db().prepare("insert into rooms (id, tenancy_id, name, sort) values (?, ?, ?, ?)")
      .run(roomId, tenancyId, name, nextSort("select max(sort) s from rooms where tenancy_id = ?", tenancyId));
    db().prepare("insert into items (id, room_id, name, is_overview, sort) values (?, ?, 'Room overview', 1, 0)").run(itemId, roomId);
    db().prepare("insert into entries (id, report_id, item_id) values (?, ?, ?)").run(randomUUID(), reportId, itemId);
  }));
  done(tenancyId, user.id, `room added: ${name}`);
}

export async function addItem(tenancyId: string, roomId: string, form: FormData) {
  const { user, reportId, back } = await guard(Id.parse(tenancyId));
  const name = Name.parse(form.get("name"));
  tx(() => protect(back, () => {
    const room = db().prepare("select id from rooms where id = ? and tenancy_id = ?").get(Id.parse(roomId), tenancyId);
    if (!room) throw new Error("Room not found");
    const itemId = randomUUID();
    db().prepare("insert into items (id, room_id, name, sort) values (?, ?, ?, ?)")
      .run(itemId, roomId, name, nextSort("select max(sort) s from items where room_id = ?", roomId));
    db().prepare("insert into entries (id, report_id, item_id) values (?, ?, ?)").run(randomUUID(), reportId, itemId);
  }));
  done(tenancyId, user.id, `item added: ${name}`);
}

export async function renameRoom(tenancyId: string, roomId: string, form: FormData) {
  const { user, back } = await guard(Id.parse(tenancyId));
  const name = Name.parse(form.get("name"));
  protect(back, () => db().prepare("update rooms set name = ? where id = ? and tenancy_id = ?").run(name, Id.parse(roomId), tenancyId));
  done(tenancyId, user.id, `room renamed: ${name}`);
}

export async function renameItem(tenancyId: string, itemId: string, form: FormData) {
  const { user, back } = await guard(Id.parse(tenancyId));
  const name = Name.parse(form.get("name"));
  protect(back, () => db().prepare(
    "update items set name = ? where id = ? and is_overview = 0 and room_id in (select id from rooms where tenancy_id = ?)",
  ).run(name, Id.parse(itemId), tenancyId));
  done(tenancyId, user.id, `item renamed: ${name}`);
}

// Rows are removed child-first (photos → entries → items → room). Photo files stay on disk;
// they are content-addressed, so an orphan file is harmless.
const ITEM_SCOPE = "select id from items where id = ? and is_overview = 0 and room_id in (select id from rooms where tenancy_id = ?)";

export async function removeItem(tenancyId: string, itemId: string) {
  const { user, back } = await guard(Id.parse(tenancyId));
  Id.parse(itemId);
  tx(() => protect(back, () => {
    const d = db();
    d.prepare(`delete from photos where entry_id in (select id from entries where item_id in (${ITEM_SCOPE}))`).run(itemId, tenancyId);
    d.prepare(`delete from entries where item_id in (${ITEM_SCOPE})`).run(itemId, tenancyId);
    d.prepare(`delete from deductions where item_id in (${ITEM_SCOPE})`).run(itemId, tenancyId);
    d.prepare(`delete from items where id in (${ITEM_SCOPE})`).run(itemId, tenancyId);
  }));
  done(tenancyId, user.id, "item removed");
}

export async function removeRoom(tenancyId: string, roomId: string) {
  const { user, back } = await guard(Id.parse(tenancyId));
  Id.parse(roomId);
  const ITEMS = "select i.id from items i join rooms r on r.id = i.room_id where r.id = ? and r.tenancy_id = ?";
  tx(() => protect(back, () => {
    const d = db();
    d.prepare(`delete from photos where entry_id in (select id from entries where item_id in (${ITEMS}))`).run(roomId, tenancyId);
    d.prepare(`delete from entries where item_id in (${ITEMS})`).run(roomId, tenancyId);
    d.prepare(`delete from deductions where item_id in (${ITEMS})`).run(roomId, tenancyId);
    d.prepare(`delete from items where id in (${ITEMS})`).run(roomId, tenancyId);
    d.prepare("delete from rooms where id = ? and tenancy_id = ?").run(roomId, tenancyId);
  }));
  done(tenancyId, user.id, "room removed");
}
