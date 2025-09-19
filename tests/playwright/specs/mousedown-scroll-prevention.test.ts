import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import { execSync } from 'child_process';

test.describe('Mousedown Scroll Prevention During Drag-Drop', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async () => {
    // Build the extension first
    console.log('Building Chrome extension...');
    execSync('npm run build:chrome', { cwd: process.cwd(), stdio: 'inherit' });

    // Launch browser with extension
    const extensionPath = path.join(process.cwd(), 'dist', 'chrome');
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-dev-shm-usage'
      ],
      // Set viewport to ensure scrolling is possible
      viewport: { width: 1280, height: 600 }
    });

    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('should prevent unwanted scrolling on mousedown in edit mode', async () => {
    // Navigate to chrome://newtab to load the extension
    await page.goto('chrome://newtab');
    await page.waitForLoadState('networkidle');

    // Wait for extension redirect
    await page.waitForTimeout(3000);

    console.log('Current URL after chrome://newtab:', page.url());

    // Verify we're on the extension page
    if (!page.url().startsWith('chrome-extension://')) {
      throw new Error('Extension did not load properly');
    }

    console.log('Extension new tab page loaded successfully');
    
    // Wait for the extension to load
    await page.waitForSelector('.app', { timeout: 10000 });
    await page.waitForTimeout(2000); // Allow time for full initialization
    
    // Check scroll prevention is not active initially
    const initialScrollPreventionState = await page.evaluate(() => {
      return (window as any).EnhancedDragDropManager?.isScrollPreventionActive || false;
    });
    console.log('Initial scroll prevention state:', initialScrollPreventionState);
    expect(initialScrollPreventionState).toBe(false);
    
    // Enable edit mode to activate drag-and-drop
    console.log('Enabling edit mode...');
    const editButton = page.locator('[data-testid="edit-toggle"], .edit-toggle, button:has-text("Edit")').first();
    if (await editButton.isVisible()) {
      await editButton.click();
      await page.waitForTimeout(1000);
      console.log('Edit mode enabled');
    }
    
    // Verify edit mode is active
    const isEditMode = await page.evaluate(() => {
      return document.body.classList.contains('edit-mode') || 
             document.querySelector('.app.edit-mode') !== null;
    });
    console.log('Edit mode active:', isEditMode);
    expect(isEditMode).toBe(true);
    
    // Check if scroll prevention is activated in edit mode
    const editModeScrollPreventionState = await page.evaluate(() => {
      return (window as any).EnhancedDragDropManager?.isScrollPreventionActive || false;
    });
    console.log('Scroll prevention state in edit mode:', editModeScrollPreventionState);
    
    // Check for bookmarks and folders
    const bookmarks = await page.locator('.bookmark-item').count();
    const folders = await page.locator('.folder-container').count();
    console.log(`Found ${bookmarks} bookmarks and ${folders} folders`);
    
    if (bookmarks === 0 && folders === 0) {
      console.log('No draggable items found, skipping test');
      return;
    }
    
    // Scroll to a position where we can test scroll prevention
    await page.evaluate(() => window.scrollTo(0, 100));
    await page.waitForTimeout(500);
    
    const initialScrollY = await page.evaluate(() => window.scrollY);
    console.log('Initial scroll position:', initialScrollY);
    
    // Test mousedown on a bookmark item
    if (bookmarks > 0) {
      console.log('Testing mousedown on bookmark item...');
      const bookmark = page.locator('.bookmark-item').first();
      const bookmarkBox = await bookmark.boundingBox();
      
      if (bookmarkBox) {
        // Record scroll position before mousedown
        const scrollBeforeMousedown = await page.evaluate(() => window.scrollY);
        
        // Perform mousedown on bookmark
        await bookmark.hover();
        await page.mouse.down();
        
        // Wait a moment to see if scroll position changes
        await page.waitForTimeout(200);
        
        // Check scroll position after mousedown
        const scrollAfterMousedown = await page.evaluate(() => window.scrollY);
        
        console.log(`Scroll before mousedown: ${scrollBeforeMousedown}, after: ${scrollAfterMousedown}`);
        
        // The scroll position should remain the same (or very close)
        const scrollDifference = Math.abs(scrollAfterMousedown - scrollBeforeMousedown);
        console.log(`Scroll difference: ${scrollDifference}px`);
        
        // Allow for minimal difference due to browser mechanics
        expect(scrollDifference).toBeLessThanOrEqual(5);
        
        // Release mouse
        await page.mouse.up();
        await page.waitForTimeout(200);
      }
    }
    
    // Test mousedown on a folder container
    if (folders > 0) {
      console.log('Testing mousedown on folder container...');
      const folder = page.locator('.folder-container').first();
      const folderBox = await folder.boundingBox();
      
      if (folderBox) {
        // Record scroll position before mousedown
        const scrollBeforeMousedown = await page.evaluate(() => window.scrollY);
        
        // Perform mousedown on folder
        await folder.hover();
        await page.mouse.down();
        
        // Wait a moment to see if scroll position changes
        await page.waitForTimeout(200);
        
        // Check scroll position after mousedown
        const scrollAfterMousedown = await page.evaluate(() => window.scrollY);
        
        console.log(`Scroll before mousedown: ${scrollBeforeMousedown}, after: ${scrollAfterMousedown}`);
        
        // The scroll position should remain the same (or very close)
        const scrollDifference = Math.abs(scrollAfterMousedown - scrollBeforeMousedown);
        console.log(`Scroll difference: ${scrollDifference}px`);
        
        // Allow for minimal difference due to browser mechanics
        expect(scrollDifference).toBeLessThanOrEqual(5);
        
        // Release mouse
        await page.mouse.up();
        await page.waitForTimeout(200);
      }
    }
    
    console.log('Mousedown scroll prevention test completed');
  });

  test('should maintain scroll position during full drag operation', async () => {
    // Navigate to chrome://newtab to load the extension
    await page.goto('chrome://newtab');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Verify we're on the extension page
    if (!page.url().startsWith('chrome-extension://')) {
      throw new Error('Extension did not load properly');
    }

    // Wait for the extension to load
    await page.waitForSelector('.app', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Enable edit mode
    const editButton = page.locator('[data-testid="edit-toggle"], .edit-toggle, button:has-text("Edit")').first();
    if (await editButton.isVisible()) {
      await editButton.click();
      await page.waitForTimeout(1000);
    }
    
    const bookmarks = await page.locator('.bookmark-item').count();
    const folders = await page.locator('.folder-container').count();
    
    if (bookmarks === 0 || folders === 0) {
      console.log('Not enough items for drag test, skipping');
      return;
    }
    
    // Scroll to a specific position
    await page.evaluate(() => window.scrollTo(0, 150));
    await page.waitForTimeout(500);
    
    const initialScrollY = await page.evaluate(() => window.scrollY);
    console.log('Initial scroll position for drag test:', initialScrollY);
    
    // Perform a complete drag operation
    const bookmark = page.locator('.bookmark-item').first();
    const folder = page.locator('.folder-container').first();
    
    const bookmarkBox = await bookmark.boundingBox();
    const folderBox = await folder.boundingBox();
    
    if (bookmarkBox && folderBox) {
      // Record scroll position throughout the operation
      const scrollPositions: number[] = [];
      
      // Start monitoring scroll position
      const scrollMonitor = setInterval(async () => {
        const scrollY = await page.evaluate(() => window.scrollY);
        scrollPositions.push(scrollY);
      }, 100);
      
      // Start drag
      await bookmark.hover();
      await page.mouse.down();
      
      // Move to folder (drag operation)
      await page.mouse.move(folderBox.x + folderBox.width / 2, folderBox.y + folderBox.height / 2, { steps: 10 });
      await page.waitForTimeout(1000);
      
      // Complete drag
      await page.mouse.up();
      await page.waitForTimeout(500);
      
      // Stop monitoring
      clearInterval(scrollMonitor);
      
      // Analyze scroll positions
      const maxScrollDiff = Math.max(...scrollPositions.map(pos => Math.abs(pos - initialScrollY)));
      console.log(`Scroll positions during drag: ${scrollPositions.join(', ')}`);
      console.log(`Maximum scroll difference during drag: ${maxScrollDiff}px`);
      
      // The scroll position should remain relatively stable
      expect(maxScrollDiff).toBeLessThanOrEqual(10);
    }
    
    console.log('Full drag operation scroll stability test completed');
  });

  test('should check if scroll prevention handlers are properly installed', async () => {
    // Navigate to chrome://newtab to load the extension
    await page.goto('chrome://newtab');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Verify we're on the extension page
    if (!page.url().startsWith('chrome-extension://')) {
      throw new Error('Extension did not load properly');
    }

    // Wait for the extension to load
    await page.waitForSelector('.app', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Check if EnhancedDragDropManager is available
    const managerExists = await page.evaluate(() => {
      return typeof (window as any).EnhancedDragDropManager !== 'undefined';
    });
    console.log('EnhancedDragDropManager exists:', managerExists);
    expect(managerExists).toBe(true);
    
    // Enable edit mode
    const editButton = page.locator('[data-testid="edit-toggle"], .edit-toggle, button:has-text("Edit")').first();
    if (await editButton.isVisible()) {
      await editButton.click();
      await page.waitForTimeout(1500);
    }
    
    // Check if scroll prevention is active
    const scrollPreventionState = await page.evaluate(() => {
      const manager = (window as any).EnhancedDragDropManager;
      if (!manager) return { exists: false };
      
      return {
        exists: true,
        isScrollPreventionActive: manager.isScrollPreventionActive || false,
        hasPreventMousedownAutoScroll: typeof manager.preventMousedownAutoScroll === 'function',
        hasRestoreAutoScroll: typeof manager.restoreAutoScroll === 'function'
      };
    });
    
    console.log('Scroll prevention state:', scrollPreventionState);
    
    // Check if the mousedown handler is actually attached
    const hasMousedownListener = await page.evaluate(() => {
      // This is a bit hacky but we can check if our handler exists by triggering it
      const testElement = document.createElement('div');
      testElement.className = 'bookmark-item test-element';
      document.body.appendChild(testElement);
      
      let mousedownTriggered = false;
      const originalScrollX = window.scrollX;
      const originalScrollY = window.scrollY;
      
      // Trigger mousedown event
      const event = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      
      testElement.dispatchEvent(event);
      
      // Clean up
      testElement.remove();
      
      // Check if scroll position was preserved (would indicate handler is working)
      return {
        scrollPreserved: window.scrollX === originalScrollX && window.scrollY === originalScrollY
      };
    });
    
    console.log('Mousedown listener check:', hasMousedownListener);
    
    // Log CSS styles related to scroll behavior
    const scrollStyles = await page.evaluate(() => {
      const appElement = document.querySelector('.app');
      const bodyElement = document.body;
      const htmlElement = document.documentElement;
      
      return {
        appScrollBehavior: appElement ? getComputedStyle(appElement).scrollBehavior : null,
        bodyScrollBehavior: getComputedStyle(bodyElement).scrollBehavior,
        htmlScrollBehavior: getComputedStyle(htmlElement).scrollBehavior,
        bodyOverflowAnchor: getComputedStyle(bodyElement).overflowAnchor,
        htmlOverflowAnchor: getComputedStyle(htmlElement).overflowAnchor
      };
    });
    
    console.log('Scroll-related styles:', scrollStyles);
    
    console.log('Scroll prevention handler check completed');
  });
});