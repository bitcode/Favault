// Cross-browser API abstraction layer
// Use global browser object for better compatibility
declare global {
  const chrome: any;
  const browser: any;
}

// Unified browser API interface - use global objects
export const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

// Type definitions for bookmark data
export interface BookmarkItem {
  id: string;
  title: string;
  url?: string;
  parentId?: string;
  index?: number;
  dateAdded?: number;
  dateGroupModified?: number;
  children?: BookmarkItem[];
}

export interface BookmarkFolder {
  id: string;
  title: string;
  bookmarks: BookmarkItem[];
  color?: string;
}

// Settings interfaces
export interface ThemeSettings {
  selectedTheme: string;
  customColors: Record<string, string>;
  backgroundGradient: string[];
}

export interface LayoutSettings {
  viewMode: 'compact' | 'grid' | 'tags';
  itemsPerRow: number;
  showFavicons: boolean;
  compactSpacing: boolean;
}

export interface EditModeSettings {
  enabled: boolean;
  autoSave: boolean;
  showEditHints: boolean;
}

export interface UserSettings {
  theme: ThemeSettings;
  layout: LayoutSettings;
  editMode: EditModeSettings;
  version: string;
}

// Bookmark operation interfaces
export interface BookmarkMoveDestination {
  parentId?: string;
  index?: number;
}

export interface BookmarkCreateDetails {
  parentId?: string;
  index?: number;
  title: string;
  url?: string;
}

export interface BookmarkUpdateChanges {
  title?: string;
  url?: string;
}

export interface BookmarkOperationResult {
  success: boolean;
  bookmark?: BookmarkItem;
  error?: string;
}

export interface BulkOperationResult {
  successful: BookmarkOperationResult[];
  failed: BookmarkOperationResult[];
  totalProcessed: number;
}

export interface BookmarkValidationError {
  type: 'ROOT_MODIFICATION' | 'SPECIAL_FOLDER' | 'INVALID_PARENT' | 'CIRCULAR_REFERENCE' | 'PERMISSION_DENIED';
  message: string;
  bookmarkId?: string;
}

// Cross-browser compatible API functions
export class ExtensionAPI {
  static async getBookmarkTree(): Promise<BookmarkItem[]> {
    try {
      return await browserAPI.bookmarks.getTree();
    } catch (error) {
      console.error('Failed to get bookmark tree:', error);
      throw error;
    }
  }

  static async sendMessage(message: any): Promise<any> {
    try {
      return await browserAPI.runtime.sendMessage(message);
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  static onMessage(callback: (message: any, sender: any, sendResponse: any) => void): void {
    browserAPI.runtime.onMessage.addListener(callback);
  }

  static onCommand(callback: (command: string) => void): void {
    browserAPI.commands.onCommand.addListener(callback);
  }

  // Storage API methods
  static async getSettings(): Promise<UserSettings> {
    try {
      const result = await browserAPI.storage.sync.get('userSettings');
      return result.userSettings || this.getDefaultSettings();
    } catch (error) {
      console.warn('Failed to get settings from sync storage, trying local:', error);
      try {
        const result = await browserAPI.storage.local.get('userSettings');
        return result.userSettings || this.getDefaultSettings();
      } catch (localError) {
        console.warn('Failed to get settings from local storage, using localStorage:', localError);
        const settings = localStorage.getItem('favault-settings');
        return settings ? JSON.parse(settings) : this.getDefaultSettings();
      }
    }
  }

  static async saveSettings(settings: UserSettings): Promise<void> {
    try {
      await browserAPI.storage.sync.set({ userSettings: settings });
    } catch (error) {
      console.warn('Failed to save settings to sync storage, trying local:', error);
      try {
        await browserAPI.storage.local.set({ userSettings: settings });
      } catch (localError) {
        console.warn('Failed to save settings to local storage, using localStorage:', localError);
        localStorage.setItem('favault-settings', JSON.stringify(settings));
      }
    }
  }

  static getDefaultSettings(): UserSettings {
    return {
      theme: {
        selectedTheme: 'default',
        customColors: {},
        backgroundGradient: ['#667eea', '#764ba2']
      },
      layout: {
        viewMode: 'grid',
        itemsPerRow: 4,
        showFavicons: true,
        compactSpacing: false
      },
      editMode: {
        enabled: false,
        autoSave: true,
        showEditHints: true
      },
      version: '1.0.0'
    };
  }

  // Storage change listener
  static onStorageChanged(callback: (changes: any) => void): void {
    if (browserAPI.storage && browserAPI.storage.onChanged) {
      browserAPI.storage.onChanged.addListener(callback);
    }
  }
}

// Enhanced bookmark management API
export class BookmarkEditAPI extends ExtensionAPI {
  // Special folder IDs that cannot be modified
  private static readonly PROTECTED_FOLDERS = ['0', '1', '2']; // Root, Bookmarks Bar, Other Bookmarks

  // Ensure we only register native listeners once
  private static listenersInstalled = false;

  // Event listeners for bookmark changes
  private static eventListeners: Map<string, Function[]> = new Map();

  // Serialization queue for move operations to prevent race conditions
  private static moveQueue: Promise<any> = Promise.resolve();

  /**
   * Move a bookmark or folder to a new location
   * Serialized to prevent race conditions as recommended by Chrome API docs
   */
  static async moveBookmark(id: string, destination: BookmarkMoveDestination): Promise<BookmarkOperationResult> {
    // Serialize move operations to prevent race conditions
    return this.moveQueue = this.moveQueue.then(async () => {
      try {
        console.log('Moving bookmark:', id, 'to destination:', destination);

        // Get current bookmark data before move
        const [currentBookmark] = await browserAPI.bookmarks.get(id);
        if (!currentBookmark) {
          return { success: false, error: 'Bookmark not found' };
        }

        // Validate the move operation
        const validation = await this.validateMove(id, destination);
        if (!validation.success) {
          return { success: false, error: validation.error };
        }

        // Preserve bookmark metadata during move
        const preservedData = {
          title: currentBookmark.title,
          url: currentBookmark.url,
          dateAdded: currentBookmark.dateAdded,
          dateGroupModified: currentBookmark.dateGroupModified
        };

        // Perform the move operation (serialized)
        const result = await browserAPI.bookmarks.move(id, destination);

      // Verify the move was successful and data is preserved
      const [movedBookmark] = await browserAPI.bookmarks.get(id);
      if (!movedBookmark) {
        return { success: false, error: 'Bookmark lost during move operation' };
      }

      // Check if metadata was preserved
      const metadataPreserved =
        movedBookmark.title === preservedData.title &&
        movedBookmark.url === preservedData.url &&
        movedBookmark.dateAdded === preservedData.dateAdded;

      if (!metadataPreserved) {
        console.warn('Bookmark metadata may have been altered during move:', {
          original: preservedData,
          moved: {
            title: movedBookmark.title,
            url: movedBookmark.url,
            dateAdded: movedBookmark.dateAdded
          }
        });
      }

      console.log('Successfully moved bookmark:', {
        id,
        from: { parentId: currentBookmark.parentId, index: currentBookmark.index },
        to: { parentId: result.parentId, index: result.index },
        metadataPreserved
      });

        return {
          success: true,
          bookmark: result,
          metadata: {
            preserved: metadataPreserved,
            original: preservedData,
            moved: movedBookmark
          }
        };
      } catch (error) {
        console.error('Failed to move bookmark:', error);
        return {
          success: false,
          error: this.parseBookmarkError(error)
        };
      }
    });
  }

  /**
   * Update bookmark title or URL
   */
  static async updateBookmark(id: string, changes: BookmarkUpdateChanges): Promise<BookmarkOperationResult> {
    try {
      // Validate the update
      if (this.PROTECTED_FOLDERS.includes(id)) {
        return {
          success: false,
          error: 'Cannot modify protected system folders'
        };
      }

      // Validate title if provided
      if (changes.title !== undefined && !changes.title.trim()) {
        return {
          success: false,
          error: 'Title cannot be empty'
        };
      }

      // Validate URL if provided
      if (changes.url !== undefined && changes.url.trim()) {
        try {
          new URL(changes.url);
        } catch {
          return {
            success: false,
            error: 'Invalid URL format'
          };
        }
      }

      const result = await browserAPI.bookmarks.update(id, changes);

      return {
        success: true,
        bookmark: result
      };
    } catch (error) {
      console.error('Failed to update bookmark:', error);
      return {
        success: false,
        error: this.parseBookmarkError(error)
      };
    }
  }

  /**
   * Create a new bookmark or folder
   */
  static async createBookmark(details: BookmarkCreateDetails): Promise<BookmarkOperationResult> {
    try {
      // Validate parent folder
      if (details.parentId && this.PROTECTED_FOLDERS.includes(details.parentId) && details.parentId === '0') {
        return {
          success: false,
          error: 'Cannot create bookmarks in root folder'
        };
      }

      // Validate title
      if (!details.title.trim()) {
        return {
          success: false,
          error: 'Title cannot be empty'
        };
      }

      // Validate URL if provided (for bookmarks, not folders)
      if (details.url && details.url.trim()) {
        try {
          new URL(details.url);
        } catch {
          return {
            success: false,
            error: 'Invalid URL format'
          };
        }
      }

      const result = await browserAPI.bookmarks.create(details);

      return {
        success: true,
        bookmark: result
      };
    } catch (error) {
      console.error('Failed to create bookmark:', error);
      return {
        success: false,
        error: this.parseBookmarkError(error)
      };
    }
  }

  /**
   * Remove a single bookmark
   */
  static async removeBookmark(id: string): Promise<BookmarkOperationResult> {
    try {
      // Validate removal
      if (this.PROTECTED_FOLDERS.includes(id)) {
        return {
          success: false,
          error: 'Cannot remove protected system folders'
        };
      }

      await browserAPI.bookmarks.remove(id);

      return { success: true };
    } catch (error) {
      console.error('Failed to remove bookmark:', error);
      return {
        success: false,
        error: this.parseBookmarkError(error)
      };
    }
  }

  /**
   * Remove a folder and all its contents
   */
  static async removeBookmarkTree(id: string): Promise<BookmarkOperationResult> {
    try {
      // Validate removal
      if (this.PROTECTED_FOLDERS.includes(id)) {
        return {
          success: false,
          error: 'Cannot remove protected system folders'
        };
      }

      await browserAPI.bookmarks.removeTree(id);

      return { success: true };
    } catch (error) {
      console.error('Failed to remove bookmark tree:', error);
      return {
        success: false,
        error: this.parseBookmarkError(error)
      };
    }
  }

  /**
   * Bulk move multiple bookmarks
   */
  static async bulkMoveBookmarks(bookmarkIds: string[], destination: BookmarkMoveDestination): Promise<BulkOperationResult> {
    const successful: BookmarkOperationResult[] = [];
    const failed: BookmarkOperationResult[] = [];

    for (const id of bookmarkIds) {
      try {
        const result = await this.moveBookmark(id, destination);
        if (result.success) {
          successful.push(result);
        } else {
          failed.push(result);
        }

        // Small delay to prevent API throttling
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        failed.push({
          success: false,
          error: this.parseBookmarkError(error)
        });
      }
    }

    return {
      successful,
      failed,
      totalProcessed: bookmarkIds.length
    };
  }

  /**
   * Search bookmarks with advanced options
   */
  static async searchBookmarks(query: string): Promise<BookmarkItem[]> {
    try {
      return await browserAPI.bookmarks.search(query);
    } catch (error) {
      console.error('Failed to search bookmarks:', error);
      throw error;
    }
  }

  /**
   * Get bookmark by ID
   */
  static async getBookmark(id: string): Promise<BookmarkItem[]> {
    try {
      return await browserAPI.bookmarks.get(id);
    } catch (error) {
      console.error('Failed to get bookmark:', error);
      throw error;
    }
  }

  /**
   * Get children of a folder
   */
  static async getBookmarkChildren(id: string): Promise<BookmarkItem[]> {
    try {
      return await browserAPI.bookmarks.getChildren(id);
    } catch (error) {
      console.error('Failed to get bookmark children:', error);
      throw error;
    }
  }

  /**
   * Get recent bookmarks
   */
  static async getRecentBookmarks(numberOfItems: number = 10): Promise<BookmarkItem[]> {
    try {
      return await browserAPI.bookmarks.getRecent(numberOfItems);
    } catch (error) {
      console.error('Failed to get recent bookmarks:', error);
      throw error;
    }
  }

  /**
   * Validate a move operation
   */
  private static async validateMove(id: string, destination: BookmarkMoveDestination): Promise<BookmarkOperationResult> {
    try {
      // Check if trying to move to root
      if (destination.parentId === '0') {
        return {
          success: false,
          error: 'Cannot move bookmarks to root folder'
        };
      }

      // Check if moving protected folders
      if (this.PROTECTED_FOLDERS.includes(id)) {
        return {
          success: false,
          error: 'Cannot move protected system folders'
        };
      }

      // Check for circular reference (moving folder into itself)
      if (destination.parentId && await this.isCircularReference(id, destination.parentId)) {
        return {
          success: false,
          error: 'Cannot move folder into itself or its subfolder'
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: this.parseBookmarkError(error)
      };
    }
  }

  /**
   * Check for circular reference in folder moves
   */
  private static async isCircularReference(folderId: string, targetParentId: string): Promise<boolean> {
    try {
      const bookmark = await browserAPI.bookmarks.get(folderId);
      if (!bookmark[0] || !bookmark[0].children) {
        return false; // Not a folder
      }

      // Check if target is the same as source
      if (folderId === targetParentId) {
        return true;
      }

      // Check if target is a child of source
      const children = await this.getAllDescendants(folderId);
      return children.some(child => child.id === targetParentId);
    } catch (error) {
      console.error('Error checking circular reference:', error);
      return false;
    }
  }

  /**
   * Get all descendants of a folder
   */
  private static async getAllDescendants(folderId: string): Promise<BookmarkItem[]> {
    const descendants: BookmarkItem[] = [];

    try {
      const children = await browserAPI.bookmarks.getChildren(folderId);

      for (const child of children) {
        descendants.push(child);
        if (child.children) {
          const subDescendants = await this.getAllDescendants(child.id);
          descendants.push(...subDescendants);
        }
      }
    } catch (error) {
      console.error('Error getting descendants:', error);
    }

    return descendants;
  }

  /**
   * Parse bookmark API errors into user-friendly messages
   */
  private static parseBookmarkError(error: any): string {
    const message = error?.message || error?.toString() || 'Unknown error';

    if (message.includes('bookmark root cannot be modified')) {
      return 'Cannot modify root bookmark folder';
    }
    if (message.includes('No node with the given id exists')) {
      return 'Bookmark not found';
    }
    if (message.includes('Cannot create bookmark')) {
      return 'Failed to create bookmark - check permissions';
    }
    if (message.includes('Cannot move bookmark')) {
      return 'Failed to move bookmark - invalid destination';
    }

    return `Bookmark operation failed: ${message}`;
  }

  /**
   * Set up bookmark event listeners
   */
  static setupEventListeners(): void {
    if (this.listenersInstalled) {
      return;
    }
    this.listenersInstalled = true;

    // Listen for bookmark creation
    if (browserAPI.bookmarks.onCreated) {
      browserAPI.bookmarks.onCreated.addListener((id: string, bookmark: BookmarkItem) => {
        this.notifyEventListeners('created', { id, bookmark });
      });
    }

    // Listen for bookmark changes
    if (browserAPI.bookmarks.onChanged) {
      browserAPI.bookmarks.onChanged.addListener((id: string, changeInfo: any) => {
        this.notifyEventListeners('changed', { id, changeInfo });
      });
    }

    // Listen for bookmark moves
    if (browserAPI.bookmarks.onMoved) {
      browserAPI.bookmarks.onMoved.addListener((id: string, moveInfo: any) => {
        this.notifyEventListeners('moved', { id, moveInfo });
      });
    }

    // Listen for bookmark removal
    if (browserAPI.bookmarks.onRemoved) {
      browserAPI.bookmarks.onRemoved.addListener((id: string, removeInfo: any) => {
        this.notifyEventListeners('removed', { id, removeInfo });
      });
    }

    // Listen for folder children reordering
    if (browserAPI.bookmarks.onChildrenReordered) {
      browserAPI.bookmarks.onChildrenReordered.addListener((id: string, reorderInfo: any) => {
        this.notifyEventListeners('reordered', { id, reorderInfo });
      });
    }
  }

  /**
   * Add event listener for bookmark changes
   */
  static addEventListener(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  static removeEventListener(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Notify all event listeners
   */
  private static notifyEventListeners(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in bookmark event listener for ${event}:`, error);
        }
      });
    }
  }
}
