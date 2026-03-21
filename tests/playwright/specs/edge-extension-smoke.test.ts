import { test, expect } from '../fixtures/extension';

test.describe('Edge Extension Smoke', () => {
  test('loads Edge extension and resolves chrome://newtab/ to the extension page', async ({ context, extensionId }, testInfo) => {
    // browserName is always 'chromium' for Edge — use project name to gate this test
    test.skip(testInfo.project.name !== 'edge-extension', 'Edge-only smoke test');

    expect(extensionId).toBeTruthy();

    const page = await context.newPage();
    await page.goto('chrome://newtab/');
    await page.waitForLoadState('networkidle');

    const pageInfo = await page.evaluate(() => {
      const extensionAPI = (window as any).chrome;
      return {
        href: window.location.href,
        protocol: window.location.protocol,
        hasRuntime: !!extensionAPI?.runtime,
        hasBookmarks: !!extensionAPI?.bookmarks,
        manifestName: extensionAPI?.runtime?.getManifest?.()?.name || null,
        appVisible: !!document.querySelector('[data-testid="favault-app"], .app-container, #app')
      };
    });

    expect(pageInfo.protocol).toBe('chrome-extension:');
    expect(pageInfo.href).toContain('/newtab.html');
    expect(pageInfo.hasRuntime).toBeTruthy();
    expect(pageInfo.hasBookmarks).toBeTruthy();
    expect(pageInfo.manifestName).toContain('FaVault');
    expect(pageInfo.appVisible).toBeTruthy();
  });
});
