# CLAUDE.md — MoveProof (project memory and build log)

Claude Code reads this file automatically at the start of every session. It is the single source of truth for **what has been built so far**. If a session ends mid-phase (usage limit, crash, closed terminal), the next session resumes from the Build Log below.

---

## 1. Project in one paragraph

MoveProof is a mobile-first web app for Indian rentals and student PGs. At move-in, owner and tenant build a room-by-room, item-by-item condition report with live (in-app camera) photos, review it, and both sign. Once signed, the report **locks** and the database refuses any change. At move-out the same checklist is captured again, shown side by side, and the owner proposes itemised deductions that the tenant accepts or disputes one by one. Full spec: `docs/SPEC.md`.

## 2. Stack (fixed — do not change without asking the human)

| Layer | Choice |
| --- | --- |
| App | Next.js (App Router, TypeScript, Server Actions) in `web/` |
| UI | Tailwind CSS + shadcn/ui, mobile-first (design for 360 px wide first) |
| Auth | Own email OTP (6-digit code, hashed in DB) + httpOnly session cookie. Local: code printed to server console |
| Database | SQLite via Node built-in `node:sqlite`; schema in `web/db/schema.sql` (port of `supabase/migrations/0001_init.sql`, same lock triggers) |
| Photos | Local disk `web/data/photos/<tenancyId>/<sha256>.jpg` (git-ignored), served only through a member-checked route |
| Hashing | Web Crypto in browser, Node `crypto` on server |
| Validation | Zod |
| Tests | Vitest (unit) |
| PDF | Print stylesheet + browser "Save as PDF" |
| QR | `qrcode` npm package |
| Hosting | Local for now (SQLite needs a persistent disk; Vercel won't keep it) |

> **Stack change 2026-10-28 (human request: "for now use sqlite")**: Supabase replaced by SQLite + own auth + local photo storage. `supabase/` is kept untouched for a possible later switch. Where phases mention Supabase clients / admin client / Storage / RLS, use `src/lib/db.ts` (server-only) instead; the browser never reaches the DB because it is only opened in server code.

## 3. Non-negotiable rules

### Git rules
- **Never run `git push`** in any form. The human pushes manually. (Also blocked in `.claude/settings.json`.)
- **Never add Claude as co-author.** No `Co-Authored-By:` trailer, no "Generated with Claude Code" line, no `Claude-Session:` trailer, no mention of Claude or AI in commit messages. A `commit-msg` hook in `.githooks/` strips these as a safety net, but do not rely on it — just don't write them.
- Commit locally at the end of every phase (and optionally after big tasks) with a plain conventional message, e.g. `feat(capture): live camera, hashing and photo upload`.
- Never rewrite history (`git reset --hard`, `rebase`, `commit --amend` on already-logged commits) unless the human asks.

### Secrets
- Never print, log or commit keys. Secrets live only in `web/.env.local` (git-ignored). Keep `web/.env.example` updated with names, no values.
- The database is opened only in `src/lib/db.ts` (`import 'server-only'`), never imported into a client component.

### Integrity rules (the heart of the project — never weaken)
- Photos come only from the in-page camera (`getUserMedia`). No `<input type="file">` in production. A dev-only upload exists behind `NEXT_PUBLIC_ALLOW_DEV_UPLOAD=true` and is stored with `source='dev_upload'`.
- Every photo: SHA-256 computed in browser, recomputed on server after upload; mismatch → reject and delete the object.
- Report hash = SHA-256 of canonical JSON (see `docs/SPEC.md` §6). A signature stores the hash its signer saw. Second signature is refused if the hash changed.
- Once a report is `LOCKED`, the DB triggers block changes. Never drop, disable or bypass the triggers, and never add code paths that try.
- All DB writes happen in server actions via `db()` **after** `requireUser()` and `requireMember()` checks. The browser has no DB access path (SQLite file is only opened server-side). `npm run lock-check` must keep passing.

### Working rules
- Follow phases in order: `phases/PHASE_00_*.md` → `PHASE_08_*.md`. Do not start a phase until the previous one is marked Done (or the human says to skip).
- If a step needs the human (creating the Supabase project, pasting keys, running SQL, testing on a phone), stop and write a clear **HUMAN STEP** in the Build Log and in chat, then wait.
- Prefer small files and plain code over clever abstractions; this is also a Software Engineering course project, so module boundaries should match the class diagram in `docs/SPEC.md`.
- Before marking a phase Done: `npm run lint`, `npx tsc --noEmit`, `npm run test` (from phase 4 on) and `npm run build` must pass inside `web/`.
- If a library API differs from what the phase file says (versions change), check the library's current docs and adapt; note the deviation in the log.

## 4. Progress logging protocol (MANDATORY)

Update this file **as you work, not only at the end**, so an interrupted session can resume:

1. **Starting a phase:** set its row in the Phase Status table to `In progress` and add a `### Phase N — started <date time>` heading in the Build Log.
2. **After every completed task** in the phase: append one line under that heading:
   `- [x] <task id> <what was done> — files: <paths> — notes: <anything surprising>`
3. **Before any risky or long step** (big refactor, dependency install, migration): append `- [ ] <task id> STARTED: <what>` first, so a crash leaves a trace.
4. **Ending a phase:** run the checks, set the status to `Done`, write a 2–4 line `Summary:` and a `Next:` line, then commit.
5. **Blocked:** set status `Blocked`, write `HUMAN STEP:` with exact instructions.
6. Keep the `Current position` block at the top of the Build Log accurate at all times.

## 5. Phase status

| Phase | Title | Status |
| --- | --- | --- |
| 0 | Setup and scaffolding | Done |
| 1 | Database, storage and auth | Done |
| 2 | Tenancy, templates, invites, India rules | Not started |
| 3 | Live capture, hashing, photo upload | Not started |
| 4 | Review, sign-off and lock | Not started |
| 5 | Move-out and comparison | Not started |
| 6 | Deductions and settlement | Not started |
| 7 | Printable report, QR and verify page | Not started |
| 8 | Hardening, tests, docs and demo | Not started |

## 6. Build log

### Current position
- Phase: 2 (not started)
- Last completed task: Phase 1 done and committed
- Next action: start `phases/PHASE_02_tenancy_templates.md` (use `db()` wherever it says admin client)
- Open HUMAN STEPs: none

<!-- Claude Code: append phase logs below this line, newest at the bottom. -->

### Phase 0 — started 2026-10-28 21:20
- [x] 0.1 git init -b main, hooksPath=.githooks, root .gitignore, no remote — files: .gitignore
- [x] 0.2 Scaffolded web/ with create-next-app — files: web/ — notes: Next.js 16.4.3, React 19.3; web/AGENTS.md warns APIs differ, check node_modules/next/dist/docs
- [x] 0.3 Deps + test/typecheck scripts — files: web/package.json — notes: vitest 5 needs @types/node>=22, bumped to ^24
- [x] 0.4 shadcn init (style base-nova, Base UI, neutral) + 10 components — files: web/components.json, web/src/components/ui/* — notes: Base UI Button has no asChild; use buttonVariants on Link
- [x] 0.5 env template — files: web/.env.example, web/.gitignore — notes: added !.env.example exception
- [x] 0.6 Base layout (max-w-md shell, Toaster, viewport) — files: web/src/app/layout.tsx
- [x] 0.7 Landing page — files: web/src/app/page.tsx
- [x] 0.8 lib skeleton per SPEC §8 — files: web/src/lib/**
- Acceptance: lint, typecheck, build pass; dev server serves landing; hooksPath=.githooks; no remote.

Summary: Next.js 16.4.3 app scaffolded in `web/` with Tailwind 4, shadcn/ui (base-nova / Base UI), Supabase, Zod, qrcode, Vitest. Git initialised with attribution-stripping hooks. Mobile-first shell, landing page and empty `src/lib` modules per SPEC §8.
HUMAN STEP: 1) supabase.com → New project (region Mumbai ap-south-1), save DB password. 2) Project Settings → API: copy Project URL, anon/publishable key, service_role/secret key. 3) `cp web/.env.example web/.env.local` and paste the three values. 4) Reply "keys added".
Next: Phase 1 — Database, storage and auth (after HUMAN STEP).

### Phase 1 — started 2026-10-28 21:45 (SQLite variant, Supabase HUMAN STEPs not needed)
- [x] 1.1 (SQLite) db/schema.sql port with identical lock triggers (OLD+NEW checked) + cross-tenancy triggers; src/lib/db.ts (node:sqlite, server-only); supabase deps removed — files: web/db/schema.sql, web/src/lib/db.ts, web/scripts/lock-check.mjs — notes: `npm run lock-check` proves every tamper fails; data/ git-ignored
- [x] 1.2 Auth guards + own OTP/session (codes and session tokens stored as SHA-256, 5 attempts, 10 min, 60 s resend) — files: web/src/lib/auth.ts, web/src/proxy.ts (sets x-pathname for ?next=)
- [x] 1.5 logEvent — files: web/src/lib/audit.ts
- [x] 1.3 /login: email → 6-digit code (numeric keyboard, one-time-code autofill), 60 s resend cooldown, safe `next` (relative paths only) — files: web/src/app/login/*
- [x] 1.4 Sign-out server action + header — files: web/src/app/login/actions.ts, web/src/components/app-header.tsx
- [x] 1.6 /dashboard guarded by requireUser — files: web/src/app/dashboard/page.tsx
- notes: Next 16 template had `cacheComponents: true`; removed (all pages are per-user dynamic, it would force Suspense everywhere). DB opened lazily (`db()`) because parallel build workers locked SQLite at import. Fixed shadcn's self-referencing `--font-sans`.
- Acceptance: lint, typecheck, build pass; `npm run lock-check` passes (16 tamper attempts refused incl. cross-tenancy items); Playwright run at 360 px: unauth /dashboard → /login?next=, wrong code rejected, right code → dashboard, sign-out → dashboard redirects to login. No client component imports db/auth (grep). RLS check replaced by lock-check (no network DB API exists).

Summary: Supabase swapped for SQLite (`node:sqlite`) per human request. Schema + all lock triggers ported to `web/db/schema.sql`, stricter (OLD and NEW rows checked, no cross-tenancy items). Own email-OTP auth with hashed codes and hashed session tokens; in local mode the code is printed in the `npm run dev` terminal.
Next: Phase 2 — Tenancy, templates, invites, India rules.
