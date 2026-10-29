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
| 2 | Tenancy, templates, invites, India rules | Done |
| 3 | Live capture, hashing, photo upload | Done |
| 4 | Review, sign-off and lock | Done |
| 5 | Move-out and comparison | Done |
| 6 | Deductions and settlement | Done |
| 7 | Printable report, QR and verify page | Done |
| 8 | Hardening, tests, docs and demo | Done |

## 6. Build log

### Current position
- Phase: ALL DONE (0–8)
- Last completed task: Phase 8 committed
- Next action: human runs the final HUMAN STEP (phone demo, then push)
- Open HUMAN STEPs: real-phone test (camera, WhatsApp, QR scan) over https; push to GitHub

<!-- Claude Code: append phase logs below this line, newest at the bottom. -->

### Phase 5 — started 2026-10-28
- [x] 5.1 start move-out: createMoveOut action (guards: member + move-in LOCKED + no existing MOVE_OUT; move-out date Y-M-D saved as tenancies.move_out_date; creates MOVE_OUT report + one entry per item, ids generated per row) + StartMoveOutForm on tenancy home (hidden/disabled text before lock) — files: web/src/app/t/[id]/start-moveout.tsx (server actions), start-moveout-form.tsx, page.tsx — notes: fixed UNIQUE constraint failure caused by a single shared entry id in the first insert version
- [x] 5.2 flow reuse: report/item/submit/review/countersign/self-lock actions all take report ids and never hardcode MOVE_IN (checklist editor stays MOVE_IN-only, correct); headers already show "Move-in/Move-out report" via type
- [x] 5.3 comparison.ts: compare() pairs rooms/items by id, flags { worse: out>in && !missing, missing: became 6, newNote }, counts { unchanged, worse, missing, notCaptured }, isChanged() — files: web/src/lib/comparison.ts, comparison.test.ts — notes: 6 tests; rated-baseline semantics (unrated move-in can never flag worse)
- [x] 5.4 compare page /t/[id]/compare: member-only, amber banner while move-out not LOCKED, 4-up summary counts, "Only changed items" toggle (default on), side-by-side cards with rating badges/notes/photo thumbnails, full-screen scroll-snap photo viewer per side — files: web/src/app/t/[id]/compare/{page.tsx,comparison-list.tsx}
- [x] 5.5 links: tenancy home (compare button once move-out exists), locked move-out report → "Compare with the move-in report →"
- Friendly checklist-freeze messaging: guard() redirects stale submissions back with ?msg=, protect() catches late DB trigger freezes, report page renders the message — files: checklist-actions.ts, report page
- Acceptance (Playwright e2e, scripts/e2e-phase5.mjs, untracked; 360 px, solo initiator): move-out start absent before move-in lock; locked solo move-in → Start move-out with date → open move-out report; seeded Good→Damaged + Good→Missing items; compare shows Worse/Missing badges, counts 2 changed / rest same, only-changed filter on by default and toggleable, photo viewer opens/closes; locked move-out links to compare. Unit 25 tests. lint, typecheck, test, build, lock-check pass.

Summary: After the move-in lock, either member starts a move-out report on the same frozen checklist with a move-out date; the whole capture/sign/lock flow is reused unchanged. The comparison page pairs both trees per item, flags Worse/Missing/New note, counts summaries and filters to changed items by default, with an in/out photo viewer.
Next: Phase 6 — Deductions and settlement.
- [x] 4.1 hash.ts: canonicalJson (recursive key sort, no whitespace, undefined dropped, throws on non-finite), sha256Hex, buildHashPayload + reportHash per SPEC §6 — files: web/src/lib/hash.ts, hash.test.ts — notes: known fixture pinned to 60cd7a62…40d540cd (8 tests incl. photo order / trim-stability / reviewer_comment excluded)
- [x] 4.2 state.ts: transition table (DRAFT→REVIEW→DRAFT/LOCKED, self_lock DRAFT|REVIEW→LOCKED), targetStatus, assertTransition, canSubmit/canReview/canSelfLock — files: web/src/lib/state.ts, state.test.ts — notes: full 3×4 status×event matrix plus guard tests (5 tests)
- [x] 4.3–4.7, 4.4 actions + review UI: submitReport (all-items validation + initiator signature + REVIEW), requestChanges (≥1 comment enforced, deletes signatures, → DRAFT, submitted_at cleared), countersign (seenHash === recomputed === initiator's signed hash, else { stale: true, "report changed" message }), selfLock (members ≤ 1 enforced server-side, self_attested = 1), saveReviewerComment (other party, REVIEW only; editing an item in DRAFT clears its reviewer_comment) — files: web/src/app/t/[id]/r/[reportId]/actions.ts, sign-dialog.tsx, request-changes.tsx, item-comment.tsx, web/src/app/t/[id]/r/[reportId]/item/[itemId]/actions.ts
- [x] 4.4 review screen embeds the rendered hash on `div[data-report-hash]`; per-item comment inputs; initiator sees 💬 comments highlighted
- [x] 4.8 locked view: lock time, full hash in monospace + CopyHash button, signer names/roles, self-attested banner; Self-attested yellow badge added to StatusBadge and shown on report + tenancy pages — files: web/src/app/t/[id]/r/[reportId]/page.tsx, copy-hash.tsx, web/src/components/status-badge.tsx, web/src/app/t/[id]/page.tsx
- [x] 4.9 try-tamper.mjs: attempts an entry UPDATE on a LOCKED report, prints "MoveProof: report is locked and cannot be changed" — files: web/scripts/try-tamper.mjs
- Fixed during e2e: item page passed node:sqlite row objects to a client component (Next refuses non-plain objects) — now mapped to plain objects; report page hid reviewer comments from the initiator (!canCapture)
- Acceptance (Playwright e2e, scripts/e2e-phase4.mjs, untracked machine-specific helper; 360 px, two accounts, fake camera): full flow O→T: submit → comment → request changes → edit (comment cleared) → resubmit → stale-tab countersign refused with "report changed" → fresh reload countersign → LOCKED with both signers + copyable hash; locked item page shows edit controls disabled; solo tenancy self-attest → LOCKED + Self-attested badge on report and tenancy home. Unit: 19 tests. lint, typecheck, test, build, lock-check, try-tamper all pass.
- HUMAN STEP (not needed to continue): real-phone camera test still pending (needs https deploy or tunnel).

Summary: Canonical report hash (SPEC §6) implemented and pinned by fixture tests; state-machine transition table with exhaustive matrix tests backs every action. Submit/sign → review/comment → request changes → resubmit → countersign flow locks the report only when both parties signed the same hash; stale viewer is refused with a reload message by comparing posted hash, recomputed hash and the initiator's signature. Solo tenancy can self-attest lock. Locked reports expose only a read-only view.
Next: Phase 5 — Move-out report creation and side-by-side comparison.
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

### Phase 2 — started 2026-10-28 22:15
- [x] 2.1 depositCapMonths/depositWarning/refundDueDate + 3 Vitest tests — files: web/src/lib/india-rules.ts, india-rules.test.ts — notes: refund date clamps 31 Jan → 28 Feb
- [x] 2.2 Templates (PG single/shared, 1BHK, 2BHK; overview first in every room) — files: web/src/lib/templates.ts; added tx() helper in db.ts (transactions instead of manual cleanup)
- [x] 2.3 /tenancies/new form (live deposit warning) + createTenancy action in one transaction (tenancy, member, MOVE_IN report, rooms, items, entries) — files: web/src/app/tenancies/new/*
- [x] 2.4 Dashboard lists tenancies with move-in/out badges — files: web/src/app/dashboard/page.tsx, web/src/lib/tenancies.ts, web/src/components/status-badge.tsx — notes: added lib/tenancies.ts (queries) not in SPEC §8 map
- [x] 2.5 Tenancy home /t/[id] (requireMember, parties, deposit warning, report cards, last 20 audit events) — files: web/src/app/t/[id]/page.tsx
- [x] 2.6 Invite link + WhatsApp wa.me share + copy — files: web/src/app/t/[id]/invite-share.tsx
- [x] 2.7 /join/[code]: role picked server-side, already-member redirect, full tenancy refused — files: web/src/app/join/[code]/*
- [x] 2.8 Report page placeholder + checklist editor (add/rename/remove rooms & items; overview item fixed; new items get move-in entries; initiator + DRAFT guard server-side, ids scoped to tenancy) — files: web/src/lib/reports.ts (loadReport tree), web/src/app/t/[id]/r/[reportId]/* — notes: typecheck script now runs `next typegen` first
- Security fix: /login `next` now resolved against a fixed origin (blocked `/\\evil.com` open redirect). WhatsApp button colour fixed with cn() (buttonVariants does not merge classes).
- Acceptance (Playwright, 360 px, `next start`): TN rent 8000 / deposit 40000 → "5 months' rent … caps it at 3 months"; wa.me link contains invite link; owner joins via link and shows on home; third account refused at /join and redirected away from /t/[id]; audit shows "Tenancy created", "Checklist edited", "Owner joined"; non-initiator sees no checklist editor. lint, typecheck, test (3), build, lock-check pass. WhatsApp on a real phone not tested yet (human, during Phase 3 phone test).

Summary: Tenancies can be created from 4 templates with a live deposit-cap warning (TN/MTA), in a single transaction that also creates the move-in report and its entries. Invite link with WhatsApp/copy share, server-decided join role, tenancy home with parties, report cards and audit log. Initiator can edit the checklist while move-in is Draft.
Next: Phase 3 — Live capture, hashing, photo upload.

### Phase 3 — started 2026-10-28 22:50 (SQLite variant: browser posts JPEG to a server action; server re-hashes before writing to disk, so a mismatching object is never stored)
- [x] 3.1 ratings.ts (labels, colours, photoRequired, itemDone) + tests — files: web/src/lib/ratings.ts, ratings.test.ts; next.config serverActions.bodySizeLimit=3mb
- [x] 3.2 loadReport tree already built in Phase 2 (web/src/lib/reports.ts; rooms/items sorted by sort,id; photos sorted by sha256) — notes: named loadReport(tenancyId, reportId), scoped by tenancy
- [x] 3.4 Item page (6 big rating buttons, notes, photo strip, Save and next item across rooms); saveEntry guards member+initiator+DRAFT+item in tenancy — files: web/src/app/t/[id]/r/[reportId]/item/[itemId]/*
- [x] 3.5 Camera overlay (rear lens, ≤1600 px, JPEG 0.75, Web Crypto SHA-256, tracks stopped on close/unmount, clear errors incl. insecure context); file input only when NEXT_PUBLIC_ALLOW_DEV_UPLOAD=true — files: web/src/components/camera-capture.tsx
- [x] 3.6 uploadPhoto server action: Zod, guards, ≤2.5 MB, JPEG magic bytes, server SHA-256 must equal client hash BEFORE writing (mismatch never stored), duplicate detection, dev_upload refused unless flag on server too, logEvent photo.added; client keeps blob + Retry on failure — files: web/src/lib/photos.ts, item actions.ts
- [x] 3.7 Photos served by member-checked route /t/[id]/photo/[photoId] (private cache 600 s, nosniff) instead of signed URLs; tap for full view; "verified ✓" with server uploaded_at; initiator delete in DRAFT (file removed only if no other row uses it) — files: web/src/app/t/[id]/photo/[photoId]/route.ts
- [x] 3.3 Report page: header (type + status badge), progress bar "N of M items done", rooms as <details> with per-room progress, items with ✓/rating badge/photo count; read-only for viewer who is not the initiator while DRAFT — files: web/src/app/t/[id]/r/[reportId]/page.tsx
- [x] 3.8 Validation summary "Still to do (N)" on the report page (initiator, DRAFT only): items missing a rating or a required photo, each linking to its item page — files: web/src/app/t/[id]/r/[reportId]/page.tsx
- Acceptance: lint, typecheck, test (6), build, lock-check pass. Phone camera test still HUMAN STEP (needs https deploy or tunnel; local capture path verified via emulated Dev upload: server hash mismatch refused, duplicate refused, JPEG magic checked). Gallery pick impossible in normal mode (only camera; file input only behind NEXT_PUBLIC_ALLOW_DEV_UPLOAD on both client and server).

Summary: Item capture flow complete: 6 large rating buttons, notes, live camera at ≤1600 px JPEG q0.75 with browser SHA-256, server re-hashes before writing so a mismatching object is never stored; duplicate detection; dev upload double-gated. Photos content-addressed on local disk, served only through a member-checked route. Report page shows progress, per-room checklist and a "still to do" summary.
Next: Phase 4 — Review, sign-off and lock.
### Phase 6 — started 2026-10-28 (resumed 2026-10-29 in a new session; previous session left uncommitted work)
- [x] 6.1 settlement.ts: summarise, settlementStatus, canAddDeduction, refundCountdownText + tests — files: web/src/lib/settlement.ts, settlement.test.ts
- [x] 6.2–6.4 (draft) server actions propose/respond/withdraw + dialog/forms on comparison cards — files: web/src/app/t/[id]/compare/{actions.ts,deduction-forms.tsx,comparison-list.tsx,page.tsx}
- [x] 6.5 (draft) SettlementCard on tenancy home + compare page — files: web/src/components/settlement-card.tsx
- [x] 6.R review fixes done — empty-note dispute was accepted (bug); propose check+insert not atomic; respond/withdraw status not re-checked in UPDATE; consolidated table lacked status/notes and printed amount twice; deduction query duplicated; data.e2e-backup/ not ignored
- [x] 6.R fixes: dispute needs a non-blank note (server); propose check+insert in one tx(); respond/withdraw UPDATE re-checks status (`.changes`); amount uses z.coerce (form strings were ALWAYS rejected before — owner could never propose); shared listDeductions() in lib/tenancies.ts; consolidated table with item/reason/amount/status/notes; plain-language audit labels for every logged action; MOVEPROOF_DATA_DIR env for throwaway test DBs; data.e2e-backup/ git-ignored — files: compare/actions.ts, settlement-card.tsx, lib/tenancies.ts, lib/db.ts, settlement.test.ts
- notes: untracked web/scripts/e2e-phase6.mjs restore step uses `web/data` paths while running from web/, so it never restores data — do not rely on it; leftover web/data and web/data.e2e-backup hold only e2e test data.
- Acceptance (Playwright, 360 px, throwaway DB via MOVEPROOF_DATA_DIR, captured server-action requests replayed with the other party's cookie): tenant propose refused; owner accept/dispute refused; 4000+7000 > 10000 deposit refused; blank-note dispute refused server-side; PENDING → DISPUTED → SETTLED; TN move-out 10 days ago → "Refund due in 21 days"; refund now ₹6,000. Unit 31 tests. lint (0 errors), typecheck, test, build, lock-check, try-tamper pass.

Summary: Owner proposes itemised deductions (flagged items directly, unchanged ones behind "More" with a warning) within the deposit limit; tenant accepts or disputes with a note; owner withdraws. Settlement card on tenancy home and compare page shows totals, status chip, TN refund countdown and a consolidated deduction table.
Next: Phase 7 — Printable report, QR and verify page.

### Phase 7 — started 2026-10-29
- [x] 7.3 Public /verify/[reportId]: verifyReport() in lib/reports.ts (recompute vs content_hash and every signature hash), Unchanged/Does not match/Not locked, first names only, counts, both hashes, paste-to-compare; bad/unknown id → friendly not-found — files: web/src/lib/reports.ts, web/src/lib/qr.ts, web/src/app/verify/[reportId]/*
- [x] 7.1 /t/[id]/print/[reportId]: A4 print CSS (no-print, print-avoid), header with address/parties/signers, QR (qrcode → data URL) to /verify, full hash, rooms → items with rating/notes/3-per-row photos captioned upload time + sha256[0..10], footer "Not a legal contract", Print / Save as PDF button — files: web/src/app/t/[id]/print/[reportId]/page.tsx, web/src/components/{print-button,print-header}.tsx, web/src/app/globals.css
- [x] 7.2 /t/[id]/print/compare: both reports' QR+hash, settlement summary + deductions table, changed items side by side (?all=1 toggle) — files: web/src/app/t/[id]/print/compare/page.tsx
- [x] 7.4 Print/Verify buttons on locked report; Print on compare page; WhatsApp "report is locked, verify it here" share per locked report on tenancy home
- [x] 7.5 scripts/verify-check.mjs (standalone, reads SQLite, duplicates SPEC §6 hashing, checks stored + every signature) — `npm run verify-check <id>`
- Acceptance (Playwright on throwaway DB, 17/17): verify-check MATCH exit 0 and MISMATCH exit 1; public /verify (no login) shows Unchanged — so the standalone script and app hash.ts agree; first names only, no address/notes/emails/photos; pasted hash matches; bad content_hash → "Does not match" + self-attested; unknown uuid and garbage id → friendly "Report not found"; print page has hash, QR (alt = verify URL), photo caption, footer, photo loads; print media hides buttons; Chromium A4 PDF of report and comparison rendered and checked visually; compare print has 2 QRs, Worse flag, settlement; Print/Verify links on locked report; WhatsApp verify share; print page requires login. lint (0 errors), typecheck, test (31), build, lock-check pass.
- HUMAN STEP (pending, not blocking): scan the QR on a real phone. Set NEXT_PUBLIC_APP_URL in web/.env.local to an address the phone can reach (https tunnel or LAN URL), otherwise the QR points to localhost:3000.

Summary: Locked reports and the comparison print as clean A4 PDFs with QR codes and the full hash. A public /verify page recomputes the hash with the same hash.ts, checks it against the stored hash and every signature, and reveals only first names, counts and hashes. scripts/verify-check.mjs repeats the check offline for the viva.
Next: Phase 8 — Hardening, tests, docs and demo.

### Phase 8 — started 2026-10-29
- [x] 8.1 Security pass: every action Zod → requireUser/requireMember → role/state guard (13 action files reviewed); compare guard now authenticates BEFORE tenancy lookup (no existence leak) and validates tenancyId; start-moveout validates tenancyId and rejects impossible dates (2026-02-30, month 13 no longer throws); no client file imports db/auth/photos/reports/tenancies/qr/audit; .env.local ignored; git history has no secrets; .env.example cleaned to the 3 real vars — files: compare/actions.ts, start-moveout.tsx, web/.env.example — notes: ponytail: OTP brute force bounded by 5 tries/code + 60 s resend only; add per-IP rate limiting when hosted
- [x] 8.2 UX: app-wide error.tsx (Try again / Go to my tenancies) and not-found.tsx; SubmitButton (useFormStatus) gives checklist editor forms a pending state; editor controls raised to 44 px (h-11) — files: web/src/app/{error,not-found}.tsx, web/src/components/submit-button.tsx, checklist-editor.tsx
- [x] 8.3 Audit: one plain sentence per action ("Priya submitted and signed the move-in report", "Ravi proposed a deduction of ₹4,000 on Fan"); report events now carry `type`; all times via fmtIST (Asia/Kolkata); refund countdown and move-out "today" use todayIST() (was UTC date — wrong before 05:30 IST) — files: web/src/lib/format.ts, web/src/lib/tenancies.ts, report actions.ts, 8 pages/components
- [x] 8.4 Tests: unit tests exist for india-rules, hash, state, comparison, settlement, ratings; added format.test.ts (IST, ₹ grouping) and leap-year refund date — 33 tests green
- [x] 8.5 docs/TEST_PLAN.md (levels, 33 unit tests, 3 integrity scripts, 27 manual cases, F01–F22 traceability matrix), USER_MANUAL.md, DEMO_SCRIPT.md (5 min, try-tamper live), DEVIATIONS.md (D1–D12); try-tamper now also takes a real <reportId> (npm run try-tamper)
- [x] 8.6 Root README rewritten as project README (problem, features, stack, architecture, integrity design, setup incl. terminal login codes + https tunnel for camera, deploy needs persistent disk, testing, limitations, future work); web/README.md points to it
- [x] 8.7 Final checks: lint 0 errors (5 warnings, all in untracked scripts/e2e-phase6.mjs), typecheck, 33 unit tests, build, lock-check, try-tamper green. Regression Playwright run (throwaway DB) 27/27: all Phase 7 checks + audit sentences + no horizontal scroll at 360 px on 8 screens + 404 page.

Summary: Security pass (auth-before-lookup, id/date validation), IST everywhere, plain-sentence activity log, error/not-found pages, pending states, SE docs (test plan with traceability, user manual, demo script, deviations) and a project README.
HUMAN STEP (end): 1) Run docs/DEMO_SCRIPT.md once on two phones via an https tunnel with NEXT_PUBLIC_APP_URL set. 2) Instead of supabase/checks/lock_check.sql, run `cd web && npm run lock-check` and `npm run try-tamper -- <lockedReportId>`; every attempt must be refused. 3) When happy, push yourself: `git remote add origin …` then `git push -u origin main`.

## Project summary
**Works:** email-OTP login; tenancy from 4 templates with TN/MTA deposit warning; WhatsApp/copy invite and join; live-camera capture with browser + server SHA-256; review/comments/request changes; two-party signing bound to the report hash; self-attested lock; DB-enforced lock (SQLite triggers); move-out on frozen checklist; side-by-side comparison with flags; itemised deductions with accept/dispute/withdraw and settlement + TN refund countdown; A4 print with QR; public verify page; plain-language IST audit log.
**Known issues / not verified by me:** camera, WhatsApp and QR scan on a real phone (needs https); login codes go to the server console (no email provider); no per-IP rate limit; SQLite needs a persistent-disk host (not Vercel). Untracked helper scripts web/scripts/e2e-phase{4,5,6}.mjs are machine-specific; e2e-phase6.mjs fails to restore web/data (wrong path), so don't run it on real data.
**Demo commands:** `cd web && npm install && npm run build && npm start` (codes print in this terminal) · `npm run test` · `npm run lock-check` · `npm run try-tamper -- <reportId>` · `npm run verify-check -- <reportId>`.

### Post-build — 2026-10-29 (going live via Cloudflare quick tunnel)
- [x] Invite/QR/verify links now use the request's own address (x-forwarded-host/proto) unless NEXT_PUBLIC_APP_URL is set, so a changing trycloudflare.com URL needs no rebuild — files: web/src/lib/qr.ts (appUrl async), t/[id]/page.tsx, print pages, web/.env.example
- [x] `npm run live` = build + `next start` + `cloudflared tunnel --protocol http2 --url http://localhost:3000` — files: web/scripts/live.sh
- Blocked on this machine's current network: outbound port 7844 (UDP and TCP) to Cloudflare's edge times out, so the tunnel never registers (public URL returns 530). Works on a network that allows 7844, e.g. a phone hotspot.
- [x] Email login codes: src/lib/mail.ts (nodemailer, Gmail SMTP 465 when SMTP_USER/SMTP_PASS set, else console); issueOtp async → "sent" | "wait" | "failed" (failed send deletes the code so the user can retry at once, friendly error) — files: web/src/lib/{mail,auth}.ts, web/src/app/login/actions.ts, web/.env.example — notes: Gmail chosen because Resend etc. need a verified domain to send to other people
- HUMAN STEP: create a Gmail App Password and put SMTP_USER / SMTP_PASS in web/.env.local, then restart `npm run live`.

### Change — 2026-10-29: report roles (human request: "move in should be done only by the tenant and move out by the owner")
- [x] R.1 initiatorRole() in state.ts (+2 tests); createReport() in lib/reports.ts reused by create/join/move-out; tenancy creation makes MOVE_IN only for a tenant creator; join creates MOVE_IN when the tenant joins an owner-created tenancy (same tx as member insert); createMoveOut refuses the non-initiator role server-side; tenancy home explains who records each report; role hint on new-tenancy form — files: web/src/lib/{state,state.test,reports}.ts, tenancies/new/*, join/[code]/actions.ts, t/[id]/{page,start-moveout}.tsx
- [x] R.2 docs: SPEC §7 role rule, DEVIATIONS D13, USER_MANUAL "Who does what", DEMO_SCRIPT move-out by owner, TEST_PLAN U34–U35, TC16 update, TC28
- notes: owner-created tenancy → owner cannot edit the checklist (only the move-in initiator can, while DRAFT). Existing tenancies keep their current initiators.
- Acceptance (Playwright, throwaway DB, 9/9): owner-created has no move-in until tenant joins; join creates tenant-owned move-in with entries; tenant sees no Start move-out and a replayed tenant request is refused; owner starts move-out; tenant-created still auto-creates move-in; solo tenant can start move-out. lint 0 errors, typecheck, 35 tests, build pass.
