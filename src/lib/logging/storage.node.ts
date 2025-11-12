import type { LogEntry } from './types';
import fs from 'fs';
import path from 'path';
import type { IStorageAdapter } from './storage';

// --- Node.js Adapter ---
class NodeStorageAdapter implements IStorageAdapter {
  private logFilePath: string;
  private initPromise: Promise<void>;

  constructor() {
    const logDir = path.resolve(process.cwd(), 'logs');
    this.logFilePath = path.resolve(logDir, 'playwright.log');
    this.initPromise = (async () => {
      await fs.promises.mkdir(logDir, { recursive: true });
    })();
  }

  public async store(entry: LogEntry): Promise<void> {
    await this.initPromise;
    const logLine = JSON.stringify(entry) + '\n';
    try {
      await fs.promises.appendFile(this.logFilePath, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }
}

export const storage = new NodeStorageAdapter();