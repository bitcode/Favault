import type { LogEntry } from './types';
import type { IStorageAdapter } from './storage';

// --- Browser Adapter ---
class BrowserStorageAdapter implements IStorageAdapter {
  private db: Promise<IDBDatabase>;
  private dbName = 'FavaultLogDB';
  private storeName = 'logs';
  private isInitialized = false;

  constructor() {
    // Resolve the IndexedDB factory in a way that is safe in both browser and Node environments.
    // We MUST NOT access `self` or `window` directly at module evaluation time in Node,
    // so we always guard them with `typeof` checks.
    const indexedDBFactory: IDBFactory | null =
      typeof indexedDB !== 'undefined'
        ? indexedDB
        : typeof window !== 'undefined' && (window as any).indexedDB
        ? (window as any).indexedDB
        : typeof self !== 'undefined' && (self as any).indexedDB
        ? (self as any).indexedDB
        : null;

    if (!indexedDBFactory) {
      // In non-browser environments (e.g. Node/Playwright) IndexedDB won't exist.
      // Make the adapter a no-op but DO NOT reject at construction time, to avoid
      // failing module evaluation when this file is imported in Node.
      console.warn('[Logging] IndexedDB not available; browser logging storage disabled.');
      this.db = Promise.resolve(null as unknown as IDBDatabase);
      return;
    }

    this.db = new Promise((resolve, reject) => {
      try {
        const request = indexedDBFactory.open(this.dbName, 1);

        request.onerror = () => {
          const error = new Error(`Failed to open IndexedDB: ${request.error?.message || 'Unknown error'}`);
          console.error('[Logging] IndexedDB initialization failed:', error);
          reject(error);
        };

        request.onsuccess = () => {
          this.isInitialized = true;
          console.log('[Logging] IndexedDB initialized successfully');
          resolve(request.result);
        };

        request.onupgradeneeded = () => {
          console.log('[Logging] Creating IndexedDB object store');
          request.result.createObjectStore(this.storeName, { autoIncrement: true });
        };
      } catch (error) {
        console.error('[Logging] Failed to initialize IndexedDB:', error);
        reject(error);
      }
    });
  }

  public async store(entry: LogEntry): Promise<void> {
    try {
      const db = await this.db;
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);

      return new Promise((resolve, reject) => {
        const request = store.add(entry);
        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.error('[Logging] Failed to store log entry:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('[Logging] Error storing log entry:', error);
      // Don't throw - we don't want logging failures to break the app
    }
  }

  public async retrieveLogs(): Promise<LogEntry[]> {
    const db = await this.db;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      request.onerror = () => reject(new Error('Failed to retrieve logs from IndexedDB'));
      request.onsuccess = () => resolve(request.result);
    });
  }

  public async downloadLogs(): Promise<void> {
    try {
      const logs = await this.retrieveLogs();
      const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `favault-logs-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download logs:', error);
    }
  }
}

export const storage = new BrowserStorageAdapter();