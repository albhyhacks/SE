# Phase 4 — Review, sign-off and lock

**Goal:** initiator submits and signs, the other party reviews, comments or countersigns, and the report locks only when both signed the same hash. Self-attested lock when the other party never joined. Target time: 75 min.

**Read first:** `docs/SPEC.md` §3 F09–F13, §6 (hash), §7 (state machine).

## Tasks

- [ ] **4.1 Hashing** `src/lib/hash.ts`:
  - `canonicalJson(value)` — recursive key sort, arrays kept in given order, no whitespace, `undefined` dropped, throws on non-finite numbers.
  - `sha256Hex(string | Uint8Array)` using Node `crypto` (server only).
  - `buildHashPayload(tree)` exactly as SPEC §6 (sorting rooms, items, photo hashes; trimmed notes or null).
  - `reportHash(tree)`.
  - Tests `hash.test.ts`: key order does not change the hash; changing one note, one rating or one photo hash changes it; photo order does not; known fixture → known hash (pin it).
- [ ] **4.2 State machine** `src/lib/state.ts`: a transition table `{ from, event, to }[]` and `assertTransition(status, event)`; guard helpers `canSubmit`, `canReview`, `canSelfLock(tree, membership, otherJoined)`. Tests `state.test.ts`: every allowed transition passes, every other combination throws (loop over all statuses × events).
- [ ] **4.3 Submit** (initiator, DRAFT): validation (all items done) → compute hash → insert signature (role, typed full name, hash) → update report `status='REVIEW', submitted_at=now()` → `logEvent('report.submitted', { hash })`. UI: a "Submit and sign" dialog that shows the first 12 characters of the hash, a typed-name input, and the line "By signing, you confirm this report matches the property today. This is an evidence record, not a legal contract."
- [ ] **4.4 Review screen** (other member, REVIEW): same report view read-only, plus per-item "Comment" (saves `entries.reviewer_comment`; allowed in REVIEW only — the entry update is permitted because the report is not locked). The page embeds the hash it rendered (`data-hash` / hidden input).
- [ ] **4.5 Request changes** (other member, REVIEW): requires at least one reviewer comment → delete all signatures of this report → status DRAFT → `logEvent('report.changes_requested')`. Initiator then sees comments highlighted on the items; editing an item clears its reviewer comment.
- [ ] **4.6 Countersign** (other member, REVIEW): post `{ reportId, seenHash, typedName }` → recompute hash from DB → require `seenHash === recomputed === initiatorSignature.report_hash`; otherwise return "This report changed while you were reviewing. Please reload." (HTTP-409-style result) → insert signature → update report `status='LOCKED', content_hash=hash, locked_at=now()` → `logEvent('report.locked', { hash })`. Do the signature insert and the status update so that a failure in the second step is reported clearly (if possible, use a Postgres function via a new `0002_sign_fn.sql` migration with a HUMAN STEP; otherwise sequential calls are acceptable for the MVP — note the choice in the log).
- [ ] **4.7 Self-attested lock** (initiator, DRAFT or REVIEW, other role not joined): confirmation dialog explaining "Only you have signed. The report will be marked self-attested." → compute hash → insert initiator signature if missing → `LOCKED`, `self_attested=true` → log. Show a yellow "Self-attested" badge everywhere this report appears.
- [ ] **4.8 Locked view**: lock banner with lock time, full hash (monospace, copy button), signer names and roles, self-attested badge if any. All edit controls hidden.
- [ ] **4.9 Lock test** (the demo moment): add a dev-only server action or script `web/scripts/try-tamper.mjs` that attempts to update an entry of a LOCKED report with the admin client and prints the database error. Expected: `MoveProof: report ... is locked`.

## Acceptance checks
- Full flow with two accounts: submit → comment → request changes → edit → submit → countersign → LOCKED.
- Stale-hash test: reviewer opens the review page, initiator's report goes back to DRAFT (reviewer requests changes in a second tab), initiator edits and resubmits; the reviewer's original tab then tries to countersign with the old hash → refused with the "report changed" message. Also cover this in a unit-level test of the countersign guard with a wrong `seenHash`.
- `try-tamper.mjs` prints the lock error; `supabase/checks/lock_check.sql` statements all fail for the locked report (HUMAN can run it).
- `npm run test` passes with hash and state tests.
- lint, typecheck, build pass.

## Finish
Update CLAUDE.md. Commit: `feat(signoff): canonical report hash, two-party signing and lock`.
