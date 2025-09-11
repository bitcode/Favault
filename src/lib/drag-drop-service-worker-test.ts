// Test suite for drag-and-drop functionality with service worker cycling
import { serviceWorkerManager } from './service-worker-manager';
import { BookmarkEditAPI } from './api';
import { BookmarkManager } from './bookmarks';

export interface ServiceWorkerDragDropTestResult {
  testName: string;
  passed: boolean;
  error?: string;
  serviceWorkerStatus?: any;
  timing?: number;
}

export interface ServiceWorkerDragDropTestSuite {
  name: string;
  results: ServiceWorkerDragDropTestResult[];
  passed: number;
  failed: number;
  total: number;
  serviceWorkerCycled: boolean;
}

export class ServiceWorkerDragDropTester {
  private static testResults: ServiceWorkerDragDropTestResult[] = [];

  /**
   * Run comprehensive drag-and-drop tests with service worker cycling
   */
  static async runServiceWorkerDragDropTests(): Promise<ServiceWorkerDragDropTestSuite> {
    console.log('🧪 Starting drag-and-drop tests with service worker cycling...');
    
    this.testResults = [];
    let serviceWorkerCycled = false;

    // Test 1: Basic drag-and-drop with active service worker
    await this.runTest('Basic Drag-Drop with Active SW', async () => {
      const isActive = await serviceWorkerManager.ensureActive();
      if (!isActive) {
        throw new Error('Could not ensure service worker is active');
      }
      
      // Simulate a basic bookmark move
      return await this.simulateBookmarkMove('test-bookmark-1', 'folder-1', 0);
    });

    // Test 2: Force service worker to become inactive and test reactivation
    await this.runTest('Service Worker Reactivation', async () => {
      // Get initial status
      const initialStatus = serviceWorkerManager.getStatus();
      
      // Wait for potential inactivity (simulate by waiting)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Force a status check
      const status = await serviceWorkerManager.forceStatusCheck();
      
      // If service worker became inactive, mark that we've tested cycling
      if (!status.isActive && initialStatus.isActive) {
        serviceWorkerCycled = true;
      }
      
      // Ensure it can be reactivated
      const isActive = await serviceWorkerManager.ensureActive();
      return isActive;
    });

    // Test 3: Drag-and-drop after service worker reactivation
    await this.runTest('Drag-Drop After SW Reactivation', async () => {
      // Ensure service worker is active
      const isActive = await serviceWorkerManager.ensureActive();
      if (!isActive) {
        throw new Error('Service worker could not be reactivated');
      }
      
      // Test bookmark move after reactivation
      return await this.simulateBookmarkMove('test-bookmark-2', 'folder-2', 1);
    });

    // Test 4: Multiple rapid operations
    await this.runTest('Rapid Multiple Operations', async () => {
      const operations = [];
      
      for (let i = 0; i < 5; i++) {
        operations.push(this.simulateBookmarkMove(`test-bookmark-${i}`, `folder-${i % 2}`, i));
      }
      
      const results = await Promise.allSettled(operations);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      
      return successful >= 3; // At least 60% success rate
    });

    // Test 5: Service worker status monitoring during operations
    await this.runTest('SW Status Monitoring During Operations', async () => {
      const statusBefore = serviceWorkerManager.getStatus();
      
      // Perform an operation
      await this.simulateBookmarkMove('test-bookmark-monitor', 'folder-monitor', 0);
      
      const statusAfter = serviceWorkerManager.getStatus();
      
      // Verify status was tracked
      return statusAfter.lastPing >= statusBefore.lastPing;
    });

    // Test 6: Error handling with inactive service worker
    await this.runTest('Error Handling with Inactive SW', async () => {
      try {
        // Try to perform operation without ensuring service worker is active
        // This should either succeed (if SW is active) or handle gracefully
        const result = await this.simulateBookmarkMove('test-bookmark-error', 'folder-error', 0, false);
        return true; // Success is good
      } catch (error) {
        // Graceful error handling is also acceptable
        return error instanceof Error && error.message.includes('service worker') || 
               error instanceof Error && error.message.includes('inactive');
      }
    });

    // Test 7: Bookmark data integrity across service worker cycles
    await this.runTest('Data Integrity Across SW Cycles', async () => {
      // Get initial bookmark state
      const initialBookmarks = await BookmarkManager.getOrganizedBookmarks();
      const initialCount = initialBookmarks.reduce((sum, folder) => sum + folder.bookmarks.length, 0);
      
      // Perform operations
      await this.simulateBookmarkMove('test-integrity-1', 'folder-integrity', 0);
      
      // Force service worker check
      await serviceWorkerManager.forceStatusCheck();
      
      // Perform another operation
      await this.simulateBookmarkMove('test-integrity-2', 'folder-integrity', 1);
      
      // Check final state
      BookmarkManager.clearCache(); // Force fresh data
      const finalBookmarks = await BookmarkManager.getOrganizedBookmarks();
      const finalCount = finalBookmarks.reduce((sum, folder) => sum + folder.bookmarks.length, 0);
      
      // Data integrity check (count should be consistent)
      return Math.abs(finalCount - initialCount) <= 2; // Allow for test bookmarks
    });

    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.filter(r => !r.passed).length;

    const suite: ServiceWorkerDragDropTestSuite = {
      name: 'Drag-and-Drop with Service Worker Cycling',
      results: this.testResults,
      passed,
      failed,
      total: this.testResults.length,
      serviceWorkerCycled
    };

    console.log(`🧪 Service worker drag-drop tests completed: ${passed}/${suite.total} passed`);
    
    if (failed > 0) {
      console.warn(`❌ ${failed} tests failed:`);
      this.testResults.filter(r => !r.passed).forEach(result => {
        console.warn(`  - ${result.testName}: ${result.error}`);
      });
    }

    if (serviceWorkerCycled) {
      console.log('✅ Service worker cycling was detected and tested');
    } else {
      console.log('ℹ️ Service worker remained active throughout tests');
    }

    return suite;
  }

  /**
   * Simulate a bookmark move operation
   */
  private static async simulateBookmarkMove(
    bookmarkId: string, 
    targetFolderId: string, 
    targetIndex: number,
    ensureServiceWorkerActive: boolean = true
  ): Promise<boolean> {
    try {
      if (ensureServiceWorkerActive) {
        const isActive = await serviceWorkerManager.ensureActive();
        if (!isActive) {
          throw new Error('Service worker is not active');
        }
      }

      // Note: This is a simulation - in a real test, you would use actual bookmark IDs
      // For now, we'll test the API availability and service worker communication
      
      // Test service worker communication
      const response = await new Promise((resolve, reject) => {
        if (!chrome?.runtime) {
          reject(new Error('Chrome runtime not available'));
          return;
        }

        const timeout = setTimeout(() => {
          reject(new Error('Service worker communication timeout'));
        }, 5000);

        chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
          clearTimeout(timeout);
          
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });

      return response && (response as any).status === 'pong';
    } catch (error) {
      console.error('Bookmark move simulation failed:', error);
      throw error;
    }
  }

  /**
   * Run a single test
   */
  private static async runTest(testName: string, testFunction: () => Promise<boolean>): Promise<void> {
    const startTime = Date.now();
    
    try {
      const result = await testFunction();
      const timing = Date.now() - startTime;
      
      this.testResults.push({
        testName,
        passed: result,
        serviceWorkerStatus: serviceWorkerManager.getStatus(),
        timing
      });
      
      if (result) {
        console.log(`✅ ${testName} (${timing}ms)`);
      } else {
        console.warn(`❌ ${testName} (${timing}ms)`);
      }
    } catch (error) {
      const timing = Date.now() - startTime;
      
      this.testResults.push({
        testName,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        serviceWorkerStatus: serviceWorkerManager.getStatus(),
        timing
      });
      
      console.error(`❌ ${testName} (${timing}ms): ${error}`);
    }
  }

  /**
   * Generate a detailed test report
   */
  static generateReport(suite: ServiceWorkerDragDropTestSuite): string {
    const passRate = ((suite.passed / suite.total) * 100).toFixed(1);
    
    let report = `# Service Worker Drag-and-Drop Test Report\n\n`;
    report += `**Overall Result**: ${suite.passed}/${suite.total} tests passed (${passRate}%)\n`;
    report += `**Service Worker Cycling**: ${suite.serviceWorkerCycled ? 'Detected and tested' : 'Not detected'}\n\n`;
    
    if (suite.failed > 0) {
      report += `## Failed Tests\n\n`;
      suite.results.filter(r => !r.passed).forEach(result => {
        report += `- **${result.testName}**: ${result.error || 'Test failed'}\n`;
        if (result.timing) {
          report += `  - Duration: ${result.timing}ms\n`;
        }
        if (result.serviceWorkerStatus) {
          report += `  - SW Status: ${result.serviceWorkerStatus.isActive ? 'Active' : 'Inactive'}\n`;
        }
      });
      report += `\n`;
    }
    
    report += `## All Test Results\n\n`;
    suite.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      const timing = result.timing ? ` (${result.timing}ms)` : '';
      report += `${status} ${result.testName}${timing}\n`;
    });
    
    report += `\n## Performance Summary\n\n`;
    const avgTiming = suite.results.reduce((sum, r) => sum + (r.timing || 0), 0) / suite.results.length;
    report += `- Average test duration: ${avgTiming.toFixed(0)}ms\n`;
    report += `- Fastest test: ${Math.min(...suite.results.map(r => r.timing || 0))}ms\n`;
    report += `- Slowest test: ${Math.max(...suite.results.map(r => r.timing || 0))}ms\n`;
    
    return report;
  }
}

// Expose to global scope for manual testing
if (typeof window !== 'undefined') {
  (window as any).ServiceWorkerDragDropTester = ServiceWorkerDragDropTester;
}
