// Enhanced drag and drop functionality for FaVault
// Integrates console script features with existing Svelte extension architecture
// Supports folder reordering with protected folder detection and error recovery

import { BookmarkEditAPI, type BookmarkItem, type BookmarkFolder, browserAPI } from './api';
import { bookmarkFolders } from './stores';

// Enhanced interfaces with console script features
export interface DragData {
  type: 'bookmark' | 'folder';
  id: string;
  title: string;
  parentId?: string;
  index?: number;
  url?: string;
  bookmarkId?: string; // Real Chrome bookmark ID
}

export interface DropZoneData {
  type: 'folder' | 'insertion-point' | 'folder-reorder';
  targetId: string;
  targetIndex?: number;
  parentId?: string;
}

export interface SystemState {
  initialized: boolean;
  lastError: Error | null;
  operationCount: number;
  failedOperations: number;
}

export interface FolderMappingResult {
  success: boolean;
  mappedCount: number;
  protectedCount: number;
  totalFolders: number;
  error?: string;
}

// Enhanced drag and drop manager with console script integration
export class EnhancedDragDropManager {
  private static editModeEnabled = false;
  private static currentDragData: DragData | null = null;
  private static dragEnterCounters = new Map<string, number>();
  private static folderBookmarkIds = new Map<number, string>();
  private static protectedFolderIds = new Set<string>();
  private static systemState: SystemState = {
    initialized: false,
    lastError: null,
    operationCount: 0,
    failedOperations: 0
  };

  // DOM observer for dynamic folder detection
  private static domObserver: MutationObserver | null = null;
  private static folderSetupRetryCount = 0;
  private static maxRetryAttempts = 5;
  private static retryTimeouts: Set<number> = new Set();

  // DOM Observer debouncing and logging controls - PERFORMANCE OPTIMIZED
  private static domObserverDebounceTimer: number | null = null;
  private static readonly DOM_OBSERVER_DEBOUNCE_MS = 1000; // Increased debounce
  private static lastDomObserverTrigger = 0;
  private static domObserverTriggerCount = 0;
  private static readonly MAX_OBSERVER_TRIGGERS_PER_SECOND = 2; // Reduced triggers
  private static debugLoggingEnabled = false; // DISABLED for performance

  // Auto-scroll prevention properties
  private static originalScrollPosition: { x: number; y: number } | null = null;
  private static lastManualScrollTime: number | null = null;
  private static scrollPreventionHandler: ((e: Event) => void) | null = null;
  private static manualScrollHandler: (() => void) | null = null;
  private static mousedownScrollPreventionHandler: ((e: MouseEvent) => void) | null = null;
  private static isScrollPreventionActive = false;

  // Refresh system management - PERFORMANCE OPTIMIZED
  private static pendingRefreshTimers: Set<number> = new Set();
  private static isRefreshInProgress = false;
  private static lastRefreshTime = 0;
  private static readonly REFRESH_DEBOUNCE_MS = 300; // Increased debounce

  // Operation management for preventing race conditions - PERFORMANCE OPTIMIZED
  private static activeOperations: Set<string> = new Set();
  private static lastOperationTime = 0;
  private static readonly OPERATION_DEBOUNCE_MS = 250; // Increased debounce
  private static operationQueue: Array<() => Promise<any>> = [];

  // Protected folder patterns from console script
  private static readonly PROTECTED_TITLES = [
    'Bookmarks Bar',
    'Bookmarks',
    'Other Bookmarks',
    'Mobile Bookmarks',
    'Bookmarks Menu'
  ];

  /**
   * Detect if we're running in production mode
   */
  private static isProductionMode(): boolean {
    // Check for common production indicators
    return (
      // Chrome extension in production (no dev tools context)
      typeof chrome !== 'undefined' &&
      chrome.runtime &&
      !chrome.runtime.getManifest().key && // Dev extensions have a key
      // URL-based detection
      (window.location.protocol === 'chrome-extension:' ||
        window.location.protocol === 'moz-extension:') &&
      // No development flags
      !window.location.search.includes('debug') &&
      !window.location.search.includes('dev')
    );
  }

  /**
   * Control debug logging verbosity
   */
  static setDebugLogging(enabled: boolean): void {
    this.debugLoggingEnabled = enabled;
    console.log(`🦁 Debug logging ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get current debug logging state
   */
  static isDebugLoggingEnabled(): boolean {
    return this.debugLoggingEnabled;
  }

  /**
   * Log debug messages only if debug logging is enabled
   */
  private static debugLog(message: string, ...args: any[]): void {
    if (this.debugLoggingEnabled) {
      console.log(message, ...args);
    }
  }

  /**
   * Initialize the enhanced drag-drop system
   */
  static async initialize(): Promise<{ success: boolean; error?: string }> {
    // Set debug logging based on production mode
    if (this.isProductionMode()) {
      this.debugLoggingEnabled = false;
    }

    console.log('🦁 Initializing enhanced drag-drop system...');
    this.debugLog(`🔧 Production mode: ${this.isProductionMode()}, Debug logging: ${this.debugLoggingEnabled}`);

    try {
      // Check Chrome API access
      const apiCheck = await this.checkBookmarkAPI();
      if (!apiCheck.success) {
        throw new Error(`Bookmark API not accessible: ${apiCheck.error}`);
      }

      // Restore bookmark mappings with protection detection
      const mappingResult = await this.restoreBookmarkMapping();
      if (!mappingResult.success) {
        throw new Error(`Failed to restore bookmark mappings: ${mappingResult.error}`);
      }

      // Setup enhanced styles
      this.setupEnhancedStyles();

      // Mark system as initialized
      this.systemState.initialized = true;

      console.log('✅ Enhanced drag-drop system initialized successfully');
      console.log(`📊 ${mappingResult.mappedCount}/${mappingResult.totalFolders} folders mapped`);
      console.log(`🔒 ${mappingResult.protectedCount} protected folders identified`);

      return { success: true };
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      console.error('❌ Enhanced drag-drop initialization failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check bookmark API access
   */
  private static async checkBookmarkAPI(): Promise<{ success: boolean; error?: string; tree?: any }> {
    try {
      if (!browserAPI || !browserAPI.bookmarks) {
        throw new Error('Bookmark API not available');
      }

      const tree = await browserAPI.bookmarks.getTree();
      return { success: true, tree };
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      return { success: false, error: error.message };
    }
  }

  /**
   * Restore bookmark folder mappings with protection detection
   */
  private static async restoreBookmarkMapping(): Promise<FolderMappingResult> {
    console.log('🦁 Restoring bookmark folder mappings...');

    try {
      const apiCheck = await this.checkBookmarkAPI();
      if (!apiCheck.success) {
        throw new Error(`Bookmark API not accessible: ${apiCheck.error}`);
      }

      const bookmarkTree = apiCheck.tree;
      this.folderBookmarkIds.clear();
      this.protectedFolderIds.clear();

      const folders = document.querySelectorAll('.folder-container');
      let mappedCount = 0;
      let protectedCount = 0;

      console.log(`🦁 Found ${folders.length} folder containers in DOM`);

      // If no folders found, this might be called too early - that's OK, we'll retry later
      if (folders.length === 0) {
        console.log('🦁 No folder containers found yet - will retry when edit mode is enabled');
      }

      folders.forEach((folder, index) => {
        const folderTitle = folder.querySelector('.folder-title, h3, .folder-name')?.textContent?.trim();

        if (folderTitle) {
          const bookmarkFolder = this.findBookmarkFolderByTitle(bookmarkTree, folderTitle);

          if (bookmarkFolder) {
            this.folderBookmarkIds.set(index, bookmarkFolder.id);

            // Check if this is a protected folder
            if (this.isProtectedFolder(bookmarkFolder.id, folderTitle)) {
              console.log(`🔒 Protected: "${folderTitle}" (${index}) → ${bookmarkFolder.id} [PROTECTED]`);
              protectedCount++;
            } else {
              console.log(`📁 Mapped: "${folderTitle}" (${index}) → ${bookmarkFolder.id}`);
            }
            mappedCount++;
          } else {
            console.warn(`⚠️ Could not find bookmark folder for "${folderTitle}"`);
            this.folderBookmarkIds.set(index, `placeholder-${index}`);
          }
        } else {
          console.warn(`⚠️ No title found for folder at index ${index}`);
          this.folderBookmarkIds.set(index, `placeholder-${index}`);
        }
      });

      console.log(`✅ Restored ${mappedCount} bookmark mappings (${protectedCount} protected) out of ${folders.length} folders`);
      return {
        success: true,
        mappedCount,
        protectedCount,
        totalFolders: folders.length
      };

    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      console.error('🦁 ERROR: Failed to restore bookmark mappings:', error);
      return { success: false, mappedCount: 0, protectedCount: 0, totalFolders: 0, error: error.message };
    }
  }

  /**
   * Find bookmark folder by title in bookmark tree
   */
  private static findBookmarkFolderByTitle(bookmarkTree: any[], title: string): any {
    const searchNode = (node: any): any => {
      if (node.title === title && node.children && !node.url) {
        return node;
      }

      if (node.children) {
        for (const child of node.children) {
          const result = searchNode(child);
          if (result) return result;
        }
      }

      return null;
    };

    for (const rootNode of bookmarkTree) {
      const result = searchNode(rootNode);
      if (result) return result;
    }

    return null;
  }

  /**
   * Check if a folder is protected (cannot be moved)
   */
  static isProtectedFolder(bookmarkId: string, folderTitle: string): boolean {
    // Root folder IDs are typically '1', '2', '3'
    const isRootId = bookmarkId && (bookmarkId === '1' || bookmarkId === '2' || bookmarkId === '3');
    const isProtectedTitle = this.PROTECTED_TITLES.includes(folderTitle);

    if (isRootId || isProtectedTitle) {
      this.protectedFolderIds.add(bookmarkId);
      return true;
    }

    return false;
  }

  /**
   * Check folder protection before operations
   */
  static checkFolderProtection(fromIndex: number, toIndex?: number): boolean {
    const fromBookmarkId = this.folderBookmarkIds.get(fromIndex);
    const fromFolder = document.querySelectorAll('.folder-container')[fromIndex];
    const fromTitle = fromFolder?.querySelector('.folder-title, h3, .folder-name')?.textContent?.trim();

    if (fromTitle && fromBookmarkId && this.isProtectedFolder(fromBookmarkId, fromTitle)) {
      console.warn(`🔒 PROTECTED FOLDER: "${fromTitle}" (ID: ${fromBookmarkId}) cannot be moved`);
      this.showNotification(`Cannot move protected folder "${fromTitle}"`, 'error');
      return false;
    }

    if (toIndex !== undefined) {
      const toBookmarkId = this.folderBookmarkIds.get(toIndex);
      const toFolder = document.querySelectorAll('.folder-container')[toIndex];
      const toTitle = toFolder?.querySelector('.folder-title, h3, .folder-name')?.textContent?.trim();

      if (toTitle && toBookmarkId && this.isProtectedFolder(toBookmarkId, toTitle)) {
        console.warn(`🔒 PROTECTED TARGET: "${toTitle}" (ID: ${toBookmarkId}) cannot be used as target`);
        this.showNotification(`Cannot use protected folder "${toTitle}" as target`, 'error');
        return false;
      }
    }

    return true;
  }

  /**
   * Enhanced error handling from console script
   */
  static handleOperationError(error: Error, operation: string, context: any = {}): { handled: boolean; recoverable: boolean } {
    this.systemState.lastError = error;
    this.systemState.failedOperations++;

    console.error(`🦁 OPERATION ERROR [${operation}]:`, error);
    console.error('🦁 Context:', context);

    // Specific error handling
    if (error.message.includes("Can't modify the root bookmark folders")) {
      const folderTitle = context.folderTitle || 'Unknown folder';
      this.showNotification(`Cannot move system folder "${folderTitle}" - it's protected by Chrome`, 'error');

      // Mark as protected for future operations
      if (context.bookmarkId) {
        this.protectedFolderIds.add(context.bookmarkId);
      }

      return { handled: true, recoverable: true };
    }

    if (error.message.includes('Cannot read properties of null')) {
      console.warn('🦁 Null reference error - attempting recovery...');

      // Attempt to refresh the system state
      setTimeout(() => {
        this.refreshSystemState();
      }, 1000);

      return { handled: true, recoverable: true };
    }

    // Generic error handling
    this.showNotification(`Operation failed: ${error.message}`, 'error');
    return { handled: false, recoverable: false };
  }

  /**
   * Refresh system state after errors
   */
  static async refreshSystemState(): Promise<boolean> {
    // Called only from error recovery paths — silently remap IDs, no toast, no full reload.
    console.log('🦁 Refreshing system state (silent remap only)...');

    try {
      const mappingResult = await this.restoreBookmarkMapping();

      if (mappingResult.success) {
        console.log(`✅ System state silently refreshed — ${mappingResult.mappedCount} mappings restored`);
        return true;
      } else {
        throw new Error('Failed to refresh bookmark mappings');
      }
    } catch (error) {
      console.error('🦁 Failed to refresh system state:', error);
      return false;
    }
  }

  /**
   * Silently rebuild folderBookmarkIds from Chrome after a successful folder move.
   * Does NOT call refreshUI / loadBookmarks / showNotification — zero UI disruption.
   */
  private static async silentRebuildFolderMappings(): Promise<void> {
    try {
      await this.restoreBookmarkFolderMappings();
      console.log('🔄 Silent folder mapping rebuild complete');
    } catch (err) {
      console.warn('🔄 Silent folder mapping rebuild failed (non-critical):', err);
    }
  }

  /**
   * Unified refresh system - replaces multiple conflicting refresh mechanisms
   */
  static async refreshUI(): Promise<boolean> {
    // Prevent multiple simultaneous refreshes
    if (this.isRefreshInProgress) {
      console.log('🔄 Refresh already in progress, skipping...');
      return true;
    }

    // Debounce rapid refresh calls
    const now = Date.now();
    if (now - this.lastRefreshTime < this.REFRESH_DEBOUNCE_MS) {
      console.log('🔄 Refresh debounced, too soon since last refresh');
      return true;
    }

    this.isRefreshInProgress = true;
    this.lastRefreshTime = now;

    // Clear any pending refresh timers to prevent conflicts
    this.clearPendingRefreshTimers();

    console.log('🔄 Starting unified UI refresh...');

    try {
      // Clear bookmark cache first to ensure fresh data
      if (typeof (window as any).BookmarkManager !== 'undefined' &&
        typeof (window as any).BookmarkManager.clearCache === 'function') {
        console.log('🔄 Clearing bookmark cache...');
        (window as any).BookmarkManager.clearCache();
      }

      // Primary method: Try global loadBookmarks function
      if (typeof (window as any).loadBookmarks === 'function') {
        console.log('🔄 Calling global loadBookmarks function...');
        await (window as any).loadBookmarks();
        console.log('✅ UI refreshed via global loadBookmarks');
        return true;
      }

      // Fallback method: Dispatch custom event
      console.log('🔄 Dispatching bookmark refresh event...');
      const refreshEvent = new CustomEvent('favault-refresh-bookmarks', {
        detail: {
          source: 'folder-reordering',
          timestamp: now,
          clearCache: true
        }
      });
      document?.dispatchEvent(refreshEvent);
      console.log('✅ UI refresh event dispatched');

      return true;
    } catch (error) {
      console.error('❌ Failed to refresh UI:', error);
      return false;
    } finally {
      this.isRefreshInProgress = false;
    }
  }

  /**
   * Clear all pending refresh timers to prevent conflicts
   */
  private static clearPendingRefreshTimers(): void {
    this.pendingRefreshTimers.forEach(timerId => {
      clearTimeout(timerId);
    });
    this.pendingRefreshTimers.clear();
    console.log('🔄 Cleared pending refresh timers');
  }

  /**
   * Schedule a delayed refresh with proper timer management
   */
  private static scheduleDelayedRefresh(delay: number, operation: string): void {
    const timerId = window.setTimeout(() => {
      this.pendingRefreshTimers.delete(timerId);
      console.log(`🔄 Executing delayed refresh for ${operation}`);
      this.refreshSystemState();
    }, delay);

    this.pendingRefreshTimers.add(timerId);
    console.log(`🔄 Scheduled delayed refresh for ${operation} in ${delay}ms`);
  }

  /**
   * Check if an operation can be started (debouncing and race condition prevention)
   */
  private static canStartOperation(operationId: string): boolean {
    // Check if operation is already active
    if (this.activeOperations.has(operationId)) {
      console.log(`🚫 Operation ${operationId} already in progress, skipping`);
      return false;
    }

    // Check debouncing
    const now = Date.now();
    if (now - this.lastOperationTime < this.OPERATION_DEBOUNCE_MS) {
      console.log(`🚫 Operation ${operationId} debounced, too soon since last operation`);
      return false;
    }

    return true;
  }

  /**
   * Start an operation with proper tracking
   */
  private static startOperation(operationId: string): void {
    this.activeOperations.add(operationId);
    this.lastOperationTime = Date.now();
    console.log(`🚀 Started operation: ${operationId}`);
  }

  /**
   * Complete an operation and clean up tracking
   */
  private static completeOperation(operationId: string): void {
    this.activeOperations.delete(operationId);
    console.log(`✅ Completed operation: ${operationId}`);
  }

  /**
   * Clear all active operations (for cleanup)
   */
  private static clearActiveOperations(): void {
    this.activeOperations.clear();
    console.log('🧹 Cleared all active operations');
  }

  /**
   * Optimistic folder reorder — instantly reorders the bookmarkFolders Svelte store
   * without a full data reload, exactly like optimisticMove does for bookmarks.
   * A silent background sync (scheduleDelayedRefresh) reconciles with Chrome after 500 ms.
   */
  private static optimisticFolderReorder(fromIndex: number, targetIndex: number): void {
    try {
      bookmarkFolders.update((folders) => {
        if (fromIndex < 0 || fromIndex >= folders.length) return folders;
        const copy = [...folders];
        const [moved] = copy.splice(fromIndex, 1);
        const clampedTarget = Math.max(0, Math.min(targetIndex, copy.length));
        copy.splice(clampedTarget, 0, moved);
        return copy;
      });
      console.log(`🦁 Optimistic folder reorder: index ${fromIndex} → ${targetIndex}`);
    } catch (err) {
      console.warn('🦁 Optimistic folder reorder failed:', err);
    }
  }

  /**
   * Show notification to user
   */
  static showNotification(message: string, type: 'success' | 'error' = 'success'): void {
    const bgColor = type === 'success' ? '#10b981' : '#ef4444';
    const icon = type === 'success' ? '✅' : '❌';

    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${bgColor};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: bold;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      max-width: 300px;
      animation: slideInRight 0.3s ease;
    `;
    notification.textContent = `${icon} ${message}`;

    if (!document.getElementById('notification-styles')) {
      const style = document.createElement('style');
      style.id = 'notification-styles';
      style.textContent = `
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, type === 'success' ? 4000 : 6000);
  }

  /**
   * Prevent auto-scrolling during drag operations
   */
  static preventAutoScroll(): void {
    this.debugLog('🦁 Preventing auto-scroll during drag operation');

    // Store current scroll position
    this.originalScrollPosition = {
      x: window.scrollX,
      y: window.scrollY
    };

    // Disable smooth scrolling
    document.documentElement.style.scrollBehavior = 'auto';
    document.body.style.scrollBehavior = 'auto';

    // Prevent scroll position changes
    document.documentElement.style.overflowAnchor = 'none';
    document.body.style.overflowAnchor = 'none';

    // Add event listener to prevent programmatic scrolling
    this.scrollPreventionHandler = (e: Event) => {
      if (e.type === 'scroll' && this.currentDragData) {
        // Allow manual scrolling but prevent programmatic scrolling
        const currentTime = Date.now();
        if (!this.lastManualScrollTime || currentTime - this.lastManualScrollTime > 100) {
          // This might be programmatic scrolling, prevent it
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    // Track manual scroll events
    this.manualScrollHandler = () => {
      this.lastManualScrollTime = Date.now();
    };

    window.addEventListener('wheel', this.manualScrollHandler, { passive: true });
    window.addEventListener('touchmove', this.manualScrollHandler, { passive: true });
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) {
        this.lastManualScrollTime = Date.now();
      }
    });

    this.isScrollPreventionActive = true;
  }

  /**
   * Prevent auto-scrolling on mousedown in edit mode (before drag starts)
   */
  static preventMousedownAutoScroll(): void {
    if (this.isScrollPreventionActive) {
      return; // Already active
    }

    this.debugLog('🦁 Preventing auto-scroll on mousedown in edit mode');

    // Store current scroll position
    this.originalScrollPosition = {
      x: window.scrollX,
      y: window.scrollY
    };

    // Prevent focus-related scrolling on mousedown
    this.mousedownScrollPreventionHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Only prevent scrolling for draggable items in edit mode
      if (!this.editModeEnabled || !target) {
        return;
      }

      // Check if this is a draggable item
      const isDraggableItem = target.classList.contains('bookmark-item') ||
        target.classList.contains('folder-container') ||
        target.closest('.bookmark-item') ||
        target.closest('.folder-container');

      if (isDraggableItem) {

        // Note: Do not call preventDefault here; it breaks native dragstart.

        // Store the scroll position before the event
        const scrollBeforeX = window.scrollX;
        const scrollBeforeY = window.scrollY;

        // Use requestAnimationFrame to check if scroll position changed after the event
        requestAnimationFrame(() => {
          const scrollAfterX = window.scrollX;
          const scrollAfterY = window.scrollY;

          // If scroll position changed, restore it
          if (scrollAfterX !== scrollBeforeX || scrollAfterY !== scrollBeforeY) {
            this.debugLog(`🦁 Detected unwanted scroll on mousedown, restoring position: (${scrollBeforeX}, ${scrollBeforeY})`);
            window.scrollTo(scrollBeforeX, scrollBeforeY);
          }
        });
      }
    };

    // Add mousedown listener to detect and correct unwanted scrolling
    document.addEventListener('mousedown', this.mousedownScrollPreventionHandler, { capture: true });

    // Also guard pointer events for broader device coverage
    document.addEventListener('pointerdown', this.mousedownScrollPreventionHandler as any, { capture: true } as any);


    this.isScrollPreventionActive = true;
  }

  /**
   * Restore normal scroll behavior after drag operations
   */
  static restoreAutoScroll(): void {
    console.log('🦁 Restoring normal scroll behavior');

    // Restore scroll behavior
    document.documentElement.style.scrollBehavior = '';
    document.body.style.scrollBehavior = '';

    // Restore overflow anchor
    document.documentElement.style.overflowAnchor = '';
    document.body.style.overflowAnchor = '';

    // Remove event listeners
    if (this.scrollPreventionHandler) {
      window.removeEventListener('scroll', this.scrollPreventionHandler);
    }

    if (this.manualScrollHandler) {
      window.removeEventListener('wheel', this.manualScrollHandler);
      window.removeEventListener('touchmove', this.manualScrollHandler);
    }

    if (this.mousedownScrollPreventionHandler) {
      document.removeEventListener('mousedown', this.mousedownScrollPreventionHandler, { capture: true } as any);
      document.removeEventListener('pointerdown', this.mousedownScrollPreventionHandler as any, { capture: true } as any);
    }

    // Clear stored data
    this.originalScrollPosition = null;
    this.lastManualScrollTime = null;
    this.scrollPreventionHandler = null;
    this.manualScrollHandler = null;
    this.mousedownScrollPreventionHandler = null;
    this.isScrollPreventionActive = false;
  }

  /**
   * Add visual feedback for successful folder move
   */
  static addMoveSuccessVisualFeedback(folderTitle: string, insertionIndex: number): void {
    // Find the moved folder by title (since DOM may have been updated)
    const folders = document.querySelectorAll('.folder-container');
    let movedFolder: Element | null = null;

    folders.forEach(folder => {
      const titleElement = folder.querySelector('.folder-title, h3, .folder-name');
      if (titleElement && titleElement.textContent?.trim() === folderTitle) {
        movedFolder = folder;
      }
    });

    if (movedFolder) {
      // Add green highlighting for successful move
      const htmlElement = movedFolder as HTMLElement;
      htmlElement.style.background = 'rgba(0, 255, 0, 0.2)';
      htmlElement.style.border = '2px solid green';
      htmlElement.style.transform = 'scale(1.05)';
      htmlElement.style.transition = 'all 0.3s ease';

      this.debugLog(`✅ Added visual feedback for moved folder: "${folderTitle}"`);

      // Remove visual feedback after animation
      setTimeout(() => {
        htmlElement.style.background = '';
        htmlElement.style.border = '';
        htmlElement.style.transform = '';
      }, 2000);
    } else {
      this.debugLog(`⚠️ Could not find moved folder "${folderTitle}" for visual feedback`);
    }
  }

  /**
   * Check if edit mode is enabled
   */
  static isEditModeEnabled(): boolean {
    return this.editModeEnabled ||
      document.body.classList.contains('edit-mode') ||
      document.querySelector('.app.edit-mode') !== null;
  }

  /**
   * Insert folder at specific position (from console script)
   */
  static async insertFolderAtPosition(fromIndex: number, toIndex: number): Promise<{ success: boolean; error?: string;[key: string]: any }> {
    console.log(`🦁 API: insertFolderAtPosition(${fromIndex}, ${toIndex})`);
    this.systemState.operationCount++;

    try {
      // Check for protected folders
      if (!this.checkFolderProtection(fromIndex)) {
        return { success: false, error: 'Protected folder cannot be moved', fromIndex, toIndex };
      }

      let folderBookmarkId = this.folderBookmarkIds.get(fromIndex);

      // If we have a placeholder ID, try to refresh the mappings
      if (!folderBookmarkId || folderBookmarkId.startsWith('placeholder-')) {
        console.log('🦁 Placeholder ID detected, refreshing bookmark mappings...');
        const mappingResult = await this.restoreBookmarkFolderMappings();

        if (mappingResult.success) {
          folderBookmarkId = this.folderBookmarkIds.get(fromIndex);
          console.log(`🦁 After refresh: folderBookmarkId=${folderBookmarkId}`);
        }

        // Check again after refresh
        if (!folderBookmarkId || folderBookmarkId.startsWith('placeholder-')) {
          throw new Error(`No real bookmark ID found for folder at index ${fromIndex} after refresh. ID: ${folderBookmarkId}`);
        }
      }

      console.log(`🦁 Moving bookmark folder ID ${folderBookmarkId} from position ${fromIndex} to ${toIndex}`);

      const [bookmarkFolder] = await browserAPI.bookmarks.get(folderBookmarkId);
      console.log('🦁 Current bookmark folder:', bookmarkFolder);

      const parentId = bookmarkFolder.parentId;
      const parentChildren = await browserAPI.bookmarks.getChildren(parentId);
      console.log(`🦁 Parent folder has ${parentChildren.length} children`);
      console.log(`🦁 DEBUG: Parent children details:`, parentChildren.map((child: any) => ({ id: child.id, title: child.title, index: child.index })));

      const currentIndex = parentChildren.findIndex((child: any) => child.id === folderBookmarkId);
      console.log(`🦁 Current index in bookmark system: ${currentIndex}`);
      console.log(`🦁 DEBUG: Target bookmark ID ${folderBookmarkId} in parent ${parentId}`);

      // Calculate target index with proper position mapping and enhanced bounds checking
      let newIndex = toIndex;
      console.log(`🦁 Position calculation: currentIndex=${currentIndex}, toIndex=${toIndex}, parentChildren.length=${parentChildren.length}`);

      // ENHANCED INDEX CALCULATION FIX
      // The bug was that when moving an item "up" (to a lower index), the `toIndex`
      // was correct, but when moving "down" (to a higher index), the `toIndex`
      // was off by one. This was due to a misunderstanding of how the `bookmarks.move`
      // API calculates the final position. The fix is to simply use the `toIndex`
      // as the `newIndex` and let the API handle the rest.
      newIndex = toIndex;
      console.log(`🦁 Simplified index calculation: newIndex is now always ${newIndex}`);

      // CRITICAL FIX: Enhanced bounds validation with safer limits
      const originalNewIndex = newIndex;
      const maxAllowedIndex = Math.max(0, parentChildren.length - 1);

      // More conservative bounds checking to prevent Chrome API failures
      if (newIndex < 0) {
        newIndex = 0;
        console.warn(`🦁 ⚠️ CRITICAL FIX: Negative index ${originalNewIndex} corrected to 0`);
      } else if (newIndex >= parentChildren.length) {
        // Use parentChildren.length - 1 for safer positioning, or 0 if empty
        newIndex = parentChildren.length > 0 ? parentChildren.length - 1 : 0;
        console.warn(`🦁 ⚠️ CRITICAL FIX: Index ${originalNewIndex} was beyond bounds! Corrected to ${newIndex}. Parent has ${parentChildren.length} children`);
      }

      // Additional validation to ensure index is within Chrome API limits
      if (newIndex !== originalNewIndex) {
        console.warn(`🦁 ⚠️ CRITICAL: Index ${originalNewIndex} was out of bounds! Adjusted to ${newIndex}. Max allowed: ${maxAllowedIndex}`);
      }

      // CRITICAL DEBUG: Validate the move operation parameters
      console.log(`🦁 🚨 CRITICAL DEBUG - Chrome API move parameters:`);
      console.log(`   - Bookmark ID: ${folderBookmarkId}`);
      console.log(`   - Target Parent: ${parentId}`);
      console.log(`   - Target Index: ${newIndex}`);
      console.log(`   - Original toIndex: ${toIndex}`);
      console.log(`   - Current bookmark index: ${currentIndex}`);
      console.log(`   - Parent has ${parentChildren.length} children`);
      console.log(`   - Is index valid? ${newIndex >= 0 && newIndex < parentChildren.length}`);

      console.log(`🦁 Moving to index ${newIndex} in parent ${parentId}`);

      // CRITICAL DEBUG: Capture Chrome API call with comprehensive error tracking and recovery
      let result: any;
      try {
        console.log(`🦁 🚨 EXECUTING Chrome API move operation...`);
        console.log(`🦁 🚨 Pre-move bookmark tree state check...`);

        // Verify bookmark still exists before moving
        const preCheckBookmark = await browserAPI.bookmarks.get(folderBookmarkId);
        console.log(`🦁 DEBUG: Pre-move bookmark check:`, preCheckBookmark);

        // Verify parent still exists and has expected children
        const preCheckParent = await browserAPI.bookmarks.getChildren(parentId);
        console.log(`🦁 DEBUG: Pre-move parent check: ${preCheckParent.length} children`);

        // ENHANCED ERROR HANDLING: Validate parameters before Chrome API call
        if (!folderBookmarkId || typeof folderBookmarkId !== 'string') {
          throw new Error(`Invalid bookmark ID: ${folderBookmarkId}`);
        }
        if (!parentId || typeof parentId !== 'string') {
          throw new Error(`Invalid parent ID: ${parentId}`);
        }
        if (typeof newIndex !== 'number' || newIndex < 0) {
          throw new Error(`Invalid index: ${newIndex}`);
        }

        // Additional validation: ensure we're not trying to move beyond the actual parent size
        if (newIndex >= preCheckParent.length && preCheckParent.length > 0) {
          console.warn(`🦁 ⚠️ CRITICAL FIX: Index ${newIndex} exceeds parent size ${preCheckParent.length}, adjusting to ${preCheckParent.length - 1}`);
          newIndex = Math.max(0, preCheckParent.length - 1);
        }

        result = await browserAPI.bookmarks.move(folderBookmarkId, {
          parentId: parentId,
          index: newIndex
        });

        // ENHANCED SUCCESS VALIDATION
        if (!result || !result.id) {
          throw new Error('Chrome API returned invalid result - bookmark may have been lost');
        }

        console.log('🦁 ✅ SUCCESS: Chrome API move completed:', result);
        console.log(`🦁 DEBUG: Move result details:`, {
          resultId: result.id,
          resultParentId: result.parentId,
          resultIndex: result.index,
          resultTitle: result.title
        });

        // CRITICAL DEBUG: Verify bookmark exists after move with enhanced error detection
        setTimeout(async () => {
          try {
            console.log(`🦁 🚨 POST-MOVE VERIFICATION: Checking if bookmark ${result.id} still exists...`);
            const postMoveCheck = await browserAPI.bookmarks.get(result.id);
            console.log(`🦁 ✅ POST-MOVE: Bookmark verified existing:`, postMoveCheck);

            // Check if it's in the expected location
            const postMoveParent = await browserAPI.bookmarks.getChildren(result.parentId);
            const foundIndex = postMoveParent.findIndex((child: any) => child.id === result.id);
            console.log(`🦁 DEBUG: Post-move position verification: expected index ${result.index}, found at index ${foundIndex}`);

            if (foundIndex === -1) {
              console.error(`🦁 🚨 CRITICAL ERROR: Bookmark disappeared after move! ID: ${result.id}, Expected Parent: ${result.parentId}`);
              console.error(`🦁 DEBUG: Parent children after move:`, postMoveParent.map((child: any) => ({ id: child.id, title: child.title, index: child.index })));

              // ENHANCED: Attempt to locate the bookmark elsewhere
              try {
                const fullTree = await browserAPI.bookmarks.getTree();
                console.log('🦁 🚨 ATTEMPTING BOOKMARK RECOVERY: Searching entire bookmark tree...');
                // This will help identify if the bookmark moved to an unexpected location
              } catch (recoveryError) {
                console.error('🦁 🚨 RECOVERY SEARCH FAILED:', recoveryError);
              }
            }
          } catch (verifyError) {
            console.error(`🦁 🚨 CRITICAL ERROR: Post-move verification failed - bookmark may have disappeared!`, verifyError);
          }
        }, 100);

      } catch (apiError: any) {
        console.error(`🦁 🚨 CRITICAL ERROR: Chrome API move operation failed!`, apiError);
        console.error(`🦁 DEBUG: Failed move parameters:`, {
          bookmarkId: folderBookmarkId,
          parentId,
          index: newIndex,
          originalToIndex: toIndex,
          errorMessage: apiError?.message || 'Unknown error',
          errorCode: apiError?.code || 'No code'
        });

        // ENHANCED: Provide more specific error information
        if (apiError?.message?.includes("Cannot read properties")) {
          console.error(`🦁 🚨 LIKELY CAUSE: Bookmark or parent folder no longer exists`);
        } else if (apiError?.message?.includes("index")) {
          console.error(`🦁 🚨 LIKELY CAUSE: Invalid index position ${newIndex}`);
        } else if (apiError?.message?.includes("root bookmark")) {
          console.error(`🦁 🚨 LIKELY CAUSE: Attempting to modify protected system folder`);
        }

        throw apiError;
      }

      this.showNotification(`Folder "${bookmarkFolder.title}" moved to position ${toIndex + 1}`);

      // Immediately refresh UI to show new folder order
      console.log('🔄 Triggering immediate UI refresh...');
      await this.refreshUI();

      // Schedule system state refresh using the new timer management
      this.scheduleDelayedRefresh(500, 'insertFolderAtPosition');

      return {
        success: true,
        bookmarkId: folderBookmarkId,
        fromIndex,
        toIndex,
        newIndex,
        result
      };

    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      const context = {
        operation: 'insertFolderAtPosition',
        fromIndex,
        toIndex,
        bookmarkId: this.folderBookmarkIds.get(fromIndex),
        folderTitle: document.querySelectorAll('.folder-container')[fromIndex]?.querySelector('.folder-title, h3, .folder-name')?.textContent?.trim()
      };

      const errorResult = this.handleOperationError(error, 'insertFolderAtPosition', context);

      return {
        success: false,
        error: error.message,
        fromIndex,
        toIndex,
        handled: errorResult.handled,
        recoverable: errorResult.recoverable
      };
    }
  }

  /**
   * Move folder to specific insertion position (for insertion point drops)
   */
  static async moveFolderToPosition(
    fromIndex: number,
    positionOrInsertionIndex: number,
    options?: { mode?: 'final-index' | 'insertion-index' }
  ): Promise<{ success: boolean; error?: string;[key: string]: any }> {
    const mode = options?.mode ?? 'final-index';
    const operationId = `moveFolderToPosition-${fromIndex}-${positionOrInsertionIndex}-${mode}`;
    console.log(`🦁 API: moveFolderToPosition(${fromIndex}, ${positionOrInsertionIndex}, mode=${mode})`);

    // Check if operation can be started (debouncing and race condition prevention)
    if (!this.canStartOperation(operationId)) {
      return { success: false, error: 'Operation blocked by debouncing or race condition prevention' };
    }

    this.startOperation(operationId);
    this.systemState.operationCount++;

    const insertionIndex = positionOrInsertionIndex;

    try {
      // Check for protected folders
      if (this.protectedFolderIds.has(this.folderBookmarkIds.get(fromIndex) || '')) {
        return {
          success: false,
          error: 'Protected folder cannot be moved',
          fromIndex,
          insertionIndex
        };
      }

      let fromBookmarkId = this.folderBookmarkIds.get(fromIndex);

      // If we have placeholder ID, try to refresh the mappings
      if (!fromBookmarkId || fromBookmarkId.startsWith('placeholder-')) {
        console.log('🦁 Placeholder ID detected, refreshing bookmark mappings...');
        const mappingResult = await this.restoreBookmarkFolderMappings();

        if (mappingResult.success) {
          fromBookmarkId = this.folderBookmarkIds.get(fromIndex);
          console.log(`🦁 After refresh: from=${fromBookmarkId}`);
        }

        if (!fromBookmarkId || fromBookmarkId.startsWith('placeholder-')) {
          throw new Error(`Missing real bookmark ID after refresh: from=${fromBookmarkId}`);
        }
      }

      console.log(`🦁 Moving folder ${fromBookmarkId} to insertion position ${insertionIndex}`);

      const [fromFolder] = await browserAPI.bookmarks.get(fromBookmarkId);
      const parentChildren = await browserAPI.bookmarks.getChildren(fromFolder.parentId);

      // ── Key insight from Chrome API docs ──────────────────────────────────────
      // parentChildren contains ALL siblings: loose bookmarks (URLs) AND sub-folders.
      // The UI insertion points only count folder-type children (nodes with .children /
      // no .url).  Using the raw insertionIndex as-is against parentChildren will be off
      // by however many non-folder items precede the target slot.
      //
      // Strategy:
      //   1. Build folder-only sibling list (preserving their real indices in parentChildren).
      //   2. Map the UI insertionIndex [0..numFolders] → desired folder-sibling gap.
      //   3. Convert that gap to the Chrome sibling index of the destination slot so
      //      chrome.bookmarks.move gets the right position.
      //   4. Derive the UI display index (position among folders-only) to feed
      //      optimisticFolderReorder correctly.

      // Folder-type siblings = nodes without a URL (they're folders/groups)
      const folderSiblings = parentChildren.filter((c: any) => !c.url);
      const folderCount = folderSiblings.length;

      // Index of the dragged folder within the folder-sibling list
      const fromFolderSiblingIdx = folderSiblings.findIndex((c: any) => c.id === fromBookmarkId);

      let targetIndex: number;       // Chrome sibling index (used in chrome.bookmarks.move)
      let uiTargetDisplayIdx: number; // Display index among folder-only list (for optimisticFolderReorder)

      if (mode === 'insertion-index') {
        // insertionIndex is a UI gap slot: 0 = before first folder, N = after last folder.
        // Clamp to valid range [0..folderCount].
        const clampedGap = Math.max(0, Math.min(insertionIndex, folderCount));

        // ─── Two-part correct calculation ───────────────────────────────────────
        //
        // PART 1 — uiTargetDisplayIdx (final position in the folder-only list):
        //   Gap G means "insert before folderSiblings[G]".
        //   • Moving DOWN  (fromFolderSiblingIdx < G): after removing the dragged
        //     folder, everything ≥ fromFolderSiblingIdx shifts down by 1. The slot
        //     "before original G" becomes "before G-1" in the shrunk list.
        //     → final display index = G - 1
        //   • Moving UP or same (fromFolderSiblingIdx >= G): no shift at the
        //     target slot. → final display index = G
        //   • Drop at end (clampedGap >= folderCount): land at last slot,
        //     → final display index = folderCount - 1
        //
        // PART 2 — targetIndex (Chrome sibling index passed to bookmarks.move):
        //   Chrome REMOVES the item first, then inserts at `targetIndex` in the
        //   already-shrunk parent list.  Therefore:
        //   • The "insertion point" in Chrome-sibling space =
        //       `insertionChrome` = Chrome index of folderSiblings[clampedGap]
        //       (or parentChildren.length for drop-at-end)
        //   • After removing the dragged folder:
        //     – If moving DOWN (fromChromeIdx < insertionChrome):
        //         everything after fromChromeIdx shifts down 1, so
        //         targetIndex = insertionChrome - 1
        //     – If moving UP or same (fromChromeIdx >= insertionChrome):
        //         no shift at target, targetIndex = insertionChrome
        // ────────────────────────────────────────────────────────────────────────

        const fromChromeIdx = parentChildren.findIndex((c: any) => c.id === fromBookmarkId);

        // Determine the Chrome-sibling "insertion point" (insert BEFORE this index).
        let insertionChrome: number;
        if (clampedGap >= folderCount) {
          // Drop at end — place after the last folder sibling.
          insertionChrome = parentChildren.length;       // one-past-end
          uiTargetDisplayIdx = Math.max(0, folderCount - 1);
        } else {
          const insertBeforeNode = folderSiblings[clampedGap];
          insertionChrome = parentChildren.findIndex((c: any) => c.id === insertBeforeNode?.id);
          if (insertionChrome === -1) insertionChrome = clampedGap; // safe fallback
          // UI display index — where the folder ends up in the folder-only list
          uiTargetDisplayIdx = (fromFolderSiblingIdx < clampedGap)
            ? clampedGap - 1   // moving down: removal shifts target slot by -1
            : clampedGap;      // moving up or same: no shift
        }

        // Apply Chrome removal-then-insert offset
        if (fromChromeIdx < insertionChrome) {
          targetIndex = insertionChrome - 1;  // moving down: account for removal
        } else {
          targetIndex = insertionChrome;      // moving up or same: no adjustment
        }

        console.log(
          `🦁 Position calculation (insertion-index): insertionIndex=${insertionIndex}, clampedGap=${clampedGap}, ` +
          `folderCount=${folderCount}, fromFolderSiblingIdx=${fromFolderSiblingIdx}, fromChromeIdx=${fromChromeIdx}, ` +
          `insertionChrome=${insertionChrome}, targetIndex=${targetIndex}, uiTargetDisplayIdx=${uiTargetDisplayIdx}`
        );
      } else {
        // FINAL INDEX semantics: positionOrInsertionIndex is the desired UI display index.
        // Map it to a Chrome sibling index via the folder-sibling list.
        let requestedDisplayIdx = insertionIndex;
        if (folderCount > 0) {
          requestedDisplayIdx = Math.max(0, Math.min(requestedDisplayIdx, folderCount - 1));
        } else {
          requestedDisplayIdx = 0;
        }

        uiTargetDisplayIdx = requestedDisplayIdx;

        const targetFolderNode = folderSiblings[requestedDisplayIdx];
        targetIndex = parentChildren.findIndex((c: any) => c.id === targetFolderNode?.id);
        if (targetIndex === -1) targetIndex = requestedDisplayIdx;

        console.log(
          `🦁 Position calculation (final-index): requestedDisplayIdx=${requestedDisplayIdx}, ` +
          `folderCount=${folderCount}, chromeSiblingIndex=${targetIndex}`
        );
      }

      const currentIndex = parentChildren.findIndex((c: any) => c.id === fromBookmarkId);

      // CRITICAL DEBUG: Capture Chrome API call with comprehensive error tracking
      let result: any;
      try {
        console.log(`🦁 🚨 EXECUTING Chrome API move operation for moveFolderToPosition...`);
        console.log(`🦁 🚨 Pre-move bookmark tree state check...`);

        // Verify bookmark still exists before moving
        const preCheckBookmark = await browserAPI.bookmarks.get(fromBookmarkId);
        console.log(`🦁 DEBUG: Pre-move bookmark check:`, preCheckBookmark);

        result = await browserAPI.bookmarks.move(fromBookmarkId, {
          parentId: fromFolder.parentId,
          index: targetIndex
        });

        console.log(`🦁 ✅ SUCCESS: Chrome API move completed for moveFolderToPosition:`, result);
        console.log(`🦁 Moved folder ${fromBookmarkId} to position ${targetIndex}`);

        // CRITICAL DEBUG: Verify bookmark exists after move
        setTimeout(async () => {
          try {
            console.log(`🦁 🚨 POST-MOVE VERIFICATION: Checking if bookmark ${result.id} still exists...`);
            const postMoveCheck = await browserAPI.bookmarks.get(result.id);
            console.log(`🦁 ✅ POST-MOVE: Bookmark verified existing:`, postMoveCheck);

            // Check if it's in the expected location
            const postMoveParent = await browserAPI.bookmarks.getChildren(result.parentId);
            const foundIndex = postMoveParent.findIndex((child: any) => child.id === result.id);
            console.log(`🦁 DEBUG: Post-move position verification: expected index ${result.index}, found at index ${foundIndex}`);

            if (foundIndex === -1) {
              console.error(`🦁 🚨 CRITICAL ERROR: Bookmark ${result.id} NOT FOUND in parent ${result.parentId} after move!`);
              console.error(`🦁 DEBUG: Parent children after move:`, postMoveParent.map((child: any) => ({ id: child.id, title: child.title, index: child.index })));
            }
          } catch (verifyError) {
            console.error(`🦁 🚨 CRITICAL ERROR: Post-move verification failed - bookmark may have disappeared!`, verifyError);
          }
        }, 100);

      } catch (apiError) {
        console.error(`🦁 🚨 CRITICAL ERROR: Chrome API move operation failed in moveFolderToPosition!`, apiError);
        console.error(`🦁 DEBUG: Failed move parameters:`, {
          bookmarkId: fromBookmarkId,
          parentId: fromFolder.parentId,
          index: targetIndex,
          originalInsertionIndex: insertionIndex
        });
        throw apiError;
      }

      // Show position in 1-based, folder-only terms (what the user sees in the UI)
      const finalPosition = uiTargetDisplayIdx + 1;
      this.showNotification(`Folder "${fromFolder.title}" moved to position ${finalPosition}`);

      // Instantly reorder the Svelte store using the UI display index (not the Chrome sibling index)
      this.optimisticFolderReorder(fromIndex, uiTargetDisplayIdx);
      console.log('✅ Optimistic folder reorder applied — no page refresh');

      // Clean up ALL drop zones and visual states after successful move
      setTimeout(() => {
        // Clear all drop zone visual states
        document.querySelectorAll('.insertion-point').forEach(point => {
          point.classList.remove('drag-over', 'drag-over-insertion');
        });

        document.querySelectorAll('.folder-container').forEach(folder => {
          folder.classList.remove(
            'drop-zone-active',
            'drop-zone-folder-reorder',
            'drop-zone',
            'drop-target',
            'drop-success'
          );
          folder.removeAttribute('data-drop-zone');
        });

        // Clear any stuck green highlighting
        document.querySelectorAll('.drop-zone-active, .drop-zone, .drop-target').forEach(el => {
          el.classList.remove('drop-zone-active', 'drop-zone', 'drop-target');
        });

        console.log('✅ Cleaned up all drop zone visual states after successful move');
      }, 150);

      // Add visual feedback for successful move (after UI refresh)
      setTimeout(() => {
        this.addMoveSuccessVisualFeedback(fromFolder.title, insertionIndex);
      }, 100);

      // Silently rebuild the ID mapping after 500 ms so subsequent drags have
      // fresh bookmark IDs — does NOT call loadBookmarks or show any toasts.
      setTimeout(() => { this.silentRebuildFolderMappings(); }, 500);

      this.completeOperation(operationId);

      return {
        success: true,
        fromBookmarkId,
        fromIndex,
        insertionIndex,
        targetIndex,
        result
      };

    } catch (e) {
      this.completeOperation(operationId);
      const error = e instanceof Error ? e : new Error(String(e));
      const context = {
        operation: 'moveFolderToPosition',
        fromIndex,
        insertionIndex,
        error: error.message
      };

      console.error('🦁 MOVE FOLDER ERROR:', context);
      this.handleOperationError(error, 'moveFolderToPosition', context);

      return {
        success: false,
        error: error.message,
        fromIndex,
        insertionIndex
      };
    }
  }

  /**
   * Reorder folders by swapping positions (from console script)
   */
  static async reorderFolder(fromIndex: number, toIndex: number): Promise<{ success: boolean; error?: string;[key: string]: any }> {
    console.log(`🦁 API: reorderFolder(${fromIndex}, ${toIndex})`);
    this.systemState.operationCount++;

    try {
      // Check for protected folders
      if (!this.checkFolderProtection(fromIndex, toIndex)) {
        return { success: false, error: 'Protected folder cannot be moved', fromIndex, toIndex };
      }

      let fromBookmarkId = this.folderBookmarkIds.get(fromIndex);
      let toBookmarkId = this.folderBookmarkIds.get(toIndex);

      // If we have placeholder IDs, try to refresh the mappings
      if (!fromBookmarkId || !toBookmarkId ||
        fromBookmarkId.startsWith('placeholder-') ||
        toBookmarkId.startsWith('placeholder-')) {

        console.log('🦁 Placeholder IDs detected, refreshing bookmark mappings...');
        const mappingResult = await this.restoreBookmarkFolderMappings();

        if (mappingResult.success) {
          fromBookmarkId = this.folderBookmarkIds.get(fromIndex);
          toBookmarkId = this.folderBookmarkIds.get(toIndex);
          console.log(`🦁 After refresh: from=${fromBookmarkId}, to=${toBookmarkId}`);
        }

        // Check again after refresh
        if (!fromBookmarkId || !toBookmarkId ||
          fromBookmarkId.startsWith('placeholder-') ||
          toBookmarkId.startsWith('placeholder-')) {
          throw new Error(`Missing real bookmark IDs after refresh: from=${fromBookmarkId}, to=${toBookmarkId}`);
        }
      }

      console.log(`🦁 Swapping positions: ${fromBookmarkId} ↔ ${toBookmarkId}`);

      const [fromFolder] = await browserAPI.bookmarks.get(fromBookmarkId);
      const [toFolder] = await browserAPI.bookmarks.get(toBookmarkId);

      const parentChildren = await browserAPI.bookmarks.getChildren(fromFolder.parentId);

      const currentFromIndex = parentChildren.findIndex((child: any) => child.id === fromBookmarkId);
      const currentToIndex = parentChildren.findIndex((child: any) => child.id === toBookmarkId);

      console.log(`🦁 Current bookmark indices: from=${currentFromIndex}, to=${currentToIndex}`);

      if (currentFromIndex === -1 || currentToIndex === -1) {
        throw new Error('Could not find current positions in bookmark system');
      }

      const result = await browserAPI.bookmarks.move(fromBookmarkId, {
        parentId: fromFolder.parentId,
        index: currentToIndex
      });

      console.log(`🦁 Moved folder ${fromBookmarkId} to position ${currentToIndex}`);

      this.showNotification(`Folders "${fromFolder.title}" and "${toFolder.title}" reordered`);

      // Immediately refresh UI to show new folder order
      console.log('🔄 Triggering immediate UI refresh...');
      await this.refreshUI();

      // Schedule system state refresh using the new timer management
      this.scheduleDelayedRefresh(500, 'reorderFolder');

      return {
        success: true,
        fromBookmarkId,
        toBookmarkId,
        fromIndex,
        toIndex,
        result
      };

    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      const context = {
        operation: 'reorderFolder',
        fromIndex,
        toIndex,
        fromBookmarkId: this.folderBookmarkIds.get(fromIndex),
        toBookmarkId: this.folderBookmarkIds.get(toIndex),
        fromFolderTitle: document.querySelectorAll('.folder-container')[fromIndex]?.querySelector('.folder-title, h3, .folder-name')?.textContent?.trim(),
        toFolderTitle: document.querySelectorAll('.folder-container')[toIndex]?.querySelector('.folder-title, h3, .folder-name')?.textContent?.trim()
      };

      const errorResult = this.handleOperationError(error, 'reorderFolder', context);

      return {
        success: false,
        error: error.message,
        fromIndex,
        toIndex,
        handled: errorResult.handled,
        recoverable: errorResult.recoverable
      };
    }
  }

  /**
   * Setup enhanced styles from console script
   */
  private static setupEnhancedStyles(): void {
    if (document.getElementById('enhanced-drag-drop-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'enhanced-drag-drop-styles';
    styles.textContent = `
      /* Enhanced draggable elements */
      .folder-container[draggable="true"]:not(.protected-folder) {
        cursor: grab !important;
        transition: all 0.2s ease !important;
        border: 2px solid transparent !important;
        border-radius: 8px !important;
        position: relative !important;
      }

      .bookmark-item[draggable="true"] {
        cursor: grab !important;
        transition: all 0.2s ease !important;
        border: 1px solid transparent !important;
        border-radius: 4px !important;
      }

      .folder-container.protected-folder {
        cursor: not-allowed !important;
        background-color: rgba(128, 128, 128, 0.6) !important;
        background: rgba(239, 68, 68, 0.05) !important;
        border: 2px dashed rgba(239, 68, 68, 0.3) !important;
      }

      .folder-container[draggable="true"]:not(.protected-folder):hover {
        border-color: #3b82f6 !important;
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2) !important;
        transform: translateY(-2px) !important;
        background: rgba(59, 130, 246, 0.05) !important;
      }

      .folder-container.protected-folder:hover::after {
        content: "Protected folder - cannot be moved";
        position: absolute;
        top: -30px;
        left: 50%;
        transform: translateX(-50%);
        background: #ef4444;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        white-space: nowrap;
        z-index: 1001;
      }

      /* Enhanced dragging states */
      .dragging {
        background-color: rgba(128, 128, 128, 0.5) !important;
        transform: rotate(3deg) scale(0.95) !important;
        z-index: 1000 !important;
        box-shadow: 0 15px 30px rgba(0,0,0,0.3) !important;
      }

      /* Drop zones - using test-compatible class names */
      .drop-zone-active,
      .drop-zone,
      .drop-target {
        background: rgba(16, 185, 129, 0.1) !important;
        border: 2px dashed #10b981 !important;
        transform: scale(1.02) !important;
      }

      .drop-zone-folder-reorder {
        background: rgba(59, 130, 246, 0.1) !important;
        border-top: 4px solid #3b82f6 !important;
        border-bottom: 4px solid #3b82f6 !important;
      }

      .drop-zone-bookmark-target {
        background: rgba(34, 197, 94, 0.1) !important;
        border: 2px dashed #22c55e !important;
        transform: scale(1.02) !important;
        position: relative !important;
      }

      .drop-zone-bookmark-target::after {
        content: "📁 Drop bookmark here";
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(34, 197, 94, 0.9);
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: bold;
        pointer-events: none;
        z-index: 1000;
      }

      /* Drag ghost/preview for test compatibility */
      .dragging {
        opacity: 0.5 !important;
        transform: rotate(2deg) scale(0.95) !important;
        z-index: 1000 !important;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3) !important;
      }

      .drag-ghost,
      .drag-preview {
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3) !important;
        opacity: 0.8 !important;
        transform: rotate(2deg) !important;
        z-index: 1000 !important;
      }

      /* Success animation */
      @keyframes successPulse {
        0%, 100% { transform: scale(1); }
        25% { transform: scale(1.05); box-shadow: 0 0 20px rgba(16, 185, 129, 0.4); }
        50% { transform: scale(1.02); }
        75% { transform: scale(1.05); box-shadow: 0 0 20px rgba(16, 185, 129, 0.4); }
      }

      .drop-success {
        background: rgba(16, 185, 129, 0.2) !important;
        border: 2px solid #10b981 !important;
        animation: successPulse 2s ease !important;
      }
    `;

    document.head.appendChild(styles);
    console.log('✅ Enhanced drag-drop styles added');
  }

  /**
   * Setup bookmark drag functionality
   */
  static setupBookmarkDragDrop(): { draggable: number } {
    const bookmarks = document.querySelectorAll('.bookmark-item');
    console.log(`🦁 Setting up enhanced bookmark drag for ${bookmarks.length} bookmarks...`);

    let draggableCount = 0;

    bookmarks.forEach((bookmark, bookmarkIndex) => {
      // CRITICAL FIX: Skip bookmarks already managed by Svelte components
      // This prevents duplicate event listener registration
      if (bookmark.hasAttribute('data-svelte-managed-drag')) {
        this.debugLog(`Skipping bookmark ${bookmarkIndex} - already managed by Svelte component`);
        return;
      }

      // Clear existing handlers
      ['dragstart', 'dragend'].forEach(event => {
        const handler = (bookmark as any)[`_${event}Handler`];
        if (handler) {
          bookmark.removeEventListener(event, handler);
        }
      });

      // Get bookmark data from element or attributes
      const titleElement = bookmark.querySelector('.bookmark-title');
      const bookmarkTitle = titleElement?.textContent?.trim() || 'Unknown Bookmark';
      const bookmarkId = bookmark.getAttribute('data-bookmark-id') ||
        bookmark.getAttribute('data-id') ||
        `bookmark-${bookmarkIndex}`;
      const bookmarkUrl = bookmark.getAttribute('data-url') || '';

      // Set up draggable
      bookmark.setAttribute('draggable', 'true');
      bookmark.classList.add('enhanced-draggable-bookmark');

      // Drag start handler for bookmarks
      (bookmark as any)._dragstartHandler = (e: DragEvent) => {
        this.currentDragData = {
          type: 'bookmark',
          id: bookmarkId,
          title: bookmarkTitle,
          url: bookmarkUrl,
          index: bookmarkIndex
        };

        this.debugLog(`🦁 BOOKMARK DRAG START: "${bookmarkTitle}" (id: ${bookmarkId})`);

        // Set drag data with both formats for compatibility
        const dragDataStr = JSON.stringify(this.currentDragData);
        e.dataTransfer?.setData('text/plain', dragDataStr);
        e.dataTransfer?.setData('application/x-favault-bookmark', dragDataStr);
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
        }

        bookmark.classList.add('dragging');
        document.body.classList.add('dragging-bookmark-active');
      };

      // Drag end handler for bookmarks
      (bookmark as any)._dragendHandler = (e: DragEvent) => {
        console.log(`🦁 BOOKMARK DRAG END: "${bookmarkTitle}"`);

        bookmark.classList.remove('dragging');
        document.body.classList.remove('dragging-bookmark-active');

        // Clear drag data
        this.currentDragData = null;

        // Clear all drop zone indicators
        document.querySelectorAll('.drop-zone').forEach(zone => {
          zone.classList.remove('drop-zone', 'drop-target', 'drop-zone-bookmark-target');
          zone.removeAttribute('data-drop-zone');
        });
      };

      // Attach event listeners
      bookmark.addEventListener('dragstart', (bookmark as any)._dragstartHandler);
      bookmark.addEventListener('dragend', (bookmark as any)._dragendHandler);

      draggableCount++;
    });

    console.log(`✅ Enhanced bookmark drag setup complete: ${draggableCount} draggable bookmarks`);
    return { draggable: draggableCount };
  }

  /**
   * Initialize DOM observer to detect when folder containers are added
   * Enhanced with proper debouncing and infinite loop prevention
   */
  private static initializeDOMObserver(): void {
    if (this.domObserver) {
      this.domObserver.disconnect();
    }

    this.domObserver = new MutationObserver((mutations) => {
      // Prevent excessive triggering
      const now = Date.now();
      if (now - this.lastDomObserverTrigger < 100) { // Minimum 100ms between triggers
        this.domObserverTriggerCount++;
        if (this.domObserverTriggerCount > this.MAX_OBSERVER_TRIGGERS_PER_SECOND) {
          this.debugLog('🚫 DOM Observer: Too many rapid triggers, throttling...');
          return;
        }
      } else {
        this.domObserverTriggerCount = 0;
      }
      this.lastDomObserverTrigger = now;

      let folderContainersAdded = false;
      let relevantChanges = false;

      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // Only check added nodes, not removed ones
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              // Check if the added node is a folder container or contains folder containers
              if (element.classList?.contains('folder-container') ||
                element.querySelector?.('.folder-container')) {
                folderContainersAdded = true;
                this.debugLog('🦁 DOM Observer: New folder container added to DOM');
              }
            }
          });
        } else if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          // Only watch for class changes on elements that are becoming folder containers
          const element = mutation.target as Element;
          const oldValue = mutation.oldValue || '';
          const newValue = element.className || '';

          // Only trigger if element is gaining the folder-container class (not losing it or changing other classes)
          if (!oldValue.includes('folder-container') && newValue.includes('folder-container')) {
            relevantChanges = true;
            this.debugLog('🦁 DOM Observer: Element became folder container');
          }
        }
      });

      // Only proceed if we have meaningful changes and edit mode is enabled
      if ((folderContainersAdded || relevantChanges) && this.editModeEnabled) {
        this.debugLog('🦁 DOM Observer: Relevant folder container changes detected');

        // Clear any existing debounce timer
        if (this.domObserverDebounceTimer) {
          clearTimeout(this.domObserverDebounceTimer);
        }

        // Debounce the setup to avoid multiple rapid calls
        this.domObserverDebounceTimer = window.setTimeout(() => {
          this.domObserverDebounceTimer = null;

          // Double-check that we still need to run setup
          if (this.editModeEnabled) {
            this.debugLog('🦁 DOM Observer: Executing debounced folder setup...');
            const result = this.setupFolderDragDrop();
            this.debugLog(`🦁 DOM Observer setup result: ${result.draggable} draggable, ${result.protected} protected`);
          }
        }, this.DOM_OBSERVER_DEBOUNCE_MS);
      }
    });

    // Observe with more targeted configuration to reduce noise
    // Try to observe more specific containers first, fall back to document.body if needed
    const targetContainers = [
      document.querySelector('.app'),
      document.querySelector('#app'),
      document.querySelector('.bookmark-container'),
      document.querySelector('.folders-container')
    ].filter(Boolean);

    const observeTarget = targetContainers.length > 0 ? targetContainers[0] : document.body;

    this.domObserver.observe(observeTarget as Element, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'], // Only watch class changes, not draggable attribute changes
      attributeOldValue: true // Track old values to detect meaningful changes
    });

    this.debugLog(`✅ DOM Observer initialized with enhanced debouncing and loop prevention (observing: ${(observeTarget as Element).tagName || 'body'})`);
  }

  /**
   * Setup folder drag-drop functionality with protection and retry logic
   * Enhanced with recursive call prevention and debug logging
   */
  static setupFolderDragDrop(): { draggable: number; protected: number } {
    // Prevent recursive calls during setup
    if (this.activeOperations.has('setupFolderDragDrop')) {
      this.debugLog('🚫 setupFolderDragDrop already in progress, skipping recursive call');
      return { draggable: 0, protected: 0 };
    }

    this.activeOperations.add('setupFolderDragDrop');

    try {
      const folders = document.querySelectorAll('.folder-container');
      this.debugLog(`🦁 Setting up enhanced drag-drop for ${folders.length} folders...`);

      // If no folders found and we haven't exceeded retry attempts, schedule a retry
      if (folders.length === 0 && this.folderSetupRetryCount < this.maxRetryAttempts) {
        this.folderSetupRetryCount++;
        const retryDelay = Math.min(500 * this.folderSetupRetryCount, 2000); // Exponential backoff, max 2s

        this.debugLog(`🦁 No folder containers found (attempt ${this.folderSetupRetryCount}/${this.maxRetryAttempts}), retrying in ${retryDelay}ms...`);

        const timeoutId = window.setTimeout(() => {
          this.retryTimeouts.delete(timeoutId);
          this.activeOperations.delete('setupFolderDragDrop'); // Clear operation flag before retry
          this.setupFolderDragDrop();
        }, retryDelay);

        this.retryTimeouts.add(timeoutId);
        this.activeOperations.delete('setupFolderDragDrop'); // Clear operation flag
        return { draggable: 0, protected: 0 };
      }

      // Reset retry count on successful folder detection
      if (folders.length > 0) {
        this.folderSetupRetryCount = 0;
      }

      let draggableCount = 0;
      let protectedCount = 0;

      folders.forEach((folder, folderIndex) => {
        // Clear existing handlers
        ['dragstart', 'dragend', 'dragover', 'dragenter', 'dragleave', 'drop'].forEach(event => {
          const handler = (folder as any)[`_${event}Handler`];
          if (handler) {
            folder.removeEventListener(event, handler);
          }
        });

        const folderTitle = folder.querySelector('.folder-title, h3, .folder-name')?.textContent?.trim() || `Folder ${folderIndex + 1}`;
        const bookmarkId = this.folderBookmarkIds.get(folderIndex);

        // Check if this is a protected folder
        const isProtected = (bookmarkId && this.protectedFolderIds.has(bookmarkId)) || (bookmarkId && this.isProtectedFolder(bookmarkId, folderTitle));

        if (isProtected) {
          // Mark as protected and make non-draggable
          folder.classList.add('protected-folder');
          folder.setAttribute('draggable', 'false');
          (folder as HTMLElement).draggable = false;
          (folder as HTMLElement).style.cursor = 'not-allowed';

          // Add protected indicator
          if (!folder.querySelector('.protected-indicator')) {
            const indicator = document.createElement('div');
            indicator.className = 'protected-indicator';
            indicator.innerHTML = '🔒';
            indicator.style.cssText = `
            position: absolute;
            top: 8px;
            left: 8px;
            color: #ef4444;
            font-size: 14px;
            z-index: 10;
          `;
            folder.appendChild(indicator);
          }

          console.log(`🔒 Protected folder: "${folderTitle}" (index: ${folderIndex})`);
          protectedCount++;
          return; // Skip drag-drop setup for protected folders
        }

        // Setup draggable folder
        folder.classList.remove('protected-folder');
        folder.setAttribute('draggable', 'true');
        (folder as HTMLElement).draggable = true;
        folder.classList.add('draggable-folder');
        (folder as HTMLElement).style.cursor = 'grab';
        (folder as HTMLElement).style.position = 'relative';

        // Add drag handle if not exists
        if (!folder.querySelector('.enhanced-drag-handle')) {
          const handle = document.createElement('div');
          handle.className = 'enhanced-drag-handle';
          handle.innerHTML = '⋮⋮';
          handle.style.cssText = `
          position: absolute;
          top: 8px;
          right: 8px;
          color: #6b7280;
          font-size: 14px;
          opacity: 0;
          transition: opacity 0.2s ease;
          pointer-events: none;
          z-index: 10;
        `;
          folder.appendChild(handle);
        }

        // Drag start handler
        (folder as any)._dragstartHandler = (e: DragEvent) => {
          // Double-check protection at drag start
          if ((bookmarkId && this.protectedFolderIds.has(bookmarkId)) || (bookmarkId && this.isProtectedFolder(bookmarkId, folderTitle))) {
            e.preventDefault();
            this.showNotification(`Cannot move protected folder "${folderTitle}"`, 'error');
            return;
          }

          this.currentDragData = {
            type: 'folder',
            id: bookmarkId || '',
            title: folderTitle,
            index: folderIndex,
            bookmarkId: bookmarkId
          };

          // If the drag originated from a bookmark item inside this folder,
          // do NOT treat it as a folder drag (avoid overwriting bookmark drag data)
          const target = e.target as HTMLElement | null;
          if (target && target.closest('.bookmark-item')) {
            this.debugLog('🦁 FOLDER dragstart ignored (originated from bookmark item)');
            return;
          }

          console.log(`🦁 DRAG START: "${folderTitle}" (index: ${folderIndex}, bookmarkId: ${bookmarkId})`);

          // Set drag data with both formats for compatibility
          const dragDataStr = JSON.stringify(this.currentDragData);
          e.dataTransfer?.setData('text/plain', dragDataStr);
          e.dataTransfer?.setData('application/x-favault-bookmark', dragDataStr);
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
          }

          // Visual feedback - add test-compatible classes
          folder.classList.add('dragging', 'drag-ghost');
          folder.setAttribute('data-dragging', 'true');
          document.body.classList.add('dragging-folder-active', 'drag-active');
          document.body.style.cursor = 'grabbing';

          // Add drag-active class to app container for insertion point visibility
          const appContainer = document.querySelector('.app');
          if (appContainer) {
            appContainer.classList.add('drag-active');
          }

          // Prevent auto-scrolling during drag operations
          this.preventAutoScroll();
        };

        // Drag end handler
        (folder as any)._dragendHandler = (e: DragEvent) => {
          console.log(`🦁 DRAG END: "${folderTitle}"`);

          folder.classList.remove('dragging', 'drag-ghost');
          folder.removeAttribute('data-dragging');
          document.body.classList.remove('dragging-folder-active', 'drag-active');
          document.body.style.cursor = '';

          // Remove drag-active class from app container
          const appContainer = document.querySelector('.app');
          if (appContainer) {
            appContainer.classList.remove('drag-active');
          }

          // Comprehensive cleanup of ALL visual states
          this.cleanupAllDropZones();

          // Restore normal scroll behavior
          this.restoreAutoScroll();

          this.currentDragData = null;
          this.dragEnterCounters.clear();
        };

        // Drop zone handlers - folder reordering now handled by insertion points
        (folder as any)._dragoverHandler = (e: DragEvent) => {
          // Allow bookmark drops into folders
          if (this.currentDragData?.type === 'bookmark' &&
            bookmarkId && !this.protectedFolderIds.has(bookmarkId)) {
            e.preventDefault();
            if (e.dataTransfer) {
              e.dataTransfer.dropEffect = 'move';
            }
            return;
          }
        };

        (folder as any)._dragenterHandler = (e: DragEvent) => {
          const folderId = `folder-${folderIndex}`;
          if (!this.dragEnterCounters.has(folderId)) {
            this.dragEnterCounters.set(folderId, 0);
          }
          this.dragEnterCounters.set(folderId, this.dragEnterCounters.get(folderId)! + 1);

          if (this.dragEnterCounters.get(folderId) === 1) {
            // Folder reordering is now handled by insertion points, not folder drop zones
            // Only handle bookmark drops into folders
            if (this.currentDragData?.type === 'bookmark' &&
              bookmarkId && !this.protectedFolderIds.has(bookmarkId)) {
              this.debugLog(`🦁 BOOKMARK DROP TARGET: "${folderTitle}"`);
              folder.classList.add('drop-zone-bookmark-target', 'drop-zone', 'drop-target');
              folder.setAttribute('data-drop-zone', 'true');
            }
          }
        };

        (folder as any)._dragleaveHandler = (e: DragEvent) => {
          const folderId = `folder-${folderIndex}`;
          const count = this.dragEnterCounters.get(folderId) || 0;
          this.dragEnterCounters.set(folderId, Math.max(0, count - 1));

          if (this.dragEnterCounters.get(folderId) === 0) {
            // Remove all drop zone classes
            folder.classList.remove(
              'drop-zone-folder-reorder',
              'drop-zone-bookmark-target',
              'drop-zone',
              'drop-target'
            );
            folder.removeAttribute('data-drop-zone');
          }
        };

        // Drop handler with error handling
        (folder as any)._dropHandler = async (e: DragEvent) => {
          // If the drop originated from inside this folder's own bookmarks grid, the
          // Svelte grid handler (onGridDrop / onContainerDrop) has already processed it
          // and called e.stopPropagation() on the bubbling phase.  However this handler
          // is registered on the bubbling phase too and may still fire for drops that
          // the Svelte handler already handled (capture-phase vs bubble-phase ordering).
          // Check the event path: if the deepest target is inside .bookmarks-grid we
          // skip further processing to avoid double-moves and conflicting toasts.
          const dropTarget = e.target as HTMLElement | null;
          if (dropTarget && dropTarget.closest('.bookmarks-grid, .bookmark-wrapper')) {
            // This drop was already handled by the Svelte in-grid handler — bail out
            // without showing any toast or triggering another API call.
            return;
          }

          e.preventDefault();
          e.stopPropagation();

          const folderId = `folder-${folderIndex}`;
          this.dragEnterCounters.set(folderId, 0);

          // Clear any drop-zone state on this folder
          folder.classList.remove(
            'drop-zone-folder-reorder',
            'drop-zone-bookmark-target',
            'drop-zone',
            'drop-target'
          );
          folder.removeAttribute('data-drop-zone');

          // --- Folder-on-folder drop: use moveFolderToPosition so drag gestures reorder folders ---
          if (this.currentDragData?.type === 'folder') {
            try {
              // Determine the current set of visible folders and indices
              const allFolders = Array.from(document.querySelectorAll('.folder-container')) as HTMLElement[];
              const domTargetIndex = allFolders.indexOf(folder as HTMLElement);

              // Prefer the index captured at drag start, but fall back to DOM lookup if needed
              let fromIndex =
                typeof this.currentDragData.index === 'number'
                  ? this.currentDragData.index
                  : allFolders.findIndex(el => el.getAttribute('data-dragging') === 'true');

              if (fromIndex === -1) {
                // As a final fallback, derive from folderBookmarkIds mapping if possible
                const fromBookmarkId = this.currentDragData.bookmarkId;
                if (fromBookmarkId) {
                  for (const [idx, id] of this.folderBookmarkIds.entries()) {
                    if (id === fromBookmarkId) {
                      fromIndex = idx;
                      break;
                    }
                  }
                }
              }

              const childCount = allFolders.length;

              console.log('🦁 FOLDER DROP (container)', {
                title: this.currentDragData.title,
                fromIndex,
                domTargetIndex,
                childCount
              });

              if (fromIndex === -1 || domTargetIndex === -1) {
                console.warn('🦁 FOLDER DROP: Unable to resolve fromIndex or targetIndex; aborting move', {
                  fromIndex,
                  domTargetIndex
                });
                return;
              }

              if (fromIndex === domTargetIndex) {
                console.log('🦁 FOLDER DROP: Source and target are the same index; no move performed');
                return;
              }

              // We want the final folder index to equal domTargetIndex (what the tests expect).
              const targetIndex = domTargetIndex;

              console.log('🦁 FOLDER DROP → moveFolderToPosition mapping (final-index semantics)', {
                fromIndex,
                domTargetIndex,
                childCount,
                targetIndex
              });

              const moveResult = await this.moveFolderToPosition(fromIndex, targetIndex, { mode: 'final-index' });

              if (!moveResult.success) {
                console.error('❌ FOLDER DROP MOVE FAILED:', moveResult);
                this.handleOperationError(
                  new Error(moveResult.error || 'Folder drop move failed'),
                  'folderDrop',
                  {
                    fromIndex,
                    domTargetIndex,
                    folderTitle,
                    bookmarkId
                  }
                );
              }
            } catch (err) {
              const error = err instanceof Error ? err : new Error(String(err));
              console.error('🦁 FOLDER DROP ERROR:', error);
              this.handleOperationError(error, 'folderDrop', {
                sourceIndex: this.currentDragData?.index,
                targetFolderIndex: folderIndex,
                targetFolderTitle: folderTitle
              });
            } finally {
              // Ensure all drop zone visuals are cleaned up shortly after the drop
              setTimeout(() => {
                this.cleanupAllDropZones();
              }, 200);
            }
            return;
          }

          // --- Bookmark-on-folder drop: existing behavior (move bookmark into folder) ---
          if (this.currentDragData?.type === 'bookmark' &&
            bookmarkId && !this.protectedFolderIds.has(bookmarkId)) {

            console.log(`🦁 BOOKMARK DROP: "${this.currentDragData.title}" → "${folderTitle}"`);

            // Show loading state
            folder.classList.add('drop-zone-active');

            try {
              if (!bookmarkId) {
                throw new Error('Target folder has no bookmark ID');
              }
              const result = await this.moveBookmarkToFolder(this.currentDragData, bookmarkId);

              if (result.success) {
                console.log('✅ BOOKMARK DROP SUCCESS:', result);
                folder.classList.add('drop-success');
                this.showNotification(`Bookmark "${this.currentDragData.title}" moved to "${folderTitle}"`);

                // Auto-refresh after successful move
                setTimeout(() => {
                  this.showRefreshPrompt();
                }, 1000);
              } else {
                console.error('❌ BOOKMARK DROP FAILED:', result);
                this.showNotification(`Drop failed: ${result.error}`, 'error');
              }
            } catch (e) {
              const error = e instanceof Error ? e : new Error(String(e));
              console.error('🦁 BOOKMARK DROP ERROR:', error);
              this.handleOperationError(error, 'bookmarkDrop', {
                bookmarkId: this.currentDragData.id,
                bookmarkTitle: this.currentDragData.title,
                targetFolderId: bookmarkId,
                targetFolderTitle: folderTitle
              });
            }

            // Reset visual state
            setTimeout(() => {
              folder.classList.remove('drop-zone-active', 'drop-success');
            }, 3000);
          }
        };

        // Attach all event listeners
        folder.addEventListener('dragstart', (folder as any)._dragstartHandler);
        folder.addEventListener('dragend', (folder as any)._dragendHandler);
        folder.addEventListener('dragover', (folder as any)._dragoverHandler);
        folder.addEventListener('dragenter', (folder as any)._dragenterHandler);
        folder.addEventListener('dragleave', (folder as any)._dragleaveHandler);
        folder.addEventListener('drop', (folder as any)._dropHandler);

        draggableCount++;
      });

      this.debugLog(`✅ Enhanced drag-drop setup complete: ${draggableCount} draggable, ${protectedCount} protected`);
      return { draggable: draggableCount, protected: protectedCount };
    } finally {
      // Always clear the operation flag, even if an error occurs
      this.activeOperations.delete('setupFolderDragDrop');
    }
  }

  /**
   * Show refresh prompt after successful operations
   */
  static showRefreshPrompt(): void {
    const existing = document.getElementById('refresh-prompt');
    if (existing) existing.remove();

    const refreshDiv = document.createElement('div');
    refreshDiv.id = 'refresh-prompt';
    refreshDiv.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #3b82f6;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: bold;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      cursor: pointer;
      transition: all 0.3s ease;
    `;
    refreshDiv.innerHTML = `
      🔄 Refresh page to see new bookmark order<br>
      <small style="opacity: 0.8;">Click to refresh now</small>
    `;

    refreshDiv.onclick = () => {
      console.log('🦁 Refreshing page to show new bookmark order...');
      window.location.reload();
    };

    refreshDiv.onmouseenter = () => {
      refreshDiv.style.transform = 'scale(1.05)';
    };

    refreshDiv.onmouseleave = () => {
      refreshDiv.style.transform = 'scale(1)';
    };

    document.body.appendChild(refreshDiv);

    setTimeout(() => {
      if (refreshDiv.parentNode) {
        refreshDiv.remove();
      }
    }, 10000);
  }

  /**
   * Restore bookmark folder mappings (called during initialization)
   */
  static async restoreBookmarkFolderMappings(): Promise<{ success: boolean; mappedCount: number; protectedCount: number; totalFolders: number; error?: string }> {
    try {
      console.log('🦁 Restoring bookmark folder mappings...');

      // Get the bookmark tree from Chrome
      const bookmarkTree = await browserAPI.bookmarks.getTree();

      this.folderBookmarkIds.clear();
      this.protectedFolderIds.clear();

      const folders = document.querySelectorAll('.folder-container, [data-testid="bookmark-folder"]');
      let mappedCount = 0;
      let protectedCount = 0;

      console.log(`🦁 Found ${folders.length} folder containers in DOM`);

      // If no folders found, this might be called too early - that's OK, we'll retry later
      if (folders.length === 0) {
        console.log('🦁 No folder containers found yet - will retry when edit mode is enabled');
      }

      folders.forEach((folder, index) => {
        const folderTitle = folder.querySelector('.folder-title, h3, .folder-name, [data-testid="folder-title"]')?.textContent?.trim();

        if (folderTitle) {
          const bookmarkFolder = this.findBookmarkFolderByTitle(bookmarkTree, folderTitle);

          if (bookmarkFolder) {
            this.folderBookmarkIds.set(index, bookmarkFolder.id);

            // Check if this is a protected folder
            if (this.isProtectedFolder(bookmarkFolder.id, folderTitle)) {
              console.log(`🔒 Protected: "${folderTitle}" (${index}) → ${bookmarkFolder.id} [PROTECTED]`);
              protectedCount++;
            } else {
              console.log(`📁 Mapped: "${folderTitle}" (${index}) → ${bookmarkFolder.id}`);
            }
            mappedCount++;
          } else {
            console.warn(`⚠️ Could not find bookmark folder for "${folderTitle}"`);
            this.folderBookmarkIds.set(index, `placeholder-${index}`);
          }
        } else {
          console.warn(`⚠️ No title found for folder at index ${index}`);
          this.folderBookmarkIds.set(index, `placeholder-${index}`);
        }
      });

      console.log(`✅ Restored ${mappedCount} bookmark mappings (${protectedCount} protected) out of ${folders.length} folders`);
      return {
        success: true,
        mappedCount,
        protectedCount,
        totalFolders: folders.length
      };

    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      console.error('🦁 ERROR: Failed to restore bookmark mappings:', error);
      return { success: false, mappedCount: 0, protectedCount: 0, totalFolders: 0, error: error.message };
    }
  }

  /**
   * Move a bookmark to a different folder
   */
  static async moveBookmarkToFolder(dragData: any, targetFolderId: string): Promise<{ success: boolean; error?: string; result?: any; handled?: boolean; recoverable?: boolean; }> {
    console.log(`🦁 API: moveBookmarkToFolder("${dragData.title}", ${targetFolderId})`);
    this.systemState.operationCount++;

    try {
      if (!dragData.id) {
        throw new Error('Invalid bookmark data - missing ID');
      }

      console.log(`🦁 Moving bookmark ${dragData.id} to folder ${targetFolderId}`);

      // Get current bookmark info
      const [bookmark] = await browserAPI.bookmarks.get(dragData.id);
      console.log('🦁 Current bookmark:', bookmark);

      // CRITICAL DEBUG: Capture Chrome API call for bookmark moves to folders
      let result: any;
      try {
        console.log(`🦁 🚨 EXECUTING Chrome API move operation for moveBookmarkToFolder...`);
        console.log(`🦁 🚨 Pre-move bookmark tree state check...`);

        // Verify bookmark still exists before moving
        const preCheckBookmark = await browserAPI.bookmarks.get(dragData.id);
        console.log(`🦁 DEBUG: Pre-move bookmark check:`, preCheckBookmark);

        // Verify target folder exists
        const preCheckTargetFolder = await browserAPI.bookmarks.get(targetFolderId);
        console.log(`🦁 DEBUG: Pre-move target folder check:`, preCheckTargetFolder);

        result = await browserAPI.bookmarks.move(dragData.id, {
          parentId: targetFolderId
        });

        console.log('🦁 ✅ SUCCESS: Chrome API move completed for moveBookmarkToFolder:', result);

        // CRITICAL DEBUG: Verify bookmark exists after move
        setTimeout(async () => {
          try {
            console.log(`🦁 🚨 POST-MOVE VERIFICATION: Checking if bookmark ${result.id} still exists...`);
            const postMoveCheck = await browserAPI.bookmarks.get(result.id);
            console.log(`🦁 ✅ POST-MOVE: Bookmark verified existing:`, postMoveCheck);

            // Check if it's in the expected location
            const postMoveParent = await browserAPI.bookmarks.getChildren(result.parentId);
            const foundIndex = postMoveParent.findIndex((child: any) => child.id === result.id);
            console.log(`🦁 DEBUG: Post-move position verification in target folder: found at index ${foundIndex}`);

            if (foundIndex === -1) {
              console.error(`🦁 🚨 CRITICAL ERROR: Bookmark ${result.id} NOT FOUND in target folder ${result.parentId} after move!`);
              console.error(`🦁 DEBUG: Target folder children after move:`, postMoveParent.map((child: any) => ({ id: child.id, title: child.title, index: child.index })));
            }
          } catch (verifyError) {
            console.error(`🦁 🚨 CRITICAL ERROR: Post-move verification failed - bookmark may have disappeared!`, verifyError);
          }
        }, 100);

      } catch (apiError) {
        console.error(`🦁 🚨 CRITICAL ERROR: Chrome API move operation failed in moveBookmarkToFolder!`, apiError);
        console.error(`🦁 DEBUG: Failed move parameters:`, {
          bookmarkId: dragData.id,
          targetFolderId,
          dragDataTitle: dragData.title
        });
        throw apiError;
      }
      // NOTE: callers are responsible for showing the user-facing success notification
      // so that the message can be contextualised (e.g. "moved to <folder>").

      return {
        success: true,
        result: result
      };

    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      const context = {
        operation: 'moveBookmarkToFolder',
        bookmarkId: dragData.id,
        bookmarkTitle: dragData.title,
        targetFolderId: targetFolderId
      };

      const handled = this.handleOperationError(error, 'moveBookmarkToFolder', context);
      return {
        success: false,
        error: error.message,
        handled: handled.handled,
        recoverable: handled.recoverable
      };
    }
  }

  /**
   * Enable edit mode with enhanced functionality
   */
  static async enableEditMode(): Promise<void> {
    this.editModeEnabled = true;
    document.body.classList.add('edit-mode');

    // Enable mousedown scroll prevention for edit mode
    this.preventMousedownAutoScroll();

    // Re-initialize folder mappings in case they weren't found during initial setup
    console.log('🦁 Restoring bookmark folder mappings for edit mode...');
    const mappingResult = await this.restoreBookmarkFolderMappings();

    if (mappingResult.success) {
      console.log(`✅ Successfully mapped ${mappingResult.mappedCount} folders (${mappingResult.protectedCount} protected)`);
    } else {
      console.error('❌ Failed to restore bookmark mappings:', mappingResult.error);
    }

    // Setup enhanced styles
    this.setupEnhancedStyles();

    // Initialize DOM observer for dynamic folder detection
    this.initializeDOMObserver();

    // Setup bookmark drag functionality
    const bookmarkResult = this.setupBookmarkDragDrop();
    console.log(`✅ Enhanced bookmark drag enabled: ${bookmarkResult.draggable} draggable bookmarks`);

    // Setup folder drag-drop with retry logic
    const folderResult = this.setupFolderDragDrop();
    console.log(`✅ Enhanced folder drag enabled: ${folderResult.draggable} draggable, ${folderResult.protected} protected`);

    // If no folders were found initially, the retry logic will handle it
    if (folderResult.draggable === 0 && folderResult.protected === 0) {
      console.log('🦁 No folders found initially - DOM observer and retry logic will handle folder detection');
    }

    const combinedResult = {
      bookmarks: bookmarkResult.draggable,
      folders: folderResult.draggable,
      protected: folderResult.protected,
      total: bookmarkResult.draggable + folderResult.draggable
    };

    console.log(`✅ Enhanced edit mode enabled: ${combinedResult.total} total draggable items (${combinedResult.bookmarks} bookmarks, ${combinedResult.folders} folders, ${combinedResult.protected} protected)`);

    // Set global flag for tests to check
    (window as any).enhancedDragDropReady = true;
    (window as any).enhancedDragDropStats = combinedResult;
  }

  /**
   * Global cleanup of all drop zone visual states
   */
  static cleanupAllDropZones(): void {
    console.log('🧹 Cleaning up all drop zones globally');

    // Clean up insertion points
    document.querySelectorAll('.insertion-point').forEach(point => {
      point.classList.remove('drag-over', 'drag-over-insertion');
    });

    // Clean up folder containers
    document.querySelectorAll('.folder-container').forEach(folder => {
      folder.classList.remove(
        'drop-zone-active',
        'drop-zone-folder-reorder',
        'drop-zone-bookmark-target',
        'drop-zone',
        'drop-target',
        'drop-success',
        'dragging'
      );
      folder.removeAttribute('data-drop-zone');
      folder.removeAttribute('data-dragging');
    });

    // Clean up bookmark items
    document.querySelectorAll('.bookmark-item').forEach(item => {
      item.classList.remove('dragging');
      item.removeAttribute('data-dragging');
    });

    // Clean up body classes
    document.body.classList.remove('dragging-folder-active', 'dragging-bookmark-active', 'drag-active');

    // Clean up app container
    const appContainer = document.querySelector('.app');
    if (appContainer) {
      appContainer.classList.remove('drag-active');
    }

    console.log('✅ All drop zones cleaned up');
  }

  /**
   * Disable edit mode
   */
  static disableEditMode(): void {
    this.editModeEnabled = false;
    document.body.classList.remove('edit-mode', 'dragging-folder-active', 'dragging-bookmark-active');

    // Restore normal scroll behavior
    this.restoreAutoScroll();

    // Clean up bookmark drag functionality
    document.querySelectorAll('.bookmark-item').forEach(bookmark => {
      ['dragstart', 'dragend'].forEach(event => {
        const handler = (bookmark as any)[`_${event}Handler`];
        if (handler) {
          bookmark.removeEventListener(event, handler);
          delete (bookmark as any)[`_${event}Handler`];
        }
      });

      bookmark.classList.remove('enhanced-draggable-bookmark', 'dragging');
      bookmark.removeAttribute('draggable');
      (bookmark as HTMLElement).draggable = false;
      (bookmark as HTMLElement).style.cursor = '';
    });

    // Clean up folder drag functionality
    document.querySelectorAll('.folder-container').forEach(folder => {
      // Remove event listeners
      ['dragstart', 'dragend', 'dragover', 'dragenter', 'dragleave', 'drop'].forEach(event => {
        const handler = (folder as any)[`_${event}Handler`];
        if (handler) {
          folder.removeEventListener(event, handler);
          delete (folder as any)[`_${event}Handler`];
        }
      });

      // Remove classes and attributes
      folder.classList.remove(
        'draggable-folder',
        'protected-folder',
        'dragging',
        'drop-zone-active',
        'drop-zone-folder-reorder',
        'drop-zone-bookmark-target',
        'drop-zone',
        'drop-target',
        'drop-success'
      );
      folder.removeAttribute('draggable');
      (folder as HTMLElement).draggable = false;
      (folder as HTMLElement).style.cursor = '';

      // Remove indicators
      folder.querySelectorAll('.protected-indicator, .enhanced-drag-handle').forEach(el => el.remove());
    });

    // Clear state
    this.currentDragData = null;
    this.dragEnterCounters.clear();

    // Disconnect DOM observer
    if (this.domObserver) {
      this.domObserver.disconnect();
      this.domObserver = null;
      console.log('✅ DOM Observer disconnected');
    }

    // Clear retry timeouts
    this.retryTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    this.retryTimeouts.clear();
    this.folderSetupRetryCount = 0;

    // Clear pending refresh timers
    this.clearPendingRefreshTimers();

    // Clear active operations
    this.clearActiveOperations();

    // Clear global flags
    (window as any).enhancedDragDropReady = false;
    delete (window as any).enhancedDragDropStats;

    console.log('✅ Enhanced edit mode disabled');
  }
}
