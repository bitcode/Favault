import { writable } from 'svelte/store';
import { browserAPI } from './api';

// Persistent storage key for folder expansion state
const STORAGE_KEY = 'favault-folder-expansion';

export type FolderExpansionState = Record<string, boolean>;

// In-memory state + Svelte store for reactive consumers
const expansionStore = writable<FolderExpansionState>({});
let currentState: FolderExpansionState = {};
let initialized = false;

expansionStore.subscribe((v) => {
  currentState = v || {};
});

async function readFromStorage(): Promise<FolderExpansionState> {
  // Prefer local storage for faster writes and fewer quota constraints.
  try {
    const res = await browserAPI.storage?.local?.get?.(STORAGE_KEY);
    return (res && res[STORAGE_KEY]) || {};
  } catch (_) {
    // Fallback to sync storage
    try {
      const res = await browserAPI.storage?.sync?.get?.(STORAGE_KEY);
      return (res && res[STORAGE_KEY]) || {};
    } catch (_) {
      // Final fallback to window.localStorage
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    }
  }
}

async function writeToStorage(state: FolderExpansionState): Promise<void> {
  try {
    await browserAPI.storage?.local?.set?.({ [STORAGE_KEY]: state });
  } catch (_) {
    try {
      await browserAPI.storage?.sync?.set?.({ [STORAGE_KEY]: state });
    } catch (_) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Ignore final fallback failures
      }
    }
  }
}

// Initialize the store from storage (idempotent)
export async function initFolderExpansionState(): Promise<void> {
  if (initialized) return;
  const saved = await readFromStorage();
  expansionStore.set(saved);
  initialized = true;

  // Optional: keep in sync if storage changes from another context/tab
  try {
    browserAPI.storage?.onChanged?.addListener?.((changes: any, areaName: string) => {
      if ((areaName === 'local' || areaName === 'sync') && changes[STORAGE_KEY]) {
        const newValue = changes[STORAGE_KEY].newValue || {};
        expansionStore.set(newValue);
      }
    });
  } catch {
    // No-op if not supported
  }
}

export function getFolderExpanded(id: string, defaultValue = true): boolean {
  const v = currentState[id];
  return typeof v === 'boolean' ? v : defaultValue;
}

export function setFolderExpanded(id: string, expanded: boolean): void {
  expansionStore.update((prev) => {
    const next = { ...(prev || {}), [id]: expanded };
    // Persist immediately on every change
    void writeToStorage(next);
    return next;
  });
}

export { expansionStore as folderExpansionStore };

