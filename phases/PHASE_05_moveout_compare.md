# Phase 5 — Move-out and comparison

**Goal:** after move-in is LOCKED, either party starts the move-out report on the same items, completes the same capture/sign/lock flow, and both see a side-by-side comparison with change flags. Target time: 75 min.

**Read first:** `docs/SPEC.md` §3 F14–F15, §5 ("got worse"), §7.

## Tasks

- [ ] **5.1 Start move-out** on tenancy home (enabled only when MOVE_IN is LOCKED and no MOVE_OUT exists): asks for the move-out date (default today) → saves `tenancies.move_out_date` → creates `MOVE_OUT` report (`created_by` = this user) with one entry per existing item → `logEvent('moveout.started')`. The checklist is frozen by the DB (rooms/items triggers), so there is nothing to clone except entries.
- [ ] **5.2 Reuse the flow:** make the report, item, submit, review, countersign and self-lock code work for both report types without duplication (pass the report id; never hardcode MOVE_IN). Show "Move-out" in headers. Move-out initiator can be either party.
- [ ] **5.3 Comparison logic** `src/lib/comparison.ts`:
  - `compare(moveInTree, moveOutTree)` → per room, per item: `{ item, in: {rating, notes, photos}, out: {rating, notes, photos} | null, flags: { worse: boolean, missing: boolean, newNote: boolean } }`.
  - `worse` = out.rating > in.rating; `missing` = out.rating === 6 && in.rating !== 6; `newNote` = out notes present and different.
  - Summary counts: unchanged, worse, missing, not yet captured.
  - Tests `comparison.test.ts` with small fixtures.
- [ ] **5.4 Comparison page** `/t/[id]/compare` (members only; available once MOVE_OUT exists, but shows a banner "Move-out not locked yet — comparison may change" until it is LOCKED):
  - Summary bar with counts; toggle "Only changed items" (default on).
  - Per item a card: left "Move-in" (rating badge, notes, photo thumbnails, date), right "Move-out" (same). On phones the two columns stay side by side with small thumbnails; tapping a thumbnail opens a full-screen viewer that lets you swipe between the in and out photo.
  - Red badge "Worse" / "Missing" on flagged items.
- [ ] **5.5 Link** the comparison from the tenancy home and from the locked move-out report.

## Acceptance checks
- Move-out cannot start before move-in is LOCKED (button disabled and the server action refuses).
- Trying to add a room after move-in lock fails with the frozen-checklist error (shown as a friendly message).
- Comparison shows correct flags for a seeded case: one item Good→Damaged, one Good→Missing, rest unchanged.
- `npm run test` passes (comparison tests added).
- lint, typecheck, build pass.

## Finish
Update CLAUDE.md. Commit: `feat(moveout): move-out report and side-by-side comparison`.
