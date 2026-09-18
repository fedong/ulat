/**
 * Browser E2E for the API-wired mobile app (Expo web export). Requires:
 *   - the API server running (see api-test.ts header), seeded
 *   - the mobile export served, e.g.:
 *       cd mobile && EXPO_PUBLIC_API_URL=http://localhost:3100 npx expo export --platform web
 *       <serve dist/ with clean URLs on :3200>
 *
 *   MOBILE_URL=http://localhost:3200 node scripts/mobile-e2e.mjs
 *
 * Walks: role splash → instructor sign-in (demo account) → live classes from
 * the API → starts today's attendance session → proves it persisted across a
 * full reload (session restore included) → discards it → proves the discard
 * persisted too.
 */
const { chromium } = await import("playwright").catch(
  () => import("/opt/node22/lib/node_modules/playwright/index.mjs"),
);

const APP = process.env.MOBILE_URL || "http://localhost:3200";

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
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
// The RN-web tree keeps hidden stack screens mounted; match visible text only.
const vis = (text, exact = true) => page.getByText(text, { exact }).locator("visible=true").first();

try {
  console.log("role splash → instructor sign-in");
  await page.goto(APP);
  await vis("I'm an instructor").click();
  await vis("Sign in as instructor").waitFor({ timeout: 20000 });
  ok(true, "instructor role opens the sign-in screen");

  await vis("Tour the demo account").click();
  await vis("CS101 · BSCS 2A", false).waitFor({ timeout: 20000 });
  await vis("MTEC305A", false).waitFor();
  ok(true, "demo sign-in loads both classes live from the API");

  console.log("attendance write → cloud");
  await vis("Attendance").click();
  await vis("Start today's session").waitFor({ timeout: 10000 });
  await vis("Start today's session").click();
  await vis("Discard").waitFor({ timeout: 10000 });
  ok(true, "today's session starts recording");
  await page.waitForTimeout(1800); // sync queue

  console.log("reload → session restore + persisted state");
  await page.reload();
  await vis("CS101 · BSCS 2A", false).waitFor({ timeout: 25000 });
  ok(true, "reload restores the instructor session from the stored token");
  await vis("Attendance").click();
  await vis("Discard").waitFor({ timeout: 10000 });
  ok(true, "today's session came back from the database");

  console.log("discard → cloud");
  page.once("dialog", (d) => d.accept()); // window.confirm on web
  await vis("Discard").click();
  await vis("Start today's session").waitFor({ timeout: 10000 });
  ok(true, "discard reverts to the start button");
  await page.waitForTimeout(1800);
  await page.reload();
  await vis("CS101 · BSCS 2A", false).waitFor({ timeout: 25000 });
  await vis("Attendance").click();
  await vis("Start today's session").waitFor({ timeout: 10000 });
  ok(true, "discard persisted — the session is gone after reload");

  console.log("student + guardian demo roles still work");
  await page.goto(APP);
  await vis("I'm a student").click();
  await vis("Ana", false).waitFor({ timeout: 20000 });
  ok(true, "student demo renders");
  await page.goto(APP);
  await vis("I'm a guardian").click();
  await vis("Reyes", false).waitFor({ timeout: 20000 });
  ok(true, "guardian demo renders");

  console.log(`\nAll ${passed} checks passed.`);
} catch (e) {
  process.exitCode = 1;
  console.error(e.message || e);
  await page.screenshot({ path: "/tmp/mobile-e2e-fail.png", fullPage: true }).catch(() => {});
} finally {
  await browser.close();
}
