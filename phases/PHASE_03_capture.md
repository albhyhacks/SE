# Phase 3 — Live capture, hashing and photo upload

**Goal:** the report initiator can go room by room, rate each item, write notes and take live photos that are hashed in the browser and verified on the server. Target time: 2 h. This is the most important UX in the app.

**Read first:** `CLAUDE.md` §3 Integrity rules, `docs/SPEC.md` §3 F06–F08, §5.

## Tasks

- [ ] **3.1 Ratings** `src/lib/ratings.ts`: labels 1–6 (Excellent, Good, Fair, Poor, Damaged, Missing), colours for badges, `photoRequired(rating, isOverview)`.
- [ ] **3.2 Report loader** `src/lib/reports.ts`: `loadReportTree(reportId)` → report + rooms (sorted) + items (sorted) + entry per item + photos per entry. Used by UI now and by hashing in Phase 4.
- [ ] **3.3 Report page** `/t/[id]/r/[reportId]`: header (type, status badge), progress bar ("23 of 41 items done"), list of rooms with per-room progress, each room expands to its items with rating badge and photo count. An item is "done" when it has a rating and meets the photo rule. Read-only view when the viewer is not the initiator or status ≠ DRAFT.
- [ ] **3.4 Item page** `/t/[id]/r/[reportId]/item/[itemId]`: item name, room name, rating as 6 large buttons, notes textarea, photo strip, "Take photo" button, "Save and next item" (goes to next item in the room, then next room). Saving is a server action that checks: member, initiator, report DRAFT, item belongs to the report's tenancy.
- [ ] **3.5 Camera component** `src/components/camera-capture.tsx` (client):
  - Opens rear camera via `navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } }, audio: false })` in a full-screen overlay with a big shutter button and cancel.
  - On shutter: draw video frame to canvas scaled so the long edge ≤ 1600 px, `canvas.toBlob(..., 'image/jpeg', 0.75)`, compute SHA-256 hex with `crypto.subtle.digest`, record `captured_at = new Date().toISOString()`.
  - Stops all tracks on close/unmount. Clear error messages for permission denied / no camera / insecure context (camera needs HTTPS or localhost; tell the human to test on a phone through the deployed Vercel URL or a tunnel).
  - There is NO file input. Only if `process.env.NEXT_PUBLIC_ALLOW_DEV_UPLOAD === 'true'`, show a small "Dev upload" link that uses a file input, resizes the same way, and sends `source: 'dev_upload'`.
- [ ] **3.6 Upload flow** (server actions in the item route's `actions.ts`):
  1. `requestPhotoUpload({ entryId, sha256 })` → guards → path `<tenancyId>/<sha256>.jpg` → `admin.storage.from('photos').createSignedUploadUrl(path)` → returns `{ path, token }`. If a photo with the same sha256 already exists on this entry, return a "duplicate" result.
  2. Client: `supabase.storage.from('photos').uploadToSignedUrl(path, token, blob, { contentType: 'image/jpeg' })` using the browser client.
  3. `confirmPhotoUpload({ entryId, sha256, path, capturedAt, source })` → guards → download the object with the admin client → SHA-256 in Node → if mismatch: delete object, return error "Photo failed integrity check, please retake" → else insert `photos` row → `logEvent('photo.added', { item, sha256 })`.
  - Show upload progress and retry on network failure (keep the blob in memory until confirmed).
- [ ] **3.7 Displaying photos:** server creates signed URLs (expiry 600 s) via `createSignedUrls` for all photos of the page in one call. Thumbnails in a strip; tap to view full; show "Taken <time> · verified" with the server `uploaded_at`. Initiator may delete a photo while DRAFT (delete row + object).
- [ ] **3.8 Validation summary** on the report page: list items still missing a rating or a required photo, each linking to its item page.

## Acceptance checks
- On a phone (deployed URL or HTTPS tunnel), the camera opens the rear lens; there is no way to pick a gallery photo.
- A captured photo appears with "verified"; its row has a 64-char sha256 and the object path ends in that hash.
- Manually tamper test: in a scratch script, call `confirmPhotoUpload` with a wrong sha256 → rejected and the object deleted.
- Rating "Damaged" without a photo → item shows as not done.
- lint, typecheck, test, build pass.

## HUMAN STEP (optional but recommended now)
Ask the human to deploy to Vercel for phone testing: import the repo folder (or `npx vercel` from `web/`), set root directory `web`, add the env vars, then add the Vercel URL to Supabase → Authentication → URL Configuration (Site URL + Redirect URLs) and set `NEXT_PUBLIC_APP_URL`. Do not run `git push` yourself; if they deploy via GitHub, they push.

## Finish
Update CLAUDE.md. Commit: `feat(capture): live camera, browser hashing and verified uploads`.
