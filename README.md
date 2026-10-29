# MoveProof

**Proof of your room's condition, signed by both sides.**

Indian tenants, especially students in PGs, often lose part of their deposit at move-out because nobody can prove what the room looked like at move-in. MoveProof lets the tenant and the owner build a room-by-room, item-by-item condition report with live photos, sign it together, and **lock** it so that even the database refuses to change it. At move-out the same checklist is captured again and compared side by side, and every deduction is settled item by item. Anyone with the link can check that a printed report is unchanged.

It is an evidence record, not a legal contract.

## Features
- Email login with a 6-digit code (no passwords)
- Tenancy with Tamil Nadu / Model Tenancy Act **deposit-cap warning**
- Templates: PG single room, PG shared room, 1BHK, 2BHK; checklist editable while in draft
- Invite the other party through **WhatsApp** or a copied link
- Ratings 1–6, notes, and **live camera photos only**, each SHA-256 hashed in the browser and re-checked on the server
- Submit → review with per-item comments → request changes or countersign → **LOCKED**; self-attested lock if the other side never joins
- The **tenant records move-in**, the **owner records move-out**, and the other side reviews and countersigns
- Move-out report on the same frozen checklist, **side-by-side comparison** with Worse / Missing flags
- Itemised **deductions**: owner proposes, tenant accepts or disputes, owner withdraws; settlement summary with the TN refund deadline countdown
- **Printable A4 PDF** with QR code, and a public **/verify** page that recomputes the hash
- Append-only activity log in plain language, times in IST

## Stack
Next.js 16 (App Router, Server Actions, TypeScript) · Tailwind CSS 4 + shadcn/ui · SQLite via Node's built-in `node:sqlite` · Zod · Vitest · `qrcode`. Mobile-first, designed for 360 px screens.

## Architecture
```
Browser (React client components)
  │  camera → canvas (≤1600 px, JPEG 0.75) → Web Crypto SHA-256
  ▼
Server actions  (each: Zod → requireUser → requireMember → role/state guard → write → logEvent)
  │
  ├── src/lib/  domain modules (mirror the class diagram)
  │     auth · templates · india-rules · ratings · hash · state · reports
  │     comparison · settlement · audit · tenancies · photos · qr · format · db
  ▼
SQLite file (web/data/moveproof.db)          Photos (web/data/photos/<tenancy>/<sha256>.jpg)
  └── lock triggers: locked report, entries, photos, signatures,
      frozen checklist, append-only audit, no cross-tenancy items
```
- Domain rules live in pure modules with unit tests (`hash`, `state`, `india-rules`, `ratings`, `comparison`, `settlement`).
- The database is opened only in `lib/db.ts` (`server-only`), so the browser has no path to the tables.

## Integrity design
1. **Photos:** live camera only (a file picker exists only behind a dev flag, and those photos are labelled `dev_upload`). The browser sends the JPEG with its SHA-256. The server recomputes the hash and stores the file only if it matches, under its own hash as the file name.
2. **Report hash:** SHA-256 of a canonical JSON of rooms → items → rating, trimmed notes and sorted photo hashes (`docs/SPEC.md` §6). Comments and signatures are excluded.
3. **Signatures:** each one stores the hash its signer saw. Countersigning is refused unless the posted hash, the recomputed hash and the initiator's signed hash all match.
4. **Lock:** once locked, SQLite triggers refuse any change to the report, its entries, photos and signatures, and to the checklist after the move-in lock. This holds even with direct database access (`npm run try-tamper`).
5. **Verify:** `/verify/<reportId>` recomputes the hash and compares it with the stored hash and every signature. It shows first names only: no address, photos or notes.

## Setup
Requires Node.js 22.5+ (built-in `node:sqlite`; developed on Node 24).
```bash
cd web
npm install
cp .env.example .env.local      # optional: set NEXT_PUBLIC_APP_URL
npm run dev                     # http://localhost:3000
```
The database is created automatically in `web/data/`. **Login codes are printed in the terminal running the server** because no mail service is configured.

To test the camera on a phone, open the app over **https** (for example a tunnel such as `cloudflared tunnel --url http://localhost:3000`) and set `NEXT_PUBLIC_APP_URL` to that address so invite links and QR codes point to it.

### Deploy
Any Node host with a persistent disk (a VM, Railway or Fly.io with a volume): `npm run build && npm start`, with `MOVEPROOF_DATA_DIR` pointing to the volume. Vercel's filesystem is not persistent, so it is not suitable while the app uses SQLite. The original Supabase schema is kept in `supabase/` for a future move to Postgres.

## Testing
```bash
cd web
npm run test                         # 35 unit tests (Vitest)
npm run lint && npm run typecheck && npm run build
npm run lock-check                   # 16 tamper attempts, all refused by triggers
npm run try-tamper -- <reportId>     # try to edit a real locked report
npm run verify-check -- <reportId>   # recompute a report's hash from the DB file
```
See `docs/TEST_PLAN.md` for the manual test cases and the requirements traceability matrix.

## Documents
`docs/SPEC.md` (requirements and design) · `docs/TEST_PLAN.md` · `docs/USER_MANUAL.md` · `docs/DEMO_SCRIPT.md` · `docs/DEVIATIONS.md` · `CLAUDE.md` (build log)

## Limitations
- Login codes go to the server console; a real deployment needs an email provider and per-IP rate limiting.
- SQLite plus local photo storage means a single server with a persistent disk.
- One owner and one tenant per tenancy; no co-tenants.
- English only; online only.
- `captured_at` comes from the client and is informational. The server's `uploaded_at` is authoritative.

## Future work
Offline capture with a background sync queue · push / WhatsApp notifications · a hash chain over audit events · Aadhaar eSign for signatures · Tamil and Hindi UI · AI-assisted change detection between move-in and move-out photos, used only as review flags and never to decide deductions.
