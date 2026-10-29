# MoveProof — Test Plan

## 1. Scope and levels

| Level | What | Tool | Where |
| --- | --- | --- | --- |
| Unit | Pure domain modules: hashing, state machine, India rules, ratings, comparison, settlement, formatting | Vitest | `web/src/lib/*.test.ts` — `npm run test` |
| Database integrity | Lock triggers, frozen checklist, append-only audit, cross-tenancy guards | Node script on in-memory SQLite | `npm run lock-check`, `npm run try-tamper` |
| Verification | Standalone hash recomputation from the DB file | Node script | `npm run verify-check <reportId>` |
| System / acceptance | End-to-end flows at 360 px with two or three accounts | Playwright (run per phase during the build, see Build Log) + manual cases below | browser / phone |
| Static | Lint, types, production build | ESLint, `tsc`, `next build` | `npm run lint`, `npm run typecheck`, `npm run build` |

Entry criteria: app builds. Exit criteria: all unit tests and integrity scripts green, every manual case below Pass, no open Sev-1 defect.

## 2. Unit tests (33)

| ID | Module | Test |
| --- | --- | --- |
| U01 | hash | sorts keys recursively, no whitespace |
| U02 | hash | drops undefined object values |
| U03 | hash | throws on non-finite numbers |
| U04 | hash | known digest of empty string |
| U05 | hash | known fixture → pinned hash |
| U06 | hash | changing one rating changes the hash |
| U07 | hash | changing a note changes the hash; trimming whitespace does not |
| U08 | hash | changing a photo hash changes the hash; photo order does not |
| U09 | hash | reviewer comment is not part of the hash |
| U10 | state | every allowed status × event passes, every other combination throws |
| U11 | state | canSubmit: initiator while DRAFT only |
| U12 | state | canReview: only the other member while REVIEW |
| U13 | state | canSelfLock: initiator, other party not joined, not locked |
| U14 | india-rules | deposit caps TN 3 / MTA 2 / Other none |
| U15 | india-rules | warning only above the cap, never says "illegal" |
| U16 | india-rules | TN refund due +1 month, month-end clamp, leap year, other states null |
| U17 | ratings | labels |
| U18 | ratings | photo rule (rating ≥ 3 or overview) |
| U19 | ratings | item done = rated + photo rule met |
| U20 | comparison | Good→Damaged = worse, Good→Missing = missing |
| U21 | comparison | new move-out note flagged |
| U22 | comparison | worse item with a new note counts both |
| U23 | comparison | photos per side, not a flag |
| U24 | comparison | no move-out entry = not captured |
| U25 | comparison | unrated move-in never flags worse |
| U26 | settlement | totals by status, refund now / if all accepted |
| U27 | settlement | empty list = full deposit back |
| U28 | settlement | status NO_DEDUCTIONS → PENDING → DISPUTED → SETTLED |
| U29 | settlement | deductions may not exceed the deposit (withdrawn excluded) |
| U30 | settlement | refund countdown wording (due in / tomorrow / today / overdue) |
| U31 | settlement | TN move-out 10 days ago → due in 21 days |
| U32 | format | times shown in IST whatever the server zone |
| U33 | format | ₹ with Indian digit grouping |

(Some IDs group several `expect`s of one Vitest `it`; the runner reports 33 tests.)

## 3. Integrity scripts

| ID | Script | Expected |
| --- | --- | --- |
| I01 | `npm run lock-check` | 16 tamper attempts refused: edit/delete entries, photos, signatures of a locked report; unlock or delete the report; edit rooms/items after move-in lock; update/delete audit events; cross-tenancy items in entries/deductions |
| I02 | `npm run try-tamper` (or `npm run try-tamper -- <lockedReportId>`) | "refused by the database: MoveProof: report is locked …" |
| I03 | `npm run verify-check -- <lockedReportId>` | `MATCH — unchanged since lock`, exit 0; mismatch exits 1 |

## 4. Manual / system test cases

Setup: `npm run dev`, two browsers (or two phones via an https tunnel), accounts O (owner) and T (tenant), a third account X. Login codes print in the server terminal.

| TC | F-ID | Steps | Expected |
| --- | --- | --- | --- |
| TC01 | F01 | Enter email → code from terminal → Sign in. Try a wrong code. | Lands on My tenancies; wrong code shows an error; 60 s resend cooldown |
| TC02 | F02 | Create tenancy: address, TN, rent 8000, deposit 40000, role Tenant, PG single room | Tenancy home shows address, rent, deposit, you as tenant |
| TC03 | F03 | While typing deposit 40000 with rent 8000 (TN); then choose MTA; then Other | TN: "5 months' rent … caps it at 3 months"; MTA: 2-month wording; Other: no warning |
| TC04 | F04 | Open move-in report → Edit checklist: add item "AC remote", rename a room, remove an item. Log in as the other party. | Changes saved and listed; other party sees no editor |
| TC05 | F05 | On tenancy home tap WhatsApp; tap Copy link | WhatsApp opens with prefilled text + link; toast "Link copied" |
| TC06 | F05 | Account O opens the link, enters name, Join as Owner. Account X opens the same link | O appears as Owner; X sees "Both … have already joined" and cannot open the tenancy |
| TC07 | F06 | Item page: pick Damaged, save without photo | Item shows "needs a photo" in Still to do; not counted as done |
| TC08 | F07 | Rate Room overview Excellent, no photo | Still requires a photo |
| TC09 | F08 | Take photo on a phone | Rear camera overlay; photo appears with "verified ✓"; no gallery option exists |
| TC10 | F08 | Tamper with an upload (send a sha256 that does not match the bytes) | "Photo failed integrity check, please retake"; nothing stored |
| TC11 | F09 | Initiator completes all items → Submit and sign with full name | Status In review; initiator signature listed |
| TC12 | F10 | Other party adds an item comment → Request changes | Back to Draft, all signatures removed; initiator sees the comment |
| TC13 | F11 | Initiator resubmits; other party countersigns from a stale tab, then reloads and signs | Stale tab refused ("report changed"); after reload report LOCKED with both signatures and hash |
| TC14 | F12 | Solo tenancy (no second party) → Self-attest and lock | LOCKED with "Self-attested" badge on report, tenancy home, print and verify page |
| TC15 | F13 | `npm run try-tamper -- <lockedReportId>` | Database refuses each change |
| TC16 | F14 | After move-in lock: Start move-out with a date → capture → sign → lock | Same items as move-in; same flow |
| TC17 | F15 | Open Compare | Worse and Missing items flagged; "Only changed" on by default; photos side by side |
| TC18 | F16 | Owner adds a ₹4000 Damage deduction on a flagged item; tries a total above the deposit; tenant looks for the button | Proposed; over-deposit refused; tenant has no Add deduction |
| TC19 | F17 | Tenant accepts one, disputes another (Dispute disabled until a note is typed); owner withdraws the disputed one | Statuses update; owner cannot accept/dispute |
| TC20 | F18 | Watch the settlement card through TC18–19 | Pending → Disputed → Settled; refund now = deposit − accepted |
| TC21 | F19 | TN tenancy with move-out date 10 days ago | "Refund due in ~21 days (date)"; non-TN: "Check your agreement" |
| TC22 | F20 | Print / PDF on a locked report and on Compare → browser Save as PDF | A4 PDF with photos, captions, hash, QR, footer "Not a legal contract" |
| TC23 | F21 | Scan the QR on a phone, without logging in | /verify shows "✓ Unchanged since …", first names only, no address/photos/notes |
| TC24 | F21 | Open /verify/<random id> | Friendly "Report not found" |
| TC25 | F22 | Read Activity on tenancy home | Plain sentences in IST, e.g. "Priya submitted and signed the move-in report" |
| TC26 | N02 | All screens at 360 px | No horizontal scroll; buttons ≥ 44 px |
| TC27 | N04 | Open /t/<id> or a photo URL as a non-member | Redirected / 404; photos only through the member-checked route |

## 5. Traceability matrix

| F-ID | Requirement | Unit / script | Manual / system | Status |
| --- | --- | --- | --- | --- |
| F01 | Email OTP login | — | TC01 | Pass (Playwright, Phase 1) |
| F02 | Create tenancy | — | TC02 | Pass (Phase 2) |
| F03 | Deposit-cap warning | U14, U15 | TC03 | Pass |
| F04 | Templates, edit checklist in Draft | I01 (frozen after lock) | TC04 | Pass (Phase 2) |
| F05 | Invite link, WhatsApp | — | TC05, TC06 | Pass (Phase 2); WhatsApp on a real phone: pending human test |
| F06 | Rating, notes, photo rule | U17–U19 | TC07 | Pass (Phase 3) |
| F07 | Room overview needs photo | U18, U19 | TC08 | Pass |
| F08 | Live camera, SHA-256 verified | — | TC09, TC10 | Server checks Pass (Phase 3); real-phone camera: pending human test |
| F09 | Initiator submits and signs | U10, U11 | TC11 | Pass (Phase 4) |
| F10 | Review, comment, request changes | U10, U12, U09 | TC12 | Pass (Phase 4) |
| F11 | Countersign with seen hash → lock | U05–U08 | TC13 | Pass (Phase 4) |
| F12 | Self-attested lock | U13 | TC14 | Pass (Phase 4) |
| F13 | DB lock | I01, I02 | TC15 | Pass |
| F14 | Move-out report | — | TC16 | Pass (Phase 5) |
| F15 | Comparison + flags | U20–U25 | TC17 | Pass (Phase 5) |
| F16 | Owner proposes deductions | U29 | TC18 | Pass (Phase 6) |
| F17 | Accept / dispute / withdraw | — | TC19 | Pass (Phase 6) |
| F18 | Settlement summary | U26–U28 | TC20 | Pass (Phase 6) |
| F19 | Refund-due countdown | U16, U30, U31 | TC21 | Pass (Phase 6) |
| F20 | Printable report + QR | — | TC22 | Pass (Chromium PDF, Phase 7); phone print: pending human test |
| F21 | Public verify page | U05, I03 | TC23, TC24 | Pass (Phase 7); QR scan on phone: pending human test |
| F22 | Audit log | I01 (append-only) | TC25 | Pass (Phase 8) |
