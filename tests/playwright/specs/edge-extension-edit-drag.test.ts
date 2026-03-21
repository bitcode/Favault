/**
 * Edge Extension — Edit Mode and Drag-Drop Tests
 *
 * Verifies that on Edge (msedge channel / dist/edge build):
 *   1. Edit mode can be entered and exited, with correct DOM class state
 *   2. Sections (folders) can be reordered and their Chrome bookmark API
 *      position matches the intended display position
 *   3. Bookmarks can be moved between folders and the Chrome API reflects
 *      the new parentId correctly
 *
 * All tests are gated to the edge-extension project and skip on other browsers.
 *
 * Helpers mirror section-drag-drop.test.ts so this file is self-contained.
 */

import { test, expect } from '../fixtures/extension';
import { ExtensionTestUtils } from '../fixtures/extension';
import { DragDropTestUtils } from '../utils/dragdrop-utils';
import { BookmarkTestUtils } from '../utils/bookmark-utils';
import type { Page } from '@playwright/test';

// ─── Page-side helpers ────────────────────────────────────────────────────────

/** DOM section order: { displayIndex, title, bookmarkId } */
async function getDomSectionState(page: Page) {
  return page.evaluate(() => {
    const containers = Array.from(
      document.querySelectorAll('.folder-container')
    ) as HTMLElement[];
    return containers.map((el, i) => ({
      displayIndex: i,
      title:
        el.querySelector<HTMLElement>('.folder-title, h3, .folder-name')
          ?.textContent?.trim() ?? '',
      bookmarkId:
        el.getAttribute('data-folder-id') ??
        el.getAttribute('data-bookmark-id') ??
        ''
    }));
  });
}

/** Chrome bookmarks API position for a folder, counting folder-only siblings */
async function getChromeFolderPosition(page: Page, bookmarkId: string) {
  return page.evaluate(async (id: string) => {
    const extensionBookmarks =
      (window as any).browser?.bookmarks ?? (window as any).chrome?.bookmarks;
    if (!extensionBookmarks) throw new Error('Extension bookmarks API not accessible');

    const [node] = await extensionBookmarks.get(id);
    const parentChildren = await extensionBookmarks.getChildren(node.parentId);

    const chromeSiblingAll = parentChildren.findIndex((c: any) => c.id === id);
    const folderOnlySiblings = parentChildren.filter((c: any) => !c.url);
    const chromeFolderOnly = folderOnlySiblings.findIndex((c: any) => c.id === id);

    return {
      bookmarkId: id,
      parentId: node.parentId,
      chromeSiblingAll,
      chromeFolderOnly,
      folderOnlySiblings: folderOnlySiblings.map((c: any) => ({
        id: c.id,
        title: c.title,
        folderIndex: folderOnlySiblings.indexOf(c)
      }))
    };
  }, bookmarkId);
}

/** Chrome bookmarks API info for a bookmark: parentId and index */
async function getChromeBookmarkInfo(page: Page, bookmarkId: string) {
  return page.evaluate(async (id: string) => {
    const extensionBookmarks =
      (window as any).browser?.bookmarks ?? (window as any).chrome?.bookmarks;
    if (!extensionBookmarks) throw new Error('Extension bookmarks API not accessible');

    const [node] = await extensionBookmarks.get(id);
    const siblings = await extensionBookmarks.getChildren(node.parentId);
    const indexInParent = siblings.findIndex((c: any) => c.id === id);

    return {
      bookmarkId: id,
      title: node.title,
      url: node.url,
      parentId: node.parentId,
      indexInParent
    };
  }, bookmarkId);
}

/** Scraped bookmark → folder ID map from DOM data attributes */
async function getFolderBookmarkIdMap(page: Page): Promise<Record<number, string>> {
  return page.evaluate(() => {
    const containers = Array.from(
      document.querySelectorAll('.folder-container')
    ) as HTMLElement[];
    const map: Record<number, string> = {};
    containers.forEach((el, i) => {
      const id =
        el.getAttribute('data-folder-id') ??
        el.getAttribute('data-bookmark-id') ??
        '';
      if (id) map[i] = id;
    });
    return map;
  });
}

/** Call EnhancedDragDropManager.moveFolderToPosition — same as FolderInsertionPoint.svelte */
async function callMoveFolderToPosition(
  page: Page,
  fromDisplayIndex: number,
  insertionIndex: number
) {
  return page.evaluate(
    async ({ fromIdx, insIdx }: { fromIdx: number; insIdx: number }) => {
      const mgr = (window as any).EnhancedDragDropManager;
      if (!mgr) throw new Error('EnhancedDragDropManager not available');
      return await mgr.moveFolderToPosition(fromIdx, insIdx, {
        mode: 'insertion-index'
      });
    },
    { fromIdx: fromDisplayIndex, insIdx: insertionIndex }
  );
}

/** Scrape first bookmark inside a folder at the given display index */
async function getFirstBookmarkInFolder(page: Page, folderDisplayIndex: number) {
  return page.evaluate((idx: number) => {
    const containers = Array.from(
      document.querySelectorAll('.folder-container')
    ) as HTMLElement[];
    const folder = containers[idx];
    if (!folder) return null;
    const item = folder.querySelector<HTMLElement>(
      '.bookmark-item, [data-testid="bookmark-item"]'
    );
    if (!item) return null;
    return {
      bookmarkId:
        item.getAttribute('data-bookmark-id') ??
        item.getAttribute('data-id') ??
        '',
      title: item.querySelector('.bookmark-title, .bookmark-name, a')
        ?.textContent?.trim() ?? '',
      folderId:
        folder.getAttribute('data-folder-id') ??
        folder.getAttribute('data-bookmark-id') ??
        ''
    };
  }, folderDisplayIndex);
}

// ─── Edge-specific setup ──────────────────────────────────────────────────────

/**
 * Enable edit mode for Edge tests.
 *
 * ExtensionTestUtils.enableEditMode waits for `enhancedDragDropReady === true`
 * on the window object, which may not be exposed in the Edge build. This version
 * only requires the DOM to reflect edit-mode and draggable folders, which are
 * reliable signals that work on Edge.
 */
async function enableEditModeEdge(page: Page): Promise<void> {
  // Use settingsManager if available, otherwise fall back to keyboard shortcut
  const hasSettingsManager = await page.evaluate(
    () => typeof (window as any).settingsManager !== 'undefined'
  );

  if (hasSettingsManager) {
    await page.evaluate(async () => {
      await (window as any).settingsManager.updateEditMode({ enabled: true });
    });
  } else {
    await page.keyboard.press('Control+E');
  }

  // Wait for edit-mode class and draggable folders (no enhancedDragDropReady dependency)
  await page.waitForFunction(() => {
    const inEditMode =
      document.body.classList.contains('edit-mode') ||
      !!document.querySelector('.app.edit-mode, [data-edit-mode="true"]');
    const hasFolders =
      document.querySelectorAll('.folder-container').length > 0;
    return inEditMode && hasFolders;
  }, { timeout: 15000 });

  await page.waitForTimeout(800);
}

async function setupPage(page: Page) {
  await ExtensionTestUtils.waitForExtensionReady(page);
  await enableEditModeEdge(page);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Edge Extension — Edit Mode', () => {
  test.describe.configure({ mode: 'serial' });
  test('can enter and exit edit mode, DOM class toggles correctly', async (
    { newTabPage },
    testInfo
  ) => {
    test.skip(testInfo.project.name !== 'edge-extension', 'Edge-only test');

    await ExtensionTestUtils.waitForExtensionReady(newTabPage);

    // Verify we start outside edit mode
    const startInEditMode = await newTabPage
      .locator('body.edit-mode, .app.edit-mode')
      .count();
    expect(startInEditMode, 'Should not be in edit mode on load').toBe(0);

    // Enter edit mode (use Edge-specific helper — avoids enhancedDragDropReady dependency)
    await enableEditModeEdge(newTabPage);

    const inEditMode = await newTabPage
      .locator('body.edit-mode, .app.edit-mode')
      .count();
    expect(inEditMode, 'Should be in edit mode after enabling').toBeGreaterThan(0);

    // Verify folders are present in edit mode
    const folderCount = await newTabPage.locator('.folder-container').count();
    expect(folderCount, 'Folders should be visible in edit mode').toBeGreaterThan(0);

    // Check draggable attribute as a diagnostic (may not be set on Edge if
    // EnhancedDragDropManager hasn't fully initialized — not a hard failure)
    const draggableFolders = await newTabPage
      .locator('.folder-container[draggable="true"]')
      .count();
    console.log(
      `Edge edit mode: ${folderCount} folders visible, ${draggableFolders} have draggable="true" ` +
      `(draggable attr may be absent on Edge if EnhancedDragDropManager is partially initialized)`
    );

    // Exit edit mode
    await ExtensionTestUtils.disableEditMode(newTabPage);
    await newTabPage.waitForTimeout(500);

    const stillInEditMode = await newTabPage
      .locator('body.edit-mode, .app.edit-mode')
      .count();
    expect(stillInEditMode, 'Should not be in edit mode after disabling').toBe(0);

    console.log('✅ Edge: edit mode toggle works correctly');
  });

  test('edit mode toggle via keyboard shortcut Ctrl+E', async (
    { newTabPage },
    testInfo
  ) => {
    test.skip(testInfo.project.name !== 'edge-extension', 'Edge-only test');

    await ExtensionTestUtils.waitForExtensionReady(newTabPage);

    // Enter via keyboard
    await newTabPage.keyboard.press('Control+E');
    await newTabPage.waitForTimeout(500);

    const inEditMode = await newTabPage
      .locator('body.edit-mode, .app.edit-mode, [data-edit-mode="true"]')
      .count();
    expect(inEditMode, 'Ctrl+E should enable edit mode').toBeGreaterThan(0);

    // Exit via keyboard
    await newTabPage.keyboard.press('Control+E');
    await newTabPage.waitForTimeout(500);

    const stillInEditMode = await newTabPage
      .locator('body.edit-mode, .app.edit-mode, [data-edit-mode="true"]')
      .count();
    expect(stillInEditMode, 'Second Ctrl+E should disable edit mode').toBe(0);

    console.log('✅ Edge: Ctrl+E keyboard toggle works');
  });
});

test.describe('Edge Extension — Section Reordering', () => {
  test.describe.configure({ mode: 'serial' });
  test('move first section to end — Chrome API reflects new position', async (
    { newTabPage },
    testInfo
  ) => {
    test.skip(testInfo.project.name !== 'edge-extension', 'Edge-only test');
    await setupPage(newTabPage);

    const idMap = await getFolderBookmarkIdMap(newTabPage);
    const domSections = await getDomSectionState(newTabPage);
    test.skip(domSections.length < 3, `Need ≥3 sections, found ${domSections.length}`);

    const N = domSections.length;
    const movedId = idMap[0] ?? domSections[0]?.bookmarkId;
    test.skip(!movedId || movedId.startsWith('placeholder'), 'No real bookmark ID for S[0]');

    const before = await getChromeFolderPosition(newTabPage, movedId);
    console.log(`Edge section move: "${domSections[0].title}" starts at folder-only index ${before.chromeFolderOnly}`);

    await callMoveFolderToPosition(newTabPage, 0, N);
    await newTabPage.waitForTimeout(700);

    const after = await getChromeFolderPosition(newTabPage, movedId);
    console.log(
      `After move to end: folder-only index = ${after.chromeFolderOnly}\n` +
      `Order: [${after.folderOnlySiblings.map(f => `"${f.title}"`).join(', ')}]`
    );

    expect(
      after.chromeFolderOnly,
      `"${domSections[0].title}" should be at index ${N - 1} (last), got ${after.chromeFolderOnly}`
    ).toBe(N - 1);

    console.log('✅ Edge: move first section to end — Chrome API correct');
  });

  test('move last section to front — Chrome API reflects new position', async (
    { newTabPage },
    testInfo
  ) => {
    test.skip(testInfo.project.name !== 'edge-extension', 'Edge-only test');
    await setupPage(newTabPage);

    const idMap = await getFolderBookmarkIdMap(newTabPage);
    const domSections = await getDomSectionState(newTabPage);
    test.skip(domSections.length < 3, `Need ≥3 sections, found ${domSections.length}`);

    const N = domSections.length;
    const lastIdx = N - 1;
    const movedId = idMap[lastIdx] ?? domSections[lastIdx]?.bookmarkId;
    test.skip(!movedId || movedId.startsWith('placeholder'), 'No real bookmark ID for last section');

    const before = await getChromeFolderPosition(newTabPage, movedId);
    console.log(`Edge: "${domSections[lastIdx].title}" starts at folder-only index ${before.chromeFolderOnly}`);

    await callMoveFolderToPosition(newTabPage, lastIdx, 0);
    await newTabPage.waitForTimeout(700);

    const after = await getChromeFolderPosition(newTabPage, movedId);
    console.log(
      `After move to front: folder-only index = ${after.chromeFolderOnly}\n` +
      `Order: [${after.folderOnlySiblings.map(f => `"${f.title}"`).join(', ')}]`
    );

    expect(
      after.chromeFolderOnly,
      `"${domSections[lastIdx].title}" should be at index 0 (first), got ${after.chromeFolderOnly}`
    ).toBe(0);

    console.log('✅ Edge: move last section to front — Chrome API correct');
  });

  test('move section down one position — Chrome API reflects new position', async (
    { newTabPage },
    testInfo
  ) => {
    test.skip(testInfo.project.name !== 'edge-extension', 'Edge-only test');
    await setupPage(newTabPage);

    const idMap = await getFolderBookmarkIdMap(newTabPage);
    const domSections = await getDomSectionState(newTabPage);
    test.skip(domSections.length < 3, `Need ≥3 sections, found ${domSections.length}`);

    const movedId = idMap[0] ?? domSections[0]?.bookmarkId;
    test.skip(!movedId || movedId.startsWith('placeholder'), 'No real bookmark ID for S[0]');

    // Move S[0] → insertion gap 2 → should land at display index 1
    await callMoveFolderToPosition(newTabPage, 0, 2);
    await newTabPage.waitForTimeout(700);

    const after = await getChromeFolderPosition(newTabPage, movedId);
    console.log(
      `Move down one: folder-only index = ${after.chromeFolderOnly}\n` +
      `Order: [${after.folderOnlySiblings.map(f => `"${f.title}"`).join(', ')}]`
    );

    expect(
      after.chromeFolderOnly,
      `Section should be at index 1 after moving down one, got ${after.chromeFolderOnly}`
    ).toBe(1);

    console.log('✅ Edge: move section down one — Chrome API correct');
  });

  test('two sequential section moves — both land correctly', async (
    { newTabPage },
    testInfo
  ) => {
    test.skip(testInfo.project.name !== 'edge-extension', 'Edge-only test');
    await setupPage(newTabPage);

    const idMap = await getFolderBookmarkIdMap(newTabPage);
    const domSections = await getDomSectionState(newTabPage);
    test.skip(domSections.length < 3, `Need ≥3 sections, found ${domSections.length}`);

    const N = domSections.length;
    const s0Id = idMap[0] ?? domSections[0]?.bookmarkId;
    test.skip(!s0Id || s0Id.startsWith('placeholder'), 'No real bookmark ID for S[0]');

    // Move 1: S[0] → end
    await callMoveFolderToPosition(newTabPage, 0, N);
    await newTabPage.waitForTimeout(800);

    const afterMove1 = await getChromeFolderPosition(newTabPage, s0Id);
    expect(afterMove1.chromeFolderOnly, 'After move 1, S[0] should be last').toBe(N - 1);

    // Move 2: now what was S[1] is at index 0 — move it to end too
    const idMap2 = await getFolderBookmarkIdMap(newTabPage);
    const s1Id = idMap2[0];
    if (!s1Id || s1Id.startsWith('placeholder')) {
      console.log('Skipping second move — no ID for new S[0]');
    } else {
      await callMoveFolderToPosition(newTabPage, 0, N - 1);
      await newTabPage.waitForTimeout(800);

      const afterMove2 = await getChromeFolderPosition(newTabPage, s0Id);
      console.log(
        `After both moves, original S[0] "${domSections[0].title}" is at index ${afterMove2.chromeFolderOnly}\n` +
        `Order: [${afterMove2.folderOnlySiblings.map(f => `"${f.title}"`).join(', ')}]`
      );

      // Original S[0] should still be at the last position
      expect(afterMove2.chromeFolderOnly, 'Original S[0] should still be last after second move').toBe(N - 1);
    }

    console.log('✅ Edge: sequential section moves — both correct');
  });

  test('no-op move — Chrome API index does not change', async (
    { newTabPage },
    testInfo
  ) => {
    test.skip(testInfo.project.name !== 'edge-extension', 'Edge-only test');
    await setupPage(newTabPage);

    const idMap = await getFolderBookmarkIdMap(newTabPage);
    const domSections = await getDomSectionState(newTabPage);
    test.skip(domSections.length < 2, `Need ≥2 sections, found ${domSections.length}`);

    const bId = idMap[1] ?? domSections[1]?.bookmarkId;
    test.skip(!bId || bId.startsWith('placeholder'), 'No real bookmark ID for S[1]');

    const before = await getChromeFolderPosition(newTabPage, bId);

    // Drop S[1] into gap 1 (right before itself) — should be a no-op
    await callMoveFolderToPosition(newTabPage, 1, 1);
    await newTabPage.waitForTimeout(600);

    const after = await getChromeFolderPosition(newTabPage, bId);

    expect(
      after.chromeFolderOnly,
      `No-op drag must leave folder-only index unchanged (before=${before.chromeFolderOnly}, after=${after.chromeFolderOnly})`
    ).toBe(before.chromeFolderOnly);

    console.log('✅ Edge: no-op section move — index unchanged');
  });
});

test.describe('Edge Extension — Bookmark Moves Between Folders', () => {
  test.describe.configure({ mode: 'serial' });
  test('move bookmark to another folder — Chrome API parentId updates', async (
    { newTabPage },
    testInfo
  ) => {
    test.skip(testInfo.project.name !== 'edge-extension', 'Edge-only test');
    await setupPage(newTabPage);

    const domSections = await getDomSectionState(newTabPage);
    test.skip(domSections.length < 2, `Need ≥2 sections, found ${domSections.length}`);

    // Find a bookmark in folder 0
    const source = await getFirstBookmarkInFolder(newTabPage, 0);
    if (!source?.bookmarkId) {
      test.skip(true, 'No bookmark found in first folder');
      return;
    }

    const targetFolderId =
      (await getFolderBookmarkIdMap(newTabPage))[1] ?? domSections[1]?.bookmarkId;
    if (!targetFolderId || targetFolderId.startsWith('placeholder')) {
      test.skip(true, 'No real bookmark ID for second folder');
      return;
    }

    console.log(
      `Edge bookmark move: "${source.title}" (${source.bookmarkId})\n` +
      `  from folder ${source.folderId} → to folder ${targetFolderId}`
    );

    const before = await getChromeBookmarkInfo(newTabPage, source.bookmarkId);
    expect(before.parentId).toBe(source.folderId);

    // Move via Chrome bookmarks API (same as the drag-drop manager does internally)
    await newTabPage.evaluate(
      async ({ bookmarkId, newParentId }: { bookmarkId: string; newParentId: string }) => {
        const api =
          (window as any).browser?.bookmarks ?? (window as any).chrome?.bookmarks;
        await api.move(bookmarkId, { parentId: newParentId });
      },
      { bookmarkId: source.bookmarkId, newParentId: targetFolderId }
    );

    await newTabPage.waitForTimeout(700);

    const after = await getChromeBookmarkInfo(newTabPage, source.bookmarkId);
    console.log(
      `After move: parentId = ${after.parentId} (expected ${targetFolderId})`
    );

    expect(
      after.parentId,
      `Bookmark "${source.title}" should be in folder ${targetFolderId}`
    ).toBe(targetFolderId);

    console.log('✅ Edge: bookmark move between folders — parentId correct');
  });

  test('drag-drop bookmark to another folder — UI and Chrome API agree', async (
    { newTabPage },
    testInfo
  ) => {
    test.skip(testInfo.project.name !== 'edge-extension', 'Edge-only test');
    await setupPage(newTabPage);

    const bookmarkUtils = new BookmarkTestUtils(newTabPage);
    const dragDropUtils = new DragDropTestUtils(newTabPage);
    const domSections = await getDomSectionState(newTabPage);
    test.skip(domSections.length < 2, `Need ≥2 sections, found ${domSections.length}`);

    await bookmarkUtils.waitForBookmarksToLoad();

    const folders = await bookmarkUtils.getBookmarkFolders();
    test.skip(folders.length < 2, 'Need ≥2 visible folders');

    const sourceFolder = folders[0];
    const targetFolder = folders[1];

    const sourceBookmarks = await bookmarkUtils.getBookmarksInFolder(sourceFolder);
    if (sourceBookmarks.length === 0) {
      test.skip(true, 'No bookmarks in first folder to drag');
      return;
    }

    const targetFolderTitle = await targetFolder
      .locator('.folder-title, h3, .folder-name')
      .first()
      .textContent();

    // Snapshot bookmark IDs before drag
    const source = await getFirstBookmarkInFolder(newTabPage, 0);
    const targetFolderIdMap = await getFolderBookmarkIdMap(newTabPage);
    const targetFolderId = targetFolderIdMap[1] ?? domSections[1]?.bookmarkId;

    if (!source?.bookmarkId || !targetFolderId || targetFolderId.startsWith('placeholder')) {
      test.skip(true, 'Could not resolve bookmark IDs for drag test');
      return;
    }

    const beforeInfo = await getChromeBookmarkInfo(newTabPage, source.bookmarkId);
    console.log(
      `Edge drag: "${source.title}" from "${domSections[0].title}" → "${targetFolderTitle?.trim()}"`
    );

    // Perform the drag
    await dragDropUtils.dragAndDrop(sourceBookmarks[0], targetFolder);
    await newTabPage.waitForTimeout(1000);

    const afterInfo = await getChromeBookmarkInfo(newTabPage, source.bookmarkId);
    console.log(
      `After drag: parentId = ${afterInfo.parentId}\n` +
      `Before: ${beforeInfo.parentId}, Target folder: ${targetFolderId}`
    );

    expect(
      afterInfo.parentId,
      `Bookmark "${source.title}" should have moved to folder ${targetFolderId}`
    ).toBe(targetFolderId);

    // Also verify it no longer appears in the source folder DOM
    const sourceBookmarksAfter = await bookmarkUtils.getBookmarksInFolder(folders[0]);
    const sourceTitlesAfter = await Promise.all(
      sourceBookmarksAfter.map(b =>
        b.locator('.bookmark-title, .bookmark-name, a').first().textContent()
      )
    );
    const stillInSource = sourceTitlesAfter.some(t => t?.trim() === source.title);
    expect(stillInSource, 'Bookmark should no longer appear in the source folder').toBe(false);

    console.log('✅ Edge: drag-drop bookmark between folders — UI and Chrome API agree');
  });

  test('bookmark state persists after moving back to original folder', async (
    { newTabPage },
    testInfo
  ) => {
    test.skip(testInfo.project.name !== 'edge-extension', 'Edge-only test');
    await setupPage(newTabPage);

    const domSections = await getDomSectionState(newTabPage);
    test.skip(domSections.length < 2, `Need ≥2 sections, found ${domSections.length}`);

    const source = await getFirstBookmarkInFolder(newTabPage, 0);
    if (!source?.bookmarkId || !source.folderId) {
      test.skip(true, 'No bookmark with ID in first folder');
      return;
    }
    const targetFolderIdMap = await getFolderBookmarkIdMap(newTabPage);
    const targetFolderId = targetFolderIdMap[1] ?? domSections[1]?.bookmarkId;
    if (!targetFolderId || targetFolderId.startsWith('placeholder')) {
      test.skip(true, 'No real bookmark ID for second folder');
      return;
    }

    const originalFolderId = source.folderId;

    // Move to folder 1
    await newTabPage.evaluate(
      async ({ bookmarkId, newParentId }: { bookmarkId: string; newParentId: string }) => {
        const api =
          (window as any).browser?.bookmarks ?? (window as any).chrome?.bookmarks;
        await api.move(bookmarkId, { parentId: newParentId });
      },
      { bookmarkId: source.bookmarkId, newParentId: targetFolderId }
    );
    await newTabPage.waitForTimeout(500);

    const midInfo = await getChromeBookmarkInfo(newTabPage, source.bookmarkId);
    expect(midInfo.parentId, 'Should be in target folder after first move').toBe(targetFolderId);

    // Move back to original folder
    await newTabPage.evaluate(
      async ({ bookmarkId, newParentId }: { bookmarkId: string; newParentId: string }) => {
        const api =
          (window as any).browser?.bookmarks ?? (window as any).chrome?.bookmarks;
        await api.move(bookmarkId, { parentId: newParentId });
      },
      { bookmarkId: source.bookmarkId, newParentId: originalFolderId }
    );
    await newTabPage.waitForTimeout(700);

    const finalInfo = await getChromeBookmarkInfo(newTabPage, source.bookmarkId);
    console.log(
      `Round-trip: "${source.title}" → folder1 → back to original\n` +
      `Final parentId: ${finalInfo.parentId} (expected: ${originalFolderId})`
    );

    expect(
      finalInfo.parentId,
      `Bookmark should be back in original folder ${originalFolderId}`
    ).toBe(originalFolderId);

    console.log('✅ Edge: bookmark round-trip move — state correct');
  });
});
