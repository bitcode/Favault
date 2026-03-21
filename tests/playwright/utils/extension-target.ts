import type { BrowserContext, Page } from '@playwright/test';

export function getExtensionProtocol(browserName: string): 'chrome-extension:' | 'moz-extension:' {
  return browserName === 'firefox' ? 'moz-extension:' : 'chrome-extension:';
}

export function getNewTabUrl(browserName: string): string {
  return browserName === 'firefox' ? 'about:newtab' : 'chrome://newtab/';
}

export async function getExtensionOriginFromContext(
  context: BrowserContext,
  browserName = 'chromium'
): Promise<string | null> {
  // Firefox MV2 does not use service workers — skip the wait entirely to avoid a 5-second timeout
  if (browserName !== 'firefox') {
    let serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) {
      try {
        serviceWorker = await context.waitForEvent('serviceworker', { timeout: 5000 });
      } catch {
        // No service worker found within timeout — fall through to page scan
      }
    }
    if (serviceWorker) {
      // Do NOT use URL.origin — chrome-extension: is a non-special scheme and
      // Node.js returns the opaque string "null" for its origin property.
      // Construct origin manually from protocol + hostname instead.
      const swUrl = new URL(serviceWorker.url());
      return `${swUrl.protocol}//${swUrl.hostname}`;
    }
  }

  const extensionPage = context.pages().find((page) =>
    page.url().startsWith('chrome-extension://') || page.url().startsWith('moz-extension://')
  );

  if (!extensionPage) return null;
  const pageUrl = new URL(extensionPage.url());
  return `${pageUrl.protocol}//${pageUrl.hostname}`;
}

export async function resolveExtensionOrigin(
  context: BrowserContext,
  browserName: string
): Promise<string | null> {
  // Fast path: origin already known from service worker (Chrome) or existing extension page.
  const existingOrigin = await getExtensionOriginFromContext(context, browserName);
  if (existingOrigin) {
    return existingOrigin;
  }

  // Single probe — for Firefox the context fixture already waited for XPI activation,
  // so this should redirect immediately. For Chrome this is the normal resolution path.
  const probePage = await context.newPage();
  try {
    await probePage.goto(getNewTabUrl(browserName), {
      waitUntil: 'domcontentloaded',
      timeout: 5000
    });
    const url = probePage.url();
    if (url.startsWith(getExtensionProtocol(browserName))) {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.hostname}`;
    }
  } catch {
    // ignore
  } finally {
    await probePage.close().catch(() => {});
  }

  return await getExtensionOriginFromContext(context, browserName);
}

export async function navigateToExtensionHome(
  page: Page,
  browserName: string,
  extensionOrigin?: string | null
): Promise<void> {
  await page.goto(getNewTabUrl(browserName));
  await page.waitForLoadState('networkidle');

  if (page.url().startsWith(getExtensionProtocol(browserName))) {
    return;
  }

  if (extensionOrigin) {
    await page.goto(`${extensionOrigin}/newtab.html`);
    await page.waitForLoadState('networkidle');
  }
}
