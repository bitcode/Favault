import { ExtensionAPI, type BookmarkItem, type BookmarkFolder } from './api';

// Bookmark processing and organization logic
export class BookmarkManager {
  private static bookmarkCache: BookmarkFolder[] = [];
  private static lastFetch: number = 0;
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static async getOrganizedBookmarks(forceRefresh = false): Promise<BookmarkFolder[]> {
    const now = Date.now();

    // Return cached data if still valid and not forcing refresh
    if (!forceRefresh && this.bookmarkCache.length > 0 && (now - this.lastFetch) < this.CACHE_DURATION) {
      return this.bookmarkCache;
    }

    try {
      console.log('🔄 Fetching fresh bookmark data from Chrome API...');
      const bookmarkTree = await ExtensionAPI.getBookmarkTree();
      const organized = this.organizeBookmarks(bookmarkTree);

      this.bookmarkCache = organized;
      this.lastFetch = now;

      console.log(`✅ Organized ${organized.length} bookmark folders`);
      return organized;
    } catch (error) {
      console.error('Failed to get organized bookmarks:', error);
      return [];
    }
  }

  // Chrome's absolute root node (id='0') has no title and must never appear as a user folder.
  // IDs '1' (Bookmarks Bar) and '2' (Other Bookmarks) are allowed through — they surface
  // root-level bookmarks that don't belong to any subfolder.
  private static readonly SYSTEM_ROOT_IDS = new Set(['0']);

  private static organizeBookmarks(tree: BookmarkItem[]): BookmarkFolder[] {
    const folders: BookmarkFolder[] = [];

    // Recursively traverse the bookmark tree
    const traverse = (nodes: BookmarkItem[]) => {
      for (const node of nodes) {
        if (node.children) {
          // Skip Chrome system root containers (id 0, 1, 2) and any node with no title
          // These are internal Chrome nodes, not real user folders
          const isSystemRoot = this.SYSTEM_ROOT_IDS.has(node.id);
          const hasTitle = node.title && node.title.trim() !== '';

          if (!isSystemRoot && hasTitle) {
            const bookmarks = this.extractBookmarksFromFolder(node.children);
            folders.push({
              id: node.id,
              title: node.title,
              bookmarks,
              color: this.generateFolderColor(node.title || node.id)
            });
          }

          // Always recurse into children to find nested user folders
          traverse(node.children);
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
