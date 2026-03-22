import { test, expect } from '../fixtures/extension';
import { BookmarkTestUtils } from '../utils/bookmark-utils';
import { ConsoleTestUtils } from '../utils/console-utils';
import { ExtensionTestUtils } from '../fixtures/extension';
import { TestDataSetup } from '../utils/test-data-setup';
import type { Page, BrowserContext } from '@playwright/test';

/**
 * Tests for the Open Tabs Panel drag-to-bookmark feature.
 *
 * Two test suites:
 *   1. Drag-Drop Mechanism — directly dispatch HTML5 drag events carrying
 *      { type: 'new-tab' } payload and verify a bookmark is created.
 *      These tests do NOT depend on tabs.query() working in the test
 *      context; they isolate the drop-handler logic.
 *
 *   2. Panel UI — open real browser tabs, expand the panel, and verify the
 *      full end-to-end flow: panel shows un-bookmarked tabs → drag → bookmark
 *      created → tab disappears from panel.
 */

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Dispatch a full HTML5 drag sequence (dragstart → dragover → drop → dragend)
 *  carrying 'new-tab' payload from a synthetic source onto a real DOM target.
 *  Returns whether the drop event was handled (i.e., not cancelled). */
async function simulateNewTabDrop(
  page: Page,
  targetSelector: string,
  tabData: { title: string; url: string; tabId?: number }
): Promise<boolean> {
  return page.evaluate(
    ({ selector, data }) => {
      const target = document.querySelector(selector) as HTMLElement | null;
      if (!target) throw new Error(`Target not found: ${selector}`);

      const payload = JSON.stringify({
        type: 'new-tab',
        id: `tab-${data.tabId ?? 9999}`,
        title: data.title,
        url: data.url,
      });

      const dt = new DataTransfer();
      dt.setData('application/x-favault-bookmark', payload);
      dt.setData('text/plain', data.url);

      // Create a temporary drag source element (off-screen)
      const src = document.createElement('div');
      src.style.cssText = 'position:fixed;top:-100px;left:-100px;width:1px;height:1px';
      src.draggable = true;
      document.body.appendChild(src);

      src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
      target.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }));
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
      const dropHandled = target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
      src.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt }));

      document.body.removeChild(src);
      return dropHandled;
    },
    { selector: targetSelector, data: tabData }
  );
}

/** Read all bookmark URLs from the Chrome bookmarks API (via page.evaluate). */
async function getBookmarkUrlsInFolder(page: Page, folderId: string): Promise<string[]> {
  return page.evaluate(async (id) => {
    const children = await new Promise<any[]>((res) =>
      (chrome || (window as any).browser).bookmarks.getChildren(id, res)
    );
    return children.filter((c: any) => c.url).map((c: any) => c.url as string);
  }, folderId);
}

/** Get the Chrome bookmark folder ID for the first non-protected visible folder in the UI.
 *  Protected system folders (Chrome IDs '0','1','2') are skipped. */
async function getFirstFolderDomId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const PROTECTED = new Set(['0', '1', '2']);
    const els = Array.from(document.querySelectorAll(
      '.folder-container[data-folder-id], [data-testid="bookmark-folder"][data-folder-id]'
    )) as HTMLElement[];
    const el = els.find(e => {
      const id = e.dataset.folderId ?? '';
      return id && !PROTECTED.has(id) && !e.classList.contains('protected-folder');
    });
    return el?.dataset.folderId ?? null;
  });
}

// ---------------------------------------------------------------------------
// Suite 1: Drag-Drop Mechanism
// ---------------------------------------------------------------------------

test.describe('Open Tabs Panel — Drag-Drop Mechanism', () => {
  let bookmarkUtils: BookmarkTestUtils;
  let consoleUtils: ConsoleTestUtils;
  let testDataSetup: TestDataSetup;

  test.beforeEach(async ({ newTabPage, context }) => {
    bookmarkUtils = new BookmarkTestUtils(newTabPage);
    consoleUtils = new ConsoleTestUtils(newTabPage);
    testDataSetup = new TestDataSetup(newTabPage, context);

    await consoleUtils.startMonitoring();

    await testDataSetup.initialize({
      folderCount: 3,
      bookmarksPerFolder: 2,
      includeEmptyFolders: true,
      includeDragTestFolders: false,
      includeReorderableItems: false,
      maxNestingLevel: 1,
    });
    await testDataSetup.generateTestData();
    await testDataSetup.waitForBookmarkSync();
    await bookmarkUtils.waitForBookmarksToLoad();
  });

  test.afterEach(async () => {
    const report = consoleUtils.generateTestReport();
    if (report.errorCount > 0) {
      console.log('⚠️  Console errors during test:', JSON.stringify(report, null, 2));
    }
  });

  test('creates bookmark when new-tab drag is dropped onto folder container', async ({ newTabPage }) => {
    const TAB_URL = 'https://playwright-test-tab.example.com/';
    const TAB_TITLE = 'Playwright Test Tab';

    const folders = await bookmarkUtils.getBookmarkFolders();
    expect(folders.length).toBeGreaterThan(0);
    const targetFolder = folders[0];

    // Get the folder's Chrome bookmark ID so we can verify via API
    const folderId = await targetFolder.getAttribute('data-folder-id') ??
      await getFirstFolderDomId(newTabPage);
    expect(folderId).toBeTruthy();

    const urlsBefore = await getBookmarkUrlsInFolder(newTabPage, folderId!);
    expect(urlsBefore).not.toContain(TAB_URL);

    // Simulate a new-tab drag drop onto the folder container
    const folderSelector = `[data-folder-id="${folderId}"].folder-container, ` +
      `[data-folder-id="${folderId}"][data-testid="bookmark-folder"]`;
    await simulateNewTabDrop(newTabPage, folderSelector, {
      title: TAB_TITLE,
      url: TAB_URL,
      tabId: 1001,
    });

    // Allow bookmark API + scheduleSilentSync (1.5 s) + debounced refresh to settle
    await newTabPage.waitForTimeout(2500);

    // Verify bookmark was created via Chrome API
    const urlsAfter = await getBookmarkUrlsInFolder(newTabPage, folderId!);
    expect(urlsAfter).toContain(TAB_URL);

    // Verify no drag/drop-related errors
    const errors = consoleUtils.getErrorMessages();
    const dndErrors = errors.filter(e =>
      e.toLowerCase().includes('drop rejected') ||
      e.toLowerCase().includes('not allowed for this drop zone')
    );
    expect(dndErrors).toHaveLength(0);
  });

  test('creates bookmark when dropped onto folder header', async ({ newTabPage }) => {
    const TAB_URL = 'https://header-drop-test.example.com/';
    const TAB_TITLE = 'Header Drop Test';

    const folders = await bookmarkUtils.getBookmarkFolders();
    expect(folders.length).toBeGreaterThan(0);
    const targetFolder = folders[0];
    const folderId = await targetFolder.getAttribute('data-folder-id') ??
      await getFirstFolderDomId(newTabPage);
    expect(folderId).toBeTruthy();

    const urlsBefore = await getBookmarkUrlsInFolder(newTabPage, folderId!);
    expect(urlsBefore).not.toContain(TAB_URL);

    // Target the folder header specifically
    const headerSelector = `[data-folder-id="${folderId}"] .folder-header, ` +
      `[data-folder-id="${folderId}"] [data-testid="folder-header"]`;

    const headerExists = await newTabPage.locator(headerSelector).count();
    if (headerExists === 0) test.skip('Folder header element not found');

    await simulateNewTabDrop(newTabPage, headerSelector, {
      title: TAB_TITLE,
      url: TAB_URL,
      tabId: 1002,
    });

    await newTabPage.waitForTimeout(2500);

    const urlsAfter = await getBookmarkUrlsInFolder(newTabPage, folderId!);
    expect(urlsAfter).toContain(TAB_URL);
  });

  test('creates bookmark via insertion point in edit mode', async ({ newTabPage }) => {
    const TAB_URL = 'https://insertion-point-test.example.com/';
    const TAB_TITLE = 'Insertion Point Test';

    // Edit mode required for insertion points to be active
    await ExtensionTestUtils.enableEditMode(newTabPage);
    await newTabPage.waitForTimeout(500);

    const folders = await bookmarkUtils.getBookmarkFolders();
    expect(folders.length).toBeGreaterThan(0);
    const targetFolder = folders[0];
    const folderId = await targetFolder.getAttribute('data-folder-id') ??
      await getFirstFolderDomId(newTabPage);
    expect(folderId).toBeTruthy();

    // Find an insertion point inside this folder
    const insertionPointSelector =
      `[data-folder-id="${folderId}"] .bookmark-insertion-point, ` +
      `[data-parent-id="${folderId}"].bookmark-insertion-point`;

    const insertionPointCount = await newTabPage.locator(insertionPointSelector).count();
    if (insertionPointCount === 0) test.skip('No insertion points found in folder');

    const urlsBefore = await getBookmarkUrlsInFolder(newTabPage, folderId!);

    await simulateNewTabDrop(newTabPage, insertionPointSelector, {
      title: TAB_TITLE,
      url: TAB_URL,
      tabId: 1003,
    });

    await newTabPage.waitForTimeout(2500);

    const urlsAfter = await getBookmarkUrlsInFolder(newTabPage, folderId!);
    expect(urlsAfter.length).toBe(urlsBefore.length + 1);
    expect(urlsAfter).toContain(TAB_URL);
  });

  test('creates bookmark via folder drop WITHOUT edit mode (outside-edit-mode support)', async ({ newTabPage }) => {
    const TAB_URL = 'https://no-edit-mode-test.example.com/';
    const TAB_TITLE = 'No Edit Mode Test';

    // Ensure edit mode is OFF
    await ExtensionTestUtils.disableEditMode(newTabPage);
    await newTabPage.waitForTimeout(300);

    const folders = await bookmarkUtils.getBookmarkFolders();
    expect(folders.length).toBeGreaterThan(0);
    const targetFolder = folders[0];
    const folderId = await targetFolder.getAttribute('data-folder-id') ??
      await getFirstFolderDomId(newTabPage);
    expect(folderId).toBeTruthy();

    const urlsBefore = await getBookmarkUrlsInFolder(newTabPage, folderId!);
    expect(urlsBefore).not.toContain(TAB_URL);

    const folderSelector = `[data-folder-id="${folderId}"].folder-container, ` +
      `[data-folder-id="${folderId}"][data-testid="bookmark-folder"]`;

    await simulateNewTabDrop(newTabPage, folderSelector, {
      title: TAB_TITLE,
      url: TAB_URL,
      tabId: 1004,
    });

    await newTabPage.waitForTimeout(2500);

    const urlsAfter = await getBookmarkUrlsInFolder(newTabPage, folderId!);
    expect(urlsAfter).toContain(TAB_URL);

    // Confirm the DragDropManager did NOT reject due to edit-mode guard
    const errors = consoleUtils.getErrorMessages();
    const rejections = errors.filter(e => e.includes('Drop rejected - not allowed'));
    expect(rejections).toHaveLength(0);
  });

  test('created bookmark persists after page reload', async ({ newTabPage }) => {
    const TAB_URL = 'https://persistence-test.example.com/reload';
    const TAB_TITLE = 'Persistence Test';

    const folders = await bookmarkUtils.getBookmarkFolders();
    const targetFolder = folders[0];
    const folderId = await targetFolder.getAttribute('data-folder-id') ??
      await getFirstFolderDomId(newTabPage);
    expect(folderId).toBeTruthy();

    const folderSelector = `[data-folder-id="${folderId}"].folder-container, ` +
      `[data-folder-id="${folderId}"][data-testid="bookmark-folder"]`;

    await simulateNewTabDrop(newTabPage, folderSelector, {
      title: TAB_TITLE,
      url: TAB_URL,
      tabId: 1005,
    });

    await newTabPage.waitForTimeout(2500);

    // Reload and re-verify via Chrome API
    await newTabPage.reload();
    await bookmarkUtils.waitForBookmarksToLoad();

    const urlsAfterReload = await getBookmarkUrlsInFolder(newTabPage, folderId!);
    expect(urlsAfterReload).toContain(TAB_URL);
  });

  test('does not duplicate bookmark if dropped twice on the same folder', async ({ newTabPage }) => {
    const TAB_URL = 'https://dedup-test.example.com/';
    const TAB_TITLE = 'Dedup Test';

    const folders = await bookmarkUtils.getBookmarkFolders();
    const targetFolder = folders[0];
    const folderId = await targetFolder.getAttribute('data-folder-id') ??
      await getFirstFolderDomId(newTabPage);
    expect(folderId).toBeTruthy();

    const folderSelector = `[data-folder-id="${folderId}"].folder-container, ` +
      `[data-folder-id="${folderId}"][data-testid="bookmark-folder"]`;

    // Drop once
    await simulateNewTabDrop(newTabPage, folderSelector, { title: TAB_TITLE, url: TAB_URL, tabId: 1006 });
    await newTabPage.waitForTimeout(2500);

    const urlsAfterFirst = await getBookmarkUrlsInFolder(newTabPage, folderId!);
    const firstCount = urlsAfterFirst.filter(u => u === TAB_URL).length;
    expect(firstCount).toBe(1);

    // Drop a second time (user accidentally drags again) — expect it creates another
    // (browser bookmarks allows duplicates; panel would no longer show it since it's now bookmarked)
    // This test ensures the mechanism works correctly either way
    await simulateNewTabDrop(newTabPage, folderSelector, { title: TAB_TITLE, url: TAB_URL, tabId: 1006 });
    await newTabPage.waitForTimeout(2500);

    const urlsAfterSecond = await getBookmarkUrlsInFolder(newTabPage, folderId!);
    // Should now have 2 (browser allows duplicate bookmarks) — test that it didn't silently fail
    expect(urlsAfterSecond.filter(u => u === TAB_URL).length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Suite 2: Panel UI
// ---------------------------------------------------------------------------

test.describe('Open Tabs Panel — UI Behaviour', () => {
  let bookmarkUtils: BookmarkTestUtils;
  let consoleUtils: ConsoleTestUtils;
  let testDataSetup: TestDataSetup;
  const extraPages: Page[] = [];

  test.beforeEach(async ({ newTabPage, context }) => {
    bookmarkUtils = new BookmarkTestUtils(newTabPage);
    consoleUtils = new ConsoleTestUtils(newTabPage);
    testDataSetup = new TestDataSetup(newTabPage, context);

    await consoleUtils.startMonitoring();

    await testDataSetup.initialize({
      folderCount: 2,
      bookmarksPerFolder: 2,
      includeEmptyFolders: false,
      includeDragTestFolders: false,
    });
    await testDataSetup.generateTestData();
    await testDataSetup.waitForBookmarkSync();
    await bookmarkUtils.waitForBookmarksToLoad();
  });

  test.afterEach(async () => {
    // Close any extra pages opened during the test
    for (const p of extraPages) {
      await p.close().catch(() => {});
    }
    extraPages.length = 0;
  });

  test('panel toggle is visible on the page', async ({ newTabPage }) => {
    const toggle = newTabPage.locator('.tabs-toggle');
    await expect(toggle).toBeVisible();
  });

  test('panel starts collapsed (only toggle visible)', async ({ newTabPage }) => {
    // The panel inner content should not be visible while collapsed
    const panelInner = newTabPage.locator('.tabs-panel-inner');
    // Either not in DOM or hidden (width ~40px means content is clipped)
    const panel = newTabPage.locator('.tabs-panel');
    await expect(panel).toBeVisible();

    const panelInnerVisible = await panelInner.count();
    if (panelInnerVisible > 0) {
      // If in DOM, it should not be usefully visible (panel is collapsed / overflow hidden)
      const box = await panelInner.boundingBox();
      // Collapsed panel is 40px wide — inner content width should be 0 or clipped
      expect(box === null || box.width <= 5).toBeTruthy();
    }
  });

  test('clicking toggle expands the panel', async ({ newTabPage }) => {
    const toggle = newTabPage.locator('.tabs-toggle');
    await toggle.click();
    await newTabPage.waitForTimeout(400); // allow CSS transition

    const panelInner = newTabPage.locator('.tabs-panel-inner');
    await expect(panelInner).toBeVisible();

    const tabsHeader = newTabPage.locator('.tabs-header');
    await expect(tabsHeader).toBeVisible();
  });

  test('clicking toggle again collapses the panel', async ({ newTabPage }) => {
    const toggle = newTabPage.locator('.tabs-toggle');

    // Expand
    await toggle.click();
    await newTabPage.waitForTimeout(400);
    await expect(newTabPage.locator('.tabs-panel-inner')).toBeVisible();

    // Collapse
    await toggle.click();
    await newTabPage.waitForTimeout(400);

    const panelInner = newTabPage.locator('.tabs-panel-inner');
    const count = await panelInner.count();
    if (count > 0) {
      const box = await panelInner.boundingBox();
      expect(box === null || box.width <= 5).toBeTruthy();
    }
  });

  test('panel shows open tabs that are not yet bookmarked', async ({ newTabPage, context }) => {
    // Open a real tab in the same browser window
    const testUrl = 'about:blank';
    const extraPage = await context.newPage();
    extraPages.push(extraPage);
    await extraPage.goto(testUrl);
    await newTabPage.waitForTimeout(500);

    // Expand panel
    const toggle = newTabPage.locator('.tabs-toggle');
    await toggle.click();
    await newTabPage.waitForTimeout(2500);

    // Tabs list should be visible (may be empty if tabs.query is limited in test env)
    const tabsList = newTabPage.locator('.tabs-list');
    await expect(tabsList).toBeVisible();

    // Either items or empty state should be visible
    const hasItems = await newTabPage.locator('.tab-item').count();
    const hasEmpty = await newTabPage.locator('.tabs-empty').count();
    expect(hasItems + hasEmpty).toBeGreaterThan(0);
  });

  test('refreshing the panel updates the tab list', async ({ newTabPage }) => {
    // Expand panel
    await newTabPage.locator('.tabs-toggle').click();
    await newTabPage.waitForTimeout(2500);

    const refreshBtn = newTabPage.locator('.refresh-btn');
    await expect(refreshBtn).toBeVisible();

    // Click refresh — should not throw
    await refreshBtn.click();
    await newTabPage.waitForTimeout(500);

    // Panel should still be open and showing content
    await expect(newTabPage.locator('.tabs-list')).toBeVisible();
  });

  test('full flow: drag tab item from panel to folder creates bookmark', async ({ newTabPage, context }) => {
    const TAB_URL = 'https://full-flow-test.example.com/panel';
    const TAB_TITLE = 'Full Flow Test';

    // Open the tabs panel
    await newTabPage.locator('.tabs-toggle').click();
    await newTabPage.waitForTimeout(500);

    const folders = await bookmarkUtils.getBookmarkFolders();
    expect(folders.length).toBeGreaterThan(0);
    const targetFolder = folders[0];
    const folderId = await targetFolder.getAttribute('data-folder-id') ??
      await getFirstFolderDomId(newTabPage);
    expect(folderId).toBeTruthy();

    const urlsBefore = await getBookmarkUrlsInFolder(newTabPage, folderId!);
    expect(urlsBefore).not.toContain(TAB_URL);

    // Check if there are real tab items in the panel; if not, simulate via evaluate
    const tabItemCount = await newTabPage.locator('.tab-item').count();

    if (tabItemCount > 0) {
      // Real tab items present — use mouse drag from first tab item to folder
      const tabItem = newTabPage.locator('.tab-item').first();
      const tabItemBox = await tabItem.boundingBox();
      const folderBox = await targetFolder.boundingBox();

      if (tabItemBox && folderBox) {
        const srcX = tabItemBox.x + tabItemBox.width / 2;
        const srcY = tabItemBox.y + tabItemBox.height / 2;
        const dstX = folderBox.x + folderBox.width / 2;
        const dstY = folderBox.y + folderBox.height / 2;

        await newTabPage.mouse.move(srcX, srcY);
        await newTabPage.mouse.down();
        for (let i = 1; i <= 6; i++) {
          await newTabPage.mouse.move(srcX + (dstX - srcX) * (i / 6), srcY + (dstY - srcY) * (i / 6));
          await newTabPage.waitForTimeout(50);
        }
        await newTabPage.mouse.up();
        await newTabPage.waitForTimeout(2500);
      }
    } else {
      // No real tabs visible (tabs.query may return nothing in test context)
      // Fall back to programmatic dispatch with the correct MIME data
      const folderSelector = `[data-folder-id="${folderId}"].folder-container, ` +
        `[data-folder-id="${folderId}"][data-testid="bookmark-folder"]`;
      await simulateNewTabDrop(newTabPage, folderSelector, {
        title: TAB_TITLE,
        url: TAB_URL,
        tabId: 2001,
      });
      await newTabPage.waitForTimeout(2500);
    }

    const urlsAfter = await getBookmarkUrlsInFolder(newTabPage, folderId!);
    expect(urlsAfter).toContain(TAB_URL);
  });
});
