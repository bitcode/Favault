import { Page, ConsoleMessage } from '@playwright/test';
import { FaviconErrorFilter } from '../../../src/lib/favicon-utils';

/**
 * Console and network testing utilities for FaVault extension
 * Provides methods to capture console messages, monitor network requests, and inject test scripts
 */
export class ConsoleTestUtils {
  private consoleMessages: ConsoleMessage[] = [];
  private networkRequests: any[] = [];
  private isMonitoring = false;

  constructor(private page: Page) {}

  /**
   * Start monitoring console messages and network requests
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.consoleMessages = [];
    this.networkRequests = [];

    // Monitor console messages
    this.page.on('console', (msg) => {
      this.consoleMessages.push(msg);
      console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
    });

    // Monitor network requests
    this.page.on('request', (request) => {
      this.networkRequests.push({
        type: 'request',
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        timestamp: new Date().toISOString()
      });
    });

    this.page.on('response', (response) => {
      this.networkRequests.push({
        type: 'response',
        url: response.url(),
        status: response.status(),
        headers: response.headers(),
        timestamp: new Date().toISOString()
      });
    });

    console.log('🔍 Started monitoring console and network activity');
  }

  /**
   * Stop monitoring and return collected data
   */
  async stopMonitoring(): Promise<{
    consoleMessages: ConsoleMessage[];
    networkRequests: any[];
  }> {
    this.isMonitoring = false;
    
    // Remove listeners
    this.page.removeAllListeners('console');
    this.page.removeAllListeners('request');
    this.page.removeAllListeners('response');

    console.log(`🔍 Stopped monitoring. Captured ${this.consoleMessages.length} console messages and ${this.networkRequests.length} network events`);

    return {
      consoleMessages: [...this.consoleMessages],
      networkRequests: [...this.networkRequests]
    };
  }

  /**
   * Get console messages by type
   */
  getConsoleMessagesByType(type: 'log' | 'error' | 'warn' | 'info' | 'debug'): ConsoleMessage[] {
    return this.consoleMessages.filter(msg => msg.type() === type);
  }

  /**
   * Get console messages containing specific text
   */
  getConsoleMessagesContaining(text: string): ConsoleMessage[] {
    return this.consoleMessages.filter(msg => msg.text().includes(text));
  }

  /**
   * Check for specific error messages
   */
  hasErrorMessage(errorText: string): boolean {
    return this.getConsoleMessagesByType('error').some(msg => msg.text().includes(errorText));
  }

  /**
   * Get all error messages
   */
  getErrorMessages(): string[] {
    return this.getConsoleMessagesByType('error').map(msg => msg.text());
  }

  /**
   * Get error messages excluding favicon-related errors
   */
  getNonFaviconErrorMessages(): string[] {
    const allErrors = this.getErrorMessages();
    return FaviconErrorFilter.filterFaviconErrors(allErrors);
  }

  /**
   * Count favicon-related errors
   */
  getFaviconErrorCount(): number {
    const allErrors = this.getErrorMessages();
    return FaviconErrorFilter.countFaviconErrors(allErrors);
  }

  /**
   * Get all warning messages
   */
  getWarningMessages(): string[] {
    return this.getConsoleMessagesByType('warn').map(msg => msg.text());
  }

  /**
   * Inject test script into the page
   */
  async injectTestScript(script: string): Promise<any> {
    try {
      const result = await this.page.evaluate(script);
      console.log('✅ Test script executed successfully');
      return result;
    } catch (error) {
      console.error('❌ Test script execution failed:', error.message);
      throw error;
    }
  }

  /**
   * Inject and execute drag-drop test functions
   */
  async injectDragDropTestFunctions(): Promise<void> {
    // Use evaluate instead of addInitScript to ensure it runs after page load
    await this.page.evaluate(() => {
      // Enhanced drag-drop test functions
      (window as any).testDragDropFunctions = {
        // Test folder reordering
        testFolderReorder: async (fromIndex: number, toIndex: number) => {
          try {
            const folders = document.querySelectorAll('.folder-container, [data-testid="bookmark-folder"]');
            if (fromIndex >= folders.length || toIndex >= folders.length) {
              throw new Error(`Invalid indices: from=${fromIndex}, to=${toIndex}, max=${folders.length - 1}`);
            }

            const fromFolder = folders[fromIndex];
            const toFolder = folders[toIndex];
            
            // Get folder titles
            const fromTitle = fromFolder.querySelector('.folder-title, h3, .folder-name')?.textContent?.trim();
            const toTitle = toFolder.querySelector('.folder-title, h3, .folder-name')?.textContent?.trim();

            console.log(`🧪 Testing folder reorder: "${fromTitle}" (${fromIndex}) → "${toTitle}" (${toIndex})`);

            // Simulate drag and drop
            const dragStartEvent = new DragEvent('dragstart', { bubbles: true, cancelable: true });
            const dropEvent = new DragEvent('drop', { bubbles: true, cancelable: true });
            const dragEndEvent = new DragEvent('dragend', { bubbles: true, cancelable: true });

            fromFolder.dispatchEvent(dragStartEvent);
            toFolder.dispatchEvent(dropEvent);
            fromFolder.dispatchEvent(dragEndEvent);

            return {
              success: true,
              fromTitle,
              toTitle,
              fromIndex,
              toIndex
            };
          } catch (error) {
            return {
              success: false,
              error: error.message
            };
          }
        },

        // Test bookmark search
        testBookmarkSearch: async (query: string) => {
          try {
            const searchInput = document.querySelector('input[type="search"], input[placeholder*="search"], .search-input');
            if (!searchInput) {
              throw new Error('Search input not found');
            }

            searchInput.value = query;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

            // Wait for search results
            await new Promise(resolve => setTimeout(resolve, 1000));

            const visibleBookmarks = document.querySelectorAll('.bookmark-item:not([style*="display: none"]), [data-testid="bookmark-item"]:not([style*="display: none"])');
            const visibleFolders = document.querySelectorAll('.folder-container:not([style*="display: none"]), [data-testid="bookmark-folder"]:not([style*="display: none"])');

            return {
              success: true,
              query,
              visibleBookmarks: visibleBookmarks.length,
              visibleFolders: visibleFolders.length
            };
          } catch (error) {
            return {
              success: false,
              error: error.message
            };
          }
        },

        // Get current bookmark state
        getCurrentBookmarkState: () => {
          try {
            const folders = Array.from(document.querySelectorAll('.folder-container, [data-testid="bookmark-folder"]'));
            const bookmarks = Array.from(document.querySelectorAll('.bookmark-item, [data-testid="bookmark-item"]'));

            const result = {
              folderCount: folders.length,
              bookmarkCount: bookmarks.length,
              folderTitles: folders.map(f => f.querySelector('.folder-title, h3, .folder-name, [data-testid="folder-title"]')?.textContent?.trim()).filter(Boolean),
              bookmarkTitles: bookmarks.map(b => b.querySelector('.bookmark-title, .bookmark-name, [data-testid="bookmark-title"]')?.textContent?.trim()).filter(Boolean),
              draggableFolders: folders.filter(f => f.getAttribute('draggable') === 'true' || (f as HTMLElement).draggable === true).length,
              draggableBookmarks: bookmarks.filter(b => b.getAttribute('draggable') === 'true' || (b as HTMLElement).draggable === true).length
            };

            console.log('📊 Current bookmark state:', result);
            return result;
          } catch (error) {
            console.error('❌ Error getting bookmark state:', error);
            return {
              folderCount: 0,
              bookmarkCount: 0,
              folderTitles: [],
              bookmarkTitles: [],
              draggableFolders: 0,
              draggableBookmarks: 0,
              error: error.message
            };
          }
        },

        // Test edit mode toggle
        testEditModeToggle: async () => {
          try {
            // Try keyboard shortcut
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, bubbles: true }));

            await new Promise(resolve => setTimeout(resolve, 500));

            // Check for actual edit mode indicators
            const editModeActive = document.querySelector('.app.edit-mode, body.edit-mode, .edit-toggle.active') !== null;

            return {
              success: true,
              editModeActive,
              appHasEditMode: document.querySelector('.app.edit-mode') !== null,
              bodyHasEditMode: document.querySelector('body.edit-mode') !== null,
              toggleIsActive: document.querySelector('.edit-toggle.active') !== null
            };
          } catch (error) {
            return {
              success: false,
              error: error.message
            };
          }
        }
      };

      // Also expose individual functions to global scope for easier access
      (window as any).getCurrentBookmarkState = (window as any).testDragDropFunctions.getCurrentBookmarkState;
      (window as any).testEditModeToggle = (window as any).testDragDropFunctions.testEditModeToggle;

      console.log('🔧 Drag-drop test functions injected');
    });

    // Wait a bit for the functions to be available
    await this.page.waitForTimeout(500);
  }

  /**
   * Execute injected test function
   */
  async executeTestFunction(functionName: string, ...args: any[]): Promise<any> {
    return await this.page.evaluate(({ functionName, args }) => {
      // Try testDragDropFunctions first
      const testFunctions = (window as any).testDragDropFunctions;
      if (testFunctions && testFunctions[functionName]) {
        return testFunctions[functionName](...args);
      }

      // Try global scope as fallback
      const globalFunction = (window as any)[functionName];
      if (globalFunction && typeof globalFunction === 'function') {
        return globalFunction(...args);
      }

      throw new Error(`Test function '${functionName}' not found`);
    }, { functionName, args });
  }

  /**
   * Monitor Chrome extension API calls
   */
  async monitorExtensionAPICalls(): Promise<void> {
    await this.page.addInitScript(() => {
      // Monitor chrome.bookmarks API calls
      if (typeof chrome !== 'undefined' && chrome.bookmarks) {
        const originalMethods = {
          getTree: chrome.bookmarks.getTree,
          move: chrome.bookmarks.move,
          create: chrome.bookmarks.create,
          remove: chrome.bookmarks.remove,
          update: chrome.bookmarks.update
        };

        // Wrap API methods to log calls
        chrome.bookmarks.getTree = function(...args) {
          console.log('🔍 chrome.bookmarks.getTree called', args);
          return originalMethods.getTree.apply(this, args);
        };

        chrome.bookmarks.move = function(...args) {
          console.log('🔍 chrome.bookmarks.move called', args);
          return originalMethods.move.apply(this, args);
        };

        chrome.bookmarks.create = function(...args) {
          console.log('🔍 chrome.bookmarks.create called', args);
          return originalMethods.create.apply(this, args);
        };

        chrome.bookmarks.remove = function(...args) {
          console.log('🔍 chrome.bookmarks.remove called', args);
          return originalMethods.remove.apply(this, args);
        };

        chrome.bookmarks.update = function(...args) {
          console.log('🔍 chrome.bookmarks.update called', args);
          return originalMethods.update.apply(this, args);
        };

        console.log('🔍 Chrome extension API monitoring enabled');
      }
    });
  }

  /**
   * Get network requests by URL pattern
   */
  getNetworkRequestsByUrl(urlPattern: string | RegExp): any[] {
    const pattern = typeof urlPattern === 'string' ? new RegExp(urlPattern) : urlPattern;
    return this.networkRequests.filter(req => pattern.test(req.url));
  }

  /**
   * Get failed network requests
   */
  getFailedRequests(): any[] {
    return this.networkRequests.filter(req => 
      req.type === 'response' && req.status >= 400
    );
  }

  /**
   * Generate enhanced test report with favicon error filtering
   */
  generateTestReport(): {
    summary: any;
    errors: string[];
    warnings: string[];
    networkIssues: any[];
    faviconErrors?: {
      count: number;
      filtered: boolean;
    };
  } {
    const allErrors = this.getErrorMessages();
    const faviconErrorCount = FaviconErrorFilter.countFaviconErrors(allErrors);
    const criticalErrors = FaviconErrorFilter.filterFaviconErrors(allErrors);
    
    return {
      summary: {
        totalConsoleMessages: this.consoleMessages.length,
        errorCount: allErrors.length,
        criticalErrorCount: criticalErrors.length,
        faviconErrorCount: faviconErrorCount,
        warningCount: this.getConsoleMessagesByType('warn').length,
        networkRequests: this.networkRequests.filter(req => req.type === 'request').length,
        networkResponses: this.networkRequests.filter(req => req.type === 'response').length
      },
      errors: criticalErrors, // Only include non-favicon errors
      warnings: this.getWarningMessages(),
      networkIssues: this.getFailedRequests(),
      faviconErrors: {
        count: faviconErrorCount,
        filtered: faviconErrorCount > 0
      }
    };
  }

  /**
   * Generate drag-drop test report
   */
  async generateDragDropTestReport(): Promise<any> {
    const errors = this.getErrorMessages();
    const warnings = this.getWarningMessages();
    const logs = this.getConsoleMessagesByType('log');

    // Get drag-drop specific information
    const dragDropInfo = await this.page.evaluate(() => {
      return {
        enhancedDragDropReady: (window as any).enhancedDragDropReady || false,
        enhancedDragDropStats: (window as any).enhancedDragDropStats || {},
        editModeActive: document.body.classList.contains('edit-mode'),
        draggableElements: document.querySelectorAll('[draggable="true"]').length,
        folderCount: document.querySelectorAll('.folder-container').length,
        bookmarkCount: document.querySelectorAll('.bookmark-item').length
      };
    });

    return {
      summary: {
        totalErrors: errors.length,
        totalWarnings: warnings.length,
        totalLogs: logs.length,
        dragDropReady: dragDropInfo.enhancedDragDropReady,
        editModeActive: dragDropInfo.editModeActive,
        draggableElements: dragDropInfo.draggableElements,
        folderCount: dragDropInfo.folderCount,
        bookmarkCount: dragDropInfo.bookmarkCount
      },
      dragDropInfo,
      errors: errors.slice(-10), // Last 10 errors
      warnings: warnings.slice(-5), // Last 5 warnings
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get console errors (alias for getErrorMessages)
   */
  getConsoleErrors(): string[] {
    return this.getErrorMessages();
  }

  /**
   * Get console warnings (alias for getWarningMessages)
   */
  getConsoleWarnings(): string[] {
    return this.getWarningMessages();
  }

  /**
   * Get console logs
   */
  getConsoleLogs(): string[] {
    return this.getConsoleMessagesByType('log');
  }
}
