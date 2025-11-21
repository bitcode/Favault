import { configure, isEnabled, getLogLevel, setLogLevel } from './config';
import { getStorageAdapter, IStorageAdapter } from './storage';
import type { LogEntry, LogLevel, LogContext } from './types';

class Logger {
  private static instance: Logger;
  private originalConsole: Record<string, any> = {};
  private storageAdapter: IStorageAdapter | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private currentContext: LogContext | null = null;

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public async init(): Promise<void> {
    if (this.isInitialized || !isEnabled()) {
      return;
    }
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      this.storageAdapter = await getStorageAdapter();
      this.interceptConsole();
      this.isInitialized = true;
      console.log('Logging utility initialized.');
    })();

    return this.initPromise;
  }

  private interceptConsole(): void {
    const levels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    levels.forEach(level => {
      const consoleMethod = level.toLowerCase() as keyof typeof console;
      if (console[consoleMethod]) {
        this.originalConsole[consoleMethod] = console[consoleMethod];
        (console as any)[consoleMethod] = (...args: any[]) => {
          this.log(level, args);
          this.originalConsole[consoleMethod].apply(console, args);
        };
      }
    });
  }

  private async log(level: LogLevel, args: any[], context?: LogContext, metadata?: Record<string, any>): Promise<void> {
    if (!this.isInitialized || !this.storageAdapter || !isEnabled() || this.isLevelBelowConfigured(level)) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: this.formatMessage(args),
      args,
      context: context || this.currentContext || undefined,
      metadata,
    };

    await this.storageAdapter.store(logEntry);
  }

  private isLevelBelowConfigured(level: LogLevel): boolean {
    const configuredLevel = getLogLevel();
    const levels: Record<LogLevel, number> = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
    };
    return levels[level] < levels[configuredLevel];
  }

  private formatMessage(args: any[]): string {
    return args
      .map(arg => {
        if (typeof arg === 'string') return arg;
        try {
          return JSON.stringify(arg);
        } catch {
          return '[Unserializable Object]';
        }
      })
      .join(' ');
  }

  // Public API for configuration and control
  public static configure = configure;
  public static setLogLevel = setLogLevel;
  public static isEnabled = isEnabled;
  public static getLogLevel = getLogLevel;

  public static downloadLogs = async (): Promise<void> => {
    const adapter = await getStorageAdapter();
    if (adapter.downloadLogs) {
      await adapter.downloadLogs();
    } else {
      console.warn('Downloading logs is not supported in this environment.');
    }
  };

  public static retrieveLogs = async (): Promise<any[]> => {
    const adapter = await getStorageAdapter();
    if (adapter.retrieveLogs) {
      return await adapter.retrieveLogs();
    } else {
      console.warn('Retrieving logs is not supported in this environment.');
      return [];
    }
  };

  public static getStatus = (): { initialized: boolean; enabled: boolean; level: string } => {
    const instance = Logger.getInstance();
    return {
      initialized: instance.isInitialized,
      enabled: isEnabled(),
      level: getLogLevel()
    };
  };

  // Context management
  public static setContext = (context: LogContext | null): void => {
    const instance = Logger.getInstance();
    instance.currentContext = context;
  };

  public static getContext = (): LogContext | null => {
    const instance = Logger.getInstance();
    return instance.currentContext;
  };

  // Contextual logging methods
  public static logWithContext = async (
    level: LogLevel,
    message: string,
    context: LogContext,
    metadata?: Record<string, any>
  ): Promise<void> => {
    const instance = Logger.getInstance();
    await instance.log(level, [message], context, metadata);
  };

  public static debug = async (message: string, context?: LogContext, metadata?: Record<string, any>): Promise<void> => {
    await Logger.logWithContext('DEBUG', message, context || 'general', metadata);
  };

  public static info = async (message: string, context?: LogContext, metadata?: Record<string, any>): Promise<void> => {
    await Logger.logWithContext('INFO', message, context || 'general', metadata);
  };

  public static warn = async (message: string, context?: LogContext, metadata?: Record<string, any>): Promise<void> => {
    await Logger.logWithContext('WARN', message, context || 'general', metadata);
  };

  public static error = async (message: string, context?: LogContext, metadata?: Record<string, any>): Promise<void> => {
    await Logger.logWithContext('ERROR', message, context || 'general', metadata);
  };
}

export default Logger;