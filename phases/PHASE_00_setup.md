# Phase 0 — Setup and scaffolding

**Goal:** a running Next.js app in `web/`, git initialised with the safety hooks, environment template ready. Target time: 30 min.

**Read first:** `CLAUDE.md`, `docs/SPEC.md` §2 and §8.

## Tasks

- [ ] **0.1 Git.** If the root is not a git repo: `git init -b main`. Run `git config core.hooksPath .githooks` and `chmod +x .githooks/*`. Create a root `.gitignore` containing `node_modules/`, `.env*.local`, `.env`, `.next/`, `.vercel/`, `*.log`, `.DS_Store`. Do NOT add any remote.
- [ ] **0.2 Scaffold.** From the repo root: `npx create-next-app@latest web --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --disable-git` (accept defaults for anything else; no Turbopack-specific config needed). Note the installed Next.js major version in the log.
- [ ] **0.3 Dependencies** (inside `web/`): `npm i @supabase/supabase-js @supabase/ssr zod qrcode` and `npm i -D vitest @types/qrcode`. Add scripts: `"test": "vitest run"`, `"typecheck": "tsc --noEmit"`.
- [ ] **0.4 shadcn/ui.** `npx shadcn@latest init` (defaults, neutral base colour), then add: `button card input label textarea badge dialog sonner tabs separator`.
- [ ] **0.5 Env template.** Create `web/.env.example`:
  ```
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_ANON_KEY=
  SUPABASE_SERVICE_ROLE_KEY=
  NEXT_PUBLIC_APP_URL=http://localhost:3000
  NEXT_PUBLIC_ALLOW_DEV_UPLOAD=false
  ```
  (If the Supabase dashboard shows "publishable" and "secret" keys instead of anon/service_role, the publishable key goes in `NEXT_PUBLIC_SUPABASE_ANON_KEY` and the secret key in `SUPABASE_SERVICE_ROLE_KEY`.)
- [ ] **0.6 Base layout.** Replace the starter page with a minimal mobile-first shell: app name "MoveProof", tagline "Proof of your room's condition, signed by both sides.", `max-w-md mx-auto` container, Toaster from sonner. Set `<html lang="en">`, page title "MoveProof", viewport meta suited to mobile.
- [ ] **0.7 Landing page `/`.** One-line problem ("Most deposit fights are about proof. MoveProof gives both sides the same signed record."), two buttons: "Start a report" → `/tenancies/new`, "I have an invite" → `/login`. Links can 404 for now.
- [ ] **0.8 Folder skeleton.** Create empty modules from SPEC §8 under `web/src/lib/` with a one-line comment each, so the structure matches the class diagram from the start.

## HUMAN STEP (log it, then wait)

Tell the human, in chat, exactly:
1. Go to supabase.com → New project (region: Mumbai / ap-south-1 if available). Save the database password.
2. Project Settings → API: copy the Project URL, anon/publishable key and service_role/secret key.
3. Create `web/.env.local` from `web/.env.example` and paste the three values.
4. Reply "keys added".

## Acceptance checks
- `cd web && npm run lint && npm run typecheck && npm run build` pass.
- `npm run dev` serves the landing page.
- `git config core.hooksPath` prints `.githooks`; `git remote -v` prints nothing.

## Finish
Update CLAUDE.md (status Done, Summary, Next). Commit: `chore: scaffold Next.js app, tooling and git hooks`.
