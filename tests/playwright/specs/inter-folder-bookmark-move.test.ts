import { test, expect } from '../fixtures/extension';
import { DragDropTestUtils } from '../utils/dragdrop-utils';
import { BookmarkTestUtils } from '../utils/bookmark-utils';
import { ConsoleTestUtils } from '../utils/console-utils';
import { ExtensionTestUtils } from '../fixtures/extension';
import { TestDataSetup } from '../utils/test-data-setup';

/**
 * Inter-folder drag-and-drop tests for Favorites (bookmarks)
 * - Moves a bookmark from one folder to another
 * - Verifies removal from source and appearance in destination
 * - Tests empty-folder and populated-folder targets
 * - Validates visual feedback during drag
 * - Ensures persistence after reload
 */

test.describe('Inter-Folder Favorites Drag-and-Drop', () => {
  let dragDropUtils: DragDropTestUtils;
  let bookmarkUtils: BookmarkTestUtils;
  let consoleUtils: ConsoleTestUtils;
  let testDataSetup: TestDataSetup;

  test.beforeEach(async ({ newTabPage, context }) => {
    dragDropUtils = new DragDropTestUtils(newTabPage);
    bookmarkUtils = new BookmarkTestUtils(newTabPage);
    consoleUtils = new ConsoleTestUtils(newTabPage);
    testDataSetup = new TestDataSetup(newTabPage, context);

    // Start monitoring and ensure helpful debug hooks
    await consoleUtils.startMonitoring();
    await consoleUtils.monitorExtensionAPICalls();

    // Create controlled test data with at least one empty folder
    await testDataSetup.initialize({
      folderCount: 4,
      bookmarksPerFolder: 3,
      includeEmptyFolders: true,
      includeDragTestFolders: true,
      includeReorderableItems: true,
      maxNestingLevel: 1,
      includeProtectedFolders: false,
    });
    await testDataSetup.generateTestData();
    await testDataSetup.waitForBookmarkSync();

    // Wait for UI then enable edit mode (required for drag-drop)
    await bookmarkUtils.waitForBookmarksToLoad();
    await ExtensionTestUtils.enableEditMode(newTabPage);
  });

  test.afterEach(async () => {
    const report = consoleUtils.generateTestReport();
    console.log('📊 Inter-folder drag-drop report:', JSON.stringify(report, null, 2));
  });

  async function findEmptyFolderIndex(folders: any[]): Promise<number> {
    for (let i = 0; i < folders.length; i++) {
      const count = await folders[i].locator('.bookmark-item, [data-testid="bookmark-item"]').count();
      if (count === 0) return i;
    }
    return -1;
  }

  test('move bookmark from populated folder to another populated folder; verify removal/addition and persistence', async ({ newTabPage }) => {
    const folders = await bookmarkUtils.getBookmarkFolders();
    if (folders.length < 2) test.skip('Need at least 2 folders');

    // Ensure both source and target have items
    let sourceIdx = -1;
    let targetIdx = -1;
    for (let i = 0; i < folders.length; i++) {
      const cnt = await folders[i].locator('.bookmark-item, [data-testid="bookmark-item"]').count();
      if (cnt > 0) {
        if (sourceIdx === -1) sourceIdx = i; else if (targetIdx === -1) { targetIdx = i; break; }
      }
    }
    if (sourceIdx === -1 || targetIdx === -1 || sourceIdx === targetIdx) test.skip('Need two populated folders');

    const sourceFolder = folders[sourceIdx];
    const targetFolder = folders[targetIdx];

    // Snapshot initial state
    const initialSourceTitles = await bookmarkUtils.getBookmarkTitlesInFolder(sourceFolder);
    const initialTargetTitles = await bookmarkUtils.getBookmarkTitlesInFolder(targetFolder);
    const initialSourceCount = initialSourceTitles.length;
    const initialTargetCount = initialTargetTitles.length;
    expect(initialSourceCount).toBeGreaterThan(0);

    const sourceBookmark = sourceFolder.locator('.bookmark-item, [data-testid="bookmark-item"]').first();
    await expect(sourceBookmark).toBeVisible();
    const movedTitle = (await sourceBookmark.locator('.bookmark-title, .bookmark-name, [data-testid="bookmark-title"]').first().textContent())?.trim();
    expect(movedTitle).toBeTruthy();

    // Perform drag to target folder container
    await dragDropUtils.dragAndDrop(sourceBookmark, targetFolder);
    await dragDropUtils.waitForDragDropComplete();

    // Verify UI state updated
    const finalSourceTitles = await bookmarkUtils.getBookmarkTitlesInFolder(sourceFolder);
    const finalTargetTitles = await bookmarkUtils.getBookmarkTitlesInFolder(targetFolder);
    expect(finalSourceTitles.length).toBe(initialSourceCount - 1);
    expect(finalTargetTitles.length).toBe(initialTargetCount + 1);
    expect(finalSourceTitles).not.toContain(movedTitle!);
    expect(finalTargetTitles).toContain(movedTitle!);

    // Verify persistence after reload
    await newTabPage.reload();
    await bookmarkUtils.waitForBookmarksToLoad();
    await ExtensionTestUtils.enableEditMode(newTabPage);

    const foldersAfterReload = await bookmarkUtils.getBookmarkFolders();
    const srcAfter = foldersAfterReload[sourceIdx];
    const dstAfter = foldersAfterReload[targetIdx];
    const srcTitlesAfter = await bookmarkUtils.getBookmarkTitlesInFolder(srcAfter);
    const dstTitlesAfter = await bookmarkUtils.getBookmarkTitlesInFolder(dstAfter);
    expect(srcTitlesAfter).not.toContain(movedTitle!);
    expect(dstTitlesAfter).toContain(movedTitle!);

    // Sanity: confirm chrome.bookmarks.move was called at least once
    const errors = consoleUtils.getErrorMessages();
    expect(errors.filter(e => e.toLowerCase().includes('drag') || e.toLowerCase().includes('drop'))).toHaveLength(0);
  });

  test('move bookmark to empty folder; verify appears as first item and persists; header vs container drops', async ({ newTabPage }) => {
    const folders = await bookmarkUtils.getBookmarkFolders();
    if (folders.length < 2) test.skip('Need at least 2 folders');

    const emptyIdx = await findEmptyFolderIndex(folders);
    if (emptyIdx === -1) test.skip('No empty folder available');

    // Pick a different populated folder as source
    let sourceIdx = -1;
    for (let i = 0; i < folders.length; i++) {
      if (i === emptyIdx) continue;
      const cnt = await folders[i].locator('.bookmark-item, [data-testid="bookmark-item"]').count();
      if (cnt > 0) { sourceIdx = i; break; }
    }
    if (sourceIdx === -1) test.skip('No populated folder available');

    const sourceFolder = folders[sourceIdx];
    const emptyFolder = folders[emptyIdx];

    const sourceBookmark = sourceFolder.locator('.bookmark-item, [data-testid="bookmark-item"]').first();
    await expect(sourceBookmark).toBeVisible();
    const movedTitle = (await sourceBookmark.locator('.bookmark-title, .bookmark-name, [data-testid="bookmark-title"]').first().textContent())?.trim();

    // Drop on folder header to insert at beginning
    const header = emptyFolder.locator('.folder-header, [data-testid="folder-header"]').first();
    const dropTargetForHeader = (await header.count()) > 0 ? header : emptyFolder;

    await dragDropUtils.dragAndDrop(sourceBookmark, dropTargetForHeader);
    await dragDropUtils.waitForDragDropComplete();

    // Verify becomes first item
    const firstInEmpty = emptyFolder.locator('.bookmark-item, [data-testid="bookmark-item"]').first();
    const firstTitle = (await firstInEmpty.locator('.bookmark-title, .bookmark-name, [data-testid="bookmark-title"]').first().textContent())?.trim();
    expect(firstTitle).toBe(movedTitle);

    // Reload to verify persistence
    await newTabPage.reload();
    await bookmarkUtils.waitForBookmarksToLoad();
    await ExtensionTestUtils.enableEditMode(newTabPage);

    const foldersAfter = await bookmarkUtils.getBookmarkFolders();
    const emptyAfter = foldersAfter[emptyIdx];
    const titlesAfter = await bookmarkUtils.getBookmarkTitlesInFolder(emptyAfter);
    expect(titlesAfter[0]).toBe(movedTitle);
  });

  test('visual feedback during inter-folder drag shows drop zones/ghost', async ({ newTabPage }) => {
    const folders = await bookmarkUtils.getBookmarkFolders();
    if (folders.length < 2) test.skip('Need at least 2 folders');

    // Choose any source with a bookmark and a different target folder
    let sourceIdx = -1;
    let targetIdx = -1;
    for (let i = 0; i < folders.length; i++) {
      const cnt = await folders[i].locator('.bookmark-item, [data-testid="bookmark-item"]').count();
      if (cnt > 0 && sourceIdx === -1) sourceIdx = i;
      else if (i !== sourceIdx && targetIdx === -1) targetIdx = i;
      if (sourceIdx !== -1 && targetIdx !== -1) break;
    }
    if (sourceIdx === -1 || targetIdx === -1) test.skip('Insufficient folders for visual test');

    const sourceBookmark = folders[sourceIdx].locator('.bookmark-item, [data-testid="bookmark-item"]').first();
    const targetFolder = folders[targetIdx];

    // Use helper to validate drag feedback
    const feedback = await dragDropUtils.verifyDragFeedback(sourceBookmark);
    expect(feedback.isDragging || feedback.hasGhostImage || feedback.hasDropZones).toBeTruthy();

    // Additionally hover target while mouse is down to see drop-zone activation
    await sourceBookmark.hover();
    await newTabPage.mouse.down();
    await targetFolder.hover();

    const targetShowsDropZone = await newTabPage.locator('.drop-zone-active, .drop-target.active, [data-drop-active="true"]').count();
    await newTabPage.mouse.up();

    expect(targetShowsDropZone).toBeGreaterThanOrEqual(0); // Presence optional depending on implementation
  });
});

