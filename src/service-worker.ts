// Enhanced Service worker for handling background tasks and commands with comprehensive error handling
// Note: Using direct browser API calls instead of imports for service worker compatibility

// Cross-browser API compatibility
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

// Service worker error tracking
interface ServiceWorkerError {
  id: string;
  timestamp: string;
  type: 'initialization' | 'command' | 'message' | 'api' | 'unknown';
  message: string;
  stack?: string;
  context?: any;
}

class ServiceWorkerErrorTracker {
  private errors: ServiceWorkerError[] = [];
  private maxErrors = 25; // Reduced from 50 to save memory
  private cleanupInterval: number | null = null;

  constructor() {
    // Start periodic cleanup to prevent memory leaks
    this.startCleanup();
  }

  private startCleanup(): void {
    // Clean up old errors every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldErrors();
    }, 5 * 60 * 1000) as unknown as number;
  }

  private cleanupOldErrors(): void {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const initialCount = this.errors.length;

    this.errors = this.errors.filter(error =>
      new Date(error.timestamp).getTime() > oneHourAgo
    );

    const removedCount = initialCount - this.errors.length;
    if (removedCount > 0) {
      console.log(`🧹 Cleaned up ${removedCount} old service worker errors`);
    }
  }

  logError(type: ServiceWorkerError['type'], message: string, error?: Error, context?: any): string {
    const errorId = `SW_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const errorEntry: ServiceWorkerError = {
      id: errorId,
      timestamp: new Date().toISOString(),
      type,
      message,
      stack: error?.stack,
      context: this.sanitizeContext(context) // Sanitize context to prevent memory leaks
    };

    this.errors.unshift(errorEntry);

    // Maintain max errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors);
    }

    // Log to console with structured format (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚨 Service Worker Error [${errorId}]`);
      console.error('Type:', type);
      console.error('Message:', message);
      if (error) {
        console.error('Error:', error);
      }
      if (context) {
        console.error('Context:', context);
      }
      console.groupEnd();
    } else {
      // In production, just log the essential info
      console.error(`🚨 SW Error [${errorId}]: ${message}`);
    }

    return errorId;
  }

  private sanitizeContext(context: any): any {
    if (!context) return context;

    // Limit context size to prevent memory issues
    const contextStr = JSON.stringify(context);
    if (contextStr.length > 1000) {
      return {
        ...context,
        _truncated: true,
        _originalSize: contextStr.length
      };
    }

    return context;
  }

  getErrors(): ServiceWorkerError[] {
    return [...this.errors];
  }

  getErrorReport(): string {
    const timestamp = new Date().toISOString();
    let report = `FaVault Service Worker Error Report
Generated: ${timestamp}
========================================

SUMMARY
-------
Total Errors: ${this.errors.length}
Recent Errors (5min): ${this.getRecentErrors().length}

ERRORS
======
`;

    this.errors.forEach((error, index) => {
      report += `
${index + 1}. ERROR ID: ${error.id}
   Timestamp: ${new Date(error.timestamp).toLocaleString()}
   Type: ${error.type}
   Message: ${error.message}`;

      if (error.stack) {
        report += `
   Stack: ${error.stack.split('\n').slice(0, 3).join('\n   ')}`;
      }

      if (error.context) {
        report += `
   Context: ${JSON.stringify(error.context, null, 2)}`;
      }

      report += '\n' + '-'.repeat(60);
    });

    return report;
  }

  private getRecentErrors(): ServiceWorkerError[] {
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    return this.errors.filter(error =>
      new Date(error.timestamp).getTime() > fiveMinutesAgo
    );
  }

  public cleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.errors = [];
    console.log('🧹 Service worker error tracker cleanup completed');
  }
}

const errorTracker = new ServiceWorkerErrorTracker();

// Service Worker Lifecycle Manager
class ServiceWorkerLifecycleManager {
  private keepAliveInterval: number | null = null;
  private lastActivity: number = Date.now();
  private isActive: boolean = true;
  private activeOperations: Set<string> = new Set();
  private keepAlivePort: chrome.runtime.Port | null = null;

  constructor() {
    this.setupLifecycleHandlers();
    this.startKeepAlive();
  }

  private setupLifecycleHandlers(): void {
    // Listen for service worker activation
    self.addEventListener('activate', (event) => {
      console.log('🔄 Service worker activated');
      this.isActive = true;
      this.lastActivity = Date.now();
      event.waitUntil(this.handleActivation());
    });

    // Listen for service worker install
    self.addEventListener('install', (event) => {
      console.log('📦 Service worker installing');
      event.waitUntil(this.handleInstall());
    });

    // Monitor for potential termination
    self.addEventListener('beforeunload', () => {
      console.log('⚠️ Service worker about to terminate');
      this.cleanup();
    });
  }

  private async handleActivation(): Promise<void> {
    // Take control of all clients immediately
    await self.clients.claim();
    console.log('✅ Service worker claimed all clients');
  }

  private async handleInstall(): Promise<void> {
    // Skip waiting to activate immediately
    await self.skipWaiting();
    console.log('✅ Service worker skipped waiting');
  }

  private startKeepAlive(): void {
    // Clear any existing interval
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }

    // Set up keep-alive ping every 25 seconds (before 30-second timeout)
    this.keepAliveInterval = setInterval(() => {
      this.performKeepAlivePing();
    }, 25000) as unknown as number;

    console.log('💓 Keep-alive mechanism started');
  }

  private stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
      console.log('💤 Keep-alive mechanism stopped');
    }
  }

  private restartKeepAliveIfNeeded(): void {
    if (!this.keepAliveInterval && (this.activeOperations.size > 0 || Date.now() - this.lastActivity < 30000)) {
      this.startKeepAlive();
    }
  }

  private performKeepAlivePing(): void {
    const now = Date.now();
    const timeSinceActivity = now - this.lastActivity;
    const hasActiveOperations = this.activeOperations.size > 0;

    // Only ping if we have active operations or recent activity (reduced from 60s to 30s)
    if (hasActiveOperations || timeSinceActivity < 30000) {
      console.log('💓 Keep-alive ping', {
        activeOperations: this.activeOperations.size,
        timeSinceActivity
      });

      // Update activity timestamp
      this.lastActivity = now;

      // Perform a lightweight operation to keep the service worker alive
      this.pingClients();
    } else {
      // If no recent activity, reduce ping frequency by stopping keep-alive
      console.log('💤 No recent activity, allowing service worker to sleep');
      this.stopKeepAlive();
    }
  }

  private async pingClients(): Promise<void> {
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      if (clients.length > 0) {
        // Send a lightweight ping to the first client
        clients[0].postMessage({
          type: 'SERVICE_WORKER_PING',
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.warn('Keep-alive ping failed:', error);
    }
  }

  public registerOperation(operationId: string): void {
    this.activeOperations.add(operationId);
    this.lastActivity = Date.now();

    // Restart keep-alive if needed
    this.restartKeepAliveIfNeeded();

    console.log(`🔄 Registered operation: ${operationId} (${this.activeOperations.size} active)`);
  }

  public unregisterOperation(operationId: string): void {
    this.activeOperations.delete(operationId);
    this.lastActivity = Date.now();
    console.log(`✅ Unregistered operation: ${operationId} (${this.activeOperations.size} active)`);
  }

  public recordActivity(): void {
    this.lastActivity = Date.now();
  }

  public getStatus(): any {
    return {
      isActive: this.isActive,
      lastActivity: this.lastActivity,
      activeOperations: Array.from(this.activeOperations),
      timeSinceActivity: Date.now() - this.lastActivity
    };
  }

  private cleanup(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }

    if (this.keepAlivePort) {
      this.keepAlivePort.disconnect();
      this.keepAlivePort = null;
    }

    this.isActive = false;
    console.log('🧹 Service worker lifecycle cleanup completed');
  }
}

const lifecycleManager = new ServiceWorkerLifecycleManager();

class ServiceWorker {
  private isInitialized = false;
  private initializationAttempts = 0;
  private maxInitializationAttempts = 3;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    this.initializationAttempts++;

    try {
      console.log(`🔧 Initializing FaVault service worker (attempt ${this.initializationAttempts})...`);

      // Validate browser API availability
      if (!browserAPI) {
        throw new Error('Browser API not available');
      }

      // Setup error handlers first
      this.setupErrorHandlers();

      // Listen for keyboard commands
      if (browserAPI.commands && browserAPI.commands.onCommand) {
        browserAPI.commands.onCommand.addListener((command: string) => {
          this.handleCommand(command).catch(error => {
            errorTracker.logError('command', `Command handler failed: ${command}`, error, { command });
          });
        });
        console.log('✅ Command listeners registered');
      } else {
        console.warn('⚠️ Commands API not available');
      }

      // Listen for messages from content scripts
      if (browserAPI.runtime && browserAPI.runtime.onMessage) {
        browserAPI.runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
          this.handleMessage(message, sender, sendResponse).catch(error => {
            errorTracker.logError('message', 'Message handler failed', error, { message, sender });
            sendResponse({ success: false, error: error.message });
          });
          return true; // Keep message channel open for async response
        });
        console.log('✅ Message listeners registered');
      } else {
        throw new Error('Runtime API not available');
      }

      // Test basic functionality
      await this.performSelfTest();

      this.isInitialized = true;
      console.log('✅ FaVault service worker initialized successfully');

    } catch (error) {
      const errorId = errorTracker.logError('initialization', 'Service worker initialization failed', error as Error, {
        attempt: this.initializationAttempts,
        browserAPI: !!browserAPI,
        runtime: !!browserAPI?.runtime,
        commands: !!browserAPI?.commands
      });

      console.error(`❌ Service worker initialization failed (${errorId}):`, error);

      // Retry initialization if we haven't exceeded max attempts
      if (this.initializationAttempts < this.maxInitializationAttempts) {
        console.log(`🔄 Retrying initialization in 2 seconds...`);
        setTimeout(() => this.init(), 2000);
      } else {
        console.error('❌ Max initialization attempts reached. Service worker may not function properly.');
      }
    }
  }

  private setupErrorHandlers(): void {
    // Global error handler for service worker
    self.addEventListener('error', (event) => {
      errorTracker.logError('unknown', 'Unhandled service worker error', event.error, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    // Unhandled promise rejection handler
    self.addEventListener('unhandledrejection', (event) => {
      errorTracker.logError('unknown', 'Unhandled promise rejection in service worker',
        event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        { reason: event.reason }
      );
    });

    console.log('✅ Error handlers registered');
  }

  private async performSelfTest(): Promise<void> {
    try {
      // Test manifest access
      if (browserAPI.runtime && browserAPI.runtime.getManifest) {
        const manifest = browserAPI.runtime.getManifest();
        if (!manifest) {
          throw new Error('Manifest not accessible');
        }
        console.log(`✅ Manifest accessible: ${manifest.name} v${manifest.version}`);
      }

      // Test bookmark API if available
      if (browserAPI.bookmarks) {
        try {
          await browserAPI.bookmarks.getTree();
          console.log('✅ Bookmarks API accessible');
        } catch (error) {
          console.warn('⚠️ Bookmarks API test failed:', error);
        }
      }

      // Test storage API if available
      if (browserAPI.storage && browserAPI.storage.local) {
        try {
          const testKey = 'sw_test_' + Date.now();
          await browserAPI.storage.local.set({ [testKey]: true });
          await browserAPI.storage.local.remove(testKey);
          console.log('✅ Storage API accessible');
        } catch (error) {
          console.warn('⚠️ Storage API test failed:', error);
        }
      }

    } catch (error) {
      throw new Error(`Self-test failed: ${error.message}`);
    }
  }

  private async handleCommand(command: string): Promise<void> {
    const operationId = `command_${command}_${Date.now()}`;

    try {
      lifecycleManager.registerOperation(operationId);

      if (!this.isInitialized) {
        throw new Error('Service worker not properly initialized');
      }

      console.log(`🎯 Handling command: ${command}`);

      switch (command) {
        case 'toggle-search':
          await this.focusSearchInput();
          break;
        case 'toggle-edit-mode':
          await this.toggleEditMode();
          break;
        default:
          const error = new Error(`Unknown command: ${command}`);
          errorTracker.logError('command', error.message, error, { command });
          throw error;
      }
    } finally {
      lifecycleManager.unregisterOperation(operationId);
    }
  }

  private async focusSearchInput(): Promise<void> {
    try {
      console.log('🔍 Focusing search input...');

      if (!browserAPI.runtime) {
        throw new Error('Runtime API not available');
      }

      // Broadcast to all extension pages (newtab listens and will handle it)
      await browserAPI.runtime.sendMessage({ type: 'FOCUS_SEARCH' });
      console.log('✅ Focus search message sent');

    } catch (error) {
      errorTracker.logError('command', 'Failed to focus search input', error as Error);
      throw error;
    }
  }

  private async toggleEditMode(): Promise<void> {
    try {
      console.log('✏️ Toggling edit mode...');

      if (!browserAPI.runtime) {
        throw new Error('Runtime API not available');
      }

      // Broadcast to all extension pages (newtab listens and will handle it)
      await browserAPI.runtime.sendMessage({ type: 'TOGGLE_EDIT_MODE' });
      console.log('✅ Toggle edit mode message sent');

    } catch (error) {
      errorTracker.logError('command', 'Failed to toggle edit mode', error as Error);
      throw error;
    }
  }

  private async handleMessage(message: any, sender: any, sendResponse: any): Promise<void> {
    const operationId = `message_${message.type}_${Date.now()}`;

    try {
      lifecycleManager.registerOperation(operationId);
      lifecycleManager.recordActivity();

      if (!this.isInitialized) {
        sendResponse({ success: false, error: 'Service worker not properly initialized' });
        return;
      }

      console.log(`📨 Handling message: ${message.type}`);

      switch (message.type) {
        case 'GET_BOOKMARKS':
          await this.handleGetBookmarks(sendResponse);
          break;

        case 'PING':
          sendResponse({
            status: 'pong',
            timestamp: Date.now(),
            initialized: this.isInitialized,
            errors: errorTracker.getErrors().length,
            lifecycle: lifecycleManager.getStatus()
          });
          break;

        case 'GET_ERROR_REPORT':
          sendResponse({
            success: true,
            report: errorTracker.getErrorReport(),
            errors: errorTracker.getErrors(),
            lifecycle: lifecycleManager.getStatus()
          });
          break;

        case 'CLEAR_ERRORS':
          errorTracker.getErrors().length = 0;
          sendResponse({ success: true, message: 'Errors cleared' });
          break;

        case 'GET_LIFECYCLE_STATUS':
          sendResponse({
            success: true,
            status: lifecycleManager.getStatus(),
            health: this.getHealthStatus()
          });
          break;

        default:
          const error = new Error(`Unknown message type: ${message.type}`);
          errorTracker.logError('message', error.message, error, { message, sender });
          sendResponse({ success: false, error: error.message });
      }
    } catch (error) {
      errorTracker.logError('message', 'Message handler error', error as Error, { message, sender });
      sendResponse({ success: false, error: (error as Error).message });
    } finally {
      lifecycleManager.unregisterOperation(operationId);
    }
  }

  private async handleGetBookmarks(sendResponse: any): Promise<void> {
    const operationId = `get_bookmarks_${Date.now()}`;

    try {
      lifecycleManager.registerOperation(operationId);
      console.log('📚 Getting bookmarks...');

      if (!browserAPI.bookmarks) {
        throw new Error('Bookmarks API not available');
      }

      const startTime = Date.now();
      const bookmarks = await browserAPI.bookmarks.getTree();
      const duration = Date.now() - startTime;

      console.log(`✅ Retrieved bookmarks in ${duration}ms`);

      sendResponse({
        success: true,
        data: bookmarks,
        timing: duration,
        timestamp: Date.now(),
        lifecycle: lifecycleManager.getStatus()
      });

    } catch (error) {
      const errorId = errorTracker.logError('api', 'Failed to get bookmarks', error as Error);
      console.error(`❌ Get bookmarks failed (${errorId}):`, error);

      sendResponse({
        success: false,
        error: (error as Error).message,
        errorId,
        lifecycle: lifecycleManager.getStatus()
      });
    } finally {
      lifecycleManager.unregisterOperation(operationId);
    }
  }

  // Health check method
  getHealthStatus(): any {
    return {
      initialized: this.isInitialized,
      initializationAttempts: this.initializationAttempts,
      errors: errorTracker.getErrors().length,
      recentErrors: errorTracker.getErrors().filter(e =>
        Date.now() - new Date(e.timestamp).getTime() < 5 * 60 * 1000
      ).length,
      apis: {
        runtime: !!browserAPI?.runtime,
        bookmarks: !!browserAPI?.bookmarks,
        storage: !!browserAPI?.storage,
        commands: !!browserAPI?.commands
      }
    };
  }
}

// Initialize the service worker with error handling
try {
  const serviceWorker = new ServiceWorker();

  // Expose service worker for debugging
  (self as any).favaultServiceWorker = serviceWorker;

  // Log successful initialization
  console.log('🚀 FaVault service worker startup completed');

} catch (error) {
  console.error('💥 Critical error during service worker startup:', error);
  errorTracker.logError('initialization', 'Critical startup error', error as Error);

  // Try to report the error even if initialization failed
  try {
    if (browserAPI?.runtime) {
      browserAPI.runtime.sendMessage({
        type: 'SERVICE_WORKER_ERROR',
        error: (error as Error).message,
        stack: (error as Error).stack
      }).catch(() => {
        // Ignore errors when trying to report errors
      });
    }
  } catch (reportError) {
    // Ignore errors when trying to report errors
  }
}
