"use server";
import { z } from "zod";
import { issueOtp, signOutUser, verifyOtp } from "@/lib/auth";
import { redirect } from "next/navigation";

const Email = z.string().trim().toLowerCase().email();
const Code = z.string().trim().regex(/^\d{6}$/);

export async function requestCode(email: string) {
  const e = Email.safeParse(email);
  if (!e.success) return { error: "Enter a valid email address." };
  if (!issueOtp(e.data)) return { error: "A code was just sent. Wait a minute before asking again." };
  return { ok: true };
}

export async function checkCode(email: string, code: string) {
  const e = Email.safeParse(email);
  const c = Code.safeParse(code);
  if (!e.success || !c.success) return { error: "Enter the 6-digit code." };
  if (!(await verifyOtp(e.data, c.data))) return { error: "Wrong or expired code. Try again or resend." };
  return { ok: true };
}

export async function signOut() {
  await signOutUser();
  redirect("/");
}
