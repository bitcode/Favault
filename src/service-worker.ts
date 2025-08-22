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
  private maxErrors = 50;

  logError(type: ServiceWorkerError['type'], message: string, error?: Error, context?: any): string {
    const errorId = `SW_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const errorEntry: ServiceWorkerError = {
      id: errorId,
      timestamp: new Date().toISOString(),
      type,
      message,
      stack: error?.stack,
      context
    };

    this.errors.unshift(errorEntry);

    // Maintain max errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors);
    }

    // Log to console with structured format
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

    return errorId;
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
}

const errorTracker = new ServiceWorkerErrorTracker();

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
    if (!this.isInitialized) {
      sendResponse({ success: false, error: 'Service worker not properly initialized' });
      return;
    }

    console.log(`📨 Handling message: ${message.type}`);

    try {
      switch (message.type) {
        case 'GET_BOOKMARKS':
          await this.handleGetBookmarks(sendResponse);
          break;

        case 'PING':
          sendResponse({
            status: 'pong',
            timestamp: Date.now(),
            initialized: this.isInitialized,
            errors: errorTracker.getErrors().length
          });
          break;

        case 'GET_ERROR_REPORT':
          sendResponse({
            success: true,
            report: errorTracker.getErrorReport(),
            errors: errorTracker.getErrors()
          });
          break;

        case 'CLEAR_ERRORS':
          errorTracker.getErrors().length = 0;
          sendResponse({ success: true, message: 'Errors cleared' });
          break;

        default:
          const error = new Error(`Unknown message type: ${message.type}`);
          errorTracker.logError('message', error.message, error, { message, sender });
          sendResponse({ success: false, error: error.message });
      }
    } catch (error) {
      errorTracker.logError('message', 'Message handler error', error as Error, { message, sender });
      sendResponse({ success: false, error: (error as Error).message });
    }
  }

  private async handleGetBookmarks(sendResponse: any): Promise<void> {
    try {
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
        timestamp: Date.now()
      });

    } catch (error) {
      const errorId = errorTracker.logError('api', 'Failed to get bookmarks', error as Error);
      console.error(`❌ Get bookmarks failed (${errorId}):`, error);

      sendResponse({
        success: false,
        error: (error as Error).message,
        errorId
      });
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
