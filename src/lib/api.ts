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
}
