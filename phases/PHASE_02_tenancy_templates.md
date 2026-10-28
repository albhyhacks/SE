# Phase 2 — Tenancy, templates, invites and India rules

**Goal:** a user can create a tenancy from a template, see the deposit-cap warning, invite the other party over WhatsApp, and the other party can join. Target time: 60 min.

**Read first:** `docs/SPEC.md` §1 (Indian context), §3 F02–F05, F22, §9.

## Tasks

- [ ] **2.1 India rules** `src/lib/india-rules.ts`:
  - `depositCapMonths(state: 'TN'|'MTA'|'OTHER'): number | null` → TN 3, MTA 2, OTHER null.
  - `depositWarning(state, rent, deposit)` → `null` or a message such as "Your deposit is 5 months' rent. Tamil Nadu's law caps it at 3 months unless your agreement says otherwise." (MTA wording: "The Model Tenancy Act suggests a 2-month cap where your state has adopted it.") Never say "illegal"; this is information, not legal advice.
  - `refundDueDate(state, moveOutDate)` → TN: +1 month; others: null (show "check your agreement").
  - Unit tests in `src/lib/india-rules.test.ts` (Vitest).
- [ ] **2.2 Templates** `src/lib/templates.ts`. Every room starts with a `Room overview` item (`is_overview: true`). Suggested content:
  - **PG single room:** Room (overview, bed frame, mattress, pillow, cupboard + key, study table, chair, fan, tube light, switches, window + curtain, walls, floor, door + lock + key), Attached bathroom (overview, tap, shower, geyser, bucket + mug, toilet, wash basin, mirror, tiles, exhaust fan).
  - **PG shared room:** same as single, plus "Shared items: inventory note" item, and label personal items as "My bed", "My cupboard".
  - **1BHK:** Living room, Bedroom, Kitchen (overview, sink, tap, counter, cabinets, gas connection point, exhaust/chimney, tiles), Bathroom, Balcony; each with walls, floor, fan, lights, switches, windows, door.
  - **2BHK:** 1BHK + Bedroom 2 + Bathroom 2.
  - Export `TEMPLATES: { id, label, rooms: { name, items: { name, is_overview? }[] }[] }[]`.
- [ ] **2.3 Create tenancy** `/tenancies/new` + `actions.ts`:
  - Form (Zod): address, state (TN default), monthly rent (₹), deposit (₹), my role (Owner / Tenant), my display name, template.
  - Live deposit warning under the deposit field as the user types.
  - Action: `requireUser` → insert tenancy (invite_code = 10 url-safe random chars from `crypto.randomBytes`) → insert member → insert rooms + items from template with `sort` → create the `MOVE_IN` report (`created_by` = user) → create one `entries` row per item for that report → `logEvent('tenancy.created')` → redirect `/t/[id]`.
  - Do the inserts in a sensible order and clean up (delete the tenancy rows) if a later insert fails.
- [ ] **2.4 Dashboard** lists the user's tenancies (address, role, move-in status, move-out status) as cards linking to `/t/[id]`.
- [ ] **2.5 Tenancy home** `/t/[id]` (protected by `requireMember`): address, rent, deposit + warning, parties (Owner: name or "Not joined yet", Tenant: same), Move-in card (status + "Open report"), Move-out card (disabled until move-in is LOCKED), audit log (last 20 events, newest first, plain-language labels).
- [ ] **2.6 Invite + WhatsApp share** on tenancy home while the other role is empty:
  - Link: `${NEXT_PUBLIC_APP_URL}/join/<invite_code>`.
  - "Share on WhatsApp" → `https://wa.me/?text=` + encoded message: "Hi, I've started our move-in condition report for <address> on MoveProof. Please review and sign so we both have the same record: <link>".
  - "Copy link" button with toast.
- [ ] **2.7 Join flow** `/join/[code]`: `requireUser` (login redirects back here) → look up tenancy by code → if the user is already a member go to `/t/[id]` → if the free role exists, ask for display name and confirm "Join as Owner/Tenant" → insert member → `logEvent('member.joined')`. If both roles are taken, show a clear error.
- [ ] **2.8 Checklist editing while DRAFT:** on the move-in report page placeholder, allow adding/renaming/removing rooms and items (only the report's initiator; only while move-in is DRAFT). New items must also get an `entries` row for the move-in report. Keep the UI simple (inline edit + small dialog).

## Acceptance checks
- Create a PG single-room tenancy with deposit = 5 × rent in TN → warning shows.
- WhatsApp button opens a prefilled message on a phone.
- A second account joins via the link and appears on the tenancy home; a third account is refused.
- Audit log shows "Tenancy created" and "Tenant joined".
- RLS check script from Phase 1 still returns no rows.
- lint, typecheck, test, build pass.

## Finish
Update CLAUDE.md. Commit: `feat(tenancy): templates, deposit rules, invites and WhatsApp share`.
