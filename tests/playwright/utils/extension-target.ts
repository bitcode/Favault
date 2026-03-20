import type { BrowserContext, Page } from '@playwright/test';

export function getExtensionProtocol(browserName: string): 'chrome-extension:' | 'moz-extension:' {
  return browserName === 'firefox' ? 'moz-extension:' : 'chrome-extension:';
}

export function getNewTabUrl(browserName: string): string {
  return browserName === 'firefox' ? 'about:newtab' : 'chrome://newtab/';
}

export async function getExtensionOriginFromContext(
  context: BrowserContext
): Promise<string | null> {
  let serviceWorker = context.serviceWorkers()[0];
  if (!serviceWorker) {
    try {
      serviceWorker = await context.waitForEvent('serviceworker', { timeout: 5000 });
    } catch {
      return null;
    }
  }

  if (serviceWorker) {
    return new URL(serviceWorker.url()).origin;
  }

  const extensionPage = context.pages().find((page) =>
    page.url().startsWith('chrome-extension://') || page.url().startsWith('moz-extension://')
  );

  return extensionPage ? new URL(extensionPage.url()).origin : null;
}

export async function resolveExtensionOrigin(
  context: BrowserContext,
  browserName: string
): Promise<string | null> {
  const existingOrigin = await getExtensionOriginFromContext(context);
  if (existingOrigin) {
    return existingOrigin;
  }

  const probePage = await context.newPage();

  try {
    await probePage.goto(getNewTabUrl(browserName));
    await probePage.waitForLoadState('domcontentloaded');
    await probePage.waitForTimeout(1000);

    if (probePage.url().startsWith(getExtensionProtocol(browserName))) {
      return new URL(probePage.url()).origin;
    }
  } finally {
    await probePage.close();
  }

  return await getExtensionOriginFromContext(context);
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
