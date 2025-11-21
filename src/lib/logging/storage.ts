import type { LogEntry } from './types';
import { storage as browserStorage } from './storage.browser';

export interface IStorageAdapter {
  store(entry: LogEntry): Promise<void>;
  retrieveLogs?(): Promise<LogEntry[]>;
  downloadLogs?(): Promise<void>;
}

let storageAdapter: IStorageAdapter | null = null;

export const getStorageAdapter = async (): Promise<IStorageAdapter> => {
  if (storageAdapter) {
    return storageAdapter;
  }

  // Detect environment: Node.js vs Browser
  // Check for Node.js-specific globals first
  const isNode = typeof process !== 'undefined' &&
                 process.versions != null &&
                 process.versions.node != null;

  // Also check for browser-specific globals to be extra sure
  const isBrowser = typeof window !== 'undefined' ||
                    typeof self !== 'undefined';

  if (isNode && !isBrowser) {
    // Node.js environment (Playwright tests)
    // Wrap dynamic import to prevent Vite's preload helper from breaking service workers
    try {
      const { storage } = await import('./storage.node');
      storageAdapter = storage;
    } catch (error) {
      console.error('[Logging] Failed to load Node.js storage adapter:', error);
      // Fallback to browser storage
      storageAdapter = browserStorage;
    }
  } else {
    // Browser environment (Chrome extension, service worker, etc.)
    // Use static import to avoid Vite's dynamic import helper (which uses window)
    storageAdapter = browserStorage;
  }
  return storageAdapter;
};