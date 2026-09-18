/**
 * Browser E2E for the API-wired web app. Requires a running server (see
 * api-test.ts header) with the seeded demo account.
 *
 *   node scripts/web-e2e.mjs           # or API_URL=... to point elsewhere
 *
 * Signs in as the demo instructor, checks live data renders, flips a
 * consultation flag, and proves it round-trips through the database across
 * full page reloads.
 */
// Local playwright if installed, else the machine-global one.
const { chromium } = await import("playwright").catch(
  () => import("/opt/node22/lib/node_modules/playwright/index.mjs"),
);

const BASE = process.env.API_URL || "http://localhost:3100";

let passed = 0;
const ok = (cond, label) => {
  if (!cond) {
    console.error(`  ✗ FAIL: ${label}`);
    process.exitCode = 1;
    throw new Error(label);
  }
  passed++;
  console.log(`  ✓ ${label}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
// Keep the product tour out of the way.
await ctx.addInitScript(() => localStorage.setItem("ulat_tour_done", "1"));

try {
  console.log("sign in (demo account through the real API)");
  await page.goto(`${BASE}/signin`);
  await page.getByText("Continue with Google").click();
  await page.waitForURL("**/c/cs101/overview", { timeout: 15000 });
  await page.getByText("CS101 · Intro to Computing").first().waitFor();
  ok(true, "demo sign-in lands on the CS101 overview");

  console.log("session restore on reload");
  await page.reload();
  await page.getByText("CS101 · Intro to Computing").first().waitFor({ timeout: 15000 });
  ok(true, "reload restores the session from the refresh token");

  console.log("write path: consultation flag");
  await page.goto(`${BASE}/c/cs101/students`);
  const flagBtn = page.getByText("Flag for consultation", { exact: true }).first();
  await flagBtn.waitFor({ timeout: 15000 });
  await flagBtn.click();
  await page.getByText("Flag and notify", { exact: true }).click();
  await page.getByText("Flagged for consultation", { exact: true }).waitFor();
  ok(true, "flag applies optimistically");
  await page.waitForTimeout(1600); // let the sync queue drain
  await page.reload();
  await page.getByText("Flagged for consultation", { exact: true }).waitFor({ timeout: 15000 });
  ok(true, "flag survives a full reload — persisted via the API");

  await page.getByText("Flagged for consultation", { exact: true }).click();
  await page.getByText("Remove flag", { exact: true }).click();
  await page.getByText("Flag for consultation", { exact: true }).waitFor();
  await page.waitForTimeout(1600);
  await page.reload();
  await page.getByText("Flag for consultation", { exact: true }).waitFor({ timeout: 15000 });
  ok(true, "unflag persists too — state fully restored");

  console.log("saved indicator");
  await page.getByText("All changes saved", { exact: false }).waitFor({ timeout: 5000 });
  ok(true, "header shows all changes saved");

  console.log("fresh account → wizard → class persists");
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p2 = await ctx2.newPage();
  await ctx2.addInitScript(() => localStorage.setItem("ulat_tour_done", "1"));
  await p2.goto(`${BASE}/signin`);
  await p2.getByText("New here? Create an account").click();
  const stamp = Date.now().toString(36);
  await p2.getByPlaceholder("Full name").fill("Prof. Elena Marquez");
  await p2.getByPlaceholder("School or university").fill("QA State University");
  await p2.getByPlaceholder("name@school.edu.ph").fill(`e2e.${stamp}@example.com`);
  await p2.getByPlaceholder("Password").fill("horse-battery-9");
  await p2.getByText("Create account", { exact: true }).click();
  await p2.waitForURL("**/new", { timeout: 15000 });
  ok(true, "new account lands on the class wizard");

  await p2.getByPlaceholder("CS101").fill("QA200");
  await p2.getByPlaceholder("Intro to Computing").fill("Quality Assurance");
  await p2.getByPlaceholder("BSCS 2A").fill("QA-2B");
  await p2.getByText("Continue", { exact: true }).click(); // → grading
  await p2.getByText("Continue", { exact: true }).click(); // → roster
  await p2.getByText(/^Continue with \d+ students$/).click(); // → review
  await p2.getByText("Create class", { exact: true }).click();
  await p2.waitForURL("**/overview", { timeout: 15000 });
  await p2.getByText("QA200 · Quality Assurance").first().waitFor();
  ok(true, "wizard creates the class");

  await p2.waitForTimeout(1600); // sync
  await p2.reload();
  await p2.getByText("QA200 · Quality Assurance").first().waitFor({ timeout: 15000 });
  ok(true, "created class survives a reload — persisted via the API");
  await ctx2.close();

  console.log(`\nAll ${passed} checks passed.`);
} catch (e) {
  process.exitCode = 1;
  console.error(e.message || e);
  await page.screenshot({ path: "/tmp/e2e-fail.png", fullPage: true }).catch(() => {});
} finally {
  await browser.close();
}
