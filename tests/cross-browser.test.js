import { test, expect } from '@playwright/test';
import { ExtensionHelper } from './extension-helper.js';

test.describe('Cross-Browser Compatibility Tests', () => {
  let helper;
  let getConsoleErrors;

  test.beforeEach(async ({ page, context }) => {
    helper = new ExtensionHelper(page, context);
    getConsoleErrors = await helper.captureConsoleErrors();
    
    await helper.navigateToExtension();
    await helper.waitForExtensionReady();
    await helper.enableEditMode();
  });

  test('should work consistently across different browsers', async () => {
    const browser = await helper.detectBrowser();
    const folderOrder = await helper.getFolderOrder();
    
    expect(folderOrder.length).toBeGreaterThanOrEqual(2);
    
    const results = {
      browser: browser.name,
      userAgent: browser.userAgent,
      compatibility: {
        basicFunctionality: true,
        positionAccuracy: true,
        uiRefresh: true,
        dropZones: true
      },
      performanceMetrics: {
        averageOperationTime: 0,
        operationTimes: []
      },
      errors: []
    };

    // Test 1: Basic folder reordering
    try {
      const moveResult = await helper.moveFolderToPosition(0, 1);
      if (!moveResult.success) {
        results.compatibility.basicFunctionality = false;
        results.errors.push(`Basic reordering failed: ${moveResult.error}`);
      }
      results.performanceMetrics.operationTimes.push(moveResult.executionTime);
    } catch (error) {
      results.compatibility.basicFunctionality = false;
      results.errors.push(`Basic reordering error: ${error.message}`);
    }

    // Test 2: Position accuracy
    try {
      const beforeOrder = await helper.getFolderOrder();
      const moveResult = await helper.moveFolderToPosition(1, 0);
      const afterOrder = await helper.getFolderOrder();
      
      const expectedFolder = beforeOrder[1];
      const actualPosition = afterOrder.indexOf(expectedFolder);
      
      if (actualPosition !== 0) {
        results.compatibility.positionAccuracy = false;
        results.errors.push(`Position accuracy failed: expected 0, got ${actualPosition}`);
      }
      results.performanceMetrics.operationTimes.push(moveResult.executionTime);
    } catch (error) {
      results.compatibility.positionAccuracy = false;
      results.errors.push(`Position accuracy error: ${error.message}`);
    }

    // Test 3: UI refresh
    try {
      const initialOrder = await helper.getFolderOrder();
      await helper.moveFolderToPosition(0, 2);
      const newOrder = await helper.getFolderOrder();
      
      const orderChanged = JSON.stringify(initialOrder) !== JSON.stringify(newOrder);
      if (!orderChanged) {
        results.compatibility.uiRefresh = false;
        results.errors.push('UI did not refresh after folder move');
      }
    } catch (error) {
      results.compatibility.uiRefresh = false;
      results.errors.push(`UI refresh error: ${error.message}`);
    }

    // Test 4: Drop zones
    try {
      const insertionPointCount = await helper.getInsertionPointCount();
      const expectedCount = folderOrder.length + 1;
      
      if (insertionPointCount !== expectedCount) {
        results.compatibility.dropZones = false;
        results.errors.push(`Drop zone count mismatch: expected ${expectedCount}, got ${insertionPointCount}`);
      }
    } catch (error) {
      results.compatibility.dropZones = false;
      results.errors.push(`Drop zone error: ${error.message}`);
    }

    // Calculate performance metrics
    if (results.performanceMetrics.operationTimes.length > 0) {
      results.performanceMetrics.averageOperationTime = 
        results.performanceMetrics.operationTimes.reduce((a, b) => a + b, 0) / 
        results.performanceMetrics.operationTimes.length;
    }

    results.overallCompatibility = Object.values(results.compatibility).every(Boolean);
    results.consoleErrors = getConsoleErrors();
    
    test.info().attach('cross-browser-results', {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json'
    });
    
    // Browser-specific expectations
    if (browser.isChrome) {
      expect(results.overallCompatibility).toBe(true);
      expect(results.performanceMetrics.averageOperationTime).toBeLessThan(2000);
    } else if (browser.isBrave) {
      expect(results.overallCompatibility).toBe(true);
      expect(results.performanceMetrics.averageOperationTime).toBeLessThan(3000);
    } else {
      // Other browsers - more lenient expectations
      expect(results.compatibility.basicFunctionality).toBe(true);
    }
    
    expect(results.consoleErrors.length).toBe(0);
  });

  test('should handle browser-specific features correctly', async () => {
    const browser = await helper.detectBrowser();
    
    const results = {
      browser: browser.name,
      features: {},
      browserSpecificTests: []
    };

    // Test browser API availability
    results.features = await helper.page.evaluate(() => ({
      chromeAPI: !!(window.chrome),
      braveAPI: !!(navigator.brave),
      bookmarkAPI: !!(window.chrome?.bookmarks || window.browser?.bookmarks),
      dragEvents: typeof DragEvent !== 'undefined',
      dataTransfer: typeof DataTransfer !== 'undefined',
      customEvents: typeof CustomEvent !== 'undefined',
      enhancedDragDrop: typeof window.EnhancedDragDropManager !== 'undefined'
    }));

    // Browser-specific tests
    if (browser.isChrome) {
      // Chrome-specific UI refresh timing test
      const chromeRefreshTest = await helper.page.evaluate(async () => {
        try {
          if (typeof window.EnhancedDragDropManager?.refreshUI === 'function') {
            const startTime = Date.now();
            const result = await window.EnhancedDragDropManager.refreshUI();
            return {
              name: 'chrome_refresh_timing',
              success: result,
              executionTime: Date.now() - startTime
            };
          }
          return { name: 'chrome_refresh_timing', success: false, error: 'refreshUI not available' };
        } catch (error) {
          return { name: 'chrome_refresh_timing', success: false, error: error.message };
        }
      });
      
      results.browserSpecificTests.push(chromeRefreshTest);
    }

    if (browser.isBrave) {
      // Brave-specific position calculation test
      const bravePositionTest = await helper.page.evaluate(() => {
        try {
          // Test if Brave detection is working
          const isBraveDetected = !!(navigator.brave);
          return {
            name: 'brave_detection',
            success: isBraveDetected,
            detected: isBraveDetected
          };
        } catch (error) {
          return { name: 'brave_detection', success: false, error: error.message };
        }
      });
      
      results.browserSpecificTests.push(bravePositionTest);
    }

    results.allFeaturesAvailable = Object.values(results.features).every(Boolean);
    results.allBrowserTestsPassed = results.browserSpecificTests.every(test => test.success);
    results.consoleErrors = getConsoleErrors();
    
    test.info().attach('browser-features-results', {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json'
    });
    
    expect(results.features.enhancedDragDrop).toBe(true);
    expect(results.features.bookmarkAPI).toBe(true);
    expect(results.allBrowserTestsPassed).toBe(true);
    expect(results.consoleErrors.length).toBe(0);
  });
});
