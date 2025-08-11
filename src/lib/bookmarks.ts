import { ExtensionAPI, type BookmarkItem, type BookmarkFolder } from './api';

// Bookmark processing and organization logic
export class BookmarkManager {
  private static bookmarkCache: BookmarkFolder[] = [];
  private static lastFetch: number = 0;
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static async getOrganizedBookmarks(): Promise<BookmarkFolder[]> {
    const now = Date.now();
    
    // Return cached data if still valid
    if (this.bookmarkCache.length > 0 && (now - this.lastFetch) < this.CACHE_DURATION) {
      return this.bookmarkCache;
    }

    try {
      const bookmarkTree = await ExtensionAPI.getBookmarkTree();
      const organized = this.organizeBookmarks(bookmarkTree);
      
      this.bookmarkCache = organized;
      this.lastFetch = now;
      
      return organized;
    } catch (error) {
      console.error('Failed to get organized bookmarks:', error);
      return [];
    }
  }

  private static organizeBookmarks(tree: BookmarkItem[]): BookmarkFolder[] {
    const folders: BookmarkFolder[] = [];
    
    // Recursively traverse the bookmark tree
    const traverse = (nodes: BookmarkItem[], parentTitle = '') => {
      for (const node of nodes) {
        if (node.children) {
          // This is a folder
          const bookmarks = this.extractBookmarksFromFolder(node.children);
          if (bookmarks.length > 0) {
            folders.push({
              id: node.id,
              title: node.title || 'Untitled Folder',
              bookmarks,
              color: this.generateFolderColor(node.title || node.id)
            });
          }
          // Continue traversing subfolders
          traverse(node.children, node.title);
        }
      }
    };

    traverse(tree);
    return folders;
  }

  private static extractBookmarksFromFolder(children: BookmarkItem[]): BookmarkItem[] {
    return children.filter(child => child.url && child.url.trim() !== '');
  }

  private static generateFolderColor(identifier: string): string {
    // Generate HSL color based on folder name/id for consistent coloring
    let hash = 0;
    for (let i = 0; i < identifier.length; i++) {
      hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 65%, 75%)`;
  }

  static searchBookmarks(folders: BookmarkFolder[], query: string): BookmarkFolder[] {
    if (!query.trim()) return folders;
    
    const searchTerm = query.toLowerCase();
    
    return folders.map(folder => ({
      ...folder,
      bookmarks: folder.bookmarks.filter(bookmark => 
        bookmark.title.toLowerCase().includes(searchTerm) ||
        (bookmark.url && bookmark.url.toLowerCase().includes(searchTerm))
      )
    })).filter(folder => folder.bookmarks.length > 0);
  }

  static clearCache(): void {
    this.bookmarkCache = [];
    this.lastFetch = 0;
  }
}
