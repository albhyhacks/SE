# Deviations from SPEC / phase files

| # | Area | Spec / phase said | What was built | Why |
| --- | --- | --- | --- | --- |
| D1 | Database | Supabase Postgres, `supabase/migrations/0001_init.sql` | SQLite via Node's built-in `node:sqlite`, schema `web/db/schema.sql` | Human request ("for now use sqlite"). The Postgres file is kept untouched for a later switch. |
| D2 | Lock triggers | Postgres trigger functions | One SQLite trigger per table and operation with the same rules, **stricter**: OLD and NEW rows are both checked on UPDATE (nothing can be moved into or out of a locked report), and extra triggers stop entries/deductions pointing at another tenancy's items or being re-parented | SQLite has no trigger functions; closes a re-parenting gap found in review |
| D3 | Auth | Supabase Auth email OTP | Own OTP: 6-digit code, SHA-256 hashed in DB, 10 min expiry, 5 attempts, 60 s resend; session = random token in an httpOnly cookie, stored hashed. Locally the code is **printed in the server terminal** (no mail service). | No Supabase. Plugging in an email provider is one function (`issueOtp`). |
| D4 | RLS | RLS on, no policies; anon-key check script | No network DB API exists; the SQLite file is only opened by `lib/db.ts` (`server-only`). `npm run lock-check` replaces `rls-check.mjs`. | Same guarantee (browser can't reach tables) by construction |
| D5 | Photo storage | Supabase Storage, signed upload/download URLs | Browser posts the JPEG to a server action; the server re-hashes **before** writing to `data/photos/<tenancy>/<sha256>.jpg`, so a mismatching file is never stored; photos served by a member-checked route with 10-min private caching | No Storage; stronger than upload-then-delete |
| D6 | Hosting | Vercel | Local / any host with a persistent disk | SQLite needs a persistent file; Vercel's filesystem is ephemeral |
| D7 | `lock_check.sql` | Run in Supabase SQL editor | `npm run lock-check` (in-memory, 16 cases) and `npm run try-tamper -- <reportId>` (real DB) | No SQL editor |
| D8 | Next.js | Next.js (version unspecified) | Next.js 16.4: `proxy.ts` (not middleware), typed `PageProps`, `cacheComponents` turned **off** (every page is per-user dynamic) | Version differences |
| D9 | Module map | SPEC §8 list | Added `lib/db.ts`, `lib/photos.ts`, `lib/tenancies.ts` (tenancy, audit and deduction queries), `lib/qr.ts`, `lib/format.ts` (IST, ₹); `loadReport(tenancyId, reportId)` instead of `loadReportTree(reportId)` (always tenancy-scoped) | Keeps pages thin; scoping prevents cross-tenancy reads |
| D10 | shadcn/ui | — | Base UI variant (`base-nova`): no `asChild`, links styled with `buttonVariants` | Current shadcn default |
| D11 | Verify | admin client | `verifyReport()` in `lib/reports.ts` reuses the same `hash.ts`; also checks **every** signature's hash | — |
| D13 | Report roles | Initiator = whoever created the report (either party) | Tenant initiates move-in, owner initiates move-out (`initiatorRole()`); owner-created tenancy gets its move-in report when the tenant joins; tenant may initiate move-out only if no owner ever joined | Human request 2026-10-29: matches who has the most at stake at each stage |
| D12 | Env | Supabase keys | `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_ALLOW_DEV_UPLOAD`, optional `MOVEPROOF_DATA_DIR` | No keys needed |
