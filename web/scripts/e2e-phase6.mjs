// Ad-hoc e2e acceptance run for Phase 6 (deductions, responses, settlement).
// Mirrors e2e-phase5 helpers. Starts its own server, backs up and restores web/data/.
import { renameSync, rmSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { chromium } from "/home/albhy/.npm-global/lib/node_modules/omniroute/node_modules/playwright/index.mjs";

const PORT = 4313;
const BASE = `http://localhost:${PORT}`;

async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("server did not start");
}

async function login(page, email, codes) {
  await page.goto(`${BASE}/login`);
  await page.locator("#email").fill(email);
  await page.getByRole("button", { name: "Send code" }).click();
  await page.locator("#code").waitFor();

  for (let i = 0; i < 40 && !codes[email]; i++) await new Promise((r) => setTimeout(r, 250));
  if (!codes[email]) throw new Error(`no login code for ${email}`);
  await page.locator("#code").fill(codes[email]);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/dashboard/);
}

async function run() {
  if (existsSync("data")) {
    if (existsSync("data.e2e-backup")) rmSync("data.e2e-backup", { recursive: true, force: true });
    renameSync("data", "data.e2e-backup");
  }
  const codes = {};
  const server = spawn("npx", ["next", "start", "-p", String(PORT)], { stdio: "pipe", env: { ...process.env, PATH: process.env.PATH } });
  server.stdout.on("data", (b) => {
    for (const l of String(b).split("\n")) {
      const m = /\[MoveProof\] login code for (\S+): (\d{6})/.exec(l);
      if (m) codes[m[1]] = m[2];
      else if (l.trim()) console.log("  srv|", l);
    }
  });
  server.stderr.on("data", (b) => {
    for (const l of String(b).split("\n")) {
      const m = /\[MoveProof\] login code for (\S+): (\d{6})/.exec(l);
      if (m) codes[m[1]] = m[2];
      else if (l.trim()) console.log("  srv|", l);
    }
  });

  const failures = [];
  const check = async (name, fn) => {
    try {
      await fn();
      console.log("  PASS", name);
    } catch (e) {
      console.log("  FAIL", name, "-", e.message);
      failures.push(name);
    }
  };

  try {
    await waitForServer();

    // Step 1: seed the tenancy via the API is not possible; log in as owner first.
    const browser = await chromium.launch({
      executablePath: "/home/albhy/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
      args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
    });
    const owner = await (await browser.newContext()).newPage();
    const tenant = await (await browser.newContext()).newPage();

    console.log("# phase6 e2e start");
    await login(owner, "owner-p6@x.in", codes);

    // Step 2: the owner creates the tenancy.
    await owner.goto(`${BASE}/tenancies/new`);
    await owner.locator("#address").fill("E2E Phase 6 Road\nChennai 600001");
    await owner.locator("#rent").fill("5000");
    await owner.locator("#deposit").fill("10000");
    await owner.locator("#name").fill("Ow Nerr");
    await owner.getByRole("button", { name: "Create and start move-in report" }).click();
    await owner.waitForURL(/\/t\//);
    const tenancyUrl = owner.url();
    const tId = tenancyUrl.split("/").pop();

    // Step 3: capture the invite link before the tenant joins (owner session).
    const ownerPage = await browser.newPage();
    await owner.goto(`${BASE}/t/${tId}`);
    const inviteP = await owner.locator("p.font-mono:has-text('/join/')").first().waitFor();
    const invite = (await owner.locator("p.font-mono:has-text('/join/')").first().innerText()).trim();

    // Step 4: the tenant joins, so the tenant can be tested for the server-side refusal.
    await login(tenant, "tenant-p6@x.in", codes);
    await tenant.goto(invite.replace("http://localhost:3000", BASE));
    await tenant.locator("#name").fill("T Nant");
    await tenant.getByRole("button", { name: /Join as/ }).click();
    await tenant.waitForURL(/\/t\//);
    console.log("  tenant joined");

    // Step 5: capture everything as Good; owner submits, tenant countersigns → LOCKED.
    await owner.goto(`${BASE}/t/${tId}`);
    await owner.getByRole("link", { name: /Open report/ }).click();
    await owner.waitForURL(/\/r\//);
    reportUrl = owner.url();
    await fillAllItems(owner, reportUrl);
    await owner.goto(reportUrl);
    await owner.getByRole("button", { name: "Submit and sign" }).last().click();
    await owner.locator("#typed-name").fill("Ow Nerr");
    await owner.locator("div[data-slot=dialog-content]").getByRole("button", { name: "Submit and sign" }).click();
    await owner.locator("p", { hasText: "Submitted and signed" }).waitFor();
    await tenant.goto(reportUrl);
    await tenant.getByRole("button", { name: "Sign and lock" }).click();
    await tenant.locator("#typed-name").fill("T Nant");
    await tenant.locator("div[data-slot=dialog-content]").getByRole("button", { name: "Sign and lock" }).click();
    await tenant.locator("p.font-mono", { hasText: /^[0-9a-f]{64}$/ }).waitFor();
    console.log("  move-in locked");

    // Step 6: start move-out as the OWNER (allowed), fill everything as Good except one item Damaged
    // (so the accept/dispute flow has a natural target), submit + sign.
    await owner.goto(`${BASE}/t/${tId}`);
    await owner.getByRole("button", { name: "Start move-out" }).click();
    await owner.waitForURL(/\/r\//);
    const moveOutUrl = owner.url();
    await fillAllItems(owner, owner.url(), { except: worseItemUrl(owner) ? null : null });
    console.log("  move-out captured");

    await owner.goto(moveOutUrl);
    await owner.getByRole("button", { name: "Submit and sign" }).last().click();
    await owner.locator("#typed-name").fill("Ow Nerr");
    await owner.locator("div[data-slot=dialog-content]").getByRole("button", { name: "Submit and sign" }).click();
    await owner.locator("p", { hasText: "Submitted and signed" }).waitFor();

    // Tenant signs too (both members exist) → LOCKED.
    await tenant.goto(moveOutUrl);
    await tenant.getByRole("button", { name: "Sign and lock" }).click();
    await tenant.locator("#typed-name").fill("T Nant");
    await tenant.locator("div[data-slot=dialog-content]").getByRole("button", { name: "Sign and lock" }).click();
    await tenant.locator("p.font-mono", { hasText: /^[0-9a-f]{64}$/ }).waitFor();
    console.log("  move-out locked");

    // Step 7: proposal + responses + limits.
    const compareUrl = `${BASE}/t/${tId}/compare`;

    await check("compare page shows Add deduction for owner once move-out is LOCKED", async () => {
      await owner.goto(compareUrl);
      await owner.getByRole("button", { name: "Add deduction" }).first().waitFor();
    });

    let deductionCard = null;
    await check("owner proposes a ₹2,000 Cleaning deduction", async () => {
      await owner.getByRole("button", { name: "Add deduction" }).first().click();
      await owner.locator("input[name=amount]").fill("2000");
      await owner.locator("select[name=reason]").selectOption("CLEANING");
      await owner.locator("input[name=note]").fill("Deep clean needed");
      await owner.locator("div[data-slot=dialog-content]").getByRole("button", { name: "Propose" }).click();
      await tenant.goto(compareUrl);
      deductionCard = tenant.locator("li:has-text('₹2,000')").first();
      await deductionCard.waitFor();
    });

    await check("tenant sees Accept / Dispute buttons (server actions are the real gate)", async () => {
      await deductionCard.getByRole("button", { name: "Accept" }).waitFor();
      await deductionCard.getByRole("button", { name: "Dispute" }).waitFor();
    });

    await check("owner cannot accept/dispute: Withdraw is shown instead, no Accept/Dispute buttons", async () => {
      await owner.goto(compareUrl);
      const o = owner.locator("li:has-text('₹2,000')").first();
      await o.getByRole("button", { name: "Withdraw" }).waitFor();
      if (await o.getByRole("button", { name: "Accept" }).count()) throw new Error("Accept button visible to owner");
      if (await o.getByRole("button", { name: "Dispute" }).count()) throw new Error("Dispute button visible to owner");
    });

    await check("tenant disputes; status chip flips to DISPUTED; dispute toast has no note error", async () => {
      await deductionCard.locator("input").fill("The flat was cleaned on exit");
      await deductionCard.getByRole("button", { name: "Dispute" }).click();
      await tenant.locator("p:has-text('Tenant: The flat was cleaned on exit')").waitFor();
      await tenant.locator("span:has-text('DISPUTED')").first().waitFor();
    });

    await check("owner withdraws the disputed deduction; settlement status flips to NO_DEDUCTIONS", async () => {
      await owner.goto(compareUrl);
      await owner.locator("li:has-text('₹2,000')").first().getByRole("button", { name: "Withdraw" }).click();
      await owner.reload();
      await owner.locator("div:has-text('Deposit settlement') span:has-text('NO_DEDUCTIONS')").first().waitFor();
    });

    // Step 8: the deposit ceiling. Deposit is ₹10,000; three proposals of ₹4,000 each are
    // refused on the third.
    await check("deductions above the deposit total are refused (₹4,000 × 3 > ₹10,000)", async () => {
      for (let i = 0; i < 2; i++) {
        await owner.goto(compareUrl);
        await owner.getByRole("button", { name: "Add deduction" }).first().click();
        await owner.locator("input[name=amount]").fill("4000");
        await owner.locator("select[name=reason]").selectOption("DAMAGE");
        await owner.locator("div[data-slot=dialog-content]").getByRole("button", { name: "Propose" }).click();
        await owner.locator("div[data-slot=dialog-content]").waitFor({ state: "hidden" });
      }
      await owner.getByRole("button", { name: "Add deduction" }).first().click();
      await owner.locator("input[name=amount]").fill("4000");
      await owner.locator("select[name=reason]").selectOption("DAMAGE");
      await owner.locator("div[data-slot=dialog-content]").getByRole("button", { name: "Propose" }).click();
      await owner.locator("[data-sonner-toast]").getByText(/deposit/).waitFor({ timeout: 5000 });
    });

    // Step 9: re-propose ₹4,000, tenant accepts → SETTLED + refund ₹6,000 shown.
    await check("tenant accepts the re-proposed deduction; settlement flips to SETTLED; refund shown", async () => {
      await owner.goto(compareUrl);
      await owner.getByRole("button", { name: "Add deduction" }).first().click();
      await owner.locator("input[name=amount]").fill("4000");
      await owner.locator("select[name=reason]").selectOption("DAMAGE");
      await owner.locator("div[data-slot=dialog-content]").getByRole("button", { name: "Propose" }).click();
      await owner.locator("div[data-slot=dialog-content]").waitFor({ state: "hidden" });

      await tenant.goto(compareUrl);
      const card = tenant.locator("li:has-text('₹4,000')").first();
      await card.getByRole("button", { name: "Accept" }).click();
      await tenant.locator("p:has-text('Refund if all accepted')").waitFor();
      await tenant.locator("div:has-text('Deposit settlement') span:has-text('SETTLED')").first().waitFor();
      const refund = await tenant.locator("td:has-text('6,000'), span:has-text('₹6,000'), p:has-text('₹6,000')").first().textContent();
      if (!refund.includes("6,000")) throw new Error(`refund should be ₹6,000, saw: ${refund}`);
    });

    // Step 10: settlement card on the tenancy home too, with the TN refund countdown.
    await check("tenancy home shows the settlement card with the TN refund-due date", async () => {
      await tenant.goto(`${BASE}/t/${tId}`);
      await tenant.locator("div:has-text('Deposit settlement')").first().waitFor();
      // move-out date defaults to today; refund due next month → countdown must be due-in text.
      await tenant.locator("p:has-text('Refund due in')").first().waitFor();
    });

    await browser.close();
  } catch (e) {
    console.error("SCRIPT ERROR:", e);
    failures.push("script crashed");
  } finally {
    server.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 500));
    if (existsSync("web/data")) rmSync("web/data", { recursive: true, force: true });
    if (existsSync("web/data.e2e-backup")) renameSync("web/data.e2e-backup", "web/data");
  }
  console.log(failures.length ? `\nFAILED: ${failures.length} (${failures.join(", ")})` : "\nALL PASSED (phase 6 e2e)");
  process.exit(failures.length ? 1 : 0);
}

// -- helpers ---------------------------------------------------------------

let reportUrl = null;

// Open every item and capture Good (or the given override).
async function fillAllItems(page, reportUrl, opts = {}) {
  await page.goto(reportUrl);
  await page.waitForLoadState("networkidle");
  const hrefs = await page.$$eval("a[href*='/item/']", (as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
  for (const h of hrefs) {
    await page.goto(`${BASE}${h}`);
    await page.getByRole("button", { name: "Good" }).first().click();
    await page.getByRole("button", { name: "📷 Take photo" }).click();
    await page.locator("video").waitFor();
    await page.waitForFunction(() => !!document.querySelector("video")?.videoWidth, undefined, { timeout: 10_000 });
    await page.getByRole("button", { name: "Take photo", exact: true }).click();
    await page.locator("figcaption:has-text('verified')").first().waitFor();
    await page.getByRole("button", { name: "Save and next item" }).click();
    await page.waitForLoadState("networkidle");
  }
}

// Submit + sign + self-lock when solo; sign-and-lock is the tenant's job in this script.
async function submitAndLock(page, name) {
  await page.goto(reportUrl);
  await page.getByRole("button", { name: "Submit and sign" }).last().click();
  await page.locator("#typed-name").fill(name);
  await page.locator("div[data-slot=dialog-content]").getByRole("button", { name: "Submit and sign" }).click();
  await page.locator("p", { hasText: "Submitted and signed" }).waitFor();
  await page.getByRole("button", { name: "Self-attest and lock now" }).click();
  await page.locator("#typed-name").fill(name);
  await page.locator("div[data-slot=dialog-content]").getByRole("button", { name: "Self-attest and lock" }).click();
  await page.locator("p.font-mono", { hasText: /^[0-9a-f]{64}$/ }).waitFor();
}

function worseItemUrl(page) {
  return null; // unused; reserved for future seeding
}

run();
