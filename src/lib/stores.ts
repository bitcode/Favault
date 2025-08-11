import { writable, derived } from 'svelte/store';
import type { BookmarkFolder } from './api';

// Store for all bookmark folders
export const bookmarkFolders = writable<BookmarkFolder[]>([]);

// Store for search query
export const searchQuery = writable<string>('');

// Store for loading state
export const isLoading = writable<boolean>(true);

// Store for error state
export const error = writable<string | null>(null);

// Store for UI state
export const uiState = writable({
  searchFocused: false,
  darkMode: false
});

// Derived store for filtered bookmarks based on search
export const filteredBookmarks = derived(
  [bookmarkFolders, searchQuery],
  ([$bookmarkFolders, $searchQuery]) => {
    if (!$searchQuery.trim()) {
      return $bookmarkFolders;
    }

    const query = $searchQuery.toLowerCase();
    return $bookmarkFolders.map(folder => ({
      ...folder,
      bookmarks: folder.bookmarks.filter(bookmark =>
        bookmark.title.toLowerCase().includes(query) ||
        (bookmark.url && bookmark.url.toLowerCase().includes(query))
      )
    })).filter(folder => folder.bookmarks.length > 0);
  }
);

// Derived store for search results count
export const searchResultsCount = derived(
  filteredBookmarks,
  ($filteredBookmarks) => {
    return $filteredBookmarks.reduce((total, folder) => total + folder.bookmarks.length, 0);
  }
);
