import { test, expect } from '@playwright/test';
import { ExtensionHelper } from './extension-helper.js';

test.describe('UI Refresh Tests', () => {
  let helper;
  let getConsoleErrors;

  test.beforeEach(async ({ page, context }) => {
    helper = new ExtensionHelper(page, context);
    getConsoleErrors = await helper.captureConsoleErrors();
    
    await helper.navigateToExtension();
    await helper.waitForExtensionReady();
    await helper.enableEditMode();
  });

  test('should refresh UI immediately after folder reordering', async () => {
    const browser = await helper.detectBrowser();
    const initialOrder = await helper.getFolderOrder();
    
    expect(initialOrder.length).toBeGreaterThanOrEqual(2);
    
    const results = {
      browser: browser.name,
      tests: [],
      overallSuccess: true,
      averageRefreshTime: 0
    };

    // Test multiple reordering operations
    const testCases = [
      { from: 0, to: 1, name: 'first_to_second' },
      { from: 1, to: 0, name: 'second_to_first' },
      { from: 0, to: initialOrder.length, name: 'first_to_last' }
    ];

    for (const testCase of testCases) {
      const beforeOrder = await helper.getFolderOrder();
      const startTime = Date.now();
      
      const moveResult = await helper.moveFolderToPosition(testCase.from, testCase.to);
      
      if (!moveResult.success) {
        results.tests.push({
          name: testCase.name,
          passed: false,
          error: moveResult.error,
          refreshTime: 0
        });
        results.overallSuccess = false;
        continue;
      }
      
      // Check if UI updated
      const afterOrder = await helper.getFolderOrder();
      const orderChanged = JSON.stringify(beforeOrder) !== JSON.stringify(afterOrder);
      const refreshTime = Date.now() - startTime;
      
      const testResult = {
        name: testCase.name,
        passed: orderChanged,
        refreshTime,
        beforeOrder: beforeOrder.slice(0, 3), // Limit data size
        afterOrder: afterOrder.slice(0, 3),
        expectedPosition: testCase.to,
        actualPosition: afterOrder.indexOf(beforeOrder[testCase.from])
      };
      
      results.tests.push(testResult);
      
      if (!orderChanged) {
        results.overallSuccess = false;
      }
    }
    
    results.averageRefreshTime = results.tests.reduce((sum, test) => sum + test.refreshTime, 0) / results.tests.length;
    results.consoleErrors = getConsoleErrors();
    
    test.info().attach('ui-refresh-results', {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json'
    });
    
    // Assertions
    expect(results.overallSuccess).toBe(true);
    expect(results.averageRefreshTime).toBeLessThan(3000); // Under 3 seconds
    expect(results.consoleErrors.length).toBe(0);
  });

  test('should handle rapid successive reordering operations', async () => {
    const initialOrder = await helper.getFolderOrder();
    
    expect(initialOrder.length).toBeGreaterThanOrEqual(3);
    
    const results = {
      rapidOperations: [],
      allSuccessful: true,
      totalTime: 0
    };

    const startTime = Date.now();
    
    // Perform rapid successive moves
    const operations = [
      { from: 0, to: 2 },
      { from: 2, to: 1 },
      { from: 1, to: 0 }
    ];

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      const opStartTime = Date.now();
      
      const moveResult = await helper.moveFolderToPosition(op.from, op.to);
      
      const opResult = {
        operation: i + 1,
        from: op.from,
        to: op.to,
        success: moveResult.success,
        executionTime: Date.now() - opStartTime,
        error: moveResult.error || null
      };
      
      results.rapidOperations.push(opResult);
      
      if (!moveResult.success) {
        results.allSuccessful = false;
      }
      
      // Small delay between operations
      await helper.page.waitForTimeout(200);
    }
    
    results.totalTime = Date.now() - startTime;
    results.averageOperationTime = results.totalTime / operations.length;
    results.consoleErrors = getConsoleErrors();
    
    test.info().attach('rapid-operations-results', {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json'
    });
    
    expect(results.allSuccessful).toBe(true);
    expect(results.averageOperationTime).toBeLessThan(2000);
    expect(results.consoleErrors.length).toBe(0);
  });

  test('should maintain UI consistency across browser refresh', async () => {
    const initialOrder = await helper.getFolderOrder();
    
    // Perform a reordering operation
    const moveResult = await helper.moveFolderToPosition(0, 1);
    expect(moveResult.success).toBe(true);
    
    const orderAfterMove = await helper.getFolderOrder();
    
    // Refresh the page
    await helper.page.reload();
    await helper.waitForExtensionReady();
    
    const orderAfterRefresh = await helper.getFolderOrder();
    
    const results = {
      initialOrder: initialOrder.slice(0, 3),
      orderAfterMove: orderAfterMove.slice(0, 3),
      orderAfterRefresh: orderAfterRefresh.slice(0, 3),
      consistencyMaintained: JSON.stringify(orderAfterMove) === JSON.stringify(orderAfterRefresh),
      consoleErrors: getConsoleErrors()
    };
    
    test.info().attach('consistency-results', {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json'
    });
    
    expect(results.consistencyMaintained).toBe(true);
    expect(results.consoleErrors.length).toBe(0);
  });
});
