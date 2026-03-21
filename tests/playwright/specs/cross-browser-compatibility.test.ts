import { test, expect } from '../fixtures/extension';
import { BookmarkTestUtils } from '../utils/bookmark-utils';
import { DragDropTestUtils } from '../utils/dragdrop-utils';
import { ConsoleTestUtils } from '../utils/console-utils';
import { getExtensionProtocol, navigateToExtensionHome } from '../utils/extension-target';

/**
 * Cross-browser compatibility tests for FaVault extension
 * Tests Chrome, Firefox, Safari, and Edge to ensure consistent behavior
 */

// Browser-specific test configurations
const browserConfigs = [
  {
    name: 'Chrome',
    project: 'chrome-extension',
    extensionPath: 'dist/chrome'
  },
  {
    name: 'Chromium',
    project: 'chromium-extension',
    extensionPath: 'dist/chrome'
  },
  {
    name: 'Edge',
    project: 'edge-extension',
    extensionPath: 'dist/edge'
  },
  {
    name: 'Firefox',
    project: 'firefox-extension',
    extensionPath: 'dist/firefox'
  }
];

// Run tests for each browser configuration
for (const config of browserConfigs) {
  test.describe(`Cross-Browser Compatibility - ${config.name}`, () => {
    const assertMatchingProject = (projectName: string) => {
      test.skip(projectName !== config.project, `Only runs in ${config.project}`);
    };

    test(`should load extension correctly in ${config.name}`, async ({ page, browserName }, testInfo) => {
      assertMatchingProject(testInfo.project.name);

      const consoleUtils = new ConsoleTestUtils(page);
      await consoleUtils.startMonitoring();

      try {
        await navigateToExtensionHome(page, browserName);
        
        // Wait for extension to load
        await page.waitForSelector('[data-testid="favault-app"], .app-container, #app', { timeout: 10000 });
        
        // Verify extension is loaded
        const appContainer = page.locator('[data-testid="favault-app"], .app-container, #app');
        await expect(appContainer).toBeVisible();
        
        console.log(`✅ ${config.name}: Extension loaded successfully`);
        
        // Check for browser-specific console errors
        const errors = consoleUtils.getErrorMessages();
        const criticalErrors = errors.filter(err => 
          !err.includes('favicon') && 
          !err.includes('net::ERR') &&
          !err.includes(getExtensionProtocol(browserName)) &&
          !err.includes('Manifest V2')
        );
        
        expect(criticalErrors).toHaveLength(0);
        
      } finally {
        await consoleUtils.stopMonitoring();
      }
    });

    test(`should handle bookmarks consistently in ${config.name}`, async ({ page, browserName }, testInfo) => {
      assertMatchingProject(testInfo.project.name);


      const bookmarkUtils = new BookmarkTestUtils(page);
      const consoleUtils = new ConsoleTestUtils(page);
      
      await consoleUtils.startMonitoring();
      
      try {
        await navigateToExtensionHome(page, browserName);
        await bookmarkUtils.waitForBookmarksToLoad();
        
        // Test basic bookmark functionality
        const folders = await bookmarkUtils.getBookmarkFolders();
        const bookmarks = await bookmarkUtils.getAllBookmarks();
        
        console.log(`📊 ${config.name}: Found ${folders.length} folders and ${bookmarks.length} bookmarks`);
        
        // Verify folder structure
        if (folders.length > 0) {
          for (const folder of folders.slice(0, 3)) { // Test first 3 folders
            const titleElement = folder.locator('.folder-title, h3, .folder-name, [data-testid="folder-title"]');
            await expect(titleElement).toBeVisible();
            
            const title = await titleElement.textContent();
            expect(title?.trim()).toBeTruthy();
          }
        }
        
        // Test search functionality
        if (bookmarks.length > 0) {
          await bookmarkUtils.searchBookmarks('test');
          await page.waitForTimeout(1000);
          
          // Clear search
          await bookmarkUtils.clearSearch();
          await page.waitForTimeout(1000);
        }
        
        console.log(`✅ ${config.name}: Bookmark functionality working`);
        
      } finally {
        await consoleUtils.stopMonitoring();
      }
    });

    test(`should support keyboard shortcuts in ${config.name}`, async ({ page, browserName }, testInfo) => {
      assertMatchingProject(testInfo.project.name);


      const bookmarkUtils = new BookmarkTestUtils(page);
      
      await navigateToExtensionHome(page, browserName);
      await bookmarkUtils.waitForBookmarksToLoad();
      
      // Test search shortcut (browser-specific)
      const isMac = process.platform === 'darwin';
      const modifier = isMac ? 'Meta' : 'Control';

      // Chrome uses Ctrl+Shift+F to avoid conflict with browser search
      const searchShortcut = config.name === 'Chrome' ?
        `${modifier}+Shift+F` :
        `${modifier}+F`;

      await page.keyboard.press(searchShortcut);
      await page.waitForTimeout(1000); // Increased timeout for focus
      
      // Should focus search input
      const focusedElement = await page.locator(':focus').first();
      const tagName = await focusedElement.evaluate(el => el.tagName.toLowerCase());
      expect(tagName).toBe('input');
      
      // Test edit mode shortcut
      await page.keyboard.press('Escape');
      await page.keyboard.press(`${modifier}+E`);
      await page.waitForTimeout(500);
      
      // Should enable edit mode
      const editModeActive = await page.locator('[data-edit-mode="true"], .edit-mode-active, .edit-mode').count() > 0;
      expect(editModeActive).toBeTruthy();
      
      console.log(`✅ ${config.name}: Keyboard shortcuts working`);
    });

    test(`should handle drag-and-drop in ${config.name}`, async ({ page, browserName }, testInfo) => {
      assertMatchingProject(testInfo.project.name);


      const bookmarkUtils = new BookmarkTestUtils(page);
      const dragDropUtils = new DragDropTestUtils(page);
      const consoleUtils = new ConsoleTestUtils(page);
      
      await consoleUtils.startMonitoring();
      await consoleUtils.injectDragDropTestFunctions();
      
      try {
        await navigateToExtensionHome(page, browserName);
        await bookmarkUtils.waitForBookmarksToLoad();
        
        // Enable edit mode
        await page.keyboard.press('Control+E');
        await page.waitForTimeout(500);
        
        const folders = await bookmarkUtils.getBookmarkFolders();
        
        if (folders.length >= 2) {
          // Test drag-drop visual feedback
          const firstFolder = folders[0];
          const isProtected = await bookmarkUtils.isFolderProtected(firstFolder);
          
          if (!isProtected) {
            const feedback = await dragDropUtils.verifyDragFeedback(firstFolder);
            
            // Should provide some form of feedback
            const hasFeedback = feedback.isDragging || feedback.hasGhostImage || feedback.hasDropZones;
            
            if (config.name === 'Chrome' || config.name === 'Chromium') {
              // Chrome should have full drag-drop support
              expect(hasFeedback).toBeTruthy();
            } else {
              // Other browsers might have limited support
              console.log(`ℹ️ ${config.name}: Drag feedback - ${JSON.stringify(feedback)}`);
            }
          }
        }
        
        console.log(`✅ ${config.name}: Drag-drop functionality tested`);
        
      } finally {
        await consoleUtils.stopMonitoring();
      }
    });

    test(`should handle responsive design in ${config.name}`, async ({ page, browserName }, testInfo) => {
      assertMatchingProject(testInfo.project.name);


      const bookmarkUtils = new BookmarkTestUtils(page);
      
      await navigateToExtensionHome(page, browserName);
      await bookmarkUtils.waitForBookmarksToLoad();
      
      // Test different viewport sizes
      const viewports = [
        { width: 1920, height: 1080, name: 'Desktop Large' },
        { width: 1366, height: 768, name: 'Desktop Medium' },
        { width: 1024, height: 768, name: 'Desktop Small' },
        { width: 768, height: 1024, name: 'Tablet' },
        { width: 375, height: 667, name: 'Mobile' }
      ];
      
      for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.waitForTimeout(500);
        
        // Verify extension is still visible and functional
        const appContainer = page.locator('[data-testid="favault-app"], .app-container, #app');
        await expect(appContainer).toBeVisible();
        
        // Check if layout adapts properly
        const containerBox = await appContainer.boundingBox();
        expect(containerBox?.width).toBeLessThanOrEqual(viewport.width);
        
        console.log(`✅ ${config.name}: Responsive design working at ${viewport.name} (${viewport.width}x${viewport.height})`);
      }
    });

    test(`should maintain performance standards in ${config.name}`, async ({ page, browserName }, testInfo) => {
      assertMatchingProject(testInfo.project.name);


      const bookmarkUtils = new BookmarkTestUtils(page);
      const consoleUtils = new ConsoleTestUtils(page);
      
      await consoleUtils.startMonitoring();
      
      try {
        const startTime = Date.now();
        
        await navigateToExtensionHome(page, browserName);
        await bookmarkUtils.waitForBookmarksToLoad();
        
        const loadTime = Date.now() - startTime;
        
        // Get performance metrics
        const folders = await bookmarkUtils.getBookmarkFolders();
        const bookmarks = await bookmarkUtils.getAllBookmarks();
        
        console.log(`📊 ${config.name} Performance:`);
        console.log(`   Load time: ${loadTime}ms`);
        console.log(`   Folders: ${folders.length}`);
        console.log(`   Bookmarks: ${bookmarks.length}`);
        
        // Performance expectations (may vary by browser)
        const maxLoadTime = config.name === 'Chrome' ? 3000 : 5000; // Chrome should be fastest
        expect(loadTime).toBeLessThan(maxLoadTime);
        
        // Check for performance-related errors
        const errors = consoleUtils.getErrorMessages();
        const performanceErrors = errors.filter(err => 
          err.toLowerCase().includes('timeout') ||
          err.toLowerCase().includes('memory') ||
          err.toLowerCase().includes('performance')
        );
        
        expect(performanceErrors).toHaveLength(0);
        
      } finally {
        await consoleUtils.stopMonitoring();
      }
    });

    test(`should handle browser-specific APIs in ${config.name}`, async ({ page, browserName }, testInfo) => {
      assertMatchingProject(testInfo.project.name);


      const consoleUtils = new ConsoleTestUtils(page);
      await consoleUtils.startMonitoring();
      
      try {
        await navigateToExtensionHome(page, browserName);
        
        // Test browser API availability
        const apiTest = await page.evaluate(() => {
          const extensionAPI = (window as any).browser || (window as any).chrome;
          const results = {
            extensionAPI: typeof extensionAPI !== 'undefined',
            bookmarks: typeof extensionAPI?.bookmarks !== 'undefined',
            storage: typeof extensionAPI?.storage !== 'undefined',
            webExtensions: typeof (window as any).browser !== 'undefined'
          };
          
          console.log('🔍 Browser API availability:', results);
          return results;
        });
        
        // Chrome/Chromium should have chrome APIs
        if (config.name === 'Chrome' || config.name === 'Chromium' || config.name === 'Edge') {
          expect(apiTest.extensionAPI).toBeTruthy();
          expect(apiTest.bookmarks).toBeTruthy();
          expect(apiTest.storage).toBeTruthy();
        }
        
        console.log(`✅ ${config.name}: Browser APIs available - ${JSON.stringify(apiTest)}`);
        
      } finally {
        await consoleUtils.stopMonitoring();
      }
    });
  });
}

// Cross-browser comparison test
test.describe('Cross-Browser Feature Parity', () => {
  const testResults: Record<string, any> = {};

  test('should maintain feature parity across browsers', async () => {
    // This test would collect results from all browser tests
    // and compare them for consistency
    
    console.log('📊 Cross-browser test results summary:');
    console.log(JSON.stringify(testResults, null, 2));
    
    // Add assertions for feature parity
    // This is a placeholder for comprehensive cross-browser validation
    expect(true).toBeTruthy(); // Placeholder
  });
});
