import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Extended test fixtures for FaVault browser extension testing
 * Provides extension loading, context management, and utility functions
 */

export interface ExtensionFixtures {
  context: BrowserContext;
  extensionId: string;
  extensionPage: Page;
  newTabPage: Page;
}

export const test = base.extend<ExtensionFixtures>({
  /**
   * Browser context with extension loaded
   */
  context: async ({ }, use) => {
    const pathToExtension = path.join(__dirname, '../../../dist/chrome');
    
    // Create persistent context with extension loaded
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: false, // Extensions require headed mode for full functionality
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ],
      viewport: { width: 1280, height: 720 },
      recordVideo: {
        dir: 'test-results/videos/',
        size: { width: 1280, height: 720 }
      }
    });

    await use(context);
    await context.close();
  },

  /**
   * Extension ID extracted from service worker
   */
  extensionId: async ({ context }, use) => {
    // Wait for service worker to be available
    let serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }

    // Extract extension ID from service worker URL
    const extensionId = serviceWorker.url().split('/')[2];
    console.log('Extension ID:', extensionId);

    await use(extensionId);
  },

  /**
   * Extension popup page
   */
  extensionPage: async ({ context, extensionId }, use) => {
    // Create new page for extension popup
    const page = await context.newPage();
    
    // Navigate to extension popup (if it exists)
    // For new tab extensions, we'll use the new tab page
    await page.goto(`chrome-extension://${extensionId}/newtab.html`);
    
    // Wait for extension to load
    await page.waitForLoadState('networkidle');
    
    await use(page);
    await page.close();
  },

  /**
   * New tab page with extension loaded
   */
  newTabPage: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    
    // Navigate to new tab (which should load our extension)
    await page.goto('chrome://newtab/');
    
    // Wait for extension content to load
    await page.waitForLoadState('networkidle');
    
    // Verify extension is loaded by checking for our app container
    await page.waitForSelector('[data-testid="favault-app"], .app-container, #app', { timeout: 10000 });
    
    // Wait for critical test functions to be available on the window object
    await page.waitForFunction(() =>
      (window as any).testUtils &&
      (window as any).settingsManager &&
      (window as any).EnhancedDragDropManager,
      { timeout: 10000 }
    ).catch(() => {
      console.warn('⚠️ Critical test functions not found on window object after timeout.');
    });

    await use(page);
    await page.close();
  },
});

export const expect = test.expect;

/**
 * Extension-specific test utilities
 */
export class ExtensionTestUtils {
  /**
   * Wait for extension to be fully loaded and initialized
   */
  static async waitForExtensionReady(page: Page, timeout = 10000): Promise<void> {
    // Wait for main app container
    await page.waitForSelector('[data-testid="favault-app"], .app-container, #app', { timeout });
    
    // Wait for bookmarks to load (if any)
    await page.waitForFunction(() => {
      return window.document.readyState === 'complete' && 
             !window.document.querySelector('.loading, [data-loading="true"]');
    }, { timeout });
    
    // Additional wait for any async initialization
    await page.waitForTimeout(1000);
  }

  /**
   * Get extension console messages
   */
  static async getConsoleMessages(page: Page): Promise<string[]> {
    const messages: string[] = [];
    
    page.on('console', msg => {
      messages.push(`${msg.type()}: ${msg.text()}`);
    });
    
    return messages;
  }

  /**
   * Inject test utilities into the page
   */
  static async injectTestUtils(page: Page): Promise<void> {
    await page.addInitScript(() => {
      // Add test utilities to window object
      (window as any).testUtils = {
        // Get all bookmark folders
        getBookmarkFolders: () => {
          return Array.from(document.querySelectorAll('.folder-container, [data-testid="bookmark-folder"]'));
        },
        
        // Get all bookmarks
        getBookmarks: () => {
          return Array.from(document.querySelectorAll('.bookmark-item, [data-testid="bookmark-item"]'));
        },
        
        // Simulate drag and drop
        simulateDragDrop: (source: Element, target: Element) => {
          const dragStartEvent = new DragEvent('dragstart', { bubbles: true, cancelable: true });
          const dropEvent = new DragEvent('drop', { bubbles: true, cancelable: true });
          const dragEndEvent = new DragEvent('dragend', { bubbles: true, cancelable: true });
          
          source.dispatchEvent(dragStartEvent);
          target.dispatchEvent(dropEvent);
          source.dispatchEvent(dragEndEvent);
        },
        
        // Wait for element to be visible
        waitForElement: (selector: string, timeout = 5000) => {
          return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
              resolve(element);
              return;
            }
            
            const observer = new MutationObserver(() => {
              const element = document.querySelector(selector);
              if (element) {
                observer.disconnect();
                resolve(element);
              }
            });
            
            observer.observe(document.body, { childList: true, subtree: true });
            
            setTimeout(() => {
              observer.disconnect();
              reject(new Error(`Element ${selector} not found within ${timeout}ms`));
            }, timeout);
          });
        }
      };
    });
  }

  /**
   * Enable edit mode in the extension
   */
  static async enableEditMode(page: Page): Promise<void> {
    console.log('🔧 Enabling edit mode...');
    
    // Directly enable edit mode via settingsManager
    await page.evaluate(async () => {
      if ((window as any).settingsManager) {
        await (window as any).settingsManager.updateEditMode({ enabled: true });
      } else {
        throw new Error('settingsManager not available on window object');
      }
    });

    // Wait for the UI to update and for the drag-drop system to be ready
    await page.waitForFunction(() => {
      const isEditMode = document.body.classList.contains('edit-mode');
      const dragDropReady = (window as any).enhancedDragDropReady === true;
      const draggableFolders = document.querySelectorAll('.folder-container[draggable="true"]').length > 0;
      return isEditMode && dragDropReady && draggableFolders;
    }, { timeout: 15000 });

    console.log('✅ Edit mode fully enabled and ready for testing');
  }

  /**
   * Disable edit mode in the extension
   */
  static async disableEditMode(page: Page): Promise<void> {
    // Try keyboard shortcut first
    await page.keyboard.press('Control+E');

    // Wait a bit for the mode to change
    await page.waitForTimeout(500);

    // Use the correct selectors to verify edit mode is disabled
    try {
      await page.waitForSelector('.app.edit-mode, body.edit-mode', {
        state: 'hidden',
        timeout: 5000
      });
    } catch (error) {
      // Check if edit toggle is no longer active
      const editToggleActive = await page.locator('.edit-toggle.active').count();
      if (editToggleActive === 0) {
        console.log('Edit mode disabled - toggle not active');
      } else {
        console.log('Edit mode elements not found, assuming disabled');
      }
    }
  }
}
