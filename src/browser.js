import path from 'node:path';
import { chromium } from 'playwright';
import { config } from './config.js';
import { rewriteInPage } from './rewrite.js';
import { Semaphore } from './semaphore.js';

export const PLACEHOLDER_ID = 'galt-placeholder';

let context = null;
let launching = null;
const sem = new Semaphore(config.browserConcurrency);

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

export async function getContext() {
  if (context) return context;
  if (launching) return launching;
  launching = (async () => {
    const profileDir = path.join(config.dataDir, 'profile');
    const ctx = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      viewport: null,
      userAgent: DEFAULT_UA,
      locale: `${config.hl}-${config.gl.toUpperCase()}`,
      ignoreDefaultArgs: ['--enable-automation'],
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1280,900',
        '--window-position=0,0',
        '--start-maximized',
      ],
    });
    ctx.on('close', () => { context = null; });
    // Keep one tab open so the VNC window always shows a usable Google page for login.
    const home = ctx.pages()[0] || (await ctx.newPage());
    home.goto(`https://${config.googleDomain}/`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    context = ctx;
    return ctx;
  })();
  try {
    return await launching;
  } finally {
    launching = null;
  }
}

const MOBILE_RE = /Mobile|Android|iPhone|iPad|iPod/i;

async function applyClientEmulation(page, clientUa, acceptLanguage) {
  if (acceptLanguage) await page.setExtraHTTPHeaders({ 'accept-language': acceptLanguage });
  // Only forward real browser UAs; curl, bots, and health checks get the default so Google serves its normal page.
  if (!config.forwardClientUa || !clientUa || !/^Mozilla\/5\.0/.test(clientUa)) return;
  const cdp = await page.context().newCDPSession(page);
  const mobile = MOBILE_RE.test(clientUa);
  await cdp.send('Emulation.setUserAgentOverride', {
    userAgent: clientUa,
    platform: mobile ? (/iPhone|iPad/.test(clientUa) ? 'iPhone' : 'Linux armv8l') : undefined,
  });
  if (mobile) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2.6, mobile: true });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  }
}

/**
 * Fetch a Google results page with the signed-in profile and return the rewritten HTML.
 * @param {URL} googleUrl
 * @param {{clientUa?: string, acceptLanguage?: string}} opts
 */
export async function fetchGoogle(googleUrl, opts = {}) {
  return sem.run(async () => {
    const ctx = await getContext();
    const page = await ctx.newPage();
    try {
      await applyClientEmulation(page, opts.clientUa, opts.acceptLanguage);
      await page.goto(googleUrl.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('#rso, #search, #main, #captcha-form, form[action*="sorry"], [role="main"]', { timeout: 15000 }).catch(() => {});
      // Google sometimes renders the AI Overview a beat after the results. Give it a moment.
      if (config.aioWaitMs > 0) {
        await page.waitForFunction(
          () => Array.from(document.querySelectorAll('h1, h2, h3, [role="heading"]')).some((h) => /^\s*AI Overview\s*$/i.test(h.textContent || '')),
          null,
          { timeout: config.aioWaitMs },
        ).catch(() => {});
        // Let a rendered overview finish loading its content, then rewrite.
        await page.waitForTimeout(150);
      }
      const result = await page.evaluate(rewriteInPage, {
        proxyOrigin: config.publicOrigin,
        placeholderId: PLACEHOLDER_ID,
      });
      result.finalUrl = page.url();
      return result;
    } finally {
      await page.close().catch(() => {});
    }
  });
}

export async function browserStatus() {
  try {
    const ctx = await getContext();
    const cookies = await ctx.cookies(`https://${config.googleDomain}`);
    const signedIn = cookies.some((c) => c.name === 'SID' || c.name === '__Secure-1PSID');
    return { running: true, pages: ctx.pages().length, signedIn };
  } catch (e) {
    return { running: false, error: String(e) };
  }
}

export async function closeBrowser() {
  if (context) await context.close().catch(() => {});
  context = null;
}
