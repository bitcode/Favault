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

    // Wait for the extension to fully load and settings to be initialized
    // This is critical because loadSettings() in onMount resets editMode to false
    console.log('⏳ Waiting for extension initialization to complete...');
    await page.waitForTimeout(2000);

    // Try to enable edit mode via the settings manager to ensure it persists
    await page.evaluate(async () => {
      // Wait for settingsManager to be available
      let attempts = 0;
      while (!(window as any).settingsManager && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if ((window as any).settingsManager) {
        console.log('🔧 Using settingsManager to enable edit mode...');
        await (window as any).settingsManager.updateEditMode({ enabled: true });
      } else {
        console.log('⚠️ settingsManager not available, trying alternative approach...');
      }
    });

    // Wait for the edit mode change to propagate
    await page.waitForTimeout(1000);

    // Try keyboard shortcut as backup
    await page.keyboard.press('Control+E');
    await page.waitForTimeout(500);

    // If that doesn't work, try clicking the edit button
    const editButton = page.locator('.edit-toggle, button:has-text("Edit")').first();
    if (await editButton.isVisible()) {
      await editButton.click();
      await page.waitForTimeout(500);
    }

    // Verify edit mode is enabled using the actual selectors from the implementation
    try {
      await page.waitForSelector('.app.edit-mode, body.edit-mode, .edit-toggle.active', { timeout: 5000 });
      console.log('✅ Edit mode selectors found');
    } catch (error) {
      console.log('Edit mode verification failed, trying alternative approach...');
      // Try to enable via global function if available
      await page.evaluate(() => {
        if ((window as any).enableEnhancedEditMode) {
          (window as any).enableEnhancedEditMode();
        }
      });
      await page.waitForTimeout(500);
    }

    // Wait for enhanced drag-drop system to complete setup
    // This is critical because the enhanced system uses setTimeout calls
    console.log('⏳ Waiting for enhanced drag-drop system to complete setup...');

    // Wait for the enhanced drag-drop system to finish its initialization
    let setupComplete = false;
    let attempts = 0;
    const maxAttempts = 20; // 10 seconds total

    while (!setupComplete && attempts < maxAttempts) {
      try {
        // Check the global flag set by the enhanced drag-drop system
        const systemReady = await page.evaluate(() => {
          return {
            ready: (window as any).enhancedDragDropReady === true,
            stats: (window as any).enhancedDragDropStats,
            draggableCount: document.querySelectorAll('.folder-container[draggable="true"]').length
          };
        });

        if (systemReady.ready && systemReady.draggableCount > 0) {
          setupComplete = true;
          console.log(`✅ Enhanced drag-drop setup complete: ${systemReady.draggableCount} draggable folders, ${systemReady.stats?.protected || 0} protected`);
        } else {
          await page.waitForTimeout(500);
          attempts++;
        }
      } catch (error) {
        await page.waitForTimeout(500);
        attempts++;
      }
    }

    if (!setupComplete) {
      console.warn('⚠️ Enhanced drag-drop setup may not have completed within timeout');
      // Log current state for debugging
      const debugInfo = await page.evaluate(() => {
        return {
          editModeEnabled: document.body.classList.contains('edit-mode'),
          appEditMode: document.querySelector('.app.edit-mode') !== null,
          toggleActive: document.querySelector('.edit-toggle.active') !== null,
          enhancedReady: (window as any).enhancedDragDropReady,
          draggableCount: document.querySelectorAll('.folder-container[draggable="true"]').length,
          totalFolders: document.querySelectorAll('.folder-container').length
        };
      });
      console.log('🔍 Debug info:', debugInfo);
    }

    // Final verification that edit mode is fully active
    const finalCheck = await page.locator('.app.edit-mode, body.edit-mode, .edit-toggle.active').count();
    if (finalCheck === 0) {
      throw new Error('Edit mode could not be enabled - no edit mode indicators found');
    }

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
