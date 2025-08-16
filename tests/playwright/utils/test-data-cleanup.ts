import { Page, BrowserContext } from '@playwright/test';
import { TestDataSetup, TestDataState, TestBookmarkItem } from './test-data-setup';

/**
 * Comprehensive test data cleanup and reset utility
 * Ensures test isolation and prevents interference between test runs
 */

export interface CleanupConfig {
  // Cleanup scope
  removeTestBookmarks?: boolean;
  removeTestFolders?: boolean;
  restoreOriginalState?: boolean;
  
  // Safety options
  preserveUserBookmarks?: boolean;
  dryRun?: boolean;
  backupBeforeCleanup?: boolean;
  
  // Performance options
  batchSize?: number;
  delayBetweenOperations?: number;
  maxRetries?: number;
}

export interface CleanupResult {
  success: boolean;
  itemsRemoved: number;
  foldersRemoved: number;
  errors: string[];
  warnings: string[];
  duration: number;
  backupCreated?: boolean;
}

export interface TestIsolationManager {
  beforeTestSetup(): Promise<void>;
  afterTestCleanup(): Promise<CleanupResult>;
  emergencyReset(): Promise<void>;
}

/**
 * Main cleanup utility class
 */
export class TestDataCleanup {
  private page: Page;
  private context: BrowserContext;
  private config: CleanupConfig;

  constructor(page: Page, context: BrowserContext) {
    this.page = page;
    this.context = context;
    this.config = {
      removeTestBookmarks: true,
      removeTestFolders: true,
      restoreOriginalState: false,
      preserveUserBookmarks: true,
      dryRun: false,
      backupBeforeCleanup: true,
      batchSize: 10,
      delayBetweenOperations: 100,
      maxRetries: 3
    };
  }

  /**
   * Configure cleanup behavior
   */
  configure(config: Partial<CleanupConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('🔧 Cleanup configured:', this.config);
  }

  /**
   * Perform comprehensive cleanup of test data
   */
  async cleanup(testDataState: TestDataState): Promise<CleanupResult> {
    const startTime = Date.now();
    const result: CleanupResult = {
      success: true,
      itemsRemoved: 0,
      foldersRemoved: 0,
      errors: [],
      warnings: [],
      duration: 0
    };

    try {
      console.log('🧹 Starting test data cleanup...');

      // Create backup if requested
      if (this.config.backupBeforeCleanup) {
        result.backupCreated = await this.createCleanupBackup();
      }

      // Dry run check
      if (this.config.dryRun) {
        console.log('🔍 Dry run mode - no actual cleanup performed');
        return await this.performDryRun(testDataState, result);
      }

      // Clean up bookmarks first (children before parents)
      if (this.config.removeTestBookmarks) {
        const bookmarkResult = await this.cleanupBookmarks(testDataState.createdBookmarks);
        result.itemsRemoved += bookmarkResult.removed;
        result.errors.push(...bookmarkResult.errors);
        result.warnings.push(...bookmarkResult.warnings);
      }

      // Clean up folders (in reverse order to handle nesting)
      if (this.config.removeTestFolders) {
        const folderResult = await this.cleanupFolders(testDataState.createdFolders);
        result.foldersRemoved += folderResult.removed;
        result.errors.push(...folderResult.errors);
        result.warnings.push(...folderResult.warnings);
      }

      // Restore original state if requested
      if (this.config.restoreOriginalState && testDataState.originalBookmarks) {
        await this.restoreOriginalBookmarks(testDataState.originalBookmarks);
      }

      // Clear any remaining test artifacts
      await this.clearTestArtifacts();

      result.success = result.errors.length === 0;
      result.duration = Date.now() - startTime;

      console.log(`✅ Cleanup completed in ${result.duration}ms`);
      console.log(`📊 Removed ${result.itemsRemoved} bookmarks and ${result.foldersRemoved} folders`);

      if (result.errors.length > 0) {
        console.warn('⚠️ Cleanup completed with errors:', result.errors);
      }

      return result;

    } catch (error) {
      result.success = false;
      result.errors.push(`Cleanup failed: ${error.message}`);
      result.duration = Date.now() - startTime;
      
      console.error('❌ Cleanup failed:', error);
      return result;
    }
  }

  /**
   * Create backup before cleanup
   */
  private async createCleanupBackup(): Promise<boolean> {
    try {
      console.log('💾 Creating cleanup backup...');
      
      const backup = await this.page.evaluate(async () => {
        if (typeof chrome !== 'undefined' && chrome.bookmarks) {
          return await chrome.bookmarks.getTree();
        }
        return null;
      });

      if (backup) {
        // Store backup in session storage for potential recovery
        await this.page.evaluate((backupData) => {
          sessionStorage.setItem('favault_test_backup', JSON.stringify({
            timestamp: Date.now(),
            data: backupData
          }));
        }, backup);

        console.log('✅ Cleanup backup created');
        return true;
      }

      return false;
    } catch (error) {
      console.warn('⚠️ Failed to create cleanup backup:', error);
      return false;
    }
  }

  /**
   * Perform dry run to show what would be cleaned up
   */
  private async performDryRun(testDataState: TestDataState, result: CleanupResult): Promise<CleanupResult> {
    console.log('🔍 Dry run analysis:');
    console.log(`  - Would remove ${testDataState.createdBookmarks.length} test bookmarks`);
    console.log(`  - Would remove ${testDataState.createdFolders.length} test folders`);
    
    // Validate items still exist
    let existingBookmarks = 0;
    let existingFolders = 0;

    for (const bookmark of testDataState.createdBookmarks) {
      const exists = await this.itemExists(bookmark.id!);
      if (exists) existingBookmarks++;
    }

    for (const folder of testDataState.createdFolders) {
      const exists = await this.itemExists(folder.id!);
      if (exists) existingFolders++;
    }

    console.log(`  - ${existingBookmarks} bookmarks still exist`);
    console.log(`  - ${existingFolders} folders still exist`);

    result.itemsRemoved = existingBookmarks;
    result.foldersRemoved = existingFolders;
    result.duration = 0;

    return result;
  }

  /**
   * Clean up test bookmarks
   */
  private async cleanupBookmarks(bookmarks: TestBookmarkItem[]): Promise<{
    removed: number;
    errors: string[];
    warnings: string[];
  }> {
    const result = { removed: 0, errors: [], warnings: [] };
    
    console.log(`🔖 Cleaning up ${bookmarks.length} test bookmarks...`);

    // Process in batches to avoid overwhelming the API
    for (let i = 0; i < bookmarks.length; i += this.config.batchSize!) {
      const batch = bookmarks.slice(i, i + this.config.batchSize!);
      
      for (const bookmark of batch) {
        if (!bookmark.id) {
          result.warnings.push(`Bookmark "${bookmark.title}" has no ID, skipping`);
          continue;
        }

        // Skip if it's a user bookmark (safety check)
        if (this.config.preserveUserBookmarks && await this.isUserBookmark(bookmark)) {
          result.warnings.push(`Preserving user bookmark: "${bookmark.title}"`);
          continue;
        }

        let retries = 0;
        while (retries < this.config.maxRetries!) {
          try {
            const removed = await this.page.evaluate(async (bookmarkId) => {
              if (typeof chrome !== 'undefined' && chrome.bookmarks) {
                try {
                  await chrome.bookmarks.remove(bookmarkId);
                  return true;
                } catch (error) {
                  console.warn('Failed to remove bookmark:', bookmarkId, error);
                  return false;
                }
              }
              return false;
            }, bookmark.id);

            if (removed) {
              result.removed++;
              console.log(`  ✅ Removed bookmark: "${bookmark.title}"`);
              break;
            } else {
              throw new Error('Bookmark removal returned false');
            }

          } catch (error) {
            retries++;
            if (retries >= this.config.maxRetries!) {
              result.errors.push(`Failed to remove bookmark "${bookmark.title}": ${error.message}`);
            } else {
              console.log(`  🔄 Retrying bookmark removal (${retries}/${this.config.maxRetries}): "${bookmark.title}"`);
              await this.page.waitForTimeout(this.config.delayBetweenOperations! * retries);
            }
          }
        }
      }

      // Delay between batches
      if (i + this.config.batchSize! < bookmarks.length) {
        await this.page.waitForTimeout(this.config.delayBetweenOperations!);
      }
    }

    return result;
  }

  /**
   * Clean up test folders
   */
  private async cleanupFolders(folders: TestBookmarkItem[]): Promise<{
    removed: number;
    errors: string[];
    warnings: string[];
  }> {
    const result = { removed: 0, errors: [], warnings: [] };
    
    console.log(`📁 Cleaning up ${folders.length} test folders...`);

    // Sort folders by depth (deepest first) to handle nested structures
    const sortedFolders = [...folders].sort((a, b) => {
      const depthA = (a.parentId?.split('/').length || 0);
      const depthB = (b.parentId?.split('/').length || 0);
      return depthB - depthA;
    });

    for (const folder of sortedFolders) {
      if (!folder.id) {
        result.warnings.push(`Folder "${folder.title}" has no ID, skipping`);
        continue;
      }

      // Skip if it's a protected folder
      if (await this.isProtectedFolder(folder)) {
        result.warnings.push(`Skipping protected folder: "${folder.title}"`);
        continue;
      }

      let retries = 0;
      while (retries < this.config.maxRetries!) {
        try {
          const removed = await this.page.evaluate(async (folderId) => {
            if (typeof chrome !== 'undefined' && chrome.bookmarks) {
              try {
                // Use removeTree to remove folder and all contents
                await chrome.bookmarks.removeTree(folderId);
                return true;
              } catch (error) {
                console.warn('Failed to remove folder:', folderId, error);
                return false;
              }
            }
            return false;
          }, folder.id);

          if (removed) {
            result.removed++;
            console.log(`  ✅ Removed folder: "${folder.title}"`);
            break;
          } else {
            throw new Error('Folder removal returned false');
          }

        } catch (error) {
          retries++;
          if (retries >= this.config.maxRetries!) {
            result.errors.push(`Failed to remove folder "${folder.title}": ${error.message}`);
          } else {
            console.log(`  🔄 Retrying folder removal (${retries}/${this.config.maxRetries}): "${folder.title}"`);
            await this.page.waitForTimeout(this.config.delayBetweenOperations! * retries);
          }
        }
      }
    }

    return result;
  }

  /**
   * Check if an item still exists
   */
  private async itemExists(itemId: string): Promise<boolean> {
    try {
      return await this.page.evaluate(async (id) => {
        if (typeof chrome !== 'undefined' && chrome.bookmarks) {
          try {
            await chrome.bookmarks.get(id);
            return true;
          } catch {
            return false;
          }
        }
        return false;
      }, itemId);
    } catch {
      return false;
    }
  }

  /**
   * Check if bookmark is a user bookmark (not test data)
   */
  private async isUserBookmark(bookmark: TestBookmarkItem): Promise<boolean> {
    // Simple heuristic: test bookmarks usually have "test", "example", or specific patterns
    const testPatterns = [
      /test/i,
      /example/i,
      /mock/i,
      /drag.*drop/i,
      /reorder/i,
      /boundary/i,
      /stress/i
    ];

    return !testPatterns.some(pattern => 
      pattern.test(bookmark.title) || 
      (bookmark.url && pattern.test(bookmark.url))
    );
  }

  /**
   * Check if folder is protected (system folder)
   */
  private async isProtectedFolder(folder: TestBookmarkItem): Promise<boolean> {
    const protectedIds = ['0', '1', '2']; // Root, Bookmarks Bar, Other Bookmarks
    const protectedTitles = ['Bookmarks Bar', 'Other Bookmarks', 'Mobile Bookmarks'];
    
    return protectedIds.includes(folder.id!) || 
           protectedTitles.includes(folder.title);
  }

  /**
   * Restore original bookmarks state
   */
  private async restoreOriginalBookmarks(originalBookmarks: TestBookmarkItem[]): Promise<void> {
    console.log('🔄 Restoring original bookmark state...');
    
    // This is a complex operation that would require careful implementation
    // For now, we just log the intent
    console.log('⚠️ Original bookmark restoration not fully implemented');
    console.log('   Consider using browser bookmark sync or manual restoration');
  }

  /**
   * Clear test artifacts from page
   */
  private async clearTestArtifacts(): Promise<void> {
    await this.page.evaluate(() => {
      // Clear any test-related data from window
      delete (window as any).mockBookmarks;
      delete (window as any).mockFolders;
      delete (window as any).testDataState;
      
      // Clear test-related session storage
      const keysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.includes('test') || key?.includes('favault_test')) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => sessionStorage.removeItem(key));
    });
  }

  /**
   * Emergency reset - forceful cleanup when normal cleanup fails
   */
  async emergencyReset(): Promise<void> {
    console.log('🚨 Performing emergency reset...');
    
    try {
      // Get all bookmarks and remove anything that looks like test data
      const allBookmarks = await this.page.evaluate(async () => {
        if (typeof chrome !== 'undefined' && chrome.bookmarks) {
          return await chrome.bookmarks.getTree();
        }
        return [];
      });

      // Recursively find and remove test items
      await this.recursiveTestDataRemoval(allBookmarks);
      
      // Clear all test artifacts
      await this.clearTestArtifacts();
      
      console.log('✅ Emergency reset completed');
    } catch (error) {
      console.error('❌ Emergency reset failed:', error);
      throw error;
    }
  }

  /**
   * Recursively remove test data from bookmark tree
   */
  private async recursiveTestDataRemoval(bookmarkNodes: any[]): Promise<void> {
    for (const node of bookmarkNodes) {
      if (node.children) {
        // Process children first
        await this.recursiveTestDataRemoval(node.children);
        
        // Check if this folder looks like test data
        if (this.looksLikeTestData(node)) {
          try {
            await this.page.evaluate(async (nodeId) => {
              if (typeof chrome !== 'undefined' && chrome.bookmarks) {
                await chrome.bookmarks.removeTree(nodeId);
              }
            }, node.id);
            console.log(`🗑️ Emergency removed folder: "${node.title}"`);
          } catch (error) {
            console.warn(`⚠️ Failed to emergency remove folder "${node.title}":`, error);
          }
        }
      } else if (node.url && this.looksLikeTestData(node)) {
        // This is a bookmark that looks like test data
        try {
          await this.page.evaluate(async (nodeId) => {
            if (typeof chrome !== 'undefined' && chrome.bookmarks) {
              await chrome.bookmarks.remove(nodeId);
            }
          }, node.id);
          console.log(`🗑️ Emergency removed bookmark: "${node.title}"`);
        } catch (error) {
          console.warn(`⚠️ Failed to emergency remove bookmark "${node.title}":`, error);
        }
      }
    }
  }

  /**
   * Heuristic to identify test data
   */
  private looksLikeTestData(node: any): boolean {
    const testPatterns = [
      /test/i,
      /example/i,
      /mock/i,
      /drag.*drop/i,
      /reorder/i,
      /boundary/i,
      /stress/i,
      /favault.*test/i
    ];

    return testPatterns.some(pattern => 
      pattern.test(node.title) || 
      (node.url && pattern.test(node.url))
    );
  }
}

/**
 * Test isolation manager implementation
 */
export class TestIsolationManagerImpl implements TestIsolationManager {
  private cleanup: TestDataCleanup;
  private originalState: any = null;

  constructor(page: Page, context: BrowserContext) {
    this.cleanup = new TestDataCleanup(page, context);
  }

  async beforeTestSetup(): Promise<void> {
    console.log('🔒 Setting up test isolation...');
    
    // Store original state
    this.originalState = await this.cleanup['page'].evaluate(async () => {
      if (typeof chrome !== 'undefined' && chrome.bookmarks) {
        return await chrome.bookmarks.getTree();
      }
      return null;
    });
    
    console.log('✅ Test isolation setup complete');
  }

  async afterTestCleanup(): Promise<CleanupResult> {
    console.log('🧹 Performing post-test cleanup...');
    
    // This would need access to the test data state
    // For now, perform emergency reset
    await this.cleanup.emergencyReset();
    
    return {
      success: true,
      itemsRemoved: 0,
      foldersRemoved: 0,
      errors: [],
      warnings: [],
      duration: 0
    };
  }

  async emergencyReset(): Promise<void> {
    await this.cleanup.emergencyReset();
  }
}
