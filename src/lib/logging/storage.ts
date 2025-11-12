import type { LogEntry } from './types';

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

  // Using import.meta.env.SSR to allow Vite to tree-shake.
  // The `as any` cast is to avoid a TypeScript error if `vite/client`
  // types are not in tsconfig.json.
  if ((import.meta as any).env.SSR) {
    const { storage } = await import('./storage.node');
    storageAdapter = storage;
  } else {
    const { storage } = await import('./storage.browser');
    storageAdapter = storage;
  }
  return storageAdapter;
};