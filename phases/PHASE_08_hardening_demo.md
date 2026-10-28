# Phase 8 — Hardening, tests, documentation and demo

**Goal:** the app is stable on a phone, the SE documents exist, and a demo can be run end to end in 5 minutes. Target time: 45–60 min.

**Read first:** `docs/SPEC.md` (all), `CLAUDE.md` Build Log (to list deviations).

## Tasks

- [ ] **8.1 Security pass**: every server action starts with Zod parse → `requireUser` → `requireMember` → role/state guard. Grep for any action missing a guard and fix it. Confirm no client file imports `lib/supabase/admin`. Confirm `.env.local` is git-ignored and no secret appears in `git log -p`.
- [ ] **8.2 UX pass on 360 px**: loading states (skeletons or spinners) for every server action, disabled buttons while pending, error toasts with plain language, empty states, large tap targets (≥ 44 px), no horizontal scroll. Add an `error.tsx` and `not-found.tsx`.
- [ ] **8.3 Audit labels**: map every `action` to a human sentence ("Priya signed the move-in report"). Show times in IST (`Asia/Kolkata`).
- [ ] **8.4 Tests**: make sure unit tests exist for `india-rules`, `hash`, `state`, `comparison`, `settlement`. Add any missing edge cases. `npm run test` green.
- [ ] **8.5 Docs for the SE course** (create in `docs/`):
  - `TEST_PLAN.md` — test levels, the unit test list, the manual test cases for every F-ID in SPEC §3, and a **traceability matrix** (F-ID → test case IDs → status).
  - `USER_MANUAL.md` — short, with steps for tenant and owner.
  - `DEMO_SCRIPT.md` — a 5-minute demo: create PG tenancy (deposit warning) → capture 3 items with live photos → WhatsApp invite → second phone reviews, comments → changes → countersign → LOCKED → run `try-tamper.mjs` live to show the DB refusing the edit → move-out with one damaged item → comparison → deduction → tenant disputes → print → scan QR → "Unchanged".
  - `DEVIATIONS.md` — anything that differs from SPEC, from the Build Log.
- [ ] **8.6 Root README.md** (rewrite the kit README into a project README): problem, features, stack, architecture sketch (text), setup (Supabase SQL, env vars, `npm run dev`), deploy on Vercel (root dir `web`), testing commands, integrity design summary, limitations, future work (offline mode, push notifications, audit hash chain, Aadhaar eSign, Tamil/Hindi UI, AI-assisted change detection as review flags only).
- [ ] **8.7 Final checks** in `web/`: lint, typecheck, test, build — all green. Update the Phase Status table and write a final "Project summary" at the end of the Build Log listing what works, known issues, and the exact commands to run the demo.

## HUMAN STEP (end)
Tell the human:
1. Run through `docs/DEMO_SCRIPT.md` once on two phones using the Vercel URL.
2. Run `supabase/checks/lock_check.sql` with a locked report id — every statement must fail.
3. When happy, push to GitHub yourself (`git remote add origin …` then `git push -u origin main`). The pre-push hook will block any commit that carries Claude attribution.

## Finish
Update CLAUDE.md (all phases Done). Commit: `docs: test plan, user manual, demo script and README`.
