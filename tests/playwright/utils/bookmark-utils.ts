import { Page, Locator, BrowserContext } from '@playwright/test';
import { TestDataSetup } from './test-data-setup';

/**
 * Bookmark testing utilities for FaVault extension
 * Provides methods to interact with bookmarks, folders, and search functionality
 */
export class BookmarkTestUtils {
  constructor(private page: Page, private context?: BrowserContext) {}

  /**
   * Set up test bookmarks for drag and drop testing
   */
  async setupTestBookmarks(): Promise<void> {
    console.log('📚 Setting up test bookmarks...');

    if (!this.context) {
      console.log('⚠️ No browser context provided, skipping bookmark setup');
      return;
    }

    try {
      const testDataSetup = new TestDataSetup(this.page, this.context);

      // Initialize with drag-drop focused configuration
      await testDataSetup.initialize({
        folderCount: 5,
        bookmarksPerFolder: 2,
        includeDragTestFolders: true,
        includeEdgeCases: true,
        includeEmptyFolders: false // Skip empty folders for position testing
      });

      // Generate test data
      await testDataSetup.generateTestData();

      // Wait for bookmarks to sync
      await testDataSetup.waitForBookmarkSync();

      console.log('✅ Test bookmarks setup completed');

    } catch (error) {
      console.log('⚠️ Test bookmark setup failed, continuing with existing bookmarks:', error.message);
      // Don't fail the test if bookmark setup fails - use existing bookmarks
    }
  }

  /**
   * Get all bookmark folders on the page
   */
  async getBookmarkFolders(): Promise<Locator[]> {
    const folders = await this.page.locator('.folder-container, [data-testid="bookmark-folder"]').all();
    return folders;
  }

  /**
   * Get a specific bookmark folder by title
   */
  async getBookmarkFolderByTitle(title: string): Promise<Locator | null> {
    const folder = this.page.locator('.folder-container, [data-testid="bookmark-folder"]')
      .filter({ hasText: title });
    
    if (await folder.count() > 0) {
      return folder.first();
    }
    return null;
  }

  /**
   * Get all bookmarks within a folder
   */
  async getBookmarksInFolder(folderLocator: Locator): Promise<Locator[]> {
    const bookmarks = await folderLocator.locator('.bookmark-item, [data-testid="bookmark-item"]').all();
    return bookmarks;
  }

  /**
   * Get all bookmarks on the page
   */
  async getAllBookmarks(): Promise<Locator[]> {
    const bookmarks = await this.page.locator('.bookmark-item, [data-testid="bookmark-item"]').all();
    return bookmarks;
  }

  /**
   * Search for bookmarks using the search bar
   */
  async searchBookmarks(query: string): Promise<void> {
    // Try to find search input
    const searchInput = this.page.locator('input[type="search"], input[placeholder*="search"], .search-input').first();
    
    if (await searchInput.isVisible()) {
      await searchInput.fill(query);
      await searchInput.press('Enter');
    } else {
      // Try keyboard shortcut
      await this.page.keyboard.press('Control+F');
      await this.page.waitForTimeout(500);
      
      const activeInput = this.page.locator('input:focus').first();
      if (await activeInput.isVisible()) {
        await activeInput.fill(query);
        await activeInput.press('Enter');
      }
    }
    
    // Wait for search results to update
    await this.page.waitForTimeout(1000);
  }

  /**
   * Clear search and show all bookmarks
   */
  async clearSearch(): Promise<void> {
    const searchInput = this.page.locator('input[type="search"], input[placeholder*="search"], .search-input').first();
    
    if (await searchInput.isVisible()) {
      await searchInput.clear();
      await searchInput.press('Escape');
    }
    
    // Wait for results to update
    await this.page.waitForTimeout(1000);
  }

  /**
   * Get bookmark folder titles in order
   */
  async getFolderTitles(): Promise<string[]> {
    const folders = await this.getBookmarkFolders();
    const titles: string[] = [];
    
    for (const folder of folders) {
      const titleElement = folder.locator('.folder-title, h3, .folder-name, [data-testid="folder-title"]').first();
      const title = await titleElement.textContent();
      if (title) {
        titles.push(title.trim());
      }
    }
    
    return titles;
  }

  /**
   * Get bookmark titles within a folder
   */
  async getBookmarkTitlesInFolder(folderLocator: Locator): Promise<string[]> {
    const bookmarks = await this.getBookmarksInFolder(folderLocator);
    const titles: string[] = [];
    
    for (const bookmark of bookmarks) {
      const titleElement = bookmark.locator('.bookmark-title, .bookmark-name, [data-testid="bookmark-title"]').first();
      const title = await titleElement.textContent();
      if (title) {
        titles.push(title.trim());
      }
    }
    
    return titles;
  }

  /**
   * Verify bookmark folder exists
   */
  async verifyFolderExists(title: string): Promise<boolean> {
    const folder = await this.getBookmarkFolderByTitle(title);
    return folder !== null;
  }

  /**
   * Verify bookmark exists in folder
   */
  async verifyBookmarkInFolder(folderTitle: string, bookmarkTitle: string): Promise<boolean> {
    const folder = await this.getBookmarkFolderByTitle(folderTitle);
    if (!folder) return false;
    
    const bookmarkTitles = await this.getBookmarkTitlesInFolder(folder);
    return bookmarkTitles.includes(bookmarkTitle);
  }

  /**
   * Get folder color/theme
   */
  async getFolderColor(folderLocator: Locator): Promise<string | null> {
    // Try to get computed style or data attribute for color
    const colorAttr = await folderLocator.getAttribute('data-color');
    if (colorAttr) return colorAttr;
    
    const style = await folderLocator.getAttribute('style');
    if (style && style.includes('background')) {
      return style;
    }
    
    return null;
  }

  /**
   * Wait for bookmarks to load
   */
  async waitForBookmarksToLoad(timeout = 10000): Promise<void> {
    // Wait for loading indicators to disappear
    await this.page.waitForFunction(() => {
      const loadingElements = document.querySelectorAll('.loading, [data-loading="true"], .spinner');
      return loadingElements.length === 0;
    }, { timeout });
    
    // Wait for at least one folder or bookmark to appear, or empty state
    await this.page.waitForFunction(() => {
      const folders = document.querySelectorAll('.folder-container, [data-testid="bookmark-folder"]');
      const bookmarks = document.querySelectorAll('.bookmark-item, [data-testid="bookmark-item"]');
      const emptyState = document.querySelectorAll('.empty-state, .no-bookmarks');
      
      return folders.length > 0 || bookmarks.length > 0 || emptyState.length > 0;
    }, { timeout });
  }

  /**
   * Check if folder is protected (cannot be moved/deleted)
   */
  async isFolderProtected(folderLocator: Locator): Promise<boolean> {
    // Check for protected indicators
    const protectedIcon = folderLocator.locator('🔒, .protected-icon, [data-protected="true"]');
    return await protectedIcon.count() > 0;
  }

  /**
   * Get folder position/index
   */
  async getFolderIndex(folderTitle: string): Promise<number> {
    const titles = await this.getFolderTitles();
    return titles.indexOf(folderTitle);
  }

  /**
   * Verify folder order
   */
  async verifyFolderOrder(expectedOrder: string[]): Promise<boolean> {
    const actualOrder = await this.getFolderTitles();
    
    if (actualOrder.length !== expectedOrder.length) {
      return false;
    }
    
    for (let i = 0; i < expectedOrder.length; i++) {
      if (actualOrder[i] !== expectedOrder[i]) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Click on a bookmark to open it
   */
  async clickBookmark(bookmarkTitle: string): Promise<void> {
    const bookmark = this.page.locator('.bookmark-item, [data-testid="bookmark-item"]')
      .filter({ hasText: bookmarkTitle });
    
    await bookmark.first().click();
  }

  /**
   * Right-click on bookmark for context menu
   */
  async rightClickBookmark(bookmarkTitle: string): Promise<void> {
    const bookmark = this.page.locator('.bookmark-item, [data-testid="bookmark-item"]')
      .filter({ hasText: bookmarkTitle });
    
    await bookmark.first().click({ button: 'right' });
  }

  /**
   * Get bookmark URL
   */
  async getBookmarkUrl(bookmarkLocator: Locator): Promise<string | null> {
    const href = await bookmarkLocator.getAttribute('href');
    if (href) return href;
    
    const linkElement = bookmarkLocator.locator('a').first();
    return await linkElement.getAttribute('href');
  }
}
