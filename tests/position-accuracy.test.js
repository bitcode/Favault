import { test, expect } from '@playwright/test';
import { ExtensionHelper } from './extension-helper.js';
import { TestLogger } from '../test-logger.js';

test.describe('Position Accuracy Tests', () => {
  let helper;
  let getConsoleErrors;
  let logger;

  test.beforeEach(async ({ page, context }) => {
    logger = new TestLogger('position-accuracy');
    logger.log('INFO', 'Starting position accuracy test setup');

    helper = new ExtensionHelper(page, context);
    getConsoleErrors = await helper.captureConsoleErrors();

    logger.log('INFO', 'Navigating to extension');
    await helper.navigateToExtension();

    logger.log('INFO', 'Waiting for extension ready');
    await helper.waitForExtensionReady();

    logger.log('INFO', 'Enabling edit mode');
    await helper.enableEditMode();

    logger.log('SUCCESS', 'Test setup completed');
  });

  test.afterEach(async () => {
    if (logger) {
      logger.finalize();
      const logFiles = logger.saveLogFiles();
      console.log('📄 Position accuracy test logs saved:', logFiles.latestFile);
    }
  });

  test('should accurately position folders at all insertion points', async () => {
    const browser = await helper.detectBrowser();
    const initialOrder = await helper.getFolderOrder();
    
    expect(initialOrder.length).toBeGreaterThanOrEqual(3);
    
    const results = {
      browser: browser.name,
      totalPositions: initialOrder.length + 1,
      successfulMoves: 0,
      failedMoves: 0,
      accuracy: 0,
      executionTimes: [],
      errors: []
    };

    // Test moving first folder to each possible position
    for (let targetPosition = 0; targetPosition <= initialOrder.length; targetPosition++) {
      const moveResult = await helper.moveFolderToPosition(0, targetPosition);
      results.executionTimes.push(moveResult.executionTime);
      
      if (!moveResult.success) {
        results.failedMoves++;
        results.errors.push({
          targetPosition,
          error: moveResult.error
        });
        continue;
      }
      
      const newOrder = await helper.getFolderOrder();
      const movedFolder = initialOrder[0];
      const actualPosition = newOrder.indexOf(movedFolder);
      
      if (actualPosition === targetPosition) {
        results.successfulMoves++;
      } else {
        results.failedMoves++;
        results.errors.push({
          targetPosition,
          actualPosition,
          error: `Position mismatch: expected ${targetPosition}, got ${actualPosition}`
        });
      }
      
      // Reset to initial state for next test
      if (actualPosition !== 0) {
        await helper.moveFolderToPosition(actualPosition, 0);
      }
    }
    
    results.accuracy = (results.successfulMoves / results.totalPositions) * 100;
    results.averageExecutionTime = results.executionTimes.reduce((a, b) => a + b, 0) / results.executionTimes.length;
    results.consoleErrors = getConsoleErrors();
    
    // Store results for reporting
    test.info().attach('position-accuracy-results', {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json'
    });
    
    // Assertions
    expect(results.accuracy).toBeGreaterThanOrEqual(90); // 90% minimum accuracy
    expect(results.consoleErrors.length).toBe(0);
    expect(results.averageExecutionTime).toBeLessThan(3000); // Under 3 seconds average
  });

  test('should handle edge cases correctly', async () => {
    const initialOrder = await helper.getFolderOrder();
    const results = {
      tests: [],
      allPassed: true
    };

    // Test 1: Move to same position
    const samePositionResult = await helper.moveFolderToPosition(0, 0);
    const samePositionOrder = await helper.getFolderOrder();
    const samePositionTest = {
      name: 'move_to_same_position',
      passed: JSON.stringify(initialOrder) === JSON.stringify(samePositionOrder),
      executionTime: samePositionResult.executionTime
    };
    results.tests.push(samePositionTest);
    
    // Test 2: Move to last position
    const lastPosition = initialOrder.length;
    const lastPositionResult = await helper.moveFolderToPosition(0, lastPosition);
    const lastPositionOrder = await helper.getFolderOrder();
    const movedToLast = lastPositionOrder[lastPosition] === initialOrder[0];
    const lastPositionTest = {
      name: 'move_to_last_position',
      passed: movedToLast,
      executionTime: lastPositionResult.executionTime
    };
    results.tests.push(lastPositionTest);
    
    // Test 3: Move last folder to first position
    await helper.moveFolderToPosition(lastPosition, 0);
    const firstPositionOrder = await helper.getFolderOrder();
    const movedToFirst = firstPositionOrder[0] === initialOrder[0];
    const firstPositionTest = {
      name: 'move_last_to_first',
      passed: movedToFirst,
      executionTime: 0 // Previous move time
    };
    results.tests.push(firstPositionTest);
    
    results.allPassed = results.tests.every(test => test.passed);
    results.consoleErrors = getConsoleErrors();
    
    test.info().attach('edge-cases-results', {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json'
    });
    
    expect(results.allPassed).toBe(true);
    expect(results.consoleErrors.length).toBe(0);
  });
});
