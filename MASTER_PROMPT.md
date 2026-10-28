# Master prompt — paste this into Claude Code once, at the start

> Copy everything inside the box below into Claude Code, opened in the root of this folder.

```
You are the lead engineer building MoveProof, a move-in / move-out condition report app for Indian rentals and student PGs. This is my Software Engineering course project and I am building it tonight.

Before writing any code:
1. Read CLAUDE.md fully. It holds the rules, the stack and the build log. Follow it exactly.
2. Read docs/SPEC.md fully. It is the requirements and design spec.
3. List the files in phases/ so you know all phases.

Then work like this:
- Find the first phase in CLAUDE.md's Phase Status table that is not Done. Open its file in phases/ and execute it task by task.
- Follow the Progress Logging Protocol in CLAUDE.md section 4 strictly: update CLAUDE.md after EVERY completed task, not just at the end of a phase. If my usage limit hits mid-phase, the next session must be able to resume from CLAUDE.md alone.
- When a phase is finished, run its acceptance checks, mark it Done in CLAUDE.md with a Summary and Next line, and make one local git commit.
- Then continue straight to the next phase without waiting for me, unless the phase hits a HUMAN STEP. For a HUMAN STEP, stop, tell me exactly what to do in short numbered steps, log it in CLAUDE.md, and wait.

Hard rules (repeat of CLAUDE.md, because they matter most):
- NEVER run git push. I push myself.
- NEVER add Claude as co-author or mention Claude/AI in commit messages. No Co-Authored-By, no "Generated with Claude Code", no Claude-Session trailer.
- NEVER weaken the integrity rules: live camera only, SHA-256 on every photo, report hash bound to signatures, database lock triggers untouched.
- Never print or commit secrets.
- Keep the UI mobile-first and simple; Indian students on budget Android phones are the main users.

Start now with the first unfinished phase. Tell me in one line which phase you are starting.
```

---

## Resume prompt — paste this after a usage limit or a new session

```
Read CLAUDE.md, especially "Current position" and the Build Log. Run `git status` and `git log --oneline -5` to see the real state of the files. Reconcile any difference between the log and the files (a task marked STARTED but not finished must be checked and either completed or redone). Then continue from the next unfinished task of the current phase, following every rule in CLAUDE.md. Tell me in one line where you are resuming from.
```

---

## Single-phase prompt — if you prefer to drive one phase at a time

```
Read CLAUDE.md and docs/SPEC.md, then execute phases/PHASE_0X_<name>.md only. Log every task in CLAUDE.md as you go, run the phase's acceptance checks, mark it Done, commit locally (no push, no co-author), then stop and summarise what I should test.
```
