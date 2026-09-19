import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ARTIFACT_DIR = 'C:/Users/tumpa/.gemini/antigravity-ide/brain/bc83b0a3-0333-4247-8308-928a620fa2f0';
mkdirSync(ARTIFACT_DIR, { recursive: true });

async function runQA() {
  console.log('--- Starting Sahara Access Flow Browser QA ---');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  // ── 1. DESKTOP LANDING & ACCESS FLOW ────────────────────────────────────────
  const desktopCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await desktopCtx.newPage();

  // Go to app
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

  // Sign out if already signed in
  await page.evaluate(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {}
  });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Verify: Public Mode checks
  const cta = page.locator('#cta-begin-secure-checkin');
  const ctaCount = await cta.count();
  console.log('Citizen CTA ("Begin Secure Check-in") count:', ctaCount);

  // Check no persona switcher visible
  const personaCards = page.locator('text=Complainant Personas');
  console.log('Visible persona switcher count (should be 0):', await personaCards.count());

  // Check no duplicate Citizen Sanctuary / Safe Entry card
  const duplicateSafeEntry = page.locator('text=Safe Entry →');
  console.log('Duplicate Safe Entry count (should be 0):', await duplicateSafeEntry.count());

  // Screenshot 1: Landing
  const landingShotPath = join(ARTIFACT_DIR, 'landing.png');
  await page.screenshot({ path: landingShotPath, fullPage: false });
  console.log('Saved screenshot: landing.png');

  // Open Secure Access Modal
  await cta.click();
  await page.waitForTimeout(500);

  // Screenshot 2: Secure Access Modal
  const accessShotPath = join(ARTIFACT_DIR, 'secure_access.png');
  await page.screenshot({ path: accessShotPath });
  console.log('Saved screenshot: secure_access.png');

  // Test Negative: invalid access code
  console.log('Testing invalid access code: 999999...');
  for (let i = 1; i <= 6; i++) {
    await page.fill(`#access-digit-${i}`, '9');
  }
  await page.locator('#btn-continue-securely').click();
  await page.waitForTimeout(600);

  const errorEl = page.locator('[role="alert"]');
  const errorText = await errorEl.innerText();
  console.log('Error displayed on invalid code:', errorText);

  // Test Positive: valid access code for Complainant A (741001)
  console.log('Entering valid access code: 741001...');
  const validDigits = ['7', '4', '1', '0', '0', '1'];
  for (let i = 0; i < 6; i++) {
    await page.fill(`#access-digit-${i + 1}`, validDigits[i]);
  }
  await page.locator('#btn-continue-securely').click();
  await page.waitForTimeout(1500);

  // Verify: Post-Verification Briefing Card appears
  const welcomeText = page.locator('text=Welcome back.');
  console.log('Welcome back briefing card found:', (await welcomeText.count()) > 0);

  // Screenshot 3: Linked-Case Entry / Briefing
  const linkedCaseShotPath = join(ARTIFACT_DIR, 'linked_case_entry.png');
  await page.screenshot({ path: linkedCaseShotPath });
  console.log('Saved screenshot: linked_case_entry.png');

  // Verify clicking "Continue Check-in" enters dialogue
  const continueBtn = page.locator('#btn-continue-checkin');
  await continueBtn.click();
  await page.waitForTimeout(800);

  // Verify: Check-in dialogue loaded
  const chatInput = page.locator('textarea, input[placeholder*="reply"], input[placeholder*="जवाब"]').first();
  console.log('Chat input available in dialogue:', (await chatInput.count()) > 0);

  // Verify: No case selector or change case button exists
  const changeCaseBtn = page.locator('text=Change case profile');
  console.log('"Change case profile" button count (should be 0):', await changeCaseBtn.count());

  // Negative Security Test: Victim attempts direct navigation to another case in URL
  console.log('Testing negative security: victim navigates to #/cases/SIH-CASE-0002...');
  await page.evaluate(() => { window.location.hash = '#/cases/SIH-CASE-0002'; });
  await page.waitForTimeout(500);
  const currentHash = await page.evaluate(() => window.location.hash);
  console.log('URL hash after attempted tampering (should be #/checkin):', currentHash);

  await desktopCtx.close();

  // ── 2. MOBILE VIEWPORT (390×844) ──────────────────────────────────────────
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  const mobilePage = await mobileCtx.newPage();

  // Sign out again for clean mobile view
  await mobilePage.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await mobilePage.evaluate(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {}
  });
  await mobilePage.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(800);

  // Open Access Modal on Mobile
  await mobilePage.locator('#cta-begin-secure-checkin').click();
  await mobilePage.waitForTimeout(500);

  // Screenshot 4: Mobile Access
  const mobileShotPath = join(ARTIFACT_DIR, 'mobile_access.png');
  await mobilePage.screenshot({ path: mobileShotPath });
  console.log('Saved screenshot: mobile_access.png');

  await mobileCtx.close();
  await browser.close();
  console.log('--- Browser QA completed successfully ---');
}

runQA().catch((err) => {
  console.error('QA failed:', err);
  process.exit(1);
});
