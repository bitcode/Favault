// Extension Loading and Runtime Diagnostics for FaVault
// Specialized utilities for diagnosing Chrome extension issues

import { errorReporter, reportLoadingError, reportInitializationError, reportAPIError, reportPermissionError } from './error-reporter';
import { getBrowserInfo, getExtensionContext } from './utils';

export interface DiagnosticResult {
  test: string;
  status: 'pass' | 'fail' | 'warning' | 'info';
  message: string;
  details?: any;
  suggestions?: string[];
  timing?: number;
}

export interface ExtensionDiagnostics {
  timestamp: string;
  overallStatus: 'healthy' | 'issues' | 'critical';
  results: DiagnosticResult[];
  summary: {
    passed: number;
    failed: number;
    warnings: number;
    total: number;
  };
  recommendations: string[];
  systemInfo: {
    browser: ReturnType<typeof getBrowserInfo>;
    extension: ReturnType<typeof getExtensionContext>;
  };
}

export class ExtensionDiagnosticsRunner {
  private results: DiagnosticResult[] = [];

  /**
   * Run comprehensive extension diagnostics
   */
  async runDiagnostics(): Promise<ExtensionDiagnostics> {
    console.log('🔍 Running FaVault Extension Diagnostics...');
    this.results = [];

    // Core extension tests
    await this.testExtensionContext();
    await this.testManifestAccess();
    await this.testChromeAPIs();
    await this.testPermissions();
    await this.testServiceWorker();
    
    // Runtime tests
    await this.testDOMAccess();
    await this.testBookmarkAccess();
    await this.testStorageAccess();
    await this.testDragDropSystem();
    
    // Performance tests
    await this.testLoadingPerformance();
    await this.testMemoryUsage();

    return this.generateReport();
  }

  /**
   * Test if we're running in proper extension context
   */
  private async testExtensionContext(): Promise<void> {
    const startTime = Date.now();
    const context = getExtensionContext();
    
    if (context.isExtensionContext) {
      this.addResult({
        test: 'Extension Context',
        status: 'pass',
        message: 'Running in valid extension context',
        details: {
          protocol: context.protocol,
          extensionId: context.extensionId,
          manifestVersion: context.manifestVersion
        },
        timing: Date.now() - startTime
      });
    } else {
      this.addResult({
        test: 'Extension Context',
        status: 'fail',
        message: 'Not running in extension context',
        details: { url: context.url, protocol: context.protocol },
        suggestions: [
          'Load this page as a Chrome extension',
          'Check if extension is properly installed',
          'Verify manifest.json configuration'
        ],
        timing: Date.now() - startTime
      });
      
      reportLoadingError('Extension not running in proper context', {
        url: context.url,
        protocol: context.protocol
      });
    }
  }

  /**
   * Test manifest access and validity
   */
  private async testManifestAccess(): Promise<void> {
    const startTime = Date.now();
    
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime) {
        throw new Error('Chrome runtime not available');
      }

      const manifest = chrome.runtime.getManifest();
      
      if (!manifest) {
        throw new Error('Manifest not accessible');
      }

      // Check required fields
      const requiredFields = ['name', 'version', 'manifest_version'];
      const missingFields = requiredFields.filter(field => !manifest[field]);
      
      if (missingFields.length > 0) {
        this.addResult({
          test: 'Manifest Validity',
          status: 'fail',
          message: `Manifest missing required fields: ${missingFields.join(', ')}`,
          details: { manifest, missingFields },
          suggestions: [
            'Check manifest.json for required fields',
            'Validate manifest.json syntax',
            'Reload extension after fixing manifest'
          ],
          timing: Date.now() - startTime
        });
        
        reportLoadingError('Invalid manifest structure', { missingFields });
      } else {
        this.addResult({
          test: 'Manifest Validity',
          status: 'pass',
          message: `Manifest v${manifest.manifest_version} loaded successfully`,
          details: {
            name: manifest.name,
            version: manifest.version,
            manifestVersion: manifest.manifest_version,
            permissions: manifest.permissions
          },
          timing: Date.now() - startTime
        });
      }
    } catch (error) {
      this.addResult({
        test: 'Manifest Access',
        status: 'fail',
        message: `Failed to access manifest: ${error.message}`,
        suggestions: [
          'Check if extension is properly loaded',
          'Verify Chrome extension APIs are available',
          'Try reloading the extension'
        ],
        timing: Date.now() - startTime
      });
      
      reportLoadingError('Manifest access failed', { error: error.message });
    }
  }

  /**
   * Test Chrome API availability
   */
  private async testChromeAPIs(): Promise<void> {
    const startTime = Date.now();
    const apis = [
      { name: 'runtime', api: chrome?.runtime },
      { name: 'bookmarks', api: chrome?.bookmarks },
      { name: 'storage', api: chrome?.storage },
      { name: 'commands', api: chrome?.commands }
    ];

    const availableAPIs: string[] = [];
    const unavailableAPIs: string[] = [];

    apis.forEach(({ name, api }) => {
      if (api) {
        availableAPIs.push(name);
      } else {
        unavailableAPIs.push(name);
      }
    });

    if (unavailableAPIs.length === 0) {
      this.addResult({
        test: 'Chrome APIs',
        status: 'pass',
        message: 'All required Chrome APIs are available',
        details: { availableAPIs },
        timing: Date.now() - startTime
      });
    } else {
      const severity = unavailableAPIs.includes('runtime') || unavailableAPIs.includes('bookmarks') ? 'fail' : 'warning';
      
      this.addResult({
        test: 'Chrome APIs',
        status: severity,
        message: `Some Chrome APIs are unavailable: ${unavailableAPIs.join(', ')}`,
        details: { availableAPIs, unavailableAPIs },
        suggestions: [
          'Check manifest.json permissions',
          'Verify extension is running in proper context',
          'Try reloading the extension'
        ],
        timing: Date.now() - startTime
      });

      if (severity === 'fail') {
        reportAPIError('Critical Chrome APIs unavailable', 'Chrome Extension APIs', {
          unavailableAPIs
        });
      }
    }
  }

  /**
   * Test extension permissions
   */
  private async testPermissions(): Promise<void> {
    const startTime = Date.now();
    
    try {
      if (!chrome?.runtime) {
        throw new Error('Chrome runtime not available');
      }

      const manifest = chrome.runtime.getManifest();
      const declaredPermissions = manifest.permissions || [];
      
      // Test specific permissions
      const permissionTests = [
        {
          name: 'bookmarks',
          test: () => !!chrome.bookmarks,
          required: true
        },
        {
          name: 'storage',
          test: () => !!chrome.storage,
          required: true
        }
      ];

      const results = permissionTests.map(({ name, test, required }) => ({
        name,
        declared: declaredPermissions.includes(name),
        available: test(),
        required
      }));

      const missingRequired = results.filter(r => r.required && (!r.declared || !r.available));
      const missingOptional = results.filter(r => !r.required && r.declared && !r.available);

      if (missingRequired.length > 0) {
        this.addResult({
          test: 'Permissions',
          status: 'fail',
          message: `Missing required permissions: ${missingRequired.map(r => r.name).join(', ')}`,
          details: { declaredPermissions, results },
          suggestions: [
            'Add missing permissions to manifest.json',
            'Reload extension after updating permissions',
            'Check if permissions were granted by user'
          ],
          timing: Date.now() - startTime
        });

        missingRequired.forEach(perm => {
          reportPermissionError(`Required permission missing: ${perm.name}`, perm.name);
        });
      } else {
        this.addResult({
          test: 'Permissions',
          status: missingOptional.length > 0 ? 'warning' : 'pass',
          message: 'Required permissions are available',
          details: { declaredPermissions, results },
          timing: Date.now() - startTime
        });
      }
    } catch (error) {
      this.addResult({
        test: 'Permissions',
        status: 'fail',
        message: `Permission check failed: ${error.message}`,
        suggestions: [
          'Check if extension is properly loaded',
          'Verify manifest.json permissions section'
        ],
        timing: Date.now() - startTime
      });
      
      reportLoadingError('Permission check failed', { error: error.message });
    }
  }

  /**
   * Test service worker status
   */
  private async testServiceWorker(): Promise<void> {
    const startTime = Date.now();
    
    try {
      if (!chrome?.runtime) {
        throw new Error('Chrome runtime not available');
      }

      // Try to ping the service worker
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
          resolve(response);
        });
      });

      if (response) {
        this.addResult({
          test: 'Service Worker',
          status: 'pass',
          message: 'Service worker is active and responding',
          details: { response },
          timing: Date.now() - startTime
        });
      } else {
        this.addResult({
          test: 'Service Worker',
          status: 'warning',
          message: 'Service worker not responding',
          suggestions: [
            'Check service worker console for errors',
            'Try reloading the extension',
            'Verify service-worker.js is properly configured'
          ],
          timing: Date.now() - startTime
        });
      }
    } catch (error) {
      this.addResult({
        test: 'Service Worker',
        status: 'fail',
        message: `Service worker test failed: ${error.message}`,
        suggestions: [
          'Check if service worker is registered',
          'Look for service worker errors in extension console',
          'Verify service-worker.js exists and is valid'
        ],
        timing: Date.now() - startTime
      });
      
      reportInitializationError('Service worker communication failed', {
        error: error.message
      });
    }
  }

  /**
   * Test DOM access and manipulation
   */
  private async testDOMAccess(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Test basic DOM access
      const body = document.body;
      const title = document.title;
      
      // Test DOM manipulation
      const testElement = document.createElement('div');
      testElement.id = 'favault-diagnostic-test';
      testElement.style.display = 'none';
      document.body.appendChild(testElement);
      
      const retrieved = document.getElementById('favault-diagnostic-test');
      document.body.removeChild(testElement);
      
      if (retrieved) {
        this.addResult({
          test: 'DOM Access',
          status: 'pass',
          message: 'DOM access and manipulation working correctly',
          details: { title, bodyClasses: body.className },
          timing: Date.now() - startTime
        });
      } else {
        throw new Error('DOM manipulation test failed');
      }
    } catch (error) {
      this.addResult({
        test: 'DOM Access',
        status: 'fail',
        message: `DOM access failed: ${error.message}`,
        suggestions: [
          'Check if page has finished loading',
          'Verify script execution context',
          'Look for CSP restrictions'
        ],
        timing: Date.now() - startTime
      });
      
      reportInitializationError('DOM access failed', { error: error.message });
    }
  }

  /**
   * Test bookmark API access
   */
  private async testBookmarkAccess(): Promise<void> {
    const startTime = Date.now();

    try {
      if (!chrome?.bookmarks) {
        throw new Error('Bookmarks API not available');
      }

      // Try to get bookmark tree
      const bookmarks = await chrome.bookmarks.getTree();

      if (bookmarks && bookmarks.length > 0) {
        const folderCount = this.countBookmarkFolders(bookmarks);

        this.addResult({
          test: 'Bookmark Access',
          status: 'pass',
          message: `Bookmark API working, found ${folderCount} folders`,
          details: { folderCount, rootNodes: bookmarks.length },
          timing: Date.now() - startTime
        });
      } else {
        this.addResult({
          test: 'Bookmark Access',
          status: 'warning',
          message: 'Bookmark API accessible but no bookmarks found',
          suggestions: [
            'Create some bookmark folders to test functionality',
            'Check if bookmarks permission is properly granted'
          ],
          timing: Date.now() - startTime
        });
      }
    } catch (error) {
      this.addResult({
        test: 'Bookmark Access',
        status: 'fail',
        message: `Bookmark API failed: ${error.message}`,
        suggestions: [
          'Check bookmarks permission in manifest.json',
          'Verify extension has been granted bookmarks access',
          'Try reloading the extension'
        ],
        timing: Date.now() - startTime
      });

      reportAPIError('Bookmark API access failed', 'Bookmarks', { error: error.message });
    }
  }

  /**
   * Test storage API access
   */
  private async testStorageAccess(): Promise<void> {
    const startTime = Date.now();

    try {
      if (!chrome?.storage?.local) {
        throw new Error('Storage API not available');
      }

      const testKey = 'favault_diagnostic_test';
      const testValue = { timestamp: Date.now(), test: true };

      // Test write
      await chrome.storage.local.set({ [testKey]: testValue });

      // Test read
      const result = await chrome.storage.local.get(testKey);

      // Test delete
      await chrome.storage.local.remove(testKey);

      if (result[testKey] && result[testKey].test === true) {
        this.addResult({
          test: 'Storage Access',
          status: 'pass',
          message: 'Storage API read/write operations successful',
          timing: Date.now() - startTime
        });
      } else {
        throw new Error('Storage read/write test failed');
      }
    } catch (error) {
      this.addResult({
        test: 'Storage Access',
        status: 'fail',
        message: `Storage API failed: ${error.message}`,
        suggestions: [
          'Check storage permission in manifest.json',
          'Verify extension has storage access',
          'Check for storage quota issues'
        ],
        timing: Date.now() - startTime
      });

      reportAPIError('Storage API access failed', 'Storage', { error: error.message });
    }
  }

  /**
   * Test drag-drop system initialization
   */
  private async testDragDropSystem(): Promise<void> {
    const startTime = Date.now();

    try {
      // Check if enhanced drag-drop is available
      const enhancedDragDrop = (window as any).EnhancedDragDropManager;
      const dragDropReady = (window as any).enhancedDragDropReady;

      if (enhancedDragDrop) {
        this.addResult({
          test: 'Drag-Drop System',
          status: dragDropReady ? 'pass' : 'warning',
          message: dragDropReady ? 'Enhanced drag-drop system initialized' : 'Drag-drop system available but not initialized',
          details: {
            managerAvailable: !!enhancedDragDrop,
            systemReady: !!dragDropReady,
            stats: (window as any).enhancedDragDropStats
          },
          suggestions: dragDropReady ? [] : [
            'Enable edit mode to initialize drag-drop',
            'Check for initialization errors in console'
          ],
          timing: Date.now() - startTime
        });
      } else {
        this.addResult({
          test: 'Drag-Drop System',
          status: 'warning',
          message: 'Enhanced drag-drop system not available',
          suggestions: [
            'Check if dragdrop-enhanced.ts is properly loaded',
            'Verify script initialization order',
            'Look for JavaScript errors preventing initialization'
          ],
          timing: Date.now() - startTime
        });
      }
    } catch (error) {
      this.addResult({
        test: 'Drag-Drop System',
        status: 'fail',
        message: `Drag-drop system test failed: ${error.message}`,
        suggestions: [
          'Check browser console for drag-drop errors',
          'Verify all required scripts are loaded',
          'Try refreshing the page'
        ],
        timing: Date.now() - startTime
      });
    }
  }

  /**
   * Test loading performance
   */
  private async testLoadingPerformance(): Promise<void> {
    const startTime = Date.now();

    try {
      const timing = performance.timing;
      const loadTime = timing.loadEventEnd - timing.navigationStart;
      const domReady = timing.domContentLoadedEventEnd - timing.navigationStart;

      let status: DiagnosticResult['status'] = 'pass';
      const suggestions: string[] = [];

      if (loadTime > 5000) {
        status = 'warning';
        suggestions.push('Page load time is slow (>5s), consider optimizing resources');
      }

      if (domReady > 3000) {
        status = 'warning';
        suggestions.push('DOM ready time is slow (>3s), check for blocking scripts');
      }

      this.addResult({
        test: 'Loading Performance',
        status,
        message: `Page loaded in ${loadTime}ms, DOM ready in ${domReady}ms`,
        details: {
          loadTime,
          domReady,
          navigationStart: timing.navigationStart,
          loadEventEnd: timing.loadEventEnd
        },
        suggestions,
        timing: Date.now() - startTime
      });
    } catch (error) {
      this.addResult({
        test: 'Loading Performance',
        status: 'info',
        message: 'Performance timing not available',
        timing: Date.now() - startTime
      });
    }
  }

  /**
   * Test memory usage
   */
  private async testMemoryUsage(): Promise<void> {
    const startTime = Date.now();

    try {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
        const totalMB = Math.round(memory.totalJSHeapSize / 1024 / 1024);
        const limitMB = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);

        let status: DiagnosticResult['status'] = 'pass';
        const suggestions: string[] = [];

        if (usedMB > 50) {
          status = 'warning';
          suggestions.push('High memory usage detected, check for memory leaks');
        }

        this.addResult({
          test: 'Memory Usage',
          status,
          message: `Using ${usedMB}MB of ${totalMB}MB allocated (limit: ${limitMB}MB)`,
          details: {
            usedMB,
            totalMB,
            limitMB,
            usagePercent: Math.round((usedMB / totalMB) * 100)
          },
          suggestions,
          timing: Date.now() - startTime
        });
      } else {
        this.addResult({
          test: 'Memory Usage',
          status: 'info',
          message: 'Memory information not available in this browser',
          timing: Date.now() - startTime
        });
      }
    } catch (error) {
      this.addResult({
        test: 'Memory Usage',
        status: 'info',
        message: 'Memory usage test failed',
        timing: Date.now() - startTime
      });
    }
  }

  /**
   * Count bookmark folders recursively
   */
  private countBookmarkFolders(nodes: any[]): number {
    let count = 0;
    for (const node of nodes) {
      if (node.children) {
        count++;
        count += this.countBookmarkFolders(node.children);
      }
    }
    return count;
  }

  /**
   * Generate comprehensive diagnostic report
   */
  private generateReport(): ExtensionDiagnostics {
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;

    let overallStatus: ExtensionDiagnostics['overallStatus'] = 'healthy';
    if (failed > 0) {
      overallStatus = 'critical';
    } else if (warnings > 0) {
      overallStatus = 'issues';
    }

    // Generate recommendations
    const recommendations: string[] = [];
    const failedTests = this.results.filter(r => r.status === 'fail');
    const warningTests = this.results.filter(r => r.status === 'warning');

    if (failedTests.length > 0) {
      recommendations.push(`Address ${failedTests.length} critical issues immediately`);
      failedTests.forEach(test => {
        if (test.suggestions) {
          recommendations.push(...test.suggestions.map(s => `${test.test}: ${s}`));
        }
      });
    }

    if (warningTests.length > 0) {
      recommendations.push(`Review ${warningTests.length} warnings for potential improvements`);
    }

    if (overallStatus === 'healthy') {
      recommendations.push('Extension is functioning normally');
    }

    return {
      timestamp: new Date().toISOString(),
      overallStatus,
      results: this.results,
      summary: {
        passed,
        failed,
        warnings,
        total: this.results.length
      },
      recommendations,
      systemInfo: {
        browser: getBrowserInfo(),
        extension: getExtensionContext()
      }
    };
  }

  /**
   * Add a diagnostic result
   */
  private addResult(result: DiagnosticResult): void {
    this.results.push(result);

    // Log result to console
    const icon = {
      pass: '✅',
      fail: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    }[result.status];

    console.log(`${icon} ${result.test}: ${result.message}${result.timing ? ` (${result.timing}ms)` : ''}`);
  }
}

// Export singleton instance
export const extensionDiagnostics = new ExtensionDiagnosticsRunner();

// Convenience function to run diagnostics and get text report
export async function runDiagnosticsAndGetReport(): Promise<string> {
  const diagnostics = await extensionDiagnostics.runDiagnostics();

  let report = `FaVault Extension Diagnostics Report
Generated: ${new Date(diagnostics.timestamp).toLocaleString()}
Overall Status: ${diagnostics.overallStatus.toUpperCase()}
========================================

SUMMARY
-------
Total Tests: ${diagnostics.summary.total}
Passed: ${diagnostics.summary.passed}
Failed: ${diagnostics.summary.failed}
Warnings: ${diagnostics.summary.warnings}

RECOMMENDATIONS
--------------
${diagnostics.recommendations.map(rec => `• ${rec}`).join('\n')}

DETAILED RESULTS
===============
`;

  diagnostics.results.forEach((result, index) => {
    const icon = {
      pass: '✅',
      fail: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    }[result.status];

    report += `
${index + 1}. ${icon} ${result.test}
   Status: ${result.status.toUpperCase()}
   Message: ${result.message}`;

    if (result.timing) {
      report += `
   Timing: ${result.timing}ms`;
    }

    if (result.suggestions && result.suggestions.length > 0) {
      report += `
   Suggestions:
   ${result.suggestions.map(s => `   • ${s}`).join('\n')}`;
    }

    if (result.details) {
      report += `
   Details: ${JSON.stringify(result.details, null, 2).split('\n').map(line => `   ${line}`).join('\n')}`;
    }

    report += '\n' + '-'.repeat(60);
  });

  report += `

SYSTEM INFORMATION
=================
Browser: ${diagnostics.systemInfo.browser.userAgent}
Platform: ${diagnostics.systemInfo.browser.platform}
Extension ID: ${diagnostics.systemInfo.extension.extensionId || 'N/A'}
Manifest Version: ${diagnostics.systemInfo.extension.manifestVersion || 'N/A'}
Chrome APIs: ${JSON.stringify(diagnostics.systemInfo.browser.chrome, null, 2)}
`;

  return report;
}
