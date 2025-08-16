import { test, expect } from '../fixtures/extension';
import { ConsoleTestUtils } from '../utils/console-utils';
import { BookmarkTestUtils } from '../utils/bookmark-utils';
import { DragDropTestUtils } from '../utils/dragdrop-utils';
import { ExtensionTestUtils } from '../fixtures/extension';

/**
 * Console Capture and Network Testing for FaVault extension
 * Tests console message capture, network request monitoring, and script injection
 */

test.describe('Console Capture and Network Testing', () => {
  let consoleUtils: ConsoleTestUtils;
  let bookmarkUtils: BookmarkTestUtils;
  let dragDropUtils: DragDropTestUtils;

  test.beforeEach(async ({ newTabPage }) => {
    consoleUtils = new ConsoleTestUtils(newTabPage);
    bookmarkUtils = new BookmarkTestUtils(newTabPage);
    dragDropUtils = new DragDropTestUtils(newTabPage);
    
    // Start comprehensive monitoring
    await consoleUtils.startMonitoring();
    await consoleUtils.monitorExtensionAPICalls();
    await consoleUtils.injectDragDropTestFunctions();
    
    await bookmarkUtils.waitForBookmarksToLoad();
  });

  test.afterEach(async () => {
    const report = consoleUtils.generateTestReport();
    console.log('📊 Console/Network Test Report:', JSON.stringify(report, null, 2));
    
    await consoleUtils.stopMonitoring();
  });

  test('should capture console messages during extension loading', async ({ newTabPage }) => {
    // Reload to capture initial loading messages
    await newTabPage.reload();
    await bookmarkUtils.waitForBookmarksToLoad();
    
    // Get all console messages
    const allMessages = consoleUtils.getConsoleMessagesByType('log');
    const errorMessages = consoleUtils.getErrorMessages();
    const warningMessages = consoleUtils.getWarningMessages();
    
    console.log(`📝 Captured ${allMessages.length} log messages`);
    console.log(`❌ Captured ${errorMessages.length} error messages`);
    console.log(`⚠️ Captured ${warningMessages.length} warning messages`);
    
    // Log sample messages for debugging
    if (allMessages.length > 0) {
      console.log('📝 Sample log messages:');
      allMessages.slice(0, 5).forEach((msg, i) => {
        console.log(`  ${i + 1}. ${msg.text()}`);
      });
    }
    
    // Check for critical errors (excluding expected ones)
    const criticalErrors = errorMessages.filter(err => 
      !err.includes('favicon') && 
      !err.includes('net::ERR_FAILED') &&
      !err.includes('chrome-extension://') &&
      !err.includes('Manifest V2')
    );
    
    expect(criticalErrors).toHaveLength(0);
    
    // Verify extension initialization messages
    const initMessages = consoleUtils.getConsoleMessagesContaining('FaVault');
    expect(initMessages.length).toBeGreaterThan(0);
  });

  test('should monitor Chrome extension API calls', async ({ newTabPage }) => {
    // Trigger bookmark operations to generate API calls
    await newTabPage.reload();
    await bookmarkUtils.waitForBookmarksToLoad();
    
    // Look for bookmark API calls in console
    const bookmarkApiCalls = consoleUtils.getConsoleMessagesContaining('chrome.bookmarks');
    
    console.log(`🔍 Captured ${bookmarkApiCalls.length} bookmark API calls`);
    
    if (bookmarkApiCalls.length > 0) {
      bookmarkApiCalls.forEach((msg, i) => {
        console.log(`  API Call ${i + 1}: ${msg.text()}`);
      });
    }
    
    // Should have at least getTree call
    const getTreeCalls = consoleUtils.getConsoleMessagesContaining('getTree');
    expect(getTreeCalls.length).toBeGreaterThan(0);
  });

  test('should capture network requests and responses', async ({ newTabPage }) => {
    // Reload to capture network activity
    await newTabPage.reload();
    await bookmarkUtils.waitForBookmarksToLoad();
    
    const { networkRequests } = await consoleUtils.stopMonitoring();
    await consoleUtils.startMonitoring(); // Restart for cleanup
    
    console.log(`🌐 Captured ${networkRequests.length} network events`);
    
    // Analyze network requests
    const requests = networkRequests.filter(req => req.type === 'request');
    const responses = networkRequests.filter(req => req.type === 'response');
    
    console.log(`📤 Requests: ${requests.length}`);
    console.log(`📥 Responses: ${responses.length}`);
    
    // Log sample requests
    if (requests.length > 0) {
      console.log('📤 Sample requests:');
      requests.slice(0, 5).forEach((req, i) => {
        console.log(`  ${i + 1}. ${req.method} ${req.url}`);
      });
    }
    
    // Check for failed requests
    const failedRequests = consoleUtils.getFailedRequests();
    console.log(`❌ Failed requests: ${failedRequests.length}`);
    
    if (failedRequests.length > 0) {
      failedRequests.forEach((req, i) => {
        console.log(`  Failed ${i + 1}: ${req.status} ${req.url}`);
      });
    }
    
    // Should not have critical failed requests (favicon failures are OK)
    const criticalFailures = failedRequests.filter(req => 
      !req.url.includes('favicon') && 
      !req.url.includes('chrome-extension://')
    );
    
    expect(criticalFailures.length).toBeLessThanOrEqual(2); // Allow some tolerance
  });

  test('should inject and execute test scripts successfully', async ({ newTabPage }) => {
    // Test basic script injection
    const result = await consoleUtils.injectTestScript(`
      return {
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        extensionLoaded: document.querySelector('[data-testid="favault-app"], .app-container, #app') !== null,
        bookmarkCount: document.querySelectorAll('.bookmark-item, [data-testid="bookmark-item"]').length,
        folderCount: document.querySelectorAll('.folder-container, [data-testid="bookmark-folder"]').length
      };
    `);
    
    console.log('🔧 Script injection result:', result);
    
    expect(result.extensionLoaded).toBeTruthy();
    expect(result.timestamp).toBeGreaterThan(0);
    expect(typeof result.userAgent).toBe('string');
  });

  test('should execute drag-drop test functions via injection', async ({ newTabPage }) => {
    // Enable edit mode first
    await ExtensionTestUtils.enableEditMode(newTabPage);
    
    // Test injected drag-drop functions
    const currentState = await consoleUtils.executeTestFunction('getCurrentBookmarkState');
    console.log('📊 Current bookmark state:', currentState);
    
    expect(currentState.folderCount).toBeGreaterThanOrEqual(0);
    expect(currentState.bookmarkCount).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(currentState.folderTitles)).toBeTruthy();
    expect(Array.isArray(currentState.bookmarkTitles)).toBeTruthy();
    
    // Test edit mode toggle function
    const editModeResult = await consoleUtils.executeTestFunction('testEditModeToggle');
    console.log('🔧 Edit mode toggle result:', editModeResult);
    
    expect(editModeResult.success).toBeTruthy();
    
    // Test search function if bookmarks exist
    if (currentState.bookmarkCount > 0) {
      const searchResult = await consoleUtils.executeTestFunction('testBookmarkSearch', 'test');
      console.log('🔍 Search test result:', searchResult);
      
      expect(searchResult.success).toBeTruthy();
      expect(searchResult.query).toBe('test');
    }
  });

  test('should monitor performance and timing', async ({ newTabPage }) => {
    // Measure page load performance
    const performanceMetrics = await newTabPage.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');
      
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
        totalLoadTime: navigation.loadEventEnd - navigation.fetchStart
      };
    });
    
    console.log('⚡ Performance metrics:', performanceMetrics);
    
    // Performance expectations
    expect(performanceMetrics.totalLoadTime).toBeLessThan(5000); // 5 seconds max
    expect(performanceMetrics.firstContentfulPaint).toBeLessThan(2000); // 2 seconds max
    
    // Monitor memory usage
    const memoryInfo = await newTabPage.evaluate(() => {
      return (performance as any).memory ? {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
      } : null;
    });
    
    if (memoryInfo) {
      console.log('💾 Memory usage:', memoryInfo);
      
      // Memory should not exceed reasonable limits
      const memoryUsageMB = memoryInfo.usedJSHeapSize / (1024 * 1024);
      expect(memoryUsageMB).toBeLessThan(100); // 100MB limit
    }
  });

  test('should detect and report JavaScript errors', async ({ newTabPage }) => {
    // Inject script that causes an error
    try {
      await consoleUtils.injectTestScript(`
        // This should cause an error
        nonExistentFunction();
      `);
    } catch (error) {
      console.log('✅ Expected error caught:', error.message);
    }
    
    // Check if error was captured in console
    const errors = consoleUtils.getErrorMessages();
    const jsErrors = errors.filter(err => 
      err.includes('nonExistentFunction') || 
      err.includes('ReferenceError')
    );
    
    expect(jsErrors.length).toBeGreaterThan(0);
    console.log('❌ JavaScript error successfully captured:', jsErrors[0]);
  });

  test('should monitor extension-specific events', async ({ newTabPage }) => {
    // Monitor for extension-specific console messages
    const extensionMessages = consoleUtils.getConsoleMessagesContaining('🦁'); // Brave-specific
    const dragDropMessages = consoleUtils.getConsoleMessagesContaining('drag');
    const bookmarkMessages = consoleUtils.getConsoleMessagesContaining('bookmark');
    
    console.log(`🦁 Brave messages: ${extensionMessages.length}`);
    console.log(`🔄 Drag-drop messages: ${dragDropMessages.length}`);
    console.log(`📚 Bookmark messages: ${bookmarkMessages.length}`);
    
    // Trigger some extension events
    if (await bookmarkUtils.getBookmarkFolders().then(f => f.length > 0)) {
      await ExtensionTestUtils.enableEditMode(newTabPage);
      await newTabPage.waitForTimeout(1000);
      
      // Check for edit mode messages
      const editModeMessages = consoleUtils.getConsoleMessagesContaining('edit');
      console.log(`✏️ Edit mode messages: ${editModeMessages.length}`);
    }
  });

  test('should validate extension manifest and permissions', async ({ newTabPage }) => {
    // Check extension permissions and manifest via injected script
    const extensionInfo = await consoleUtils.injectTestScript(`
      return {
        chromeAvailable: typeof chrome !== 'undefined',
        bookmarksPermission: typeof chrome?.bookmarks !== 'undefined',
        storagePermission: typeof chrome?.storage !== 'undefined',
        manifestVersion: chrome?.runtime?.getManifest?.()?.manifest_version,
        extensionName: chrome?.runtime?.getManifest?.()?.name,
        permissions: chrome?.runtime?.getManifest?.()?.permissions
      };
    `);
    
    console.log('📋 Extension info:', extensionInfo);
    
    expect(extensionInfo.chromeAvailable).toBeTruthy();
    expect(extensionInfo.bookmarksPermission).toBeTruthy();
    expect(extensionInfo.storagePermission).toBeTruthy();
    expect(extensionInfo.extensionName).toContain('FaVault');
    expect(extensionInfo.permissions).toContain('bookmarks');
    expect(extensionInfo.permissions).toContain('storage');
  });

  test('should generate comprehensive debugging report', async ({ newTabPage }) => {
    // Trigger various extension operations
    await ExtensionTestUtils.enableEditMode(newTabPage);
    await bookmarkUtils.searchBookmarks('test');
    await bookmarkUtils.clearSearch();
    await ExtensionTestUtils.disableEditMode(newTabPage);
    
    // Generate final report
    const finalReport = consoleUtils.generateTestReport();
    
    console.log('📊 Final debugging report:');
    console.log(JSON.stringify(finalReport, null, 2));
    
    // Validate report structure
    expect(finalReport.summary).toBeDefined();
    expect(finalReport.errors).toBeDefined();
    expect(finalReport.warnings).toBeDefined();
    expect(finalReport.networkIssues).toBeDefined();
    
    expect(Array.isArray(finalReport.errors)).toBeTruthy();
    expect(Array.isArray(finalReport.warnings)).toBeTruthy();
    expect(Array.isArray(finalReport.networkIssues)).toBeTruthy();
    
    // Report should contain meaningful data
    expect(finalReport.summary.totalConsoleMessages).toBeGreaterThan(0);
  });
});
