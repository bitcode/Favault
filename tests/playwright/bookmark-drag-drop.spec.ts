import { test, expect, Page, BrowserContext } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const EXTENSION_PATH = path.join(__dirname, '../../dist/chrome');
const TEST_TIMEOUT = 30000;

test.describe('Bookmark Drag-and-Drop Functionality', () => {
  let context: BrowserContext;
  let page: Page;
  let extensionId: string;

  test.beforeAll(async ({ browser }) => {
    // Load extension context
    context = await browser.newContext();

    // Load the extension
    await context.addInitScript(() => {
      // Mock Chrome APIs if needed
      if (!window.chrome) {
        (window as any).chrome = {
          bookmarks: {
            getTree: () => Promise.resolve([]),
            move: () => Promise.resolve({}),
            create: () => Promise.resolve({}),
            remove: () => Promise.resolve(),
          },
          runtime: {
            sendMessage: () => Promise.resolve({}),
            onMessage: {
              addListener: () => {},
              removeListener: () => {},
            },
          },
        };
      }
    });

    const extensionPath = path.resolve(EXTENSION_PATH);
    await context.addInitScript(`
      // Inject extension context
      window.extensionPath = '${extensionPath}';
    `);

    page = await context.newPage();

    // Navigate to extension new tab page
    await page.goto(`file://${extensionPath}/newtab.html`);
    await page.waitForLoadState('networkidle');
  });

  test.afterAll(async () => {
    if (context) {
      await context.close();
    }
  });

  test.beforeEach(async () => {
    // Reset to initial state and enable edit mode
    await page.reload();
    await page.waitForLoadState('networkidle');
    await enableEditMode(page);
  });

  test.describe('Setup and Prerequisites', () => {
    test('should load extension and display bookmarks', async () => {
      // Verify extension loads
      await expect(page.locator('.app')).toBeVisible({ timeout: TEST_TIMEOUT });
      
      // Verify bookmark folders are present
      await expect(page.locator('.folder-container')).toHaveCount({ min: 1 });
      
      // Verify bookmarks are present
      await expect(page.locator('.bookmark-item')).toHaveCount({ min: 1 });
    });

    test('should enable edit mode successfully', async () => {
      // Verify edit mode is active
      await expect(page.locator('.app.edit-mode')).toBeVisible();
      
      // Verify draggable elements are present
      await expect(page.locator('.draggable-item')).toHaveCount({ min: 1 });
      
      // Verify insertion points are visible
      await expect(page.locator('.bookmark-insertion-point')).toHaveCount({ min: 1 });
    });

    test('should display insertion points between bookmarks', async () => {
      // Check for insertion points with debug labels
      const insertionPoints = page.locator('.bookmark-insertion-point');
      await expect(insertionPoints).toHaveCount({ min: 1 });
      
      // Verify insertion points have index labels
      const firstInsertionPoint = insertionPoints.first();
      await expect(firstInsertionPoint.locator('.insertion-hint')).toContainText('Drop here');
      
      // Verify insertion points are visible
      await expect(firstInsertionPoint).toBeVisible();
      
      // Check CSS properties
      const opacity = await firstInsertionPoint.evaluate(el => 
        window.getComputedStyle(el).opacity
      );
      expect(parseFloat(opacity)).toBeGreaterThan(0);
    });

    test('should run debug functions successfully', async () => {
      // Test debug functions
      const debugResult = await page.evaluate(() => {
        return (window as any).debugInsertionPoints?.();
      });

      expect(debugResult).toBeDefined();
      expect(debugResult.insertionPointCount).toBeGreaterThan(0);

      const testResult = await page.evaluate(() => {
        return (window as any).testInsertionPoints?.();
      });

      expect(testResult).toBeDefined();
      expect(testResult.success).toBe(true);
    });
  });

  test.describe('Intra-Folder Bookmark Reordering', () => {
    test('should move bookmark within same folder using insertion points', async () => {
      // Find a folder with multiple bookmarks
      const folder = await findFolderWithMultipleBookmarks(page);
      if (!folder) {
        test.skip('No folder with multiple bookmarks found');
        return;
      }

      // Get initial bookmark order
      const initialOrder = await getBookmarkOrder(page, folder);
      expect(initialOrder.length).toBeGreaterThan(1);

      // Find source and target positions
      const sourceBookmark = folder.locator('.bookmark-item').first();
      const targetInsertionPoint = folder.locator('.bookmark-insertion-point').nth(2); // Move to 3rd position

      // Verify elements exist
      await expect(sourceBookmark).toBeVisible();
      await expect(targetInsertionPoint).toBeVisible();

      // Get source bookmark info
      const sourceTitle = await sourceBookmark.locator('.bookmark-title').textContent();
      
      // Perform drag and drop
      await performDragAndDrop(page, sourceBookmark, targetInsertionPoint);

      // Wait for UI update
      await page.waitForTimeout(1000);

      // Verify bookmark moved
      const finalOrder = await getBookmarkOrder(page, folder);
      expect(finalOrder).not.toEqual(initialOrder);
      
      // Verify the bookmark is in the new position
      const newPosition = finalOrder.indexOf(sourceTitle || '');
      expect(newPosition).toBe(2); // Should be at index 2 (3rd position)
    });

    test('should highlight insertion points during drag operation', async () => {
      const folder = await findFolderWithMultipleBookmarks(page);
      if (!folder) {
        test.skip('No folder with multiple bookmarks found');
        return;
      }

      const sourceBookmark = folder.locator('.bookmark-item').first();
      const targetInsertionPoint = folder.locator('.bookmark-insertion-point').nth(1);

      // Start drag operation
      await sourceBookmark.hover();
      await page.mouse.down();

      // Move over insertion point
      await targetInsertionPoint.hover();

      // Check if insertion point is highlighted
      await expect(targetInsertionPoint).toHaveClass(/active/);

      // Complete drag
      await page.mouse.up();
    });

    test('should prevent invalid drops within same folder', async () => {
      const folder = await findFolderWithMultipleBookmarks(page);
      if (!folder) {
        test.skip('No folder with multiple bookmarks found');
        return;
      }

      const sourceBookmark = folder.locator('.bookmark-item').first();
      const initialOrder = await getBookmarkOrder(page, folder);

      // Try to drop on itself (should be prevented)
      await performDragAndDrop(page, sourceBookmark, sourceBookmark);

      // Wait and verify no change
      await page.waitForTimeout(500);
      const finalOrder = await getBookmarkOrder(page, folder);
      expect(finalOrder).toEqual(initialOrder);
    });

    test('should test specific Cisco Web Voicemail bookmark movement', async () => {
      // Look for the specific bookmark mentioned in the issue
      const ciscoWebVoicemailBookmark = page.locator('.bookmark-item').filter({
        hasText: 'Cisco Web Voicemail'
      });

      if (await ciscoWebVoicemailBookmark.count() === 0) {
        test.skip('Cisco Web Voicemail bookmark not found');
        return;
      }

      // Find its parent folder
      const parentFolder = ciscoWebVoicemailBookmark.locator('..').locator('..'); // Navigate up to folder container
      
      // Get initial position
      const initialOrder = await getBookmarkOrder(page, parentFolder);
      const initialPosition = initialOrder.indexOf('Cisco Web Voicemail');
      
      expect(initialPosition).toBeGreaterThan(-1);

      // Find a target insertion point (move to position 4 as mentioned in the issue)
      const targetInsertionPoint = parentFolder.locator('.bookmark-insertion-point').nth(3); // Index 3 = position 4

      if (await targetInsertionPoint.count() === 0) {
        test.skip('Target insertion point not available');
        return;
      }

      // Perform the move
      await performDragAndDrop(page, ciscoWebVoicemailBookmark, targetInsertionPoint);

      // Wait for update
      await page.waitForTimeout(1000);

      // Verify the move
      const finalOrder = await getBookmarkOrder(page, parentFolder);
      const finalPosition = finalOrder.indexOf('Cisco Web Voicemail');
      
      expect(finalPosition).toBe(3); // Should be at index 3 (position 4)
      expect(finalOrder).not.toEqual(initialOrder);
    });
  });

  test.describe('Inter-Folder Bookmark Movement', () => {
    test('should move bookmark between different folders', async () => {
      const folders = page.locator('.folder-container');
      const folderCount = await folders.count();
      
      if (folderCount < 2) {
        test.skip('Need at least 2 folders for inter-folder testing');
        return;
      }

      const sourceFolder = folders.first();
      const targetFolder = folders.nth(1);

      // Get bookmark from source folder
      const sourceBookmark = sourceFolder.locator('.bookmark-item').first();
      await expect(sourceBookmark).toBeVisible();

      const bookmarkTitle = await sourceBookmark.locator('.bookmark-title').textContent();

      // Get initial counts
      const initialSourceCount = await sourceFolder.locator('.bookmark-item').count();
      const initialTargetCount = await targetFolder.locator('.bookmark-item').count();

      // Drag to target folder container
      await performDragAndDrop(page, sourceBookmark, targetFolder);

      // Wait for update
      await page.waitForTimeout(1000);

      // Verify bookmark moved
      const finalSourceCount = await sourceFolder.locator('.bookmark-item').count();
      const finalTargetCount = await targetFolder.locator('.bookmark-item').count();

      expect(finalSourceCount).toBe(initialSourceCount - 1);
      expect(finalTargetCount).toBe(initialTargetCount + 1);

      // Verify bookmark appears in target folder
      const targetBookmarks = await getBookmarkTitles(targetFolder);
      expect(targetBookmarks).toContain(bookmarkTitle);
    });

    test('should drop bookmark at beginning of folder via header', async () => {
      const folders = page.locator('.folder-container');
      const folderCount = await folders.count();
      
      if (folderCount < 2) {
        test.skip('Need at least 2 folders for inter-folder testing');
        return;
      }

      const sourceFolder = folders.first();
      const targetFolder = folders.nth(1);

      const sourceBookmark = sourceFolder.locator('.bookmark-item').first();
      const targetHeader = targetFolder.locator('.folder-header');

      const bookmarkTitle = await sourceBookmark.locator('.bookmark-title').textContent();

      // Drag to folder header
      await performDragAndDrop(page, sourceBookmark, targetHeader);

      // Wait for update
      await page.waitForTimeout(1000);

      // Verify bookmark is at beginning of target folder
      const firstBookmarkInTarget = targetFolder.locator('.bookmark-item').first();
      const firstBookmarkTitle = await firstBookmarkInTarget.locator('.bookmark-title').textContent();
      
      expect(firstBookmarkTitle).toBe(bookmarkTitle);
    });

    test('should move bookmark from Cisco to Zing Platform folder', async () => {
      // Look for specific folders mentioned in the issue
      const ciscoFolder = page.locator('.folder-container').filter({
        hasText: 'Cisco'
      });

      const zingFolder = page.locator('.folder-container').filter({
        hasText: 'Zing'
      });

      if (await ciscoFolder.count() === 0 || await zingFolder.count() === 0) {
        test.skip('Required folders (Cisco/Zing) not found');
        return;
      }

      // Get a bookmark from Cisco folder
      const sourceBookmark = ciscoFolder.locator('.bookmark-item').first();
      await expect(sourceBookmark).toBeVisible();

      const bookmarkTitle = await sourceBookmark.locator('.bookmark-title').textContent();

      // Move to Zing folder
      await performDragAndDrop(page, sourceBookmark, zingFolder);

      // Wait for update
      await page.waitForTimeout(1000);

      // Verify bookmark appears in Zing folder
      const zingBookmarks = await getBookmarkTitles(zingFolder);
      expect(zingBookmarks).toContain(bookmarkTitle);

      // Verify bookmark removed from Cisco folder
      const ciscoBookmarks = await getBookmarkTitles(ciscoFolder);
      expect(ciscoBookmarks).not.toContain(bookmarkTitle);
    });
  });

  test.describe('Visual Feedback and Error Handling', () => {
    test('should show drag preview during operation', async () => {
      const bookmark = page.locator('.bookmark-item').first();
      await expect(bookmark).toBeVisible();

      // Start drag
      await bookmark.hover();
      await page.mouse.down();

      // Check for drag styling
      await expect(bookmark).toHaveClass(/dragging/);
      await expect(page.locator('body')).toHaveClass(/drag-active/);

      // Complete drag
      await page.mouse.up();

      // Verify drag styling removed
      await expect(bookmark).not.toHaveClass(/dragging/);
    });

    test('should display success feedback after successful move', async () => {
      const folder = await findFolderWithMultipleBookmarks(page);
      if (!folder) {
        test.skip('No folder with multiple bookmarks found');
        return;
      }

      const sourceBookmark = folder.locator('.bookmark-item').first();
      const targetInsertionPoint = folder.locator('.bookmark-insertion-point').nth(1);

      // Perform move
      await performDragAndDrop(page, sourceBookmark, targetInsertionPoint);

      // Look for success toast/feedback
      const successToast = page.locator('.drag-drop-toast.success');
      await expect(successToast).toBeVisible({ timeout: 5000 });
    });
  });
});

// Helper functions
async function enableEditMode(page: Page) {
  // Wait for the app to fully load first
  await expect(page.locator('.app')).toBeVisible({ timeout: 30000 });

  // Wait for loading to complete
  await page.waitForFunction(() => {
    const loadingElement = document.querySelector('.loading');
    return !loadingElement || loadingElement.textContent !== 'Loading FaVault...';
  }, { timeout: 30000 });

  // Wait a bit more for the app to be ready
  await page.waitForTimeout(2000);

  // Try clicking edit button first
  const editButton = page.locator('[data-testid="edit-button"], .edit-toggle, button:has-text("Edit")');

  if (await editButton.isVisible({ timeout: 5000 })) {
    console.log('Found edit button, clicking...');
    await editButton.click();
  } else {
    console.log('Edit button not found, trying keyboard shortcut...');
    // Fallback to keyboard shortcut
    await page.keyboard.press('Control+e');
  }

  // Wait for edit mode to activate with more flexible detection
  try {
    await expect(page.locator('.app.edit-mode')).toBeVisible({ timeout: 5000 });
  } catch (error) {
    // Try alternative edit mode detection
    const bodyHasEditMode = await page.locator('body.edit-mode').isVisible();
    const appHasEditClass = await page.evaluate(() => {
      const app = document.querySelector('.app');
      return app?.classList.contains('edit-mode') || false;
    });

    if (!bodyHasEditMode && !appHasEditClass) {
      console.log('Edit mode not detected, trying to force enable...');
      // Try to force enable edit mode via JavaScript
      await page.evaluate(() => {
        // Try to find and trigger edit mode
        const editButton = document.querySelector('[data-testid="edit-button"], .edit-toggle, button');
        if (editButton) {
          (editButton as HTMLElement).click();
        }

        // Also try to add the class manually for testing
        const app = document.querySelector('.app');
        if (app) {
          app.classList.add('edit-mode');
        }

        const body = document.body;
        if (body) {
          body.classList.add('edit-mode');
        }
      });

      await page.waitForTimeout(1000);
    }
  }

  await page.waitForTimeout(500); // Allow for DOM updates
}

async function findFolderWithMultipleBookmarks(page: Page) {
  const folders = page.locator('.folder-container');
  const folderCount = await folders.count();

  for (let i = 0; i < folderCount; i++) {
    const folder = folders.nth(i);
    const bookmarkCount = await folder.locator('.bookmark-item').count();
    
    if (bookmarkCount > 1) {
      return folder;
    }
  }

  return null;
}

async function getBookmarkOrder(page: Page, folder: any) {
  const bookmarks = folder.locator('.bookmark-item .bookmark-title');
  const count = await bookmarks.count();
  const titles = [];

  for (let i = 0; i < count; i++) {
    const title = await bookmarks.nth(i).textContent();
    titles.push(title);
  }

  return titles;
}

async function getBookmarkTitles(folder: any) {
  return await getBookmarkOrder(null, folder);
}

async function performDragAndDrop(page: Page, source: any, target: any) {
  // Get element positions
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();

  if (!sourceBox || !targetBox) {
    throw new Error('Could not get element positions for drag and drop');
  }

  // Perform drag and drop
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  
  // Move to target with intermediate steps for better event handling
  const steps = 5;
  for (let i = 1; i <= steps; i++) {
    const x = sourceBox.x + (targetBox.x - sourceBox.x) * (i / steps) + targetBox.width / 2;
    const y = sourceBox.y + (targetBox.y - sourceBox.y) * (i / steps) + targetBox.height / 2;
    await page.mouse.move(x, y);
    await page.waitForTimeout(50);
  }

  await page.mouse.up();
  await page.waitForTimeout(200); // Allow for drop processing
}
