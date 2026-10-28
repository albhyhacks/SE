// requireUser(), requireMember(tenancyId), getMembership(), plus OTP + session helpers.
import "server-only";
import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, now } from "@/lib/db";

const SESSION_COOKIE = "mp_session";
const SESSION_DAYS = 30;
const OTP_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_SECONDS = 60;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const inMinutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

export type User = { id: string; email: string };
export type Membership = { role: "OWNER" | "TENANT"; display_name: string };

/** Creates a 6-digit code. Returns false if one was sent less than 60 s ago. */
export function issueOtp(email: string): boolean {
  const prev = db().prepare("select sent_at from otp_codes where email = ?").get(email) as
    | { sent_at: string }
    | undefined;
  if (prev && Date.now() - Date.parse(prev.sent_at) < OTP_RESEND_SECONDS * 1000) return false;
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  db().prepare(
    `insert into otp_codes (email, code_hash, expires_at, attempts, sent_at) values (?, ?, ?, 0, ?)
     on conflict(email) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at,
       attempts = 0, sent_at = excluded.sent_at`,
  ).run(email, sha256(code), inMinutes(OTP_MINUTES), now());
  // ponytail: no mail service while on local SQLite; the code goes to the server console. Plug in SMTP/Resend here.
  console.log(`[MoveProof] login code for ${email}: ${code}`);
  return true;
}

/** Checks the code; on success creates the user if needed and sets the session cookie. */
export async function verifyOtp(email: string, code: string): Promise<boolean> {
  const row = db().prepare("select code_hash, expires_at, attempts from otp_codes where email = ?").get(email) as
    | { code_hash: string; expires_at: string; attempts: number }
    | undefined;
  if (!row || row.expires_at < now() || row.attempts >= OTP_MAX_ATTEMPTS) return false;
  if (row.code_hash !== sha256(code)) {
    db().prepare("update otp_codes set attempts = attempts + 1 where email = ?").run(email);
    return false;
  }
  db().prepare("delete from otp_codes where email = ?").run(email);
  db().prepare("insert into users (id, email) values (?, ?) on conflict(email) do nothing").run(randomUUID(), email);
  const user = db().prepare("select id from users where email = ?").get(email) as { id: string };

  const token = randomBytes(32).toString("base64url");
  db().prepare("insert into sessions (token_hash, user_id, expires_at) values (?, ?, ?)").run(
    sha256(token), user.id, inMinutes(SESSION_DAYS * 24 * 60),
  );
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
  return true;
}

export async function getUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const user = db()
    .prepare(
      `select u.id, u.email from sessions s join users u on u.id = s.user_id
       where s.token_hash = ? and s.expires_at > ?`,
    )
    .get(sha256(token), now()) as User | undefined;
  return user ?? null;
}

export async function signOutUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) db().prepare("delete from sessions where token_hash = ?").run(sha256(token));
  store.delete(SESSION_COOKIE);
}

export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (user) return user;
  const h = await headers();
  const back = h.get("x-pathname") ?? "/dashboard";
  redirect(`/login?next=${encodeURIComponent(back)}`);
}

export function getMembership(tenancyId: string, userId: string): Membership | null {
  const m = db()
    .prepare("select role, display_name from members where tenancy_id = ? and user_id = ?")
    .get(tenancyId, userId) as Membership | undefined;
  return m ?? null;
}

export async function requireMember(tenancyId: string) {
  const user = await requireUser();
  const membership = getMembership(tenancyId, user.id);
  if (!membership) redirect("/dashboard");
  return { user, membership };
}
