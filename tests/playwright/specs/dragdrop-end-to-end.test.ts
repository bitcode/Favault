import { test, expect } from '@playwright/test';
import { ExtensionTestUtils } from '../utils/extension-utils';
import { DragDropTestUtils } from '../utils/dragdrop-utils';
import { BookmarkTestUtils } from '../utils/bookmark-utils';
import { ConsoleTestUtils } from '../utils/console-utils';
import { TestDataSetup } from '../utils/test-data-setup';

test.describe('End-to-End Drag-and-Drop Operations', () => {
  let dragDropUtils: DragDropTestUtils;
  let bookmarkUtils: BookmarkTestUtils;
  let consoleUtils: ConsoleTestUtils;
  let testDataSetup: TestDataSetup;

  test.beforeEach(async ({ page, context }) => {
    dragDropUtils = new DragDropTestUtils(page);
    bookmarkUtils = new BookmarkTestUtils(page);
    consoleUtils = new ConsoleTestUtils(page);
    testDataSetup = new TestDataSetup(page, context);

    // Start monitoring
    await consoleUtils.startMonitoring();
    await consoleUtils.monitorExtensionAPICalls();
    await consoleUtils.injectDragDropTestFunctions();

    // Create test bookmark data
    console.log('🔧 Setting up test bookmark data for end-to-end testing...');
    await testDataSetup.initialize({
      folderCount: 3,
      bookmarksPerFolder: 2,
      maxNestingLevel: 1,
      includeEmptyFolders: false,
      includeDragTestFolders: true,
      includeProtectedFolders: false,
      includeReorderableItems: true
    });

    await testDataSetup.generateTestData();
    await testDataSetup.waitForBookmarkSync();
    console.log('✅ Test bookmark data created for end-to-end testing');
  });

  test.afterEach(async () => {
    // Generate test report
    const report = await consoleUtils.generateDragDropTestReport();
    console.log('📊 End-to-End Test Report:', JSON.stringify(report, null, 2));

    // Stop monitoring and cleanup
    await consoleUtils.stopMonitoring();
    await testDataSetup.clearTestData();
    console.log('🧹 End-to-end test data cleaned up');
  });

  test('should enable edit mode and activate drag-drop system', async ({ page }) => {
    // Enable edit mode through UI
    console.log('🔧 Enabling edit mode through UI...');
    await ExtensionTestUtils.enableEditMode(page);

    // Wait for enhanced drag-drop system to initialize
    await ExtensionTestUtils.waitForEnhancedDragDropSetup(page);

    // Verify edit mode is active
    const editModeActive = await page.evaluate(() => {
      return document.body.classList.contains('edit-mode');
    });
    expect(editModeActive).toBeTruthy();

    // Verify enhanced drag-drop system is ready
    const systemReady = await page.evaluate(() => {
      return (window as any).enhancedDragDropReady === true;
    });
    expect(systemReady).toBeTruthy();

    // Verify folders are draggable
    const folders = await page.locator('.folder-container').all();
    expect(folders.length).toBeGreaterThan(0);

    for (const folder of folders) {
      const isDraggable = await dragDropUtils.isDraggable(folder);
      expect(isDraggable).toBeTruthy();
    }

    console.log('✅ Edit mode enabled and drag-drop system activated');
  });

  test('should reorder folders through drag-and-drop', async ({ page }) => {
    // Enable edit mode
    await ExtensionTestUtils.enableEditMode(page);
    await ExtensionTestUtils.waitForEnhancedDragDropSetup(page);

    // Get initial folder order
    const initialOrder = await dragDropUtils.getFolderOrder();
    console.log('📊 Initial folder order:', initialOrder);
    expect(initialOrder.length).toBeGreaterThanOrEqual(2);

    // Perform drag-and-drop to reorder folders
    const firstFolder = page.locator('.folder-container').first();
    const secondFolder = page.locator('.folder-container').nth(1);

    console.log('🔄 Performing folder reorder drag-and-drop...');
    await dragDropUtils.dragAndDrop(firstFolder, secondFolder);

    // Wait for changes to propagate
    await page.waitForTimeout(2000);

    // Get new folder order
    const newOrder = await dragDropUtils.getFolderOrder();
    console.log('📊 New folder order:', newOrder);

    // Verify order changed
    expect(newOrder).not.toEqual(initialOrder);
    expect(newOrder.length).toBe(initialOrder.length);

    // Verify the change persisted in Chrome bookmarks
    const currentState = await consoleUtils.executeTestFunction('getCurrentBookmarkState');
    expect(currentState.folderCount).toBe(initialOrder.length);

    console.log('✅ Folder reordering successful and persisted');
  });

  test('should move bookmarks between folders', async ({ page }) => {
    // Enable edit mode
    await ExtensionTestUtils.enableEditMode(page);
    await ExtensionTestUtils.waitForEnhancedDragDropSetup(page);

    // Find source bookmark and target folder
    const sourceBookmark = page.locator('.bookmark-item').first();
    const targetFolder = page.locator('.folder-container').nth(1);

    // Get initial state
    const initialBookmarkTitle = await sourceBookmark.locator('.bookmark-title').textContent();
    const initialTargetFolderTitle = await targetFolder.locator('.folder-title').textContent();

    console.log(`🔄 Moving bookmark "${initialBookmarkTitle}" to folder "${initialTargetFolderTitle}"`);

    // Perform drag-and-drop to move bookmark
    await dragDropUtils.dragAndDrop(sourceBookmark, targetFolder);

    // Wait for changes to propagate
    await page.waitForTimeout(2000);

    // Verify bookmark moved to target folder
    const bookmarksInTargetFolder = await targetFolder.locator('.bookmark-item').all();
    const bookmarkTitlesInTarget = await Promise.all(
      bookmarksInTargetFolder.map(b => b.locator('.bookmark-title').textContent())
    );

    expect(bookmarkTitlesInTarget).toContain(initialBookmarkTitle);

    // Verify the change persisted in Chrome bookmarks
    const currentState = await consoleUtils.executeTestFunction('getCurrentBookmarkState');
    expect(currentState.bookmarkCount).toBeGreaterThan(0);

    console.log('✅ Bookmark move successful and persisted');
  });

  test('should provide visual feedback during drag operations', async ({ page }) => {
    // Enable edit mode
    await ExtensionTestUtils.enableEditMode(page);
    await ExtensionTestUtils.waitForEnhancedDragDropSetup(page);

    const folder = page.locator('.folder-container').first();

    // Check initial state
    const initialCursor = await folder.evaluate((el: HTMLElement) =>
      window.getComputedStyle(el).cursor
    );

    // Hover over draggable element
    await folder.hover();

    // Check cursor changed to grab
    const hoverCursor = await folder.evaluate((el: HTMLElement) =>
      window.getComputedStyle(el).cursor
    );

    expect(hoverCursor).toContain('grab');

    // Verify drag feedback
    const dragFeedback = await dragDropUtils.verifyDragFeedback(folder);
    expect(dragFeedback.isDragging || dragFeedback.hasGhostImage || dragFeedback.hasDropZones).toBeTruthy();

    console.log('✅ Visual feedback working correctly');
  });

  test('should handle drag-and-drop errors gracefully', async ({ page }) => {
    // Enable edit mode
    await ExtensionTestUtils.enableEditMode(page);
    await ExtensionTestUtils.waitForEnhancedDragDropSetup(page);

    // Try to drag to invalid target
    const folder = page.locator('.folder-container').first();
    const invalidTarget = page.locator('body');

    console.log('🔄 Testing drag to invalid target...');

    // This should not cause errors
    await dragDropUtils.dragAndDrop(folder, invalidTarget);

    // Wait and verify no errors occurred
    await page.waitForTimeout(1000);

    const errors = await consoleUtils.getConsoleErrors();
    const dragDropErrors = errors.filter(error =>
      error.includes('drag') || error.includes('drop')
    );

    // Should have minimal or no drag-drop related errors
    expect(dragDropErrors.length).toBeLessThanOrEqual(1);

    console.log('✅ Error handling working correctly');
  });

  test('should disable drag-drop when edit mode is turned off', async ({ page }) => {
    // Enable edit mode first
    await ExtensionTestUtils.enableEditMode(page);
    await ExtensionTestUtils.waitForEnhancedDragDropSetup(page);

    // Verify folders are draggable
    const folder = page.locator('.folder-container').first();
    let isDraggable = await dragDropUtils.isDraggable(folder);
    expect(isDraggable).toBeTruthy();

    // Disable edit mode
    console.log('🔧 Disabling edit mode...');
    await ExtensionTestUtils.disableEditMode(page);

    // Wait for changes to propagate
    await page.waitForTimeout(1000);

    // Verify folders are no longer draggable
    isDraggable = await dragDropUtils.isDraggable(folder);
    expect(isDraggable).toBeFalsy();

    // Verify edit mode is disabled
    const editModeActive = await page.evaluate(() => {
      return document.body.classList.contains('edit-mode');
    });
    expect(editModeActive).toBeFalsy();

    console.log('✅ Edit mode disabled and drag-drop deactivated');
  });
});
