// Ad-hoc e2e acceptance run for Phase 4. Not a committed test: run manually after `npm run build`.
// Usage: node scripts/e2e-phase4.mjs  (kills its own server, backs up and restores web/data/)
import { spawn } from "node:child_process";
import { renameSync, rmSync, existsSync } from "node:fs";
import { chromium } from "/home/albhy/.npm-global/lib/node_modules/omniroute/node_modules/playwright/index.mjs";

const PORT = 4311;
const BASE = `http://localhost:${PORT}`;
const codes = {}; // email -> last 6-digit code seen in server output
let server;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await wait(500);
  }
  throw new Error("server did not start");
}
async function login(page, email) {
  await page.goto(`${BASE}/login`);
  await page.locator("#email").fill(email);
  await page.getByRole("button", { name: "Send code" }).click();
  await page.locator("#code").waitFor();
  for (let i = 0; i < 40 && !codes[email]; i++) await wait(250);
  const code = codes[email];
  if (!code) throw new Error(`no login code appeared for ${email}`);
  await page.locator("#code").fill(code);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/dashboard/);
}
async function status(page) {
  return page.locator("p", { hasText: " items done" }).innerText();
}

const record = (line) => {
  const m = /\[MoveProof\] login code for (\S+): (\d{6})/.exec(line);
  if (m) codes[m[1]] = m[2];
};

async function fillItem(page, url) {
  await page.goto(url);
  // Rating: pick "Good" — requires no photo except on overview items (and we add one anyway).
  await page.getByRole("button", { name: /Good/ }).first().click();
  // A photo for every item: fake camera stream keeps the real capture path in play.
  await page.getByRole("button", { name: "📷 Take photo" }).click();
  await page.locator("video").waitFor();
  await page.waitForFunction(() => !!document.querySelector("video")?.videoWidth, undefined, { timeout: 10_000 });
  await page.getByRole("button", { name: "Take photo", exact: true }).click();
  await page.locator('figcaption:has-text("verified")').first().waitFor({ timeout: 20_000 }).catch(async () => {
    console.log("  dbg| after shutter: toasts =", await page.locator("[data-sonner-toast]").allInnerTexts().catch(() => []));
    console.log("  dbg| fragments =", (await page.locator("figcaption").allInnerTexts()).slice(0, 6));
    throw new Error("photo never became verified");
  });
  const save = page.getByRole("button", { name: "Save and next item" });
  await save.click();
  await page.waitForLoadState("networkidle");
}

async function run() {
  if (existsSync("data")) {
    if (existsSync("data.e2e-backup")) rmSync("data.e2e-backup", { recursive: true, force: true });
    renameSync("data", "data.e2e-backup");
  }
  server = spawn("npx", ["next", "start", "-p", String(PORT)], { stdio: "pipe" });
  server.stdout.on("data", (b) => String(b).split("\n").forEach(record));
  server.stderr.on("data", (b) => String(b).split("\n").forEach(record));
  const serveLine = (b) => { for (const l of String(b).split("\n")) if (!/\[MoveProof\]/.test(l) && l.trim()) console.log("  srv|", l); };
  server.stdout.on("data", (b) => serveLine(b));
  server.stderr.on("data", (b) => serveLine(b));

  const browser = await chromium.launch({
    executablePath: "/home/albhy/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell",
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  });
  const mkCtx = () => browser.newContext({ viewport: { width: 360, height: 740 }, baseURL: BASE });
  const results = [];
  const ok = (name) => { results.push(`PASS ${name}`); console.log(`PASS ${name}`); };

  try {
    await waitForServer();
    const oCtx = await mkCtx(); const tCtx = await mkCtx();
    const owner = await oCtx.newPage(); const tenant = await tCtx.newPage();
    owner.setDefaultTimeout(20_000); tenant.setDefaultTimeout(20_000);

    await login(owner, "owner-e2e@x.in");
    // Create a tenancy (owner is the initiator)
    await owner.goto(`${BASE}/tenancies/new`);
    await owner.locator("#address").fill("12 MGR Road, Chennai");
    await owner.locator("#rent").fill("8000");
    await owner.locator("#deposit").fill("24000");
    await owner.locator("#name").fill("Ow Nerr");
    await owner.getByRole("button", { name: "Create and start move-in report" }).click();
    await owner.waitForURL(/\/t\//);
    const tenancyUrl = owner.url();
    console.log("tenancy:", tenancyUrl);
    const tId = tenancyUrl.split("/").pop();
    await owner.locator("code, p.font-mono").filter({ hasText: "/join/" }).first().waitFor();
    const inviteLink = await owner.locator("p.font-mono").filter({ hasText: "/join/" }).first().innerText();
    const inviteCode = `/join/${inviteLink.split("/join/")[1].trim()}`;
    ok("tenancy created with invite link");
    console.log("invite:", inviteCode);

    // Full item capture flow
    await owner.goto(`${BASE}/t/${tId}`);
    await owner.getByRole("link", { name: "Open report" }).click();
    await owner.waitForURL(/\/r\//);
    const reportUrl = owner.url();
    await owner.locator('a[href*="/item/"]').first().waitFor({ state: "attached" });
    await owner.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
    let itemHrefs = await owner.$$eval('a[href*="/item/"]', (as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
    console.log("items:", itemHrefs.length);
    let i = 0;
    for (const href of itemHrefs) {
      await fillItem(owner, `${BASE}${href}`);
      console.log(`  item ${++i}/${itemHrefs.length} done`);
    }
    await owner.goto(reportUrl);
    const countTxt = await status(owner);
    console.log("progress:", countTxt.replace(/\n/g, " "));

    // 4.3 submit
    await owner.getByRole("button", { name: "Submit and sign" }).last().click();
    await owner.locator("#typed-name").fill("Ow Nerr");
    await owner.locator("div[data-slot=dialog-content]").getByRole("button", { name: "Submit and sign" }).click();
    await owner.locator("p", { hasText: "Submitted and signed" }).waitFor();
    ok("submit: initiator signed, report in REVIEW");

    // tenant joins via invite
    await login(tenant, "tenant-e2e@x.in");
    await tenant.goto(`${BASE}${inviteCode}`);
    await tenant.locator("#name").fill("Te Nant");
    await tenant.getByRole("button", { name: /Join as/ }).click();
    await tenant.waitForURL(/\/t\//);
    ok("invite: tenant joined");

    // 4.4 review + comment
    await tenant.goto(reportUrl);
    await tenant.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
    await tenant.locator('input[aria-label*="Comment"]').first().waitFor({ state: "attached" });
    await tenant.locator('input[aria-label*="Comment"]').first().fill("Fan blade has a crack, please check");
    await tenant.getByRole("button", { name: "Save", exact: true }).first().click();
    await tenant.locator("[data-sonner-toast]", { hasText: "Comment saved" }).waitFor();
    // let the revalidate settle, then open the old-hash snapshot
    await wait(1500);
    const staleSnapshot = await tCtx.newPage();
    await staleSnapshot.goto(reportUrl); // reviewer tab A: will go stale after changes are made
    await wait(500);

    // 4.5 request changes
    await tenant.getByRole("button", { name: "Request changes" }).click();
    await tenant.locator("[data-sonner-toast]", { hasText: "back in draft" }).waitFor();
    ok("request changes: signatures cleared, back to DRAFT");

    // initiator sees the comment and edits the item
    await owner.goto(reportUrl);
    await owner.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
    await owner.locator("span", { hasText: "💬" }).first().waitFor();
    ok("initiator sees reviewer comment highlighted");
    const fanUrl = BASE + await (async () => {
      await owner.locator('a[href*="/item/"]').first().waitFor({ state: "attached" });
      await owner.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
      return owner.$$eval('a[href*="/item/"]', (as) => as.map((a) => a.getAttribute("href"))[0]);
    })();
    await owner.goto(fanUrl);
    await owner.getByRole("button", { name: /Fair/ }).first().click();
    await owner.getByRole("button", { name: "Save and next item" }).click();
    // resubmit
    await owner.goto(reportUrl);
    await owner.getByRole("button", { name: "Submit and sign" }).last().click();
    await owner.locator("#typed-name").fill("Ow Nerr");
    await owner.locator("div[data-slot=dialog-content]").getByRole("button", { name: "Submit and sign" }).click();
    await owner.locator("p", { hasText: "Submitted and signed" }).waitFor();
    ok("resubmit after changes");

    // 4.6 stale countersign: tab A (snapshot before edits) must be refused; reviewer POSTS its old hash.
    await staleSnapshot.getByRole("button", { name: "Sign and lock" }).click();
    await staleSnapshot.locator("#typed-name").fill("Te Nant");
    await staleSnapshot.locator("div[data-slot=dialog-content]").getByRole("button", { name: "Review and sign" }).click();
    await staleSnapshot.locator("[data-sonner-toast]", { hasText: "report changed while you were reviewing" }).waitFor();
    ok("stale countersign refused with 'report changed'");

    // fresh reload → real countersign
    await tenant.goto(reportUrl);
    await tenant.getByRole("button", { name: "Sign and lock" }).click();
    await tenant.locator("#typed-name").fill("Te Nant");
    await tenant.locator("div[data-slot=dialog-content]").getByRole("button", { name: "Review and sign" }).click();
    await tenant.locator("p.font-mono", { hasText: /^[0-9a-f]{64}$/ }).waitFor();
    await tenant.locator("li", { hasText: "Te Nant" }).waitFor();
    ok("countersign: hashes matched, report LOCKED with both signers");

    // tamper path: the locked report must offer no editable controls
    const itemHref = await tenant.$$eval('a[href*="/item/"]', (as) => (as.map((a) => a.getAttribute("href"))[0] || ""));
    await tenant.goto(`${reportUrl}/item/${itemHref.split("/").pop()}`);
    const disabled = await tenant.locator("fieldset").first().getAttribute("disabled");
    if (disabled === null) throw new Error("locked report still shows editable rating buttons");
    ok("locked report: edit controls disabled");

    // solo self-lock tenancy
    await owner.goto(`${BASE}/tenancies/new`);
    await owner.locator("#address").fill("PG Room 9, Madurai");
    await owner.locator("#rent").fill("6000");
    await owner.locator("#deposit").fill("12000");
    await owner.locator("#name").fill("Ow Nerr");
    await owner.getByRole("button", { name: "Create and start move-in report" }).click();
    await owner.waitForURL(/\/t\//);
    const t2 = owner.url().split("/").pop();
    await owner.goto(`${BASE}/t/${t2}`);
    await owner.getByRole("link", { name: "Open report" }).click();
    await owner.waitForURL(/\/r\//);
    const url2 = owner.url();
    let j = 0;
    await owner.locator('a[href*="/item/"]').first().waitFor({ state: "attached" });
    await owner.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
    let hrefs2 = await owner.$$eval('a[href*="/item/"]', (as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
    for (const href of hrefs2) {
      await fillItem(owner, `${BASE}${href}`);
      j++;
    }
    console.log(`  solo tenancy: ${j} items done`);
    await owner.goto(url2);
    await owner.getByRole("button", { name: "Self-attest and lock now" }).click();
    await owner.locator("#typed-name").fill("Ow Nerr");
    await owner.locator("div[data-slot=dialog-content]").getByRole("button", { name: "Self-attest and lock" }).click();
    await owner.locator("span", { hasText: "Self-attested" }).first().waitFor();
    await owner.locator("p.font-mono", { hasText: /^[0-9a-f]{64}$/ }).waitFor();
    ok("self-attested lock on solo tenancy");
    await owner.goto(`${BASE}/t/${t2}`);
    await owner.locator("span", { hasText: "Self-attested" }).first().waitFor();
    ok("self-attested badge on tenancy home");
  } catch (e) {
    console.error("SCRIPT ERROR:", e);
    results.push(`FAIL script: ${e.message}`);
  } finally {
    await browser.close();
    server.kill("SIGTERM");
    await wait(500);
    if (existsSync("data")) rmSync("data", { recursive: true, force: true });
    if (existsSync("data.e2e-backup")) renameSync("data.e2e-backup", "data");
  }
  const failed = results.filter((r) => r.startsWith("FAIL"));
  console.log(`\n${results.filter((r) => r.startsWith("PASS")).length} passed, ${failed.length} failed`);
  process.exit(failed.length ? 1 : 0);
}

run();
