# Phase 6 — Deductions and settlement

**Goal:** the owner proposes itemised deductions on the comparison page, the tenant accepts or disputes each one, and both see the settlement summary and refund deadline. Target time: 60 min.

**Read first:** `docs/SPEC.md` §3 F16–F19, §7 (settlement status).

## Tasks

- [ ] **6.1 Settlement logic** `src/lib/settlement.ts`:
  - `summarise(deposit, deductions)` → `{ proposed, accepted, disputed, withdrawn, refundIfAllAccepted, refundNow }` where `refundNow = deposit − accepted` and `refundIfAllAccepted = deposit − (accepted + proposed + disputed)`.
  - `settlementStatus(deductions)` → `NO_DEDUCTIONS | PENDING | DISPUTED | SETTLED` per SPEC §7.
  - `canAddDeduction(deposit, existing, amount)` → total of non-withdrawn deductions + amount ≤ deposit.
  - Tests `settlement.test.ts`.
- [ ] **6.2 Propose deduction** (OWNER only; only when MOVE_OUT is LOCKED): on each comparison card an "Add deduction" button → dialog: amount (₹, integer > 0), reason (Cleaning / Damage / Missing / Other), note. Server action re-checks role, lock state, item belongs to tenancy, and the deposit limit → insert → `logEvent('deduction.proposed', { item, amount })`. Flagged items show the button prominently; unflagged items allow it under a "More" menu with a warning "This item looks unchanged in the photos."
- [ ] **6.3 Respond** (TENANT only, status PROPOSED): "Accept" or "Dispute" with a required note when disputing → update status, `tenant_note`, `responded_at` → log.
- [ ] **6.4 Owner follow-up**: owner can "Withdraw" a PROPOSED or DISPUTED deduction (status WITHDRAWN, log). To change an amount, the owner withdraws and proposes a new one (keeps history honest).
- [ ] **6.5 Settlement card** on tenancy home and at the top of the comparison page: deposit, accepted, disputed, pending, refund now, status chip, and for TN the refund due date with a countdown ("Refund due in 12 days" / "Refund overdue by 3 days"), using `refundDueDate` from Phase 2. For other states: "Check your agreement for the refund timeline."
- [ ] **6.6 Deduction list** under each comparison card and a consolidated table on the settlement card: item, reason, amount, status, notes.

## Acceptance checks
- Tenant cannot propose; owner cannot accept/dispute (server actions refuse, not just hidden buttons).
- Deductions totalling more than the deposit are refused.
- Status moves PENDING → DISPUTED → SETTLED correctly as items are accepted/withdrawn.
- Refund countdown is correct for a TN tenancy with move-out date 10 days ago.
- `npm run test` passes.
- lint, typecheck, build pass.

## Finish
Update CLAUDE.md. Commit: `feat(settlement): itemised deductions, responses and refund deadline`.
