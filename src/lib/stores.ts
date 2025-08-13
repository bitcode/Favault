import { writable, derived } from 'svelte/store';
import type { BookmarkFolder, UserSettings } from './api';
import { ExtensionAPI } from './api';

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

// Store for user settings
export const userSettings = writable<UserSettings>(ExtensionAPI.getDefaultSettings());

// Store for edit mode state
export const editMode = writable<boolean>(false);

// Store for settings panel visibility
export const settingsVisible = writable<boolean>(false);

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

// Derived stores for specific settings sections
export const themeSettings = derived(
  userSettings,
  ($userSettings) => $userSettings.theme
);

export const layoutSettings = derived(
  userSettings,
  ($userSettings) => $userSettings.layout
);

export const editModeSettings = derived(
  userSettings,
  ($userSettings) => $userSettings.editMode
);

// Settings management functions
export const settingsManager = {
  // Load settings from storage
  async loadSettings(): Promise<void> {
    try {
      const settings = await ExtensionAPI.getSettings();
      userSettings.set(settings);
      editMode.set(settings.editMode.enabled);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  },

  // Save settings to storage
  async saveSettings(newSettings: Partial<UserSettings>): Promise<void> {
    try {
      userSettings.update(current => {
        const updated = { ...current, ...newSettings };
        ExtensionAPI.saveSettings(updated);
        return updated;
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  },

  // Update specific setting section
  async updateTheme(themeUpdate: Partial<UserSettings['theme']>): Promise<void> {
    userSettings.update(current => ({
      ...current,
      theme: { ...current.theme, ...themeUpdate }
    }));

    const currentSettings = await ExtensionAPI.getSettings();
    await ExtensionAPI.saveSettings({
      ...currentSettings,
      theme: { ...currentSettings.theme, ...themeUpdate }
    });
  },

  async updateLayout(layoutUpdate: Partial<UserSettings['layout']>): Promise<void> {
    userSettings.update(current => ({
      ...current,
      layout: { ...current.layout, ...layoutUpdate }
    }));

    const currentSettings = await ExtensionAPI.getSettings();
    await ExtensionAPI.saveSettings({
      ...currentSettings,
      layout: { ...currentSettings.layout, ...layoutUpdate }
    });
  },

  async updateEditMode(editModeUpdate: Partial<UserSettings['editMode']>): Promise<void> {
    userSettings.update(current => ({
      ...current,
      editMode: { ...current.editMode, ...editModeUpdate }
    }));

    if (editModeUpdate.enabled !== undefined) {
      editMode.set(editModeUpdate.enabled);
    }

    const currentSettings = await ExtensionAPI.getSettings();
    await ExtensionAPI.saveSettings({
      ...currentSettings,
      editMode: { ...currentSettings.editMode, ...editModeUpdate }
    });
  },

  // Reset settings to defaults
  async resetSettings(): Promise<void> {
    const defaultSettings = ExtensionAPI.getDefaultSettings();
    userSettings.set(defaultSettings);
    editMode.set(defaultSettings.editMode.enabled);
    await ExtensionAPI.saveSettings(defaultSettings);
  }
};
