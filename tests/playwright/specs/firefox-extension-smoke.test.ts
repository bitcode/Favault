import { test, expect } from '../fixtures/extension';

test.describe('Firefox Extension Smoke', () => {
  test('loads Firefox add-on from the preconfigured profile and resolves about:newtab to the extension page', async ({ context, browserName, extensionId }) => {
    test.skip(browserName !== 'firefox', 'Firefox-only smoke test');

    expect(extensionId).toBeTruthy();

    const page = await context.newPage();
    await page.goto('about:newtab');
    await page.waitForLoadState('networkidle');

    const pageInfo = await page.evaluate(() => {
      const extensionAPI = (window as any).browser || (window as any).chrome;
      return {
        href: window.location.href,
        protocol: window.location.protocol,
        hasRuntime: !!extensionAPI?.runtime,
        hasBookmarks: !!extensionAPI?.bookmarks,
        manifestName: extensionAPI?.runtime?.getManifest?.()?.name || null,
        appVisible: !!document.querySelector('[data-testid="favault-app"], .app-container, #app')
      };
    });

    expect(pageInfo.protocol).toBe('moz-extension:');
    expect(pageInfo.href).toContain('/newtab.html');
    expect(pageInfo.hasRuntime).toBeTruthy();
    expect(pageInfo.hasBookmarks).toBeTruthy();
    expect(pageInfo.manifestName).toContain('FaVault');
    expect(pageInfo.appVisible).toBeTruthy();
  });
});
