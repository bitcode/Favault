import type { LogEntry } from './types';
import type { IStorageAdapter } from './storage';

// --- Browser Adapter ---
class BrowserStorageAdapter implements IStorageAdapter {
  private db: Promise<IDBDatabase>;
  private dbName = 'FavaultLogDB';
  private storeName = 'logs';

  constructor() {
    this.db = new Promise((resolve, reject) => {
      const request = self.indexedDB.open(this.dbName, 1);
      request.onerror = () => reject(new Error('Failed to open IndexedDB'));
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(this.storeName, { autoIncrement: true });
      };
    });
  }

  public async store(entry: LogEntry): Promise<void> {
    const db = await this.db;
    const transaction = db.transaction(this.storeName, 'readwrite');
    const store = transaction.objectStore(this.storeName);
    store.add(entry);
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