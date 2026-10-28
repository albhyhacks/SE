# MoveProof — Specification (MVP, one-night build)

## 1. Problem statement

Tenants and property owners of rental homes and paying-guest (PG) accommodation in India lack a shared, tamper-evident, item-wise record of a property's condition at move-in. As a result, move-out deposit deductions cannot be fairly verified, causing disputes, lost deposits and mistrust. MoveProof lets both parties jointly create, review, sign and lock a photo-backed condition report at move-in; capture the same checklist at move-out; compare the two side by side; and settle each deduction individually, producing a record either party can independently verify.

Indian context the app must reflect:
- Tamil Nadu Regulation of Rights and Responsibilities of Landlords and Tenants Act, 2017, s.11: unless the agreement says otherwise, the deposit may not exceed **three months' rent**; it is to be refunded within **one month** of the tenant vacating.
- Model Tenancy Act, 2021 (for states that adopt it): residential deposit capped at **two months' rent**.
- Many owners never install apps; sharing happens on WhatsApp. The other party must be able to review and sign from a link.
- The app produces an **evidence record**, not a legal contract. UI copy must never say "legally binding".

## 2. Actors

| Actor | Description |
| --- | --- |
| Tenant | Student or young professional; usually the one who loses money today |
| Owner | Landlord or PG manager |
| Verifier | Anyone with the verify link (parent, mediator); no login |
| System | Timestamps, hashing, locking |

Either the owner or the tenant can be the **initiator** (creates the tenancy). The other joins through an invite link.

## 3. Functional requirements (MVP)

| ID | Requirement |
| --- | --- |
| F01 | Sign in with email OTP (6-digit code) |
| F02 | Create a tenancy: address, state (TN / MTA state / Other), monthly rent, deposit, own role (Owner or Tenant) |
| F03 | Warn if deposit exceeds the state's cap (TN: 3 months, MTA: 2 months; Other: no warning) |
| F04 | Build checklist from a template (1BHK, 2BHK, PG single room, PG shared room); add, rename or remove rooms and items while in Draft |
| F05 | Invite the other party with a link; share via WhatsApp (`https://wa.me/?text=...`) or copy |
| F06 | Per item: rating (1–6), notes, one or more live photos; photo required when rating ≥ 3 |
| F07 | Each room starts with a "Room overview" item that requires a photo |
| F08 | Photos only from in-page camera; SHA-256 verified on server |
| F09 | Initiator submits and signs (typed full name); report moves to Review |
| F10 | Other party reviews; may comment per item and request changes (back to Draft, all signatures voided) |
| F11 | Other party signs with the hash they saw; if it matches, report locks |
| F12 | Self-attested lock: if the other party has not joined, initiator may lock alone; report is marked self-attested everywhere |
| F13 | Locked report cannot be changed (DB triggers) |
| F14 | Move-out report on the same items, same capture / review / sign / lock flow |
| F15 | Side-by-side comparison per item; flag items whose rating got worse or became Missing; "only changed" filter |
| F16 | Owner proposes deductions per item: amount (₹), reason (Cleaning, Damage, Missing, Other), note |
| F17 | Tenant accepts or disputes each deduction with a note; owner may withdraw |
| F18 | Settlement summary: deposit, accepted, disputed, pending, refund due; total deductions may not exceed deposit |
| F19 | Refund-due date (TN: move-out date + 1 month) with countdown |
| F20 | Printable report (print stylesheet) with report hash and QR code to verify page |
| F21 | Public `/verify/[reportId]`: stored hash, recomputed hash, match/mismatch, lock time, signer roles, self-attested flag; no photos, no addresses |
| F22 | Simple audit log of key actions per tenancy, visible to both members |

## 4. Non-functional requirements

| ID | Requirement |
| --- | --- |
| N01 | Integrity: lock enforced in the database, not only in app code |
| N02 | Mobile-first: usable one-handed on a 360 px wide screen; large tap targets |
| N03 | Photos compressed in browser to ≤ 1600 px long edge, JPEG quality 0.75 |
| N04 | Security: RLS on all tables with no policies; all access via server actions after auth + membership checks; private storage, short-lived signed URLs (≤ 10 min) |
| N05 | Privacy: no GPS collected in MVP; verify page reveals no personal data beyond first names of signers |
| N06 | Cost: runs on Supabase and Vercel free tiers |
| N07 | Maintainability: modules in `src/lib/` mirror the class diagram |

## 5. Rating scale

| Value | Label | Photo required |
| --- | --- | --- |
| 1 | Excellent | No (overview item: yes) |
| 2 | Good | No |
| 3 | Fair | Yes |
| 4 | Poor | Yes |
| 5 | Damaged | Yes |
| 6 | Missing | Yes |

"Got worse" = move-out rating > move-in rating.

## 6. Canonical report hash

```
payload = {
  v: 1,
  reportId, tenancyId, type,
  rooms: [ sorted by room.sort then room.id
    { id, name, items: [ sorted by item.sort then item.id
      { id, name, rating, notes,            // notes: trimmed string or null
        photos: [ sha256 strings sorted ascending ] } ] } ]
}
canonicalJson = JSON with object keys sorted recursively, no whitespace
reportHash   = lowercase hex SHA-256 of UTF-8 canonicalJson
```
Reviewer comments and signatures are NOT part of the hash (they change during review). Implement once in `src/lib/hash.ts` and reuse for submit, sign and verify.

## 7. State machine (per report)

| From | Event | To | Guard |
| --- | --- | --- | --- |
| DRAFT | submit | REVIEW | Actor is initiator of this report; every item rated; photo rules met; inserts initiator signature |
| REVIEW | request_changes | DRAFT | Actor is the other member; deletes all signatures of this report |
| REVIEW | countersign | LOCKED | Actor is the other member; posted hash == recomputed hash == initiator's signed hash |
| REVIEW or DRAFT | self_lock | LOCKED | Actor is initiator; other party has NOT joined the tenancy; sets self_attested = true |

Tenancy-level flow: MOVE_IN LOCKED → MOVE_OUT report can be created → MOVE_OUT LOCKED → deductions allowed → settlement status derived:
- `NO_DEDUCTIONS` (none), `PENDING` (any PROPOSED), `DISPUTED` (any DISPUTED, none PROPOSED), `SETTLED` (all ACCEPTED or WITHDRAWN).

The transition table lives in `src/lib/state.ts` and is unit-tested.

The initiator of a report = the member who created that report (stored as `reports.created_by`).

## 8. Module map (mirrors the class diagram)

| Module (`web/src/lib/…`) | Responsibility |
| --- | --- |
| `supabase/client.ts`, `server.ts`, `admin.ts` | Browser client, cookie-based server client, service-role client |
| `auth.ts` | `requireUser()`, `requireMember(tenancyId)`, `getMembership()` |
| `templates.ts` | Checklist templates |
| `india-rules.ts` | Deposit caps, refund-due date |
| `ratings.ts` | Rating labels, photo-required rule |
| `hash.ts` | Canonical JSON, report hash, sha256 helpers |
| `state.ts` | Report transitions and guards |
| `reports.ts` | Load full report tree for UI and hashing |
| `comparison.ts` | Pair move-in / move-out entries, flags |
| `settlement.ts` | Totals, status, refund due |
| `audit.ts` | `logEvent()` |

Server actions live in `web/src/app/**/actions.ts`, each one: parse with Zod → `requireUser` → `requireMember` → guard → write → `logEvent` → `revalidatePath`.

## 9. Routes

| Route | Screen |
| --- | --- |
| `/` | Landing: problem in one line, "Start a report", "I have an invite" |
| `/login` | Email → 6-digit code |
| `/dashboard` | My tenancies with status chips |
| `/tenancies/new` | Create tenancy form + deposit-cap warning + template pick |
| `/join/[code]` | Accept invite (after login) |
| `/t/[id]` | Tenancy home: parties, invite/share, move-in & move-out cards, settlement card, audit log |
| `/t/[id]/r/[reportId]` | Report: room list with progress; submit / review / sign actions |
| `/t/[id]/r/[reportId]/item/[itemId]` | Item capture: rating, notes, camera, photos |
| `/t/[id]/compare` | Side-by-side comparison + deductions |
| `/t/[id]/print/[reportId]` | Printable report |
| `/verify/[reportId]` | Public verification |

## 10. Data model

Defined in `supabase/migrations/0001_init.sql` (already written; do not change the lock triggers). Tables: `tenancies`, `members`, `rooms`, `items`, `reports`, `entries`, `photos`, `signatures`, `deductions`, `audit_events`. Storage object path: `photos/<tenancyId>/<sha256>.jpg`.
