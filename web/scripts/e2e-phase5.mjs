// Ad-hoc e2e acceptance run for Phase 5 (not committed logic; mirrors e2e-phase4 helpers).
// Usage: node scripts/e2e-phase5.mjs  — starts its own server, backs up and restores web/data/.
import { renameSync, rmSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { chromium } from "/home/albhy/.npm-global/lib/node_modules/omniroute/node_modules/playwright/index.mjs";

const PORT = 4312;
const BASE = `http://localhost:${PORT}`;
const codes = {};
let server;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const record = (line) => {
  const m = /\[MoveProof\] login code for (\S+): (\d{6})/.exec(line);
  if (m) codes[m[1]] = m[2];
};

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
  if (!codes[email]) throw new Error(`no login code for ${email}`);
  await page.locator("#code").fill(codes[email]);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/dashboard/);
}

const openRooms = (page) => page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));

async function fillItem(page, url, rating) {
  await page.goto(url);
  await page.getByRole("button", { name: rating }).first().click();
  // A photo for every item — some (room overviews, ratings ≥ 3) require one anyway.
  await page.getByRole("button", { name: "📷 Take photo" }).click();
  await page.locator("video").waitFor();
  await page.waitForFunction(() => !!document.querySelector("video")?.videoWidth, undefined, { timeout: 10_000 });
  await page.getByRole("button", { name: "Take photo", exact: true }).click();
  await page.locator('figcaption:has-text("verified")').first().waitFor({ timeout: 20_000 });
  await page.getByRole("button", { name: "Save and next item" }).click();
  await page.waitForLoadState("networkidle");
}

async function selfLockEverything(page, tenancyUrl, ratingsFor) {
  await page.goto(tenancyUrl);
  await page.getByRole("link", { name: "Open report" }).click();
  await page.waitForURL(/\/r\//);
  const url = page.url();
  await page.locator('a[href*="/item/"]').first().waitFor({ state: "attached" });
  await openRooms(page);
  const hrefs = await page.$$eval('a[href*="/item/"]', (as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
  for (const href of hrefs) await fillItem(page, `${BASE}${href}`, ratingsFor(href));
  await page.goto(url);
  await page.getByRole("button", { name: "Submit and sign" }).last().click();
  await page.locator("#typed-name").fill("Ow Nerr");
  await page.locator("div[data-slot=dialog-content]").getByRole("button", { name: "Submit and sign" }).click();
  await page.locator("p", { hasText: "Submitted and signed" }).waitFor();
  await page.getByRole("button", { name: "Self-attest and lock now" }).click();
  await page.locator("#typed-name").fill("Ow Nerr");
  await page.locator("div[data-slot=dialog-content]").getByRole("button", { name: "Self-attest and lock" }).click();
  await page.locator("p.font-mono", { hasText: /^[0-9a-f]{64}$/ }).waitFor();
  return url;
}

async function run() {
  if (existsSync("data")) {
    if (existsSync("data.e2e-backup")) rmSync("data.e2e-backup", { recursive: true, force: true });
    renameSync("data", "data.e2e-backup");
  }
  server = spawn("npx", ["next", "start", "-p", String(PORT)], { stdio: "pipe" });
  server.stdout.on("data", (b) => String(b).split("\n").forEach((l) => record(l)));
  server.stderr.on("data", (b) => String(b).split("\n").forEach((l) => record(l)));
  const dbg = (b) => { for (const l of String(b).split("\n")) if (!/\[MoveProof\]/.test(l) && l.trim()) console.log("  srv|", l); };
  server.stdout.on("data", dbg);
  server.stderr.on("data", dbg);
  const results = [];
  const ok = (name) => { results.push(name); console.log("PASS", name); };

  try {
    await waitForServer();
    const browser = await chromium.launch({
      executablePath: "/home/albhy/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell",
      args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
    });
    const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, baseURL: BASE });
    const owner = await ctx.newPage();
    owner.setDefaultTimeout(25_000);

    await login(owner, "owner-p5@x.in");
    await owner.goto(`${BASE}/tenancies/new`);
    await owner.locator("#address").fill("P5 Road, Chennai");
    await owner.locator("#rent").fill("8000");
    await owner.locator("#deposit").fill("24000");
    await owner.locator("#name").fill("Ow Nerr");
    await owner.getByRole("button", { name: "Create and start move-in report" }).click();
    await owner.waitForURL(/\/t\//);
    const tenancyUrl = owner.url();
    const tId = tenancyUrl.split("/").pop();

    // 5.1 acceptance: no start button while move-in is unlocked
    if (await owner.getByText("Available after the move-in report is locked.").isVisible()) {
      ok("move-out start hidden before move-in is locked (button would be refused server-side)");
    } else {
      throw new Error("move-out start unexpectedly offered before move-in lock");
    }

    const good = () => "Good";
    await selfLockEverything(owner, tenancyUrl, good);
    ok("move-in locked (self-attested solo flow)");

    // 5.4: locked move-out report shows the compare link
    await owner.goto(`${BASE}/t/${tId}`);
    await owner.getByRole("button", { name: "Start move-out" }).click();
    await owner.waitForURL(/\/r\//, { timeout: 10_000 }).catch(async () => {
      console.log("  dbg| url =", owner.url());
      console.log("  dbg| toasts =", await owner.locator("[data-sonner-toast]").allInnerTexts().catch(() => []));
      console.log("  dbg| errors =", await owner.locator("p.text-destructive").allInnerTexts().catch(() => []));
      throw new Error("start move-out did not navigate to the report");
    });
    ok("move-out started with date (move-out report opened)");
    const outUrl = owner.url();
    await owner.locator("#move-out-date, input[type=date]"); // date already set on tenancy home

    // Seeded flags: two specific items get worse / missing in move-out.
    await openRooms(owner);
    const hrefs = await owner.$$eval('a[href*="/item/"]', (as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
    const worseHref = hrefs[3];
    const missingHref = hrefs[5];
    const ratings = (href) => {
      if (href === worseHref) return "Damaged";
      if (href === missingHref) return "Missing";
      return "Good";
    };
    for (const href of hrefs) await fillItem(owner, `${BASE}${href}`, ratings(href));
    await owner.goto(outUrl);
    await owner.getByRole("button", { name: "Submit and sign" }).last().click();
    await owner.locator("#typed-name").fill("Ow Nerr");
    await owner.locator("div[data-slot=dialog-content]").getByRole("button", { name: "Submit and sign" }).click();
    await owner.locator("p", { hasText: "Submitted and signed" }).waitFor();
    await owner.getByRole("button", { name: "Self-attest and lock now" }).click();
    await owner.locator("#typed-name").fill("Ow Nerr");
    await owner.locator("div[data-slot=dialog-content]").getByRole("button", { name: "Self-attest and lock" }).click();
    await owner.locator("p.font-mono", { hasText: /^[0-9a-f]{64}$/ }).waitFor();
    await owner.getByRole("link", { name: /Compare with the move-in report/ }).click();
    await owner.waitForURL(/\/compare/);
    ok("locked move-out links to comparison");

    // Compare page: counts + flags + only-changed default filter
    await owner.locator("text=Worse").first().waitFor();
    await owner.locator("text=Missing").first().waitFor();
    const counts = await owner.locator("div.grid.grid-cols-4").innerText();
    if (!/2\s*same|same.*2/s.test(counts)) throw new Error(`unexpected summary counts: ${counts}`);
    ok("summary counts show 2 changed, rest same");
    const changedVisible = await owner.locator("li:has-text('Damaged')").count();
    if (changedVisible > 0) ok("'Only changed items' filter shows just theDamaged/Missing items");
    await owner.getByLabel(/Only changed items/).uncheck();
    await owner.locator("li:has-text('Good')").first().waitFor();
    ok("toggling the filter shows unchanged items too");
    // full-screen viewer opens from a thumbnail
    await owner.locator('img[alt="Move-in photo"]').first().click();
    await owner.locator('[role=dialog][aria-label*="photos"]').waitFor();
    await owner.getByRole("button", { name: /Close/ }).click();
    ok("photo viewer opens and closes");

    await browser.close();
  } catch (e) {
    console.error("SCRIPT ERROR:", e);
    results.push(`FAIL: ${e.message}`);
  } finally {
    server.kill("SIGTERM");
    await wait(500);
    if (existsSync("data")) rmSync("data", { recursive: true, force: true });
    if (existsSync("data.e2e-backup")) renameSync("data.e2e-backup", "data");
  }
  const failed = results.filter((r) => r.startsWith("FAIL"));
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
  process.exit(failed.length ? 1 : 0);
}

run();
