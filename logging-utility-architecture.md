# Isomorphic Logging Utility Architecture

This document outlines the architecture for a logging utility designed to work in both Node.js (for Playwright tests) and browser environments (service worker, content scripts).

## 1. File Structure

The new logging utility will be located in `src/lib/logging/`. This co-locates the logging module with other shared library code.

```
src/
└── lib/
    └── logging/
        ├── index.ts          # Main entry point for the logger
        ├── types.ts          # TypeScript interfaces (LogEntry, LogLevel, etc.)
        ├── storage.ts        # Abstract storage layer and environment-specific implementations
        └── config.ts         # Configuration management (log level, enabled/disabled)
```

## 2. Core Logger Module (`index.ts`)

The core module will provide a singleton `Logger` instance responsible for intercepting console messages and dispatching them to the appropriate storage adapter.

### API

```typescript
// src/lib/logging/index.ts

import { configure, isEnabled, setLogLevel } from './config';
import { IStorageAdapter } from './storage';

class Logger {
  private originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };

  private storageAdapter: IStorageAdapter;

  constructor(storageAdapter: IStorageAdapter) {
    this.storageAdapter = storageAdapter;
  }

  public init(): void {
    if (isEnabled()) {
      this.interceptConsole();
    }
  }

  private interceptConsole(): void {
    (console.log as any) = (...args: any[]) => {
      this.log('INFO', args);
      this.originalConsole.log.apply(console, args);
    };
    // ... similar interception for warn, error, debug
  }

  private log(level: LogLevel, args: any[]): void {
    if (!isEnabled()) return;

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: this.formatMessage(args),
      args,
    };

    this.storageAdapter.store(logEntry);
  }

  private formatMessage(args: any[]): string {
    return args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ');
  }
}

// Factory function to create the logger with the correct storage adapter
export function createLogger(): Logger {
  const storageAdapter = getStorageAdapter(); // Implemented in storage.ts
  return new Logger(storageAdapter);
}
```

## 3. Environment-Specific Adapters (`storage.ts`)

To handle the different environments, we'll use an adapter pattern. An abstract `IStorageAdapter` interface will define the contract, and concrete implementations will handle the specifics of Node.js and the browser.

### `IStorageAdapter` Interface

```typescript
// src/lib/logging/types.ts

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  args: any[];
}

// src/lib/logging/storage.ts
export interface IStorageAdapter {
  store(entry: LogEntry): Promise<void>;
  retrieveLogs?(): Promise<LogEntry[]>;
  downloadLogs?(): Promise<void>;
}
```

### Node.js Adapter

In Node.js, the adapter will write logs directly to a file.

```typescript
// src/lib/logging/storage.ts (Node.js part)
import fs from 'fs';
import path from 'path';

class NodeStorageAdapter implements IStorageAdapter {
  private logFilePath = path.resolve(process.cwd(), 'logs/playwright.log');

  constructor() {
    const logDir = path.dirname(this.logFilePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  public async store(entry: LogEntry): Promise<void> {
    const logLine = JSON.stringify(entry) + '\n';
    fs.appendFileSync(this.logFilePath, logLine);
  }
}
```

### Browser Adapter

In the browser, the adapter will use `IndexedDB` to store logs. It will also provide a method to download the logs as a file.

```typescript
// src/lib/logging/storage.ts (Browser part)

class BrowserStorageAdapter implements IStorageAdapter {
  private db: IDBDatabase;

  constructor() {
    // Initialize IndexedDB
  }

  public async store(entry: LogEntry): Promise<void> {
    // Store log entry in IndexedDB
  }

  public async retrieveLogs(): Promise<LogEntry[]> {
    // Retrieve all logs from IndexedDB
  }

  public async downloadLogs(): Promise<void> {
    const logs = await this.retrieveLogs();
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'extension-logs.json';
    a.click();
    URL.revokeObjectURL(url);
  }
}
```

A factory function will determine which adapter to use at runtime:

```typescript
// src/lib/logging/storage.ts

export function getStorageAdapter(): IStorageAdapter {
  if (typeof window === 'undefined') {
    return new NodeStorageAdapter();
  } else {
    return new BrowserStorageAdapter();
  }
}
```

## 4. Integration Points

### Playwright (`tests/playwright/global-setup.ts`)

Initialize the logger in the `globalSetup` function. This will ensure all console output during the test run is captured.

```typescript
// tests/playwright/global-setup.ts
import { createLogger } from '../../src/lib/logging';

async function globalSetup(config: FullConfig) {
  const logger = createLogger();
  logger.init();

  console.log('🚀 Starting FaVault Extension Test Setup...');
  // ... rest of the setup
}
```

### Browser Extension (`src/service-worker.ts`)

Initialize the logger at the very beginning of the service worker script to capture all startup logs.

```typescript
// src/service-worker.ts
import { createLogger } from './lib/logging';

const logger = createLogger();
logger.init();

// ... rest of the service worker code
```

## 5. Mermaid Diagram

```mermaid
graph TD
    subgraph "Application [Browser/Node.js]"
        A[console.log, warn, etc.]
    end

    subgraph "Logging Utility"
        B(Logger Core)
        C{Environment Check}
        D[Node.js Adapter]
        E[Browser Adapter]
    end

    subgraph "Storage"
        F[File System e.g., playwright.log]
        G[IndexedDB]
    end

    A --> B
    B --> C
    C -- "Node.js" --> D
    C -- "Browser" --> E
    D --> F
    E --> G