import { Page, BrowserContext } from '@playwright/test';
import { TestDataSetup, TestDataConfig, TestBookmarkItem } from './test-data-setup';

/**
 * Cross-browser compatibility layer for test data setup
 * Handles browser-specific bookmark API differences and limitations
 */

export type BrowserType = 'chromium' | 'chrome' | 'firefox' | 'safari' | 'edge';

export interface BrowserCapabilities {
  supportsBookmarkAPI: boolean;
  supportsNestedFolders: boolean;
  supportsSpecialUrls: boolean;
  maxNestingLevel: number;
  requiresPermissions: boolean;
  apiNamespace: 'chrome' | 'browser';
}

/**
 * Browser-specific configurations and capabilities
 */
export const BrowserConfigs: Record<BrowserType, BrowserCapabilities> = {
  chromium: {
    supportsBookmarkAPI: true,
    supportsNestedFolders: true,
    supportsSpecialUrls: true,
    maxNestingLevel: 10,
    requiresPermissions: false,
    apiNamespace: 'chrome'
  },
  chrome: {
    supportsBookmarkAPI: true,
    supportsNestedFolders: true,
    supportsSpecialUrls: true,
    maxNestingLevel: 10,
    requiresPermissions: false,
    apiNamespace: 'chrome'
  },
  firefox: {
    supportsBookmarkAPI: true,
    supportsNestedFolders: true,
    supportsSpecialUrls: false, // Some special URLs may not work
    maxNestingLevel: 5,
    requiresPermissions: true,
    apiNamespace: 'browser'
  },
  safari: {
    supportsBookmarkAPI: false, // Limited bookmark API support
    supportsNestedFolders: false,
    supportsSpecialUrls: false,
    maxNestingLevel: 1,
    requiresPermissions: true,
    apiNamespace: 'browser'
  },
  edge: {
    supportsBookmarkAPI: true,
    supportsNestedFolders: true,
    supportsSpecialUrls: true,
    maxNestingLevel: 8,
    requiresPermissions: false,
    apiNamespace: 'chrome'
  }
};

/**
 * Cross-browser specific test data setup
 */
export class CrossBrowserTestDataSetup extends TestDataSetup {
  private browserType: BrowserType;
  private capabilities: BrowserCapabilities;

  constructor(page: Page, context: BrowserContext, browserType: BrowserType) {
    super(page, context);
    this.browserType = browserType;
    this.capabilities = BrowserConfigs[browserType];
  }

  /**
   * Initialize with browser-specific settings
   */
  async initialize(options: TestDataConfig): Promise<void> {
    const browserSpecificOptions: TestDataConfig = {
      ...options,
      // Adjust based on browser capabilities
      maxNestingLevel: Math.min(options.maxNestingLevel || 2, this.capabilities.maxNestingLevel),
      folderCount: options.folderCount || 3,
      bookmarksPerFolder: options.bookmarksPerFolder || 2,
      includeEmptyFolders: options.includeEmptyFolders !== false,
      includeDragTestFolders: options.includeDragTestFolders !== false,
      includeProtectedFolders: options.includeProtectedFolders === true,
      includeReorderableItems: options.includeReorderableItems !== false
    };

    await super.initialize(browserSpecificOptions);
  }

  /**
   * Get browser-specific timeout
   */
  getBrowserTimeout(): number {
    switch (this.browserType) {
      case 'firefox':
        return 8000; // Firefox can be slower
      case 'safari':
        return 10000; // Safari can be slowest
      case 'edge':
        return 6000; // Edge is usually fast
      default:
        return 5000; // Chrome default
    }
  }

  /**
   * Get browser-specific folder prefix
   */
  getBrowserFolderPrefix(): string {
    return `${this.browserType.charAt(0).toUpperCase()}${this.browserType.slice(1)}_Test`;
  }

  /**
   * Get browser-specific drag-drop settings
   */
  getBrowserDragDropSettings(): any {
    return {
      useTouch: this.browserType === 'safari',
      dragDelay: this.browserType === 'firefox' ? 200 : 100,
      dropDelay: this.browserType === 'safari' ? 300 : 150,
      supportsDragImage: this.browserType !== 'safari'
    };
  }

  /**
   * Generate browser-specific test data
   */
  async generateTestData(): Promise<void> {
    console.log(`🔧 Generating ${this.browserType} test data...`);

    if (!this.capabilities.supportsBookmarkAPI) {
      console.warn(`⚠️ ${this.browserType} has limited bookmark API support`);
      return;
    }

    // Create browser-specific test folders
    const testFolders = [
      {
        title: `${this.getBrowserFolderPrefix()}_Folder_1`,
        bookmarks: [
          { title: `${this.browserType}_Bookmark_1`, url: 'https://example.com/1' },
          { title: `${this.browserType}_Bookmark_2`, url: 'https://example.com/2' }
        ]
      },
      {
        title: `${this.getBrowserFolderPrefix()}_Folder_2`,
        bookmarks: [
          { title: `${this.browserType}_Bookmark_3`, url: 'https://example.com/3' }
        ]
      }
    ];

    // Add empty folder if supported
    if (this.capabilities.supportsNestedFolders) {
      testFolders.push({
        title: `${this.getBrowserFolderPrefix()}_Empty_Folder`,
        bookmarks: []
      });
    }

    // Use parent method to create the base data
    await super.generateTestData();

    // Add browser-specific data
    for (const folder of testFolders) {
      await this.createTestFolder(folder.title, folder.bookmarks);
    }

    console.log(`✅ ${this.browserType} test data generated`);
  }

  /**
   * Create a test folder with bookmarks
   */
  private async createTestFolder(title: string, bookmarks: TestBookmarkItem[]): Promise<void> {
    const apiNamespace = this.capabilities.apiNamespace;

    await this.page.evaluate(async (folderData) => {
      const api = (window as any)[folderData.apiNamespace];

      if (typeof api?.bookmarks?.create === 'function') {
        try {
          // Create folder
          const folder = await api.bookmarks.create({
            title: folderData.title,
            parentId: '1' // Bookmarks bar
          });

          // Create bookmarks in folder
          for (const bookmark of folderData.bookmarks) {
            await api.bookmarks.create({
              title: bookmark.title,
              url: bookmark.url,
              parentId: folder.id
            });
          }

          console.log(`📁 Created ${folderData.title} with ${folderData.bookmarks.length} bookmarks`);
        } catch (error) {
          console.error(`❌ Failed to create folder ${folderData.title}:`, error);
        }
      }
    }, { title, bookmarks, apiNamespace });
  }

  /**
   * Browser-specific cleanup
   */
  async cleanup(): Promise<void> {
    console.log(`🧹 Cleaning up ${this.browserType} test data...`);

    if (!this.capabilities.supportsBookmarkAPI) {
      return;
    }

    const apiNamespace = this.capabilities.apiNamespace;

    // Remove browser-specific test folders
    await this.page.evaluate(async (cleanupData) => {
      const api = (window as any)[cleanupData.apiNamespace];

      if (typeof api?.bookmarks?.search === 'function') {
        try {
          const prefix = cleanupData.prefix;
          const folders = await api.bookmarks.search({ title: prefix });

          for (const folder of folders) {
            if (folder.title.startsWith(prefix)) {
              await api.bookmarks.removeTree(folder.id);
              console.log(`🗑️ Removed ${folder.title}`);
            }
          }
        } catch (error) {
          console.error(`❌ Failed to cleanup ${cleanupData.browserType} test data:`, error);
        }
      }
    }, {
      apiNamespace,
      prefix: this.getBrowserFolderPrefix(),
      browserType: this.browserType
    });

    await super.clearTestData();
  }

  /**
   * Get browser capabilities
   */
  async getBrowserCapabilities(): Promise<BrowserCapabilities & any> {
    const runtimeCapabilities = await this.page.evaluate(() => {
      return {
        dragEvents: typeof DragEvent !== 'undefined',
        dataTransfer: typeof DataTransfer !== 'undefined',
        touchEvents: 'ontouchstart' in window,
        fileAPI: typeof File !== 'undefined',
        clipboardAPI: typeof navigator.clipboard !== 'undefined',
        userAgent: navigator.userAgent,
        chromeAPI: typeof (window as any).chrome !== 'undefined',
        browserAPI: typeof (window as any).browser !== 'undefined'
      };
    });

    return {
      ...this.capabilities,
      ...runtimeCapabilities
    };
  }
};

