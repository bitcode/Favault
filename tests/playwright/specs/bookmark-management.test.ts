import { test, expect } from '../fixtures/extension';
import { BookmarkTestUtils } from '../utils/bookmark-utils';
import { ConsoleTestUtils } from '../utils/console-utils';

/**
 * Comprehensive bookmark management tests for FaVault extension
 * Tests bookmark loading, folder organization, search functionality, and CRUD operations
 */

test.describe('Bookmark Management', () => {
  let bookmarkUtils: BookmarkTestUtils;
  let consoleUtils: ConsoleTestUtils;

  test.beforeEach(async ({ newTabPage }) => {
    bookmarkUtils = new BookmarkTestUtils(newTabPage);
    consoleUtils = new ConsoleTestUtils(newTabPage);
    
    // Start monitoring console and network activity
    await consoleUtils.startMonitoring();
    await consoleUtils.monitorExtensionAPICalls();
    
    // Wait for extension to be fully loaded
    await bookmarkUtils.waitForBookmarksToLoad();
  });

  test.afterEach(async () => {
    // Generate test report
    const report = consoleUtils.generateTestReport();
    console.log('📊 Test Report:', JSON.stringify(report, null, 2));
    
    // Stop monitoring
    await consoleUtils.stopMonitoring();
  });

  test('should load and display bookmark folders', async ({ newTabPage }) => {
    // Verify extension is loaded
    await expect(newTabPage.locator('[data-testid="favault-app"], .app-container, #app')).toBeVisible();
    
    // Wait for bookmarks to load
    await bookmarkUtils.waitForBookmarksToLoad();
    
    // Get bookmark folders
    const folders = await bookmarkUtils.getBookmarkFolders();
    
    // Should have at least one folder or show empty state
    if (folders.length === 0) {
      await expect(newTabPage.locator('.empty-state, .no-bookmarks')).toBeVisible();
    } else {
      expect(folders.length).toBeGreaterThan(0);
      
      // Verify each folder has a title
      for (const folder of folders) {
        const titleElement = folder.locator('.folder-title, h3, .folder-name, [data-testid="folder-title"]');
        await expect(titleElement).toBeVisible();
        
        const title = await titleElement.textContent();
        expect(title?.trim()).toBeTruthy();
      }
    }
    
    // Check for console errors (excluding favicon errors)
    const criticalErrors = consoleUtils.getNonFaviconErrorMessages();
    const faviconErrorCount = consoleUtils.getFaviconErrorCount();
    
    console.log(`📊 Found ${faviconErrorCount} favicon errors (filtered out) and ${criticalErrors.length} critical errors`);
    expect(criticalErrors.filter(err => !err.includes('net::ERR'))).toHaveLength(0);
  });

  test('should display bookmarks within folders', async ({ newTabPage }) => {
    await bookmarkUtils.waitForBookmarksToLoad();
    
    const folders = await bookmarkUtils.getBookmarkFolders();
    
    if (folders.length > 0) {
      // Test first folder
      const firstFolder = folders[0];
      const bookmarks = await bookmarkUtils.getBookmarksInFolder(firstFolder);
      
      if (bookmarks.length > 0) {
        // Verify each bookmark has required elements
        for (const bookmark of bookmarks) {
          // Should have title
          const titleElement = bookmark.locator('.bookmark-title, .bookmark-name, [data-testid="bookmark-title"]');
          await expect(titleElement).toBeVisible();
          
          // Should have URL (href attribute)
          const url = await bookmarkUtils.getBookmarkUrl(bookmark);
          expect(url).toBeTruthy();
          expect(url).toMatch(/^https?:\/\//);
          
          // Should have favicon or placeholder
          const favicon = bookmark.locator('img, .favicon, .bookmark-icon');
          await expect(favicon).toBeVisible();
        }
      }
    }
  });

  test('should handle bookmark search functionality', async ({ newTabPage }) => {
    await bookmarkUtils.waitForBookmarksToLoad();
    
    // Get initial state
    const initialFolders = await bookmarkUtils.getFolderTitles();
    const initialBookmarks = await bookmarkUtils.getAllBookmarks();
    
    if (initialBookmarks.length === 0) {
      test.skip('No bookmarks available for search testing');
    }
    
    // Test search with a common term
    await bookmarkUtils.searchBookmarks('github');
    await newTabPage.waitForTimeout(1000);
    
    // Verify search results
    const searchResults = await bookmarkUtils.getAllBookmarks();
    
    // Should show only matching bookmarks or empty state
    if (searchResults.length > 0) {
      // Verify results contain search term
      for (const bookmark of searchResults) {
        const titleElement = bookmark.locator('.bookmark-title, .bookmark-name, [data-testid="bookmark-title"]');
        const title = await titleElement.textContent();
        const url = await bookmarkUtils.getBookmarkUrl(bookmark);
        
        const containsSearchTerm = 
          title?.toLowerCase().includes('github') || 
          url?.toLowerCase().includes('github');
        
        expect(containsSearchTerm).toBeTruthy();
      }
    }
    
    // Clear search
    await bookmarkUtils.clearSearch();
    await newTabPage.waitForTimeout(1000);
    
    // Should show all bookmarks again
    const clearedResults = await bookmarkUtils.getAllBookmarks();
    expect(clearedResults.length).toBeGreaterThanOrEqual(searchResults.length);
  });

  test('should support keyboard shortcuts', async ({ newTabPage }) => {
    await bookmarkUtils.waitForBookmarksToLoad();
    
    // Test search shortcut (Ctrl+Shift+F for Chrome, Ctrl+F for others)
    // Chrome uses Ctrl+Shift+F to avoid conflict with browser search
    await newTabPage.keyboard.press('Control+Shift+F');
    await newTabPage.waitForTimeout(1000); // Increased timeout for focus
    
    // Should focus search input
    const focusedElement = await newTabPage.locator(':focus').first();
    const tagName = await focusedElement.evaluate(el => el.tagName.toLowerCase());
    expect(tagName).toBe('input');
    
    // Test edit mode shortcut (Ctrl+E)
    await newTabPage.keyboard.press('Escape'); // Clear search focus
    await newTabPage.keyboard.press('Control+E');
    await newTabPage.waitForTimeout(1000); // Increased timeout for edit mode activation

    // Should enable edit mode (check for correct selectors)
    const editModeActive = await newTabPage.locator('.app.edit-mode, body.edit-mode').count() > 0;
    expect(editModeActive).toBeTruthy();
  });

  test('should handle folder color themes', async ({ newTabPage }) => {
    await bookmarkUtils.waitForBookmarksToLoad();
    
    const folders = await bookmarkUtils.getBookmarkFolders();
    
    if (folders.length > 0) {
      // Each folder should have a color theme
      for (const folder of folders) {
        const color = await bookmarkUtils.getFolderColor(folder);
        
        // Should have some color styling
        expect(color).toBeTruthy();
        
        // Verify folder has visual styling
        const hasColorClass = await folder.locator('[class*="color"], [style*="background"], [style*="border"]').count() > 0;
        expect(hasColorClass).toBeTruthy();
      }
    }
  });

  test('should handle empty bookmark state gracefully', async ({ newTabPage }) => {
    // Inject script to simulate empty bookmarks
    await consoleUtils.injectTestScript(`
      // Mock empty bookmark tree
      if (typeof chrome !== 'undefined' && chrome.bookmarks) {
        const originalGetTree = chrome.bookmarks.getTree;
        chrome.bookmarks.getTree = function() {
          return Promise.resolve([{
            id: '0',
            title: '',
            children: [{
              id: '1',
              title: 'Bookmarks Bar',
              children: []
            }]
          }]);
        };
        
        // Trigger bookmark refresh
        if (window.location.reload) {
          window.location.reload();
        }
      }
    `);
    
    await newTabPage.waitForTimeout(2000);
    
    // Should show empty state
    const emptyState = newTabPage.locator('.empty-state, .no-bookmarks, [data-testid="empty-state"]');
    await expect(emptyState).toBeVisible();
    
    // Should have helpful message
    const emptyMessage = await emptyState.textContent();
    expect(emptyMessage?.toLowerCase()).toContain('bookmark');
  });

  test('should validate bookmark URLs', async ({ newTabPage }) => {
    await bookmarkUtils.waitForBookmarksToLoad();
    
    const bookmarks = await bookmarkUtils.getAllBookmarks();
    
    if (bookmarks.length > 0) {
      // Test first few bookmarks
      const testBookmarks = bookmarks.slice(0, Math.min(5, bookmarks.length));
      
      for (const bookmark of testBookmarks) {
        const url = await bookmarkUtils.getBookmarkUrl(bookmark);
        
        if (url) {
          // Should be valid URL format
          expect(url).toMatch(/^https?:\/\/.+/);
          
          // Should not contain obvious malicious patterns
          expect(url.toLowerCase()).not.toContain('javascript:');
          expect(url.toLowerCase()).not.toContain('data:text/html');
        }
      }
    }
  });

  test('should handle bookmark click navigation', async ({ newTabPage, context }) => {
    await bookmarkUtils.waitForBookmarksToLoad();
    
    const bookmarks = await bookmarkUtils.getAllBookmarks();
    
    if (bookmarks.length > 0) {
      const firstBookmark = bookmarks[0];
      const url = await bookmarkUtils.getBookmarkUrl(firstBookmark);
      
      if (url && url.startsWith('http')) {
        // Listen for new page creation
        const pagePromise = context.waitForEvent('page');
        
        // Click bookmark
        await firstBookmark.click();
        
        // Should open new page
        const newPage = await pagePromise;
        await newPage.waitForLoadState('networkidle');
        
        // Verify navigation
        expect(newPage.url()).toContain(new URL(url).hostname);
        
        await newPage.close();
      }
    }
  });

  test('should maintain bookmark state across page reloads', async ({ newTabPage }) => {
    await bookmarkUtils.waitForBookmarksToLoad();
    
    // Get initial state
    const initialFolders = await bookmarkUtils.getFolderTitles();
    const initialBookmarkCount = (await bookmarkUtils.getAllBookmarks()).length;
    
    // Reload page
    await newTabPage.reload();
    await bookmarkUtils.waitForBookmarksToLoad();
    
    // Verify state is maintained
    const reloadedFolders = await bookmarkUtils.getFolderTitles();
    const reloadedBookmarkCount = (await bookmarkUtils.getAllBookmarks()).length;
    
    expect(reloadedFolders).toEqual(initialFolders);
    expect(reloadedBookmarkCount).toBe(initialBookmarkCount);
  });

  test('should handle large bookmark collections efficiently', async ({ newTabPage }) => {
    await bookmarkUtils.waitForBookmarksToLoad();
    
    const startTime = Date.now();
    
    // Get all bookmarks and folders
    const folders = await bookmarkUtils.getBookmarkFolders();
    const bookmarks = await bookmarkUtils.getAllBookmarks();
    
    const loadTime = Date.now() - startTime;
    
    // Should load within reasonable time (5 seconds)
    expect(loadTime).toBeLessThan(5000);
    
    // Should handle large collections without critical errors
    const criticalErrors = consoleUtils.getNonFaviconErrorMessages();
    const faviconErrorCount = consoleUtils.getFaviconErrorCount();
    const relevantErrors = criticalErrors.filter(err => 
      !err.includes('net::ERR') &&
      !err.includes('chrome-extension://')
    );
    
    console.log(`📊 Performance test: ${faviconErrorCount} favicon errors filtered, ${relevantErrors.length} critical errors found`);
    expect(relevantErrors).toHaveLength(0);
    
    console.log(`📊 Performance: Loaded ${folders.length} folders and ${bookmarks.length} bookmarks in ${loadTime}ms`);
  });
});
