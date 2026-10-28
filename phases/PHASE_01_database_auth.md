# Phase 1 — Database, storage and auth

**Goal:** schema live in Supabase with lock triggers, three Supabase clients, email-OTP login, and auth guards. Target time: 45 min.

**Read first:** `supabase/migrations/0001_init.sql`, `docs/SPEC.md` §4 (N04), §8.

**Precondition:** `web/.env.local` exists (Phase 0 HUMAN STEP done). If not, stop and remind the human.

## HUMAN STEP at the start (log it, then wait)

Tell the human:
1. Supabase dashboard → SQL Editor → New query → paste all of `supabase/migrations/0001_init.sql` → Run. It must finish with "Success".
2. Authentication → Sign In / Providers → Email: enabled. Authentication → Emails → "Magic Link" (or "Confirm signup" and "Magic Link") templates: make sure the body contains `{{ .Token }}` so users receive a 6-digit code, e.g. `Your MoveProof code is {{ .Token }}`.
3. Authentication → URL Configuration: Site URL `http://localhost:3000`.
4. Reply "schema done".

Do NOT edit `0001_init.sql`. If a later phase truly needs a schema change, write `supabase/migrations/0002_<name>.sql` and add another HUMAN STEP.

## Tasks

- [ ] **1.1 Supabase clients** (follow the current `@supabase/ssr` guide for the installed Next.js version):
  - `src/lib/supabase/client.ts` — browser client (used ONLY for auth calls in the login page).
  - `src/lib/supabase/server.ts` — cookie-based server client for reading the session.
  - `src/lib/supabase/admin.ts` — service-role client; add `import 'server-only'` at the top (`npm i server-only`).
  - Session refresh in `middleware.ts` or `proxy.ts` (whichever the installed Next.js version uses), as the guide describes.
- [ ] **1.2 Auth guards** in `src/lib/auth.ts`:
  - `requireUser()` → returns the user or redirects to `/login?next=<path>`.
  - `getMembership(tenancyId, userId)` → `{ role, display_name } | null` via admin client.
  - `requireMember(tenancyId)` → user + membership, throws/redirects to `/dashboard` if not a member.
- [ ] **1.3 Login page `/login`.** Step 1: email input → `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })`. Step 2: 6-digit code input (numeric keyboard, `inputMode="numeric"`, `autoComplete="one-time-code"`) → `supabase.auth.verifyOtp({ email, token, type: 'email' })` → redirect to `next` param or `/dashboard`. Friendly errors, resend button with 60 s cooldown.
- [ ] **1.4 Sign-out** server action and a small header with the user's email and "Sign out".
- [ ] **1.5 Audit helper** `src/lib/audit.ts`: `logEvent(tenancyId, actorId, action, detail?)` inserting into `audit_events` with the admin client. Never throws to the caller (log the error instead).
- [ ] **1.6 Placeholder `/dashboard`** protected by `requireUser()`, showing "No tenancies yet" and a "Start a report" button.

## Acceptance checks
- Human can log in with an email code on `localhost:3000` and lands on `/dashboard`; sign-out works.
- `grep -r "admin" web/src/app --include="*.tsx"` shows no client component importing `lib/supabase/admin`.
- RLS check: a small script `web/scripts/rls-check.mjs` (reads `.env.local` with `node --env-file`) calls `/rest/v1/tenancies?select=*` with ONLY the anon key and prints the result; it must be `[]` or an error, never rows. Run it once rows exist (after Phase 2) as well.
- lint, typecheck, build pass.

## Finish
Update CLAUDE.md. Commit: `feat(auth): supabase clients, email OTP login and guards`.
