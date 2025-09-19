import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import { execSync } from 'child_process';

test.describe('Drag-and-Drop Visual Stability', () => {
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
      ]
    });

    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('should have stable visual feedback without flickering during drag operations', async () => {
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
    
    console.log('Extension loaded, checking for folders...');
    
    // Check if we have folders to test with
    const folders = await page.locator('.folder-container').count();
    console.log(`Found ${folders} folders`);
    
    if (folders === 0) {
      console.log('No folders found, skipping drag-drop visual stability test');
      return;
    }
    
    // Enable edit mode to activate drag-and-drop
    const editButton = page.locator('[data-testid="edit-toggle"], .edit-toggle, button:has-text("Edit")').first();
    if (await editButton.isVisible()) {
      await editButton.click();
      await page.waitForTimeout(1000); // Wait for edit mode to activate
      console.log('Edit mode enabled');
    }
    
    // Find a bookmark to drag
    const bookmarks = await page.locator('.bookmark-item').count();
    console.log(`Found ${bookmarks} bookmarks`);
    
    if (bookmarks === 0) {
      console.log('No bookmarks found, skipping drag-drop visual stability test');
      return;
    }
    
    // Set up console monitoring to detect excessive logging during drag
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'log' && msg.text().includes('drag')) {
        consoleMessages.push(msg.text());
      }
    });
    
    // Get the first bookmark and first folder
    const firstBookmark = page.locator('.bookmark-item').first();
    const firstFolder = page.locator('.folder-container').first();
    
    // Start drag operation
    console.log('Starting drag operation...');
    await firstBookmark.hover();
    await page.mouse.down();
    
    // Move over the drop zone and hover for a period to test stability
    const folderBox = await firstFolder.boundingBox();
    if (folderBox) {
      // Move to the folder center
      const centerX = folderBox.x + folderBox.width / 2;
      const centerY = folderBox.y + folderBox.height / 2;
      
      console.log(`Moving to folder center: ${centerX}, ${centerY}`);
      await page.mouse.move(centerX, centerY, { steps: 10 });
      
      // Hover over the drop zone for 2 seconds to test stability
      console.log('Hovering over drop zone for stability test...');
      await page.waitForTimeout(2000);
      
      // Check if drop zone is active
      const isDropZoneActive = await firstFolder.evaluate(el => 
        el.classList.contains('drop-zone-active') || 
        el.classList.contains('drop-target') ||
        el.hasAttribute('data-drop-active')
      );
      
      console.log(`Drop zone active: ${isDropZoneActive}`);
      expect(isDropZoneActive).toBe(true);
      
      // Move slightly within the drop zone to test for flickering
      console.log('Testing micro-movements within drop zone...');
      for (let i = 0; i < 5; i++) {
        await page.mouse.move(centerX + (i * 2), centerY + (i * 2), { steps: 1 });
        await page.waitForTimeout(100);
      }
      
      // Check that drop zone is still consistently active
      const isStillActive = await firstFolder.evaluate(el => 
        el.classList.contains('drop-zone-active') || 
        el.classList.contains('drop-target') ||
        el.hasAttribute('data-drop-active')
      );
      
      console.log(`Drop zone still active after micro-movements: ${isStillActive}`);
      expect(isStillActive).toBe(true);
    }
    
    // End drag operation
    await page.mouse.up();
    console.log('Drag operation completed');
    
    // Wait a moment for any cleanup
    await page.waitForTimeout(500);
    
    // Analyze console messages for excessive logging patterns
    console.log(`Total drag-related console messages: ${consoleMessages.length}`);
    
    // Check for rapid repeated messages that indicate flickering
    const messageGroups = new Map<string, number>();
    consoleMessages.forEach(msg => {
      // Normalize message by removing dynamic parts
      const normalized = msg.replace(/\d+/g, 'N').replace(/folder-\w+/g, 'folder-X');
      messageGroups.set(normalized, (messageGroups.get(normalized) || 0) + 1);
    });
    
    // Look for messages that repeat excessively (indicating flickering)
    let hasExcessiveRepeats = false;
    messageGroups.forEach((count, message) => {
      if (count > 10) { // More than 10 identical messages suggests flickering
        console.log(`Excessive repeats detected: "${message}" appeared ${count} times`);
        hasExcessiveRepeats = true;
      }
    });
    
    // Test should pass if no excessive repeats are found
    expect(hasExcessiveRepeats).toBe(false);
    
    console.log('Visual stability test completed successfully');
  });
  
  test('should not have infinite CSS animations during drag hover', async () => {
    // Navigate to chrome://newtab to load the extension
    await page.goto('chrome://newtab');
    await page.waitForLoadState('networkidle');
    
    // Wait for the extension to load
    await page.waitForSelector('.app', { timeout: 10000 });
    await page.waitForTimeout(1000);
    
    // Check that CSS animations are not infinite on drop zones
    const animationStyles = await page.evaluate(() => {
      const styles = Array.from(document.styleSheets)
        .flatMap(sheet => {
          try {
            return Array.from(sheet.cssRules);
          } catch {
            return [];
          }
        })
        .filter(rule => rule instanceof CSSStyleRule)
        .map(rule => (rule as CSSStyleRule).cssText)
        .filter(text => text.includes('animation') && text.includes('infinite'));
      
      return styles;
    });
    
    console.log('Found infinite animations:', animationStyles);
    
    // Check that drop zone related animations are not infinite
    const problematicAnimations = animationStyles.filter(style => 
      style.includes('drop-zone') || 
      style.includes('drag-over') ||
      style.includes('dropZoneHighlight')
    );
    
    console.log('Problematic infinite animations:', problematicAnimations);
    
    // Should not have infinite animations on drop zones that could cause flickering
    expect(problematicAnimations.length).toBe(0);
  });
});
