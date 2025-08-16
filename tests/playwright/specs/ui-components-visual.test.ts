import { test, expect } from '../fixtures/extension';
import { BookmarkTestUtils } from '../utils/bookmark-utils';
import { ConsoleTestUtils } from '../utils/console-utils';
import { ExtensionTestUtils } from '../fixtures/extension';

/**
 * UI Component and Visual Testing for FaVault extension
 * Tests Svelte components, visual regression, responsive design, and theme functionality
 */

test.describe('UI Components and Visual Testing', () => {
  let bookmarkUtils: BookmarkTestUtils;
  let consoleUtils: ConsoleTestUtils;

  test.beforeEach(async ({ newTabPage }) => {
    bookmarkUtils = new BookmarkTestUtils(newTabPage);
    consoleUtils = new ConsoleTestUtils(newTabPage);
    
    await consoleUtils.startMonitoring();
    await bookmarkUtils.waitForBookmarksToLoad();
  });

  test.afterEach(async () => {
    await consoleUtils.stopMonitoring();
  });

  test('should render main app container correctly', async ({ newTabPage }) => {
    // Verify main app structure
    const appContainer = newTabPage.locator('[data-testid="favault-app"], .app-container, #app');
    await expect(appContainer).toBeVisible();
    
    // Take screenshot for visual regression
    await expect(appContainer).toHaveScreenshot('main-app-container.png');
    
    // Verify app has proper styling
    const containerStyles = await appContainer.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        display: styles.display,
        position: styles.position,
        width: styles.width,
        height: styles.height
      };
    });
    
    expect(containerStyles.display).not.toBe('none');
    console.log('📱 App container styles:', containerStyles);
  });

  test('should render search bar component correctly', async ({ newTabPage }) => {
    // Find search bar component
    const searchBar = newTabPage.locator('input[type="search"], input[placeholder*="search"], .search-input, [data-testid="search-bar"]').first();
    
    if (await searchBar.isVisible()) {
      await expect(searchBar).toBeVisible();
      
      // Test search bar styling
      const searchStyles = await searchBar.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          borderRadius: styles.borderRadius,
          padding: styles.padding,
          fontSize: styles.fontSize,
          backgroundColor: styles.backgroundColor
        };
      });
      
      console.log('🔍 Search bar styles:', searchStyles);
      
      // Test search bar functionality
      await searchBar.fill('test search');
      await expect(searchBar).toHaveValue('test search');
      
      await searchBar.clear();
      await expect(searchBar).toHaveValue('');
      
      // Visual regression test
      await expect(searchBar).toHaveScreenshot('search-bar-component.png');
    }
  });

  test('should render bookmark folders with proper styling', async ({ newTabPage }) => {
    const folders = await bookmarkUtils.getBookmarkFolders();
    
    if (folders.length > 0) {
      // Test first folder styling
      const firstFolder = folders[0];
      await expect(firstFolder).toBeVisible();
      
      // Check folder structure
      const folderTitle = firstFolder.locator('.folder-title, h3, .folder-name, [data-testid="folder-title"]');
      await expect(folderTitle).toBeVisible();
      
      // Test folder styling
      const folderStyles = await firstFolder.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          borderRadius: styles.borderRadius,
          padding: styles.padding,
          margin: styles.margin,
          backgroundColor: styles.backgroundColor,
          boxShadow: styles.boxShadow
        };
      });
      
      console.log('📁 Folder styles:', folderStyles);
      
      // Visual regression test for folder
      await expect(firstFolder).toHaveScreenshot('bookmark-folder-component.png');
      
      // Test folder color themes
      const folderColor = await bookmarkUtils.getFolderColor(firstFolder);
      expect(folderColor).toBeTruthy();
    }
  });

  test('should render bookmark items with proper styling', async ({ newTabPage }) => {
    const bookmarks = await bookmarkUtils.getAllBookmarks();
    
    if (bookmarks.length > 0) {
      const firstBookmark = bookmarks[0];
      await expect(firstBookmark).toBeVisible();
      
      // Check bookmark structure
      const bookmarkTitle = firstBookmark.locator('.bookmark-title, .bookmark-name, [data-testid="bookmark-title"]');
      const bookmarkIcon = firstBookmark.locator('img, .favicon, .bookmark-icon');
      
      await expect(bookmarkTitle).toBeVisible();
      await expect(bookmarkIcon).toBeVisible();
      
      // Test bookmark styling
      const bookmarkStyles = await firstBookmark.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          display: styles.display,
          alignItems: styles.alignItems,
          padding: styles.padding,
          borderRadius: styles.borderRadius,
          cursor: styles.cursor
        };
      });
      
      console.log('🔖 Bookmark styles:', bookmarkStyles);
      expect(bookmarkStyles.cursor).toBe('pointer');
      
      // Visual regression test for bookmark
      await expect(firstBookmark).toHaveScreenshot('bookmark-item-component.png');
    }
  });

  test('should handle edit mode toggle UI correctly', async ({ newTabPage }) => {
    // Find edit mode toggle
    const editToggle = newTabPage.locator('[data-testid="edit-toggle"], .edit-mode-toggle, button:has-text("Edit")').first();
    
    if (await editToggle.isVisible()) {
      // Test toggle button styling
      const toggleStyles = await editToggle.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          backgroundColor: styles.backgroundColor,
          border: styles.border,
          borderRadius: styles.borderRadius,
          cursor: styles.cursor
        };
      });
      
      console.log('🔧 Edit toggle styles:', toggleStyles);
      
      // Test toggle functionality
      await editToggle.click();
      await newTabPage.waitForTimeout(500);
      
      // Verify edit mode is active
      const editModeActive = await newTabPage.locator('[data-edit-mode="true"], .edit-mode-active, .edit-mode').count() > 0;
      expect(editModeActive).toBeTruthy();
      
      // Visual regression test for edit mode
      await expect(newTabPage.locator('[data-testid="favault-app"], .app-container, #app')).toHaveScreenshot('edit-mode-active.png');
      
      // Toggle back
      await editToggle.click();
      await newTabPage.waitForTimeout(500);
    } else {
      // Try keyboard shortcut
      await ExtensionTestUtils.enableEditMode(newTabPage);
      
      const editModeActive = await newTabPage.locator('[data-edit-mode="true"], .edit-mode-active, .edit-mode').count() > 0;
      expect(editModeActive).toBeTruthy();
    }
  });

  test('should handle responsive design correctly', async ({ newTabPage }) => {
    const viewports = [
      { width: 1920, height: 1080, name: 'Desktop Large' },
      { width: 1366, height: 768, name: 'Desktop Medium' },
      { width: 1024, height: 768, name: 'Desktop Small' },
      { width: 768, height: 1024, name: 'Tablet Portrait' },
      { width: 1024, height: 768, name: 'Tablet Landscape' },
      { width: 375, height: 667, name: 'Mobile Portrait' },
      { width: 667, height: 375, name: 'Mobile Landscape' }
    ];
    
    for (const viewport of viewports) {
      await newTabPage.setViewportSize({ width: viewport.width, height: viewport.height });
      await newTabPage.waitForTimeout(500);
      
      // Verify app is still visible and functional
      const appContainer = newTabPage.locator('[data-testid="favault-app"], .app-container, #app');
      await expect(appContainer).toBeVisible();
      
      // Check container adapts to viewport
      const containerBox = await appContainer.boundingBox();
      expect(containerBox?.width).toBeLessThanOrEqual(viewport.width);
      
      // Take screenshot for visual regression
      await expect(appContainer).toHaveScreenshot(`responsive-${viewport.name.toLowerCase().replace(/\s+/g, '-')}.png`);
      
      // Test that folders are still accessible
      const folders = await bookmarkUtils.getBookmarkFolders();
      if (folders.length > 0) {
        await expect(folders[0]).toBeVisible();
      }
      
      console.log(`📱 Responsive test passed for ${viewport.name} (${viewport.width}x${viewport.height})`);
    }
  });

  test('should handle dark/light theme switching', async ({ newTabPage }) => {
    // Test theme detection and switching
    const themeTest = await newTabPage.evaluate(() => {
      // Check for theme-related classes or attributes
      const body = document.body;
      const html = document.documentElement;
      
      return {
        bodyClasses: body.className,
        htmlClasses: html.className,
        bodyDataTheme: body.getAttribute('data-theme'),
        htmlDataTheme: html.getAttribute('data-theme'),
        prefersDark: window.matchMedia('(prefers-color-scheme: dark)').matches
      };
    });
    
    console.log('🎨 Theme information:', themeTest);
    
    // Test theme switching if available
    const themeToggle = newTabPage.locator('[data-testid="theme-toggle"], .theme-toggle, button:has-text("theme")').first();
    
    if (await themeToggle.isVisible()) {
      // Take screenshot of current theme
      await expect(newTabPage.locator('[data-testid="favault-app"], .app-container, #app')).toHaveScreenshot('theme-initial.png');
      
      // Toggle theme
      await themeToggle.click();
      await newTabPage.waitForTimeout(500);
      
      // Take screenshot of switched theme
      await expect(newTabPage.locator('[data-testid="favault-app"], .app-container, #app')).toHaveScreenshot('theme-switched.png');
      
      console.log('🎨 Theme switching tested');
    } else {
      console.log('🎨 No theme toggle found, testing system theme detection');
      
      // Test system theme detection
      const systemTheme = await newTabPage.evaluate(() => {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      });
      
      console.log(`🎨 System theme detected: ${systemTheme}`);
    }
  });

  test('should handle settings panel UI', async ({ newTabPage }) => {
    // Look for settings panel or button
    const settingsButton = newTabPage.locator('[data-testid="settings"], .settings-button, button:has-text("settings")').first();
    const settingsPanel = newTabPage.locator('[data-testid="settings-panel"], .settings-panel').first();
    
    if (await settingsButton.isVisible()) {
      // Test settings button
      await settingsButton.click();
      await newTabPage.waitForTimeout(500);
      
      // Check if settings panel opens
      if (await settingsPanel.isVisible()) {
        await expect(settingsPanel).toBeVisible();
        
        // Test settings panel styling
        const panelStyles = await settingsPanel.evaluate(el => {
          const styles = window.getComputedStyle(el);
          return {
            position: styles.position,
            zIndex: styles.zIndex,
            backgroundColor: styles.backgroundColor,
            borderRadius: styles.borderRadius
          };
        });
        
        console.log('⚙️ Settings panel styles:', panelStyles);
        
        // Visual regression test
        await expect(settingsPanel).toHaveScreenshot('settings-panel.png');
        
        // Close settings panel
        await settingsButton.click();
        await newTabPage.waitForTimeout(500);
      }
    }
  });

  test('should handle loading states correctly', async ({ newTabPage }) => {
    // Test loading indicators
    const loadingElements = newTabPage.locator('.loading, [data-loading="true"], .spinner, .skeleton');
    
    // Reload page to catch loading state
    await newTabPage.reload();
    
    // Check for loading indicators during initial load
    const hasLoadingState = await loadingElements.count() > 0;
    
    if (hasLoadingState) {
      console.log('⏳ Loading state detected');
      
      // Wait for loading to complete
      await newTabPage.waitForFunction(() => {
        const loadingElements = document.querySelectorAll('.loading, [data-loading="true"], .spinner, .skeleton');
        return loadingElements.length === 0;
      }, { timeout: 10000 });
    }
    
    // Verify final loaded state
    await bookmarkUtils.waitForBookmarksToLoad();
    const appContainer = newTabPage.locator('[data-testid="favault-app"], .app-container, #app');
    await expect(appContainer).toBeVisible();
  });

  test('should handle error states gracefully', async ({ newTabPage }) => {
    // Inject script to simulate error state
    await consoleUtils.injectTestScript(`
      // Simulate bookmark loading error
      if (typeof chrome !== 'undefined' && chrome.bookmarks) {
        const originalGetTree = chrome.bookmarks.getTree;
        chrome.bookmarks.getTree = function() {
          return Promise.reject(new Error('Simulated bookmark loading error'));
        };
        
        // Trigger error
        if (window.location.reload) {
          window.location.reload();
        }
      }
    `);
    
    await newTabPage.waitForTimeout(3000);
    
    // Check for error state UI
    const errorElements = newTabPage.locator('.error, [data-error="true"], .error-message, .error-state');
    
    if (await errorElements.count() > 0) {
      const errorElement = errorElements.first();
      await expect(errorElement).toBeVisible();
      
      // Visual regression test for error state
      await expect(errorElement).toHaveScreenshot('error-state.png');
      
      console.log('❌ Error state UI tested');
    } else {
      console.log('ℹ️ No error state UI found (may be handled silently)');
    }
  });

  test('should maintain visual consistency across components', async ({ newTabPage }) => {
    // Take full page screenshot for overall visual regression
    await expect(newTabPage).toHaveScreenshot('full-page-visual-regression.png', {
      fullPage: true,
      animations: 'disabled'
    });
    
    // Test component spacing and alignment
    const folders = await bookmarkUtils.getBookmarkFolders();
    
    if (folders.length >= 2) {
      // Check consistent spacing between folders
      const folder1Box = await folders[0].boundingBox();
      const folder2Box = await folders[1].boundingBox();
      
      if (folder1Box && folder2Box) {
        const spacing = folder2Box.y - (folder1Box.y + folder1Box.height);
        console.log(`📏 Folder spacing: ${spacing}px`);
        
        // Spacing should be consistent (positive and reasonable)
        expect(spacing).toBeGreaterThan(0);
        expect(spacing).toBeLessThan(100); // Reasonable maximum
      }
    }
    
    console.log('✅ Visual consistency tests completed');
  });
});
