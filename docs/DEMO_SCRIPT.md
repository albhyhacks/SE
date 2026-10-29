# MoveProof — 5-minute demo

**Before the demo:** `cd web && npm run build && npm start` (or `npm run dev`). Keep the terminal visible, because login codes print there. Open Phone A (tenant) and Phone B (owner); on a laptop use two browser profiles. For real phones, use an https tunnel and set `NEXT_PUBLIC_APP_URL` to it, since the camera needs https. Open a second terminal in `web/`.

| Time | Who | Do | Say |
| --- | --- | --- | --- |
| 0:00 | — | Landing page | "Most deposit fights are about proof. MoveProof gives both sides the same signed record." |
| 0:15 | A | Sign in (code from terminal) → Start a report → TN, rent 8000, deposit 40000 | Point at the yellow warning: "5 months' rent; Tamil Nadu caps it at 3 unless the agreement says otherwise." |
| 0:45 | A | Template *PG single room* → Create | "Rooms and items come from a template; every room starts with an overview photo." |
| 1:00 | A | Open report → Room overview: Good + 📷 photo; Fan: Good; Chair: **Damaged** + photo | "Live camera only, no gallery. The phone hashes each photo with SHA-256 and the server re-checks it before storing." |
| 1:45 | A | Tenancy home → WhatsApp invite (show prefilled text) → copy link to Phone B | "Owners don't install apps, so the invite goes over WhatsApp." |
| 2:00 | A | (Fill remaining items quickly or use a small checklist) → Submit and sign | "The signature stores the hash of what I saw." |
| 2:15 | B | Open link → sign in → Join as Owner → open report → comment on Fan → Request changes | "Signatures are wiped, so nobody can sign a version they didn't see." |
| 2:35 | A | Fix Fan → resubmit. B signs → **LOCKED** | Show the hash and both signers. |
| 2:50 | Terminal | `npm run try-tamper -- <reportId>` (id from the URL) | "Even direct database access is refused: the lock is enforced by triggers, not by app code." |
| 3:10 | A | Tenancy home → Start move-out (date) → capture Chair as **Missing**, others Good → submit; B signs | — |
| 3:40 | B | Compare → Chair flagged *Missing* → Add deduction ₹1500 *Missing* | "Deductions are item by item and can't exceed the deposit." |
| 4:00 | A | Dispute with note "Chair was taken by the warden" | Settlement card: *Deductions disputed*, refund due date and countdown. |
| 4:20 | B | Locked move-in report → Print / PDF | Show hash, QR, photos with capture time and hash prefix. |
| 4:40 | Any phone | Scan the QR (no login) | "✓ Unchanged since … — anyone, like a parent or mediator, can check this, and it never shows the address or photos." |
| 4:55 | — | — | "An evidence record both sides signed, which the database itself refuses to change." |

**Backup if the camera fails:** set `NEXT_PUBLIC_ALLOW_DEV_UPLOAD=true` (photos are labelled *dev upload*) or show the Playwright-verified flow. `npm run lock-check` shows all 16 refusals.
