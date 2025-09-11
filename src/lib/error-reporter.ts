// Enhanced Error Reporting System for FaVault Chrome Extension
// Captures and formats extension loading errors, initialization problems, and runtime errors

import { getBrowserInfo, getExtensionContext } from './utils';

export interface ErrorReport {
  id: string;
  timestamp: string;
  type: 'loading' | 'initialization' | 'runtime' | 'api' | 'permission' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  stack?: string;
  context: {
    browser: ReturnType<typeof getBrowserInfo>;
    extension: ReturnType<typeof getExtensionContext>;
    timing: {
      pageLoad: number;
      errorOccurred: number;
      timeSinceLoad: number;
    };
    state: {
      editMode?: boolean;
      bookmarksLoaded?: boolean;
      dragDropInitialized?: boolean;
      serviceWorkerActive?: boolean;
    };
    additionalData?: Record<string, any>;
  };
  suggestions: string[];
  category: string;
  recoverable: boolean;
}

export interface ErrorReportSummary {
  totalErrors: number;
  criticalErrors: number;
  recentErrors: number;
  commonIssues: Array<{
    type: string;
    count: number;
    lastOccurred: string;
  }>;
  systemHealth: 'healthy' | 'degraded' | 'critical';
  recommendations: string[];
}

class ErrorReporter {
  private static instance: ErrorReporter;
  private errors: ErrorReport[] = [];
  private pageLoadTime: number = Date.now();
  private maxStoredErrors: number = 100;
  private errorCategories = new Map<string, number>();

  private constructor() {
    this.setupGlobalErrorHandlers();
    this.setupUnhandledRejectionHandler();
    this.setupConsoleErrorCapture();
  }

  static getInstance(): ErrorReporter {
    if (!ErrorReporter.instance) {
      ErrorReporter.instance = new ErrorReporter();
    }
    return ErrorReporter.instance;
  }

  /**
   * Setup global error handlers to catch unhandled errors
   */
  private setupGlobalErrorHandlers(): void {
    // Capture JavaScript errors
    window.addEventListener('error', (event) => {
      this.captureError({
        type: 'runtime',
        severity: 'high',
        message: event.message,
        stack: event.error?.stack,
        category: 'JavaScript Error',
        source: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      });
    });

    // Capture resource loading errors
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        const target = event.target as HTMLElement;
        this.captureError({
          type: 'loading',
          severity: 'medium',
          message: `Failed to load resource: ${target.tagName}`,
          category: 'Resource Loading',
          source: {
            tagName: target.tagName,
            src: (target as any).src || (target as any).href,
            id: target.id,
            className: target.className
          }
        });
      }
    }, true);
  }

  /**
   * Setup unhandled promise rejection handler
   */
  private setupUnhandledRejectionHandler(): void {
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError({
        type: 'runtime',
        severity: 'high',
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        category: 'Promise Rejection',
        source: {
          reason: event.reason,
          promise: event.promise
        }
      });
    });
  }

  /**
   * Setup console error capture
   */
  private setupConsoleErrorCapture(): void {
    const originalConsoleError = console.error;
    let isCapturingError = false; // Prevent recursive error capture

    console.error = (...args: any[]) => {
      // Call original console.error first
      originalConsoleError.apply(console, args);

      // Prevent recursive error capture
      if (isCapturingError) {
        return;
      }

      try {
        isCapturingError = true;

        // Skip if this is already an error report to prevent infinite loops
        const message = args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');

        // Don't capture our own error reports
        if (message.includes('🚨 FaVault Error Report') ||
            message.includes('Console Error: Console Error:')) {
          return;
        }

        this.captureError({
          type: 'runtime',
          severity: 'medium',
          message: message,
          category: 'Console Error',
          source: {
            arguments: args,
            stack: new Error().stack
          }
        });
      } finally {
        isCapturingError = false;
      }
    };
  }

  /**
   * Capture and process an error
   */
  captureError(errorData: {
    type: ErrorReport['type'];
    severity: ErrorReport['severity'];
    message: string;
    stack?: string;
    category: string;
    source?: any;
    additionalData?: Record<string, any>;
    suggestions?: string[];
  }): string {
    const errorId = this.generateErrorId();
    const now = Date.now();
    
    const errorReport: ErrorReport = {
      id: errorId,
      timestamp: new Date().toISOString(),
      type: errorData.type,
      severity: errorData.severity,
      message: errorData.message,
      stack: errorData.stack,
      context: {
        browser: getBrowserInfo(),
        extension: getExtensionContext(),
        timing: {
          pageLoad: this.pageLoadTime,
          errorOccurred: now,
          timeSinceLoad: now - this.pageLoadTime
        },
        state: this.getCurrentState(),
        additionalData: {
          ...errorData.additionalData,
          source: errorData.source
        }
      },
      suggestions: errorData.suggestions || this.generateSuggestions(errorData),
      category: errorData.category,
      recoverable: this.isRecoverable(errorData)
    };

    // Store the error
    this.errors.unshift(errorReport);
    
    // Maintain max stored errors
    if (this.errors.length > this.maxStoredErrors) {
      this.errors = this.errors.slice(0, this.maxStoredErrors);
    }

    // Update category counts
    this.errorCategories.set(
      errorData.category,
      (this.errorCategories.get(errorData.category) || 0) + 1
    );

    // Log to console for immediate debugging
    console.group(`🚨 FaVault Error Report [${errorId}]`);
    console.error('Message:', errorData.message);
    console.error('Type:', errorData.type);
    console.error('Severity:', errorData.severity);
    console.error('Category:', errorData.category);
    if (errorData.stack) {
      console.error('Stack:', errorData.stack);
    }
    console.error('Context:', errorReport.context);
    console.error('Suggestions:', errorReport.suggestions);
    console.groupEnd();

    return errorId;
  }

  /**
   * Generate a unique error ID
   */
  private generateErrorId(): string {
    return `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current extension state
   */
  private getCurrentState(): ErrorReport['context']['state'] {
    const state: ErrorReport['context']['state'] = {};
    
    try {
      // Check if edit mode is enabled
      state.editMode = document.body.classList.contains('edit-mode');
      
      // Check if bookmarks are loaded
      state.bookmarksLoaded = document.querySelectorAll('.folder-container').length > 0;
      
      // Check if drag-drop is initialized
      state.dragDropInitialized = !!(window as any).enhancedDragDropReady;
      
      // Check service worker status
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
          state.serviceWorkerActive = !!response;
        });
      }
    } catch (e) {
      // Ignore errors when getting state
    }
    
    return state;
  }

  /**
   * Generate suggestions based on error type and context
   */
  private generateSuggestions(errorData: any): string[] {
    const suggestions: string[] = [];
    
    switch (errorData.type) {
      case 'loading':
        suggestions.push('Check if all extension files are present in the build directory');
        suggestions.push('Verify manifest.json is valid and properly formatted');
        suggestions.push('Ensure all required permissions are granted');
        break;
        
      case 'initialization':
        suggestions.push('Try reloading the extension in chrome://extensions/');
        suggestions.push('Check browser console for additional error details');
        suggestions.push('Verify Chrome extension APIs are available');
        break;
        
      case 'api':
        suggestions.push('Check if required permissions are granted in manifest.json');
        suggestions.push('Verify the Chrome API is available in this context');
        suggestions.push('Try restarting the browser if API calls are failing');
        break;
        
      case 'permission':
        suggestions.push('Grant required permissions in chrome://extensions/');
        suggestions.push('Check if bookmarks permission is enabled');
        suggestions.push('Verify storage permission is granted');
        break;
        
      default:
        suggestions.push('Check browser console for more details');
        suggestions.push('Try reloading the page');
        suggestions.push('Report this issue with the error details');
    }
    
    return suggestions;
  }

  /**
   * Determine if an error is recoverable
   */
  private isRecoverable(errorData: any): boolean {
    const nonRecoverablePatterns = [
      'manifest',
      'permission denied',
      'extension not found',
      'chrome api not available'
    ];
    
    const message = errorData.message.toLowerCase();
    return !nonRecoverablePatterns.some(pattern => message.includes(pattern));
  }

  /**
   * Get all stored errors
   */
  getErrors(): ErrorReport[] {
    return [...this.errors];
  }

  /**
   * Get errors by type
   */
  getErrorsByType(type: ErrorReport['type']): ErrorReport[] {
    return this.errors.filter(error => error.type === type);
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: ErrorReport['severity']): ErrorReport[] {
    return this.errors.filter(error => error.severity === severity);
  }

  /**
   * Get recent errors (last 5 minutes)
   */
  getRecentErrors(minutes: number = 5): ErrorReport[] {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.errors.filter(error => 
      new Date(error.timestamp).getTime() > cutoff
    );
  }

  /**
   * Clear all stored errors
   */
  clearErrors(): void {
    this.errors = [];
    this.errorCategories.clear();
  }

  /**
   * Generate error report summary
   */
  generateSummary(): ErrorReportSummary {
    const now = Date.now();
    const recentCutoff = now - (5 * 60 * 1000); // 5 minutes

    const recentErrors = this.errors.filter(error =>
      new Date(error.timestamp).getTime() > recentCutoff
    );

    const criticalErrors = this.errors.filter(error =>
      error.severity === 'critical'
    );

    // Find common issues
    const commonIssues = Array.from(this.errorCategories.entries())
      .map(([type, count]) => ({
        type,
        count,
        lastOccurred: this.errors.find(e => e.category === type)?.timestamp || ''
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Determine system health
    let systemHealth: ErrorReportSummary['systemHealth'] = 'healthy';
    if (criticalErrors.length > 0) {
      systemHealth = 'critical';
    } else if (recentErrors.length > 5) {
      systemHealth = 'degraded';
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (criticalErrors.length > 0) {
      recommendations.push('Address critical errors immediately');
    }
    if (recentErrors.length > 10) {
      recommendations.push('High error rate detected - investigate recent changes');
    }
    if (commonIssues.length > 0) {
      recommendations.push(`Most common issue: ${commonIssues[0].type} (${commonIssues[0].count} occurrences)`);
    }

    return {
      totalErrors: this.errors.length,
      criticalErrors: criticalErrors.length,
      recentErrors: recentErrors.length,
      commonIssues,
      systemHealth,
      recommendations
    };
  }

  /**
   * Export errors as formatted text for sharing
   */
  exportAsText(includeContext: boolean = true): string {
    const summary = this.generateSummary();
    const timestamp = new Date().toISOString();

    let report = `FaVault Extension Error Report
Generated: ${timestamp}
========================================

SUMMARY
-------
Total Errors: ${summary.totalErrors}
Critical Errors: ${summary.criticalErrors}
Recent Errors (5min): ${summary.recentErrors}
System Health: ${summary.systemHealth.toUpperCase()}

RECOMMENDATIONS
--------------
${summary.recommendations.map(rec => `• ${rec}`).join('\n')}

COMMON ISSUES
------------
${summary.commonIssues.map(issue =>
  `• ${issue.type}: ${issue.count} occurrences (last: ${new Date(issue.lastOccurred).toLocaleString()})`
).join('\n')}

DETAILED ERRORS
==============
`;

    this.errors.slice(0, 20).forEach((error, index) => {
      report += `
${index + 1}. ERROR ID: ${error.id}
   Timestamp: ${new Date(error.timestamp).toLocaleString()}
   Type: ${error.type}
   Severity: ${error.severity}
   Category: ${error.category}
   Message: ${error.message}
   Recoverable: ${error.recoverable ? 'Yes' : 'No'}

   Suggestions:
   ${error.suggestions.map(s => `   • ${s}`).join('\n')}`;

      if (error.stack && includeContext) {
        report += `

   Stack Trace:
   ${error.stack.split('\n').map(line => `   ${line}`).join('\n')}`;
      }

      if (includeContext && error.context.additionalData) {
        report += `

   Additional Data:
   ${JSON.stringify(error.context.additionalData, null, 2).split('\n').map(line => `   ${line}`).join('\n')}`;
      }

      report += '\n' + '-'.repeat(80);
    });

    if (includeContext) {
      const browserInfo = getBrowserInfo();
      const extensionInfo = getExtensionContext();

      report += `

SYSTEM INFORMATION
=================
Browser: ${browserInfo.userAgent}
Platform: ${browserInfo.platform}
Language: ${browserInfo.language}
Online: ${browserInfo.onLine}

Extension Context:
URL: ${extensionInfo.url}
Protocol: ${extensionInfo.protocol}
Extension ID: ${extensionInfo.extensionId || 'N/A'}
Manifest Version: ${extensionInfo.manifestVersion || 'N/A'}

Chrome APIs Available:
Runtime: ${browserInfo.chrome?.runtime ? 'Yes' : 'No'}
Bookmarks: ${browserInfo.chrome?.bookmarks ? 'Yes' : 'No'}
Storage: ${browserInfo.chrome?.storage ? 'Yes' : 'No'}
Extension Version: ${browserInfo.chrome?.version || 'N/A'}
`;
    }

    return report;
  }

  /**
   * Export errors as JSON for programmatic processing
   */
  exportAsJSON(): string {
    return JSON.stringify({
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '1.0.0',
        extension: 'FaVault'
      },
      summary: this.generateSummary(),
      errors: this.errors,
      systemInfo: {
        browser: getBrowserInfo(),
        extension: getExtensionContext()
      }
    }, null, 2);
  }

  /**
   * Download error report as a text file
   */
  downloadReport(format: 'text' | 'json' = 'text', filename?: string): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultFilename = `favault-error-report-${timestamp}.${format === 'json' ? 'json' : 'txt'}`;

    const content = format === 'json' ? this.exportAsJSON() : this.exportAsText();
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/plain' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || defaultFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Copy error report to clipboard
   */
  async copyToClipboard(format: 'text' | 'json' = 'text'): Promise<boolean> {
    try {
      const content = format === 'json' ? this.exportAsJSON() : this.exportAsText();
      await navigator.clipboard.writeText(content);
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }
}

// Export singleton instance
export const errorReporter = ErrorReporter.getInstance();

// Global error reporting functions for easy access
export function reportError(
  type: ErrorReport['type'],
  message: string,
  options: {
    severity?: ErrorReport['severity'];
    category?: string;
    stack?: string;
    additionalData?: Record<string, any>;
    suggestions?: string[];
  } = {}
): string {
  return errorReporter.captureError({
    type,
    message,
    severity: options.severity || 'medium',
    category: options.category || 'General',
    stack: options.stack,
    additionalData: options.additionalData,
    suggestions: options.suggestions
  });
}

export function reportLoadingError(message: string, additionalData?: Record<string, any>): string {
  return reportError('loading', message, {
    severity: 'high',
    category: 'Extension Loading',
    additionalData
  });
}

export function reportInitializationError(message: string, additionalData?: Record<string, any>): string {
  return reportError('initialization', message, {
    severity: 'high',
    category: 'Extension Initialization',
    additionalData
  });
}

export function reportAPIError(message: string, apiName: string, additionalData?: Record<string, any>): string {
  return reportError('api', message, {
    severity: 'high',
    category: `Chrome API - ${apiName}`,
    additionalData
  });
}

export function reportPermissionError(message: string, permission: string): string {
  return reportError('permission', message, {
    severity: 'critical',
    category: 'Permissions',
    additionalData: { permission }
  });
}
