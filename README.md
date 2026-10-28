# MoveProof build kit for Claude Code

Everything Claude Code needs to build MoveProof phase by phase, while recording its progress in `CLAUDE.md`, so a usage limit never loses your place.

## What's in this folder

```
CLAUDE.md                      Project memory + rules + live build log (Claude Code reads it automatically)
MASTER_PROMPT.md               The prompt to paste first, plus the resume prompt and a single-phase prompt
docs/SPEC.md                   Problem statement, requirements, hash rules, state machine, routes, module map
supabase/migrations/0001_init.sql   Full database schema with lock triggers (you paste this into Supabase)
supabase/checks/lock_check.sql      Manual tamper test for the viva
phases/PHASE_00 … PHASE_08     One file per phase: tasks, human steps, acceptance checks, commit message
.claude/settings.json          Turns off Claude commit/PR attribution and blocks `git push`
.githooks/commit-msg           Strips any Claude co-author / session lines from commit messages
.githooks/pre-push             Refuses any push containing Claude attribution (protects your own pushes too)
```

## How to use it

1. Unzip into an empty folder, e.g. `moveproof/`, and open a terminal there.
2. Make sure you have Node.js 20+ and git, plus a Supabase account and a Vercel account.
3. Start Claude Code in that folder: `claude`.
4. Paste the master prompt from `MASTER_PROMPT.md`.
5. Do the **HUMAN STEPs** when Claude stops and asks. There are three: Supabase keys, running the SQL, and deploying to Vercel for phone testing.
6. If you hit a usage limit, start a new session later in the same folder and paste the **resume prompt** from `MASTER_PROMPT.md`.

## Phases (about 9 hours in total)

| Phase | What gets built | Time |
| --- | --- | --- |
| 0 | Next.js app, tooling, git hooks | 30 min |
| 1 | Schema, storage, email-OTP login, guards | 45 min |
| 2 | Tenancy, PG/1BHK templates, deposit-cap warning, WhatsApp invite | 60 min |
| 3 | Live camera, browser hashing, verified uploads | 2 h |
| 4 | Report hash, two-party sign, lock, self-attested lock | 75 min |
| 5 | Move-out report, side-by-side comparison | 75 min |
| 6 | Itemised deductions, accept/dispute, refund countdown | 60 min |
| 7 | Printable PDF, QR code, public verify page | 45 min |
| 8 | Hardening, tests, SE documents, demo script | 45–60 min |

If time runs short, skip Phase 7 first (you can still demonstrate the lock with the tamper script).

## About commit attribution

`.claude/settings.json` sets `attribution` to empty strings and denies `git push`. Some Claude Code versions have had bugs where attribution still appeared, so the two git hooks are a backstop:
- `commit-msg` removes `Co-Authored-By: Claude…`, `Claude-Session:` and "Generated with Claude Code" lines from every commit.
- `pre-push` blocks a push if any of those lines slipped through.

Phase 0 activates the hooks with `git config core.hooksPath .githooks`. If you clone the repo elsewhere, run that command again.

You can also put the same `attribution` block in your user-level `~/.claude/settings.json` so it applies to every project.
