// Type definitions for the extension

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

export interface UIState {
  searchFocused: boolean;
  darkMode: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface SearchState {
  query: string;
  results: BookmarkFolder[];
  resultCount: number;
}

export interface ExtensionMessage {
  type: 'FOCUS_SEARCH' | 'GET_BOOKMARKS' | 'PING';
  data?: any;
}

export interface ExtensionResponse {
  success: boolean;
  data?: any;
  error?: string;
}
