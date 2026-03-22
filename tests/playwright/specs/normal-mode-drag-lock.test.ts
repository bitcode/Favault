import { test, expect } from '../fixtures/extension';
import { ExtensionTestUtils } from '../fixtures/extension';
import { BookmarkTestUtils } from '../utils/bookmark-utils';
import { TestDataSetup } from '../utils/test-data-setup';
import type { Page } from '@playwright/test';

/**
 * Tests that drag-and-drop of bookmarks is fully blocked in normal (non-edit) mode.
 *
 * Each test uses a different mechanism that was previously bypassing the edit mode guard:
 *   1. HTML attribute — bookmarks must not have draggable="true"
 *   2. HTML5 dragstart event — must be blocked (preventDefault)
 *   3. HTML5 drop event — folder containers must not execute moves on bookmark drops
 *   4. Mouse bridge (__fav_dragCandidate) — global state must not be set
 *   5. Mouse drag simulation — end-to-end mouse move must not move bookmarks
 *   6. Regression: new-tab drops still work in normal mode (only bookmark moves blocked)
 *   7. Positive control: all drag operations work correctly in edit mode
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get the ordered list of bookmark titles inside a folder by its Chrome ID. */
async function getBookmarkOrder(page: Page, folderId: string): Promise<string[]> {
  return page.evaluate(async (id) => {
    const children = await new Promise<any[]>((res) =>
      (chrome || (window as any).browser).bookmarks.getChildren(id, res)
    );
    return children.filter((c: any) => c.url).map((c: any) => c.title as string);
  }, folderId);
}

/** Get the folder ID from the first non-protected folder visible in the DOM. */
async function getFirstFolderId(page: Page): Promise<string> {
  const id = await page.evaluate(() => {
    const PROTECTED = new Set(['0', '1', '2']);
    const els = Array.from(
      document.querySelectorAll('.folder-container[data-folder-id]')
    ) as HTMLElement[];
    const el = els.find((e) => {
      const fid = e.dataset.folderId ?? '';
      return fid && !PROTECTED.has(fid) && !e.classList.contains('protected-folder');
    });
    return el?.dataset.folderId ?? null;
  });
  if (!id) throw new Error('No usable folder found in the DOM');
  return id;
}

/** Get the folder ID from the second non-protected folder visible in the DOM. */
async function getSecondFolderId(page: Page): Promise<string> {
  const id = await page.evaluate(() => {
    const PROTECTED = new Set(['0', '1', '2']);
    const els = Array.from(
      document.querySelectorAll('.folder-container[data-folder-id]')
    ) as HTMLElement[];
    const usable = els.filter((e) => {
      const fid = e.dataset.folderId ?? '';
      return fid && !PROTECTED.has(fid) && !e.classList.contains('protected-folder');
    });
    return usable[1]?.dataset.folderId ?? null;
  });
  if (!id) throw new Error('No second usable folder found in the DOM');
  return id;
}

/**
 * Simulate a full HTML5 drag sequence for a bookmark onto a target element.
 * Returns the bookmark's Chrome parent ID after the attempt (to detect if it moved).
 */
async function simulateBookmarkDrag(
  page: Page,
  sourceFolderId: string,
  targetFolderId: string
): Promise<{ dragStartFired: boolean; dragStartPrevented: boolean }> {
  return page.evaluate(
    ({ srcId, dstId }) => {
      const srcFolder = document.querySelector(
        `.folder-container[data-folder-id="${srcId}"]`
      ) as HTMLElement | null;
      const dstFolder = document.querySelector(
        `.folder-container[data-folder-id="${dstId}"]`
      ) as HTMLElement | null;

      if (!srcFolder || !dstFolder)
        throw new Error('Source or target folder not found');

      const bookmarkEl = srcFolder.querySelector(
        '.bookmark-item[data-bookmark-id]'
      ) as HTMLElement | null;
      if (!bookmarkEl) throw new Error('No bookmark found in source folder');

      const dt = new DataTransfer();
      const payload = JSON.stringify({
        type: 'bookmark',
        id: bookmarkEl.getAttribute('data-bookmark-id'),
        title: bookmarkEl.getAttribute('data-title') ?? '',
        parentId: srcId,
        url: bookmarkEl.getAttribute('data-url') ?? '',
        index: 0,
      });
      dt.setData('application/x-favault-bookmark', payload);
      dt.setData('text/plain', payload);

      let dragStartFired = false;
      let dragStartPrevented = false;

      const listener = (e: DragEvent) => {
        dragStartFired = true;
        if (e.defaultPrevented) dragStartPrevented = true;
      };
      bookmarkEl.addEventListener('dragstart', listener, { once: true });

      bookmarkEl.dispatchEvent(
        new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt })
      );
      dstFolder.dispatchEvent(
        new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt })
      );
      dstFolder.dispatchEvent(
        new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt })
      );
      dstFolder.dispatchEvent(
        new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })
      );
      bookmarkEl.dispatchEvent(
        new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt })
      );

      bookmarkEl.removeEventListener('dragstart', listener);
      return { dragStartFired, dragStartPrevented };
    },
    { srcId: sourceFolderId, dstId: targetFolderId }
  );
}

/**
 * Check the global drag state that the mouse bridge uses.
 * Returns true if any drag state leaked into window.
 */
async function getMouseBridgeState(page: Page) {
  return page.evaluate(() => ({
    isDragging: !!(window as any).__fav_isDragging,
    hasCandidate: !!(window as any).__fav_dragCandidate,
  }));
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('Normal Mode Drag Lock', () => {
  let bookmarkUtils: BookmarkTestUtils;
  let testDataSetup: TestDataSetup;

  test.beforeEach(async ({ newTabPage, context }) => {
    bookmarkUtils = new BookmarkTestUtils(newTabPage);
    testDataSetup = new TestDataSetup(newTabPage, context);

    await testDataSetup.initialize({
      folderCount: 3,
      bookmarksPerFolder: 3,
      includeEmptyFolders: false,
      includeDragTestFolders: false,
      includeReorderableItems: false,
      maxNestingLevel: 1,
    });
    await testDataSetup.generateTestData();
    await testDataSetup.waitForBookmarkSync();
    await bookmarkUtils.waitForBookmarksToLoad();

    // Ensure we start in normal mode
    await newTabPage.evaluate(async () => {
      if ((window as any).settingsManager) {
        await (window as any).settingsManager.updateEditMode({ enabled: false });
      }
    });
    await newTabPage.waitForTimeout(300);
  });

  // -------------------------------------------------------------------------
  // 1. draggable attribute must be absent / false in normal mode
  // -------------------------------------------------------------------------
  test('bookmark items do not have draggable="true" in normal mode', async ({ newTabPage }) => {
    const draggableCount = await newTabPage.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.bookmark-item'));
      return items.filter(
        (el) => el.getAttribute('draggable') === 'true'
      ).length;
    });

    expect(draggableCount).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 2. HTML5 dragstart must be prevented in normal mode
  // -------------------------------------------------------------------------
  test('dragstart event is prevented on bookmark items in normal mode', async ({ newTabPage }) => {
    const result = await newTabPage.evaluate(() => {
      const bookmarkEl = document.querySelector(
        '.bookmark-item[data-bookmark-id]'
      ) as HTMLElement | null;
      if (!bookmarkEl) throw new Error('No bookmark item found');

      let defaultWasPrevented = false;

      const checker = (e: DragEvent) => {
        // Our handler calls e.preventDefault() — so defaultPrevented should be true
        defaultWasPrevented = e.defaultPrevented;
      };

      // Listen AFTER the component's own handler fires (bubble phase)
      document.addEventListener('dragstart', checker);

      const dt = new DataTransfer();
      bookmarkEl.dispatchEvent(
        new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt })
      );

      document.removeEventListener('dragstart', checker);
      return { defaultWasPrevented };
    });

    // In normal mode dragstart must be prevented by our handler
    expect(result.defaultWasPrevented).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 3. HTML5 drop onto a folder must not move the bookmark in normal mode
  // -------------------------------------------------------------------------
  test('bookmark position does not change after HTML5 drag attempt in normal mode', async ({ newTabPage }) => {
    const folderId1 = await getFirstFolderId(newTabPage);
    const folderId2 = await getSecondFolderId(newTabPage);

    const orderBefore = await getBookmarkOrder(newTabPage, folderId1);
    expect(orderBefore.length).toBeGreaterThan(0);

    const countInFolder2Before = (await getBookmarkOrder(newTabPage, folderId2)).length;

    await simulateBookmarkDrag(newTabPage, folderId1, folderId2);

    // Give async drop handlers time to execute if they were going to
    await newTabPage.waitForTimeout(600);

    const orderAfter = await getBookmarkOrder(newTabPage, folderId1);
    const countInFolder2After = (await getBookmarkOrder(newTabPage, folderId2)).length;

    // Source folder bookmarks must be unchanged
    expect(orderAfter).toEqual(orderBefore);
    // Target folder must not have gained any new bookmarks
    expect(countInFolder2After).toBe(countInFolder2Before);
  });

  // -------------------------------------------------------------------------
  // 4. Mouse bridge must not set drag state in normal mode
  // -------------------------------------------------------------------------
  test('global mouse drag state is not set when clicking bookmark in normal mode', async ({ newTabPage }) => {
    // Reset any stale window state
    await newTabPage.evaluate(() => {
      (window as any).__fav_isDragging = false;
      (window as any).__fav_dragCandidate = null;
    });

    const bookmark = newTabPage.locator('.bookmark-item[data-bookmark-id]').first();
    const box = await bookmark.boundingBox();
    expect(box).not.toBeNull();

    // Mousedown on bookmark
    await newTabPage.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await newTabPage.mouse.down();
    // Move enough to exceed the 4px threshold that would mark isDragging
    await newTabPage.mouse.move(box!.x + box!.width / 2 + 30, box!.y + box!.height / 2 + 30);
    await newTabPage.waitForTimeout(100);

    const stateAfterMove = await getMouseBridgeState(newTabPage);

    await newTabPage.mouse.up();
    await newTabPage.waitForTimeout(200);

    // In normal mode, the global bridge must not set a drag candidate or isDragging
    expect(stateAfterMove.hasCandidate).toBe(false);
    expect(stateAfterMove.isDragging).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 5. Full mouse drag simulation must not move a bookmark in normal mode
  // -------------------------------------------------------------------------
  test('mouse drag from bookmark to another folder does not move bookmark in normal mode', async ({ newTabPage }) => {
    const folderId1 = await getFirstFolderId(newTabPage);
    const folderId2 = await getSecondFolderId(newTabPage);

    const orderBefore = await getBookmarkOrder(newTabPage, folderId1);
    const countInFolder2Before = (await getBookmarkOrder(newTabPage, folderId2)).length;

    // Find the first bookmark in folder 1 and the second folder element
    const srcBookmark = newTabPage
      .locator(`.folder-container[data-folder-id="${folderId1}"] .bookmark-item`)
      .first();
    const dstFolder = newTabPage.locator(
      `.folder-container[data-folder-id="${folderId2}"]`
    );

    const srcBox = await srcBookmark.boundingBox();
    const dstBox = await dstFolder.boundingBox();
    expect(srcBox).not.toBeNull();
    expect(dstBox).not.toBeNull();

    // Perform a slow mouse drag from the bookmark to the target folder
    await newTabPage.mouse.move(srcBox!.x + srcBox!.width / 2, srcBox!.y + srcBox!.height / 2);
    await newTabPage.mouse.down();
    for (let i = 1; i <= 8; i++) {
      await newTabPage.mouse.move(
        srcBox!.x + srcBox!.width / 2 + ((dstBox!.x + dstBox!.width / 2 - srcBox!.x - srcBox!.width / 2) * i) / 8,
        srcBox!.y + srcBox!.height / 2 + ((dstBox!.y + dstBox!.height / 2 - srcBox!.y - srcBox!.height / 2) * i) / 8
      );
      await newTabPage.waitForTimeout(40);
    }
    await newTabPage.mouse.up();

    // Wait long enough for any async move operation to complete
    await newTabPage.waitForTimeout(800);

    const orderAfter = await getBookmarkOrder(newTabPage, folderId1);
    const countInFolder2After = (await getBookmarkOrder(newTabPage, folderId2)).length;

    expect(orderAfter).toEqual(orderBefore);
    expect(countInFolder2After).toBe(countInFolder2Before);
  });

  // -------------------------------------------------------------------------
  // 6. Regression: new-tab drops must still work in normal mode
  // -------------------------------------------------------------------------
  test('new-tab drag drop onto folder still works in normal mode', async ({ newTabPage }) => {
    const TAB_URL = 'https://normal-mode-newtab-test.example.com/';
    const TAB_TITLE = 'Normal Mode New Tab Test';

    const folderId = await getFirstFolderId(newTabPage);
    const urlsBefore = await newTabPage.evaluate(async (id) => {
      const children = await new Promise<any[]>((res) =>
        (chrome || (window as any).browser).bookmarks.getChildren(id, res)
      );
      return children.filter((c: any) => c.url).map((c: any) => c.url as string);
    }, folderId);

    // Dispatch a new-tab drag (type: 'new-tab') onto the folder
    await newTabPage.evaluate(
      ({ selector, data }) => {
        const target = document.querySelector(selector) as HTMLElement | null;
        if (!target) throw new Error(`Target not found: ${selector}`);

        const payload = JSON.stringify({
          type: 'new-tab',
          id: `tab-${data.tabId}`,
          title: data.title,
          url: data.url,
        });
        const dt = new DataTransfer();
        dt.setData('application/x-favault-bookmark', payload);
        dt.setData('text/plain', data.url);

        const src = document.createElement('div');
        src.style.cssText = 'position:fixed;top:-100px;left:-100px;width:1px;height:1px';
        src.draggable = true;
        document.body.appendChild(src);

        src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
        target.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }));
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
        target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
        src.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt }));
        document.body.removeChild(src);
      },
      {
        selector: `.folder-container[data-folder-id="${folderId}"]`,
        data: { title: TAB_TITLE, url: TAB_URL, tabId: 7777 },
      }
    );

    await newTabPage.waitForTimeout(2500);

    const urlsAfter = await newTabPage.evaluate(async (id) => {
      const children = await new Promise<any[]>((res) =>
        (chrome || (window as any).browser).bookmarks.getChildren(id, res)
      );
      return children.filter((c: any) => c.url).map((c: any) => c.url as string);
    }, folderId);

    expect(urlsAfter).toContain(TAB_URL);
    expect(urlsAfter.length).toBe(urlsBefore.length + 1);
  });

  // -------------------------------------------------------------------------
  // 7. Positive control: drag DOES work in edit mode
  // -------------------------------------------------------------------------
  test('bookmark successfully moves to another folder when in edit mode', async ({ newTabPage }) => {
    const folderId1 = await getFirstFolderId(newTabPage);
    const folderId2 = await getSecondFolderId(newTabPage);

    const orderBefore1 = await getBookmarkOrder(newTabPage, folderId1);
    const orderBefore2 = await getBookmarkOrder(newTabPage, folderId2);
    expect(orderBefore1.length).toBeGreaterThan(0);

    // Enable edit mode
    await ExtensionTestUtils.enableEditMode(newTabPage);
    await newTabPage.waitForTimeout(500);

    // Confirm edit mode is active
    const isEditMode = await newTabPage.evaluate(
      () => document.body.classList.contains('edit-mode')
    );
    expect(isEditMode).toBe(true);

    // Now do the drag via HTML5 events
    await simulateBookmarkDrag(newTabPage, folderId1, folderId2);
    await newTabPage.waitForTimeout(1000);

    const orderAfter1 = await getBookmarkOrder(newTabPage, folderId1);
    const orderAfter2 = await getBookmarkOrder(newTabPage, folderId2);

    // One bookmark should have moved: source loses one, target gains one
    expect(orderAfter1.length).toBe(orderBefore1.length - 1);
    expect(orderAfter2.length).toBe(orderBefore2.length + 1);
  });
});
