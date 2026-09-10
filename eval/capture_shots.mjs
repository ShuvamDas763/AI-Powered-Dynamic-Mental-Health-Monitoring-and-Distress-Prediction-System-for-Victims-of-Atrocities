// Capture demo screenshots for the pitch materials via headless Edge.
// Logs in through the real API (shared browser context -> cookie), drives the real UI.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'http://localhost:5173';
const OUT = join(process.cwd(), 'docs', 'screenshots');
mkdirSync(OUT, { recursive: true });

const log = (...a) => console.log('[shots]', ...a);

async function loginViaApi(page, username) {
  const res = await page.evaluate(async ({ user, pass }) => {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username: user, passcode: pass }),
    });
    return { status: r.status, body: await r.text() };
  }, { user: username, pass: 'demo' });
  log(`login ${username}:`, res.status);
  if (res.status !== 200) throw new Error(`login failed for ${username}: ${res.body}`);
}

const shot = async (page, name, fullPage = true) => {
  const file = join(OUT, name);
  await page.screenshot({ path: file, fullPage });
  log('saved', name);
};

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
page.setDefaultTimeout(45000);

try {
  // ── 1. LOGIN PAGE ────────────────────────────────────────────────────────
  await page.goto(BASE, { waitUntil: 'networkidle' });
  // If a previous session is still valid, sign out first so we land on login.
  const signedIn = await page.evaluate(async () => {
    const r = await fetch('/api/auth/me', { credentials: 'include' });
    return (await r.json())?.user ?? null;
  });
  if (signedIn) {
    await page.evaluate(async () => { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); });
    await page.goto(BASE, { waitUntil: 'networkidle' });
  }
  await page.waitForTimeout(1200);
  await shot(page, '01-login.png');

  // ── 2. VICTIM CHECK-IN WITH LIVE SCORE ──────────────────────────────────
  await loginViaApi(page, 'victim');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  // Open the case card.
  const caseCard = page.locator('button, [role="button"], .login-role-card').filter({ hasText: /Complainant A/i }).first();
  await caseCard.click({ force: true });
  await page.waitForTimeout(1200); // initial prompt appears after 500ms
  // Type a distress message and send.
  const input = page.getByPlaceholder(/Type your reply|अपना जवाब/i).first();
  await input.fill('I feel like I will get assaulted again if I go out. I am scared to attend the hearing.');
  await page.getByRole('button', { name: /Send|भेजें/i }).first().click();
  // Wait for the assessment panel to appear.
  await page.waitForFunction(
    () => /Live LLM|Cached/i.test(document.body.innerText),
    { timeout: 60000 },
  );
  await page.waitForTimeout(800);
  await shot(page, '02-checkin.png');

  // ── 3. COUNSELLOR QUEUE ─────────────────────────────────────────────────
  await page.evaluate(async () => { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); });
  await loginViaApi(page, 'counsellor');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await shot(page, '03-counsellor-queue.png');

  // ── 4. CASE DETAIL (escalated case) ─────────────────────────────────────
  const escalatedCard = page.locator('button, [role="button"], div[onclick], .case-card').filter({ hasText: /Complainant E/i }).first();
  if (await escalatedCard.count() > 0) {
    await escalatedCard.click({ force: true });
  } else {
    await page.locator('button, [role="button"], div[onclick], .case-card').filter({ hasText: /Complainant/i }).first().click({ force: true });
  }
  await page.waitForSelector('.recharts-surface', { timeout: 30000 }).catch(() => log('no chart found — continuing'));
  await page.waitForTimeout(1500);
  await shot(page, '04-case-detail.png');

  // ── 5. ADMIN DASHBOARD ──────────────────────────────────────────────────
  await page.evaluate(async () => { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); });
  await loginViaApi(page, 'admin');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('.recharts-surface', { timeout: 30000 }).catch(() => log('no chart found — continuing'));
  await page.waitForTimeout(1500);
  await shot(page, '05-admin.png');

  log('ALL SCREENSHOTS CAPTURED');
} catch (err) {
  log('ERROR:', err.message);
  try {
    const text = await page.evaluate(() => document.body.innerText.slice(0, 500));
    log('PAGE TEXT AT FAILURE:', text);
    await shot(page, '99-failure.png', false);
  } catch { /* ignore */ }
  process.exitCode = 1;
} finally {
  await browser.close();
}
