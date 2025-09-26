import { Page, ConsoleMessage } from '@playwright/test';
import { FaviconErrorFilter } from '../../../src/lib/favicon-utils';

/**
 * Enhanced console monitoring utility for systematic user interaction testing
 * Provides detailed console error capture and correlation with specific user actions
 */

export interface ConsoleErrorCapture {
  timestamp: string;
  action: string;
  errorType: 'error' | 'warning' | 'log';
  message: string;
  stack?: string;
  url?: string;
  line?: number;
  column?: number;
  context: {
    beforeAction: string[];
    duringAction: string[];
    afterAction: string[];
  };
}

export interface UserInteractionTest {
  name: string;
  description: string;
  action: () => Promise<void>;
  expectedErrors?: string[]; // Known/expected errors to filter out
}

export interface ConsoleAnalysisReport {
  summary: {
    totalInteractions: number;
    totalErrors: number;
    totalWarnings: number;
    interactionsWithErrors: number;
    errorFreeInteractions: number;
    faviconErrorsFiltered?: number;
  };
  errorsByInteraction: Record<string, ConsoleErrorCapture[]>;
  criticalErrors: ConsoleErrorCapture[];
  recommendations: string[];
  timestamp: string;
}

export class EnhancedConsoleMonitor {
  private page: Page;
  private captures: ConsoleErrorCapture[] = [];
  private isMonitoring = false;
  private currentAction = '';
  private actionStartTime: number = 0;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Start enhanced console monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.captures = [];

    console.log('🚀 Starting enhanced console error monitoring...');

    // Enhanced console message capture with detailed context
    this.page.on('console', (msg) => this.handleConsoleMessage(msg));
    
    // Capture JavaScript errors
    this.page.on('pageerror', (error) => this.handlePageError(error));

    // Inject error capturing script into the page
    await this.injectErrorCaptureScript();
  }

  /**
   * Stop monitoring and generate report
   */
  async stopMonitoring(): Promise<ConsoleAnalysisReport> {
    this.isMonitoring = false;
    
    // Remove listeners
    this.page.removeAllListeners('console');
    this.page.removeAllListeners('pageerror');

    console.log(`🔍 Stopped monitoring. Captured ${this.captures.length} console events`);

    return this.generateAnalysisReport();
  }

  /**
   * Execute a specific user interaction and capture console errors
   */
  async captureInteractionErrors(interaction: UserInteractionTest): Promise<ConsoleErrorCapture[]> {
    console.log(`🎯 Testing interaction: ${interaction.name}`);
    
    this.currentAction = interaction.name;
    this.actionStartTime = Date.now();
    
    // Clear any existing console data before starting
    const beforeMessages = await this.getConsoleSnapshot();
    
    try {
      // Execute the interaction
      await interaction.action();
      
      // Wait a bit for async operations to complete
      await this.page.waitForTimeout(1000);
      
      // Capture any new console messages
      const afterMessages = await this.getConsoleSnapshot();
      const duringMessages = await this.getConsoleSnapshot();
      
      // Filter and categorize messages for this interaction
      const interactionErrors = this.captures.filter(capture => 
        capture.action === interaction.name
      );

      console.log(`📊 Interaction "${interaction.name}" generated ${interactionErrors.length} console events`);
      
      return interactionErrors;
      
    } catch (error) {
      console.error(`❌ Error during interaction "${interaction.name}":`, error);
      
      // Still capture the error as part of the interaction
      this.captureError('error', `Interaction execution error: ${error.message}`, interaction.name);
      
      return this.captures.filter(capture => capture.action === interaction.name);
    }
  }

  /**
   * Test multiple user interactions systematically
   */
  async runSystematicInteractionTests(): Promise<ConsoleAnalysisReport> {
    console.log('🔬 Running systematic user interaction console error analysis...');

    const interactions: UserInteractionTest[] = [
      {
        name: 'bookmark_click',
        description: 'Click on individual bookmarks',
        action: async () => {
          const bookmarks = this.page.locator('.bookmark-item, [data-testid="bookmark-item"]');
          const count = await bookmarks.count();
          if (count > 0) {
            await bookmarks.first().click();
            await this.page.waitForTimeout(500);
          } else {
            console.log('⚠️ No bookmarks found for click test');
          }
        }
      },
      {
        name: 'edit_mode_enable',
        description: 'Enter edit mode',
        action: async () => {
          // Try multiple methods to enter edit mode
          await this.page.keyboard.press('Control+e');
          await this.page.waitForTimeout(500);
          
          const editToggle = this.page.locator('.edit-toggle, [data-testid="edit-toggle"], .edit-mode-toggle').first();
          if (await editToggle.isVisible()) {
            await editToggle.click();
            await this.page.waitForTimeout(500);
          }
        }
      },
      {
        name: 'edit_mode_disable',
        description: 'Exit edit mode',
        action: async () => {
          // Try multiple methods to exit edit mode
          await this.page.keyboard.press('Escape');
          await this.page.waitForTimeout(500);
          
          const editToggle = this.page.locator('.edit-toggle.active, [data-testid="edit-toggle"][aria-pressed="true"]').first();
          if (await editToggle.isVisible()) {
            await editToggle.click();
            await this.page.waitForTimeout(500);
          }
        }
      },
      {
        name: 'search_bookmarks',
        description: 'Search for bookmarks using search functionality',
        action: async () => {
          const searchInput = this.page.locator('input[type="search"], input[placeholder*="search"], .search-input').first();
          if (await searchInput.isVisible()) {
            await searchInput.fill('test');
            await searchInput.press('Enter');
            await this.page.waitForTimeout(1000);
            await searchInput.clear();
            await searchInput.press('Escape');
            await this.page.waitForTimeout(500);
          }
        }
      },
      {
        name: 'folder_expand_collapse',
        description: 'Expand and collapse bookmark folders',
        action: async () => {
          const folders = this.page.locator('.folder-container, [data-testid="bookmark-folder"]');
          const count = await folders.count();
          if (count > 0) {
            const folder = folders.first();
            const toggleButton = folder.locator('.folder-toggle, .expand-toggle, .collapse-toggle, h3').first();
            
            if (await toggleButton.isVisible()) {
              await toggleButton.click();
              await this.page.waitForTimeout(500);
              await toggleButton.click();
              await this.page.waitForTimeout(500);
            }
          }
        }
      },
      {
        name: 'drag_drop_simulation',
        description: 'Simulate drag and drop operations',
        action: async () => {
          const folders = this.page.locator('.folder-container, [data-testid="bookmark-folder"]');
          const count = await folders.count();
          
          if (count >= 2) {
            const sourceFolder = folders.first();
            const targetFolder = folders.nth(1);
            
            // Get folder positions
            const sourceBox = await sourceFolder.boundingBox();
            const targetBox = await targetFolder.boundingBox();
            
            if (sourceBox && targetBox) {
              // Simulate drag and drop
              await this.page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
              await this.page.mouse.down();
              await this.page.waitForTimeout(200);
              await this.page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
              await this.page.waitForTimeout(200);
              await this.page.mouse.up();
              await this.page.waitForTimeout(500);
            }
          } else {
            console.log('⚠️ Need at least 2 folders for drag-drop test');
          }
        }
      },
      {
        name: 'right_click_context_menu',
        description: 'Right-click on bookmarks and folders for context menu',
        action: async () => {
          const bookmarks = this.page.locator('.bookmark-item, [data-testid="bookmark-item"]');
          const count = await bookmarks.count();
          
          if (count > 0) {
            await bookmarks.first().click({ button: 'right' });
            await this.page.waitForTimeout(500);
            await this.page.keyboard.press('Escape');
            await this.page.waitForTimeout(300);
          }
          
          const folders = this.page.locator('.folder-container, [data-testid="bookmark-folder"]');
          const folderCount = await folders.count();
          
          if (folderCount > 0) {
            await folders.first().click({ button: 'right' });
            await this.page.waitForTimeout(500);
            await this.page.keyboard.press('Escape');
            await this.page.waitForTimeout(300);
          }
        }
      },
      {
        name: 'keyboard_shortcuts',
        description: 'Test keyboard shortcuts',
        action: async () => {
          // Test various keyboard shortcuts
          const shortcuts = ['Control+f', 'Control+e', 'Escape', 'F1', 'Tab'];
          
          for (const shortcut of shortcuts) {
            await this.page.keyboard.press(shortcut);
            await this.page.waitForTimeout(200);
          }
        }
      },
      {
        name: 'window_resize',
        description: 'Test responsive behavior with window resize',
        action: async () => {
          // Get current viewport
          const viewport = this.page.viewportSize();
          
          // Test different sizes
          const sizes = [
            { width: 800, height: 600 },
            { width: 1200, height: 900 },
            { width: 1920, height: 1080 }
          ];
          
          for (const size of sizes) {
            await this.page.setViewportSize(size);
            await this.page.waitForTimeout(500);
          }
          
          // Restore original size
          if (viewport) {
            await this.page.setViewportSize(viewport);
            await this.page.waitForTimeout(500);
          }
        }
      },
      {
        name: 'settings_panel_interaction',
        description: 'Interact with settings panel if available',
        action: async () => {
          const settingsButton = this.page.locator('.settings-button, [data-testid="settings"], .settings-toggle').first();
          
          if (await settingsButton.isVisible()) {
            await settingsButton.click();
            await this.page.waitForTimeout(500);
            
            // Try to close settings
            await this.page.keyboard.press('Escape');
            await this.page.waitForTimeout(300);
            
            // Or click close button
            const closeButton = this.page.locator('.close-button, .settings-close, [aria-label="close"]').first();
            if (await closeButton.isVisible()) {
              await closeButton.click();
              await this.page.waitForTimeout(300);
            }
          }
        }
      }
    ];

    // Execute each interaction and capture console errors
    for (const interaction of interactions) {
      await this.captureInteractionErrors(interaction);
      
      // Small delay between interactions
      await this.page.waitForTimeout(500);
    }

    return this.generateAnalysisReport();
  }

  /**
   * Handle console message and categorize by current action
   */
  private handleConsoleMessage(msg: ConsoleMessage): void {
    if (!this.isMonitoring) return;

    const messageType = msg.type();
    const messageText = msg.text();
    
    // Skip expected/normal messages
    if (this.shouldSkipMessage(messageText)) {
      return;
    }

    if (messageType === 'error' || messageType === 'warn') {
      this.captureError(messageType, messageText, this.currentAction);
    }
  }

  /**
   * Handle page errors (uncaught exceptions)
   */
  private handlePageError(error: Error): void {
    if (!this.isMonitoring) return;

    this.captureError('error', `Uncaught exception: ${error.message}`, this.currentAction, error.stack);
  }

  /**
   * Capture a console error with full context
   */
  private captureError(
    type: 'error' | 'warning' | 'log',
    message: string,
    action: string,
    stack?: string
  ): void {
    const capture: ConsoleErrorCapture = {
      timestamp: new Date().toISOString(),
      action: action || 'unknown',
      errorType: type,
      message,
      stack,
      context: {
        beforeAction: [],
        duringAction: [],
        afterAction: []
      }
    };

    this.captures.push(capture);
    
    console.log(`🚨 [${type.toUpperCase()}] ${action}: ${message}`);
  }

  /**
   * Inject error capture script into the page for better error tracking
   */
  private async injectErrorCaptureScript(): Promise<void> {
    await this.page.addInitScript(() => {
      // Override console methods to capture more context
      const originalError = console.error;
      const originalWarn = console.warn;
      
      console.error = function(...args) {
        // Add context information
        const errorInfo = {
          timestamp: new Date().toISOString(),
          args: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)),
          stack: new Error().stack,
          url: window.location.href
        };
        
        (window as any).__consoleErrors = (window as any).__consoleErrors || [];
        (window as any).__consoleErrors.push(errorInfo);
        
        return originalError.apply(console, args);
      };
      
      console.warn = function(...args) {
        const warnInfo = {
          timestamp: new Date().toISOString(),
          args: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)),
          url: window.location.href
        };
        
        (window as any).__consoleWarnings = (window as any).__consoleWarnings || [];
        (window as any).__consoleWarnings.push(warnInfo);
        
        return originalWarn.apply(console, args);
      };

      // Capture unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        const rejectionInfo = {
          timestamp: new Date().toISOString(),
          reason: event.reason,
          promise: event.promise,
          url: window.location.href
        };
        
        (window as any).__promiseRejections = (window as any).__promiseRejections || [];
        (window as any).__promiseRejections.push(rejectionInfo);
      });
    });
  }

  /**
   * Get snapshot of current console state
   */
  private async getConsoleSnapshot(): Promise<string[]> {
    return await this.page.evaluate(() => {
      const errors = (window as any).__consoleErrors || [];
      const warnings = (window as any).__consoleWarnings || [];
      const rejections = (window as any).__promiseRejections || [];
      
      return [
        ...errors.map((e: any) => `ERROR: ${e.args.join(' ')}`),
        ...warnings.map((w: any) => `WARN: ${w.args.join(' ')}`),
        ...rejections.map((r: any) => `REJECTION: ${r.reason}`)
      ];
    });
  }

  /**
   * Check if message should be skipped (known expected messages)
   */
  private shouldSkipMessage(message: string): boolean {
    // Use the enhanced favicon error filter
    if (FaviconErrorFilter.isFaviconError(message)) {
      return true;
    }

    const skipPatterns = [
      /net::ERR_FAILED/i,
      /ERR_INTERNET_DISCONNECTED/i,
      /ERR_NAME_NOT_RESOLVED/i,
      /Manifest V2 is deprecated/i,
      /Extensions that use Manifest V2/i,
      /third-party cookie/i,
      /SameSite/i,
      // Add patterns for expected log messages
      /🦁/,  // Brave-specific logs
      /✅/,  // Success logs
      /🔧/,  // Debug logs
      /📊/,  // Stats logs
      /🔍/,  // Monitor logs
    ];

    return skipPatterns.some(pattern => pattern.test(message));
  }

  /**
   * Generate comprehensive analysis report with enhanced favicon filtering
   */
  private generateAnalysisReport(): ConsoleAnalysisReport {
    const errorsByInteraction: Record<string, ConsoleErrorCapture[]> = {};
    const criticalErrors: ConsoleErrorCapture[] = [];
    
    // Filter out favicon errors from captures
    const filteredCaptures = this.captures.filter(capture => 
      !FaviconErrorFilter.isFaviconError(capture.message)
    );
    
    const faviconErrorCount = this.captures.length - filteredCaptures.length;
    
    // Group filtered errors by interaction
    for (const capture of filteredCaptures) {
      if (!errorsByInteraction[capture.action]) {
        errorsByInteraction[capture.action] = [];
      }
      errorsByInteraction[capture.action].push(capture);
      
      // Identify critical errors
      if (this.isCriticalError(capture)) {
        criticalErrors.push(capture);
      }
    }
    
    const interactions = Object.keys(errorsByInteraction);
    const interactionsWithErrors = interactions.filter(interaction => 
      errorsByInteraction[interaction].length > 0
    );
    
    const totalErrors = filteredCaptures.filter(c => c.errorType === 'error').length;
    const totalWarnings = filteredCaptures.filter(c => c.errorType === 'warning').length;

    const recommendations = this.generateRecommendations(errorsByInteraction, criticalErrors);
    
    // Add favicon-specific recommendations if there were favicon errors
    if (faviconErrorCount > 0) {
      recommendations.unshift(`INFO: Filtered out ${faviconErrorCount} favicon loading errors (non-critical)`);
    }

    return {
      summary: {
        totalInteractions: interactions.length,
        totalErrors,
        totalWarnings,
        interactionsWithErrors: interactionsWithErrors.length,
        errorFreeInteractions: interactions.length - interactionsWithErrors.length,
        faviconErrorsFiltered: faviconErrorCount
      },
      errorsByInteraction,
      criticalErrors,
      recommendations,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Determine if an error is critical
   */
  private isCriticalError(capture: ConsoleErrorCapture): boolean {
    const criticalPatterns = [
      /uncaught.*exception/i,
      /referenceerror/i,
      /typeerror/i,
      /syntaxerror/i,
      /failed to execute/i,
      /cannot read prop/i,
      /undefined is not/i,
      /null is not/i,
    ];

    return criticalPatterns.some(pattern => pattern.test(capture.message));
  }

  /**
   * Generate actionable recommendations based on captured errors
   */
  private generateRecommendations(
    errorsByInteraction: Record<string, ConsoleErrorCapture[]>,
    criticalErrors: ConsoleErrorCapture[]
  ): string[] {
    const recommendations: string[] = [];

    // Check for interaction-specific issues
    Object.entries(errorsByInteraction).forEach(([interaction, errors]) => {
      if (errors.length > 0) {
        const errorTypes = [...new Set(errors.map(e => e.errorType))];
        recommendations.push(
          `Fix ${errors.length} console ${errorTypes.join('/')} issues in "${interaction}" interaction`
        );
      }
    });

    // Check for critical errors
    if (criticalErrors.length > 0) {
      recommendations.push(
        `CRITICAL: Address ${criticalErrors.length} critical JavaScript errors that may break functionality`
      );
    }

    // Check for drag-drop specific issues
    const dragDropErrors = errorsByInteraction['drag_drop_simulation'] || [];
    if (dragDropErrors.length > 0) {
      recommendations.push(
        `Review drag-drop implementation - detected ${dragDropErrors.length} errors during drag operations`
      );
    }

    // Check for edit mode issues
    const editModeErrors = [
      ...(errorsByInteraction['edit_mode_enable'] || []),
      ...(errorsByInteraction['edit_mode_disable'] || [])
    ];
    if (editModeErrors.length > 0) {
      recommendations.push(
        `Fix edit mode toggle functionality - detected ${editModeErrors.length} errors during mode changes`
      );
    }

    return recommendations;
  }

  /**
   * Get captured errors for a specific interaction
   */
  getErrorsForInteraction(interactionName: string): ConsoleErrorCapture[] {
    return this.captures.filter(capture => capture.action === interactionName);
  }

  /**
   * Get all captured errors
   */
  getAllCapturedErrors(): ConsoleErrorCapture[] {
    return [...this.captures];
  }
}