/**
 * Comprehensive Drag and Drop Position Validation Tests for Chrome
 * 
 * These tests specifically target the inconsistent positioning issues:
 * 1. Sometimes dragging over 1 position results in no movement
 * 2. Sometimes dragging over 2 positions only moves 1 position  
 * 3. Sometimes dragging over 2 positions moves 3 positions
 * 4. Final drop position is consistently off by 1-2 positions
 * 
 * Tests run exclusively in Chrome to isolate browser-specific behavior
 */

import { test, expect, Page } from '@playwright/test';
import { ExtensionTestUtils } from '../utils/extension-utils';
import { DragDropTestUtils } from '../utils/dragdrop-utils';
import { BookmarkTestUtils } from '../utils/bookmark-utils';
import { ConsoleTestUtils } from '../utils/console-utils';

// Force Chrome-only execution
test.describe.configure({ mode: 'serial' });

interface PositionTestResult {
  initialPosition: number;
  targetPosition: number;
  actualFinalPosition: number;
  expectedFinalPosition: number;
  positionDifference: number;
  success: boolean;
  folderTitle: string;
  timestamp: number;
}

interface FolderPositionSnapshot {
  title: string;
  position: number;
  element: string; // selector or identifier
}

class PositionValidator {
  constructor(private page: Page) {}

  /**
   * Get current positions of all folders
   */
  async getFolderPositions(): Promise<FolderPositionSnapshot[]> {
    return await this.page.evaluate(() => {
      // Look for both real folders and mock folders
      const folders = Array.from(document.querySelectorAll('.folder-container, .mock-folder'));
      return folders.map((folder, index) => {
        const titleElement = folder.querySelector('.folder-title, h3, .folder-name, .mock-folder-title');
        const title = titleElement?.textContent?.trim() ||
                     folder.getAttribute('data-title') ||
                     `Folder ${index}`;
        return {
          title,
          position: index,
          element: `.folder-container:nth-child(${index + 1}), .mock-folder:nth-child(${index + 1})`
        };
      });
    });
  }

  /**
   * Validate position consistency after operations
   */
  async validatePositionConsistency(
    beforePositions: FolderPositionSnapshot[],
    afterPositions: FolderPositionSnapshot[],
    expectedChanges: { folderTitle: string; expectedPosition: number }[]
  ): Promise<{ isConsistent: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Check if folder count changed unexpectedly
    if (beforePositions.length !== afterPositions.length) {
      issues.push(`Folder count changed: ${beforePositions.length} -> ${afterPositions.length}`);
    }

    // Validate expected changes
    for (const expectedChange of expectedChanges) {
      const afterFolder = afterPositions.find(f => f.title === expectedChange.folderTitle);
      if (!afterFolder) {
        issues.push(`Folder "${expectedChange.folderTitle}" not found after operation`);
        continue;
      }

      if (afterFolder.position !== expectedChange.expectedPosition) {
        issues.push(
          `Folder "${expectedChange.folderTitle}" at position ${afterFolder.position}, expected ${expectedChange.expectedPosition}`
        );
      }
    }

    return {
      isConsistent: issues.length === 0,
      issues
    };
  }

  /**
   * Log detailed position information for debugging
   */
  async logPositionDetails(label: string, positions: FolderPositionSnapshot[]): Promise<void> {
    console.log(`\n📍 ${label}:`);
    positions.forEach((folder, index) => {
      console.log(`  ${index}: "${folder.title}"`);
    });
  }
}

test.describe('Chrome Drag and Drop Position Validation', () => {
  let dragDropUtils: DragDropTestUtils;
  let bookmarkUtils: BookmarkTestUtils;
  let consoleUtils: ConsoleTestUtils;
  let positionValidator: PositionValidator;

  // Only run on Chrome projects
  test.skip(({ browserName }) => browserName !== 'chromium', 'Chrome-specific positioning tests');

  test.beforeEach(async ({ page, context }) => {
    dragDropUtils = new DragDropTestUtils(page);
    bookmarkUtils = new BookmarkTestUtils(page, context);
    consoleUtils = new ConsoleTestUtils(page);
    positionValidator = new PositionValidator(page);

    // Start console monitoring
    await consoleUtils.startMonitoring();

    // Navigate to extension and set up test data
    await ExtensionTestUtils.navigateToExtension(page);
    await bookmarkUtils.setupTestBookmarks();
    
    // Enable edit mode and wait for drag-drop system
    await ExtensionTestUtils.enableEditMode(page);

    // Try to wait for enhanced drag-drop, but don't fail if it's not available
    try {
      await ExtensionTestUtils.waitForEnhancedDragDropSetup(page, 5000);
      console.log('✅ Enhanced drag-drop system ready');
    } catch (error) {
      console.log('⚠️ Enhanced drag-drop system not available, proceeding with basic testing');
    }

    // Wait for folders to be fully rendered (either real or mock)
    try {
      await page.waitForSelector('.folder-container', { timeout: 5000 });
      console.log('✅ Found .folder-container elements');
    } catch (error) {
      // If no folder-container, check for mock container
      try {
        await page.waitForSelector('#mock-bookmark-container', { timeout: 5000 });
        console.log('✅ Found mock bookmark container');
      } catch (mockError) {
        console.log('⚠️ No folders found, checking page content...');
        const pageContent = await page.evaluate(() => {
          return {
            bodyHTML: document.body.innerHTML.substring(0, 500),
            folderContainers: document.querySelectorAll('.folder-container').length,
            mockContainers: document.querySelectorAll('#mock-bookmark-container').length,
            allDivs: document.querySelectorAll('div').length
          };
        });
        console.log('📋 Page content analysis:', pageContent);
      }
    }
    await page.waitForTimeout(1000); // Additional stability wait
  });

  test.afterEach(async ({ page }) => {
    // Log any console errors for debugging
    const errors = await consoleUtils.getConsoleErrors();
    if (errors.length > 0) {
      console.log('\n🚨 Console Errors:', errors);
    }

    await consoleUtils.stopMonitoring();
  });

  test('should detect initial folder positions accurately', async ({ page }) => {
    const initialPositions = await positionValidator.getFolderPositions();
    
    expect(initialPositions.length).toBeGreaterThanOrEqual(3);
    await positionValidator.logPositionDetails('Initial Positions', initialPositions);

    // Verify positions are sequential
    initialPositions.forEach((folder, index) => {
      expect(folder.position).toBe(index);
    });

    // Store initial state for comparison in other tests
    await page.evaluate((positions) => {
      (window as any).initialFolderPositions = positions;
    }, initialPositions);
  });

  test('should validate single position forward movement', async ({ page }) => {
    const beforePositions = await positionValidator.getFolderPositions();
    await positionValidator.logPositionDetails('Before Single Forward Move', beforePositions);

    // Move first folder to second position
    const sourceFolder = beforePositions[0];
    const targetPosition = 1;

    console.log(`\n🎯 TEST: Moving "${sourceFolder.title}" from position 0 to position ${targetPosition}`);

    // Perform drag operation
    const folders = await page.locator('.folder-container').all();
    await dragDropUtils.dragAndDrop(folders[0], folders[targetPosition]);

    // Wait for operation to complete
    await page.waitForTimeout(2000);

    const afterPositions = await positionValidator.getFolderPositions();
    await positionValidator.logPositionDetails('After Single Forward Move', afterPositions);

    // Validate the move
    const validation = await positionValidator.validatePositionConsistency(
      beforePositions,
      afterPositions,
      [{ folderTitle: sourceFolder.title, expectedPosition: targetPosition }]
    );

    if (!validation.isConsistent) {
      console.log('\n❌ Position Validation Issues:', validation.issues);
    }

    expect(validation.isConsistent).toBeTruthy();
  });

  test('should validate single position backward movement', async ({ page }) => {
    const beforePositions = await positionValidator.getFolderPositions();
    await positionValidator.logPositionDetails('Before Single Backward Move', beforePositions);

    // Move third folder to first position
    const sourceIndex = 2;
    const targetPosition = 0;
    const sourceFolder = beforePositions[sourceIndex];

    console.log(`\n🎯 TEST: Moving "${sourceFolder.title}" from position ${sourceIndex} to position ${targetPosition}`);

    // Perform drag operation
    const folders = await page.locator('.folder-container').all();
    await dragDropUtils.dragAndDrop(folders[sourceIndex], folders[targetPosition]);

    // Wait for operation to complete
    await page.waitForTimeout(2000);

    const afterPositions = await positionValidator.getFolderPositions();
    await positionValidator.logPositionDetails('After Single Backward Move', afterPositions);

    // Validate the move
    const validation = await positionValidator.validatePositionConsistency(
      beforePositions,
      afterPositions,
      [{ folderTitle: sourceFolder.title, expectedPosition: targetPosition }]
    );

    if (!validation.isConsistent) {
      console.log('\n❌ Position Validation Issues:', validation.issues);
    }

    expect(validation.isConsistent).toBeTruthy();
  });

  test('should validate two position forward movement', async ({ page }) => {
    const beforePositions = await positionValidator.getFolderPositions();
    await positionValidator.logPositionDetails('Before Two Position Forward Move', beforePositions);

    // Move first folder to third position (skip 2 positions)
    const sourceIndex = 0;
    const targetPosition = 2;
    const sourceFolder = beforePositions[sourceIndex];

    console.log(`\n🎯 TEST: Moving "${sourceFolder.title}" from position ${sourceIndex} to position ${targetPosition}`);

    // Perform drag operation
    const folders = await page.locator('.folder-container').all();
    await dragDropUtils.dragAndDrop(folders[sourceIndex], folders[targetPosition]);

    // Wait for operation to complete
    await page.waitForTimeout(2000);

    const afterPositions = await positionValidator.getFolderPositions();
    await positionValidator.logPositionDetails('After Two Position Forward Move', afterPositions);

    // Validate the move
    const validation = await positionValidator.validatePositionConsistency(
      beforePositions,
      afterPositions,
      [{ folderTitle: sourceFolder.title, expectedPosition: targetPosition }]
    );

    if (!validation.isConsistent) {
      console.log('\n❌ Position Validation Issues:', validation.issues);
      console.log('\n🔍 Expected vs Actual Analysis:');
      console.log(`   Source: "${sourceFolder.title}" from position ${sourceIndex}`);
      console.log(`   Target: position ${targetPosition}`);
      
      const actualFolder = afterPositions.find(f => f.title === sourceFolder.title);
      if (actualFolder) {
        console.log(`   Actual: position ${actualFolder.position}`);
        console.log(`   Difference: ${actualFolder.position - targetPosition} positions`);
      }
    }

    expect(validation.isConsistent).toBeTruthy();
  });

  test('should validate two position backward movement', async ({ page }) => {
    const beforePositions = await positionValidator.getFolderPositions();
    await positionValidator.logPositionDetails('Before Two Position Backward Move', beforePositions);

    // Move fourth folder to first position (skip 3 positions)
    const sourceIndex = 3;
    const targetPosition = 0;

    // Ensure we have enough folders
    expect(beforePositions.length).toBeGreaterThanOrEqual(4);

    const sourceFolder = beforePositions[sourceIndex];

    console.log(`\n🎯 TEST: Moving "${sourceFolder.title}" from position ${sourceIndex} to position ${targetPosition}`);

    // Perform drag operation
    const folders = await page.locator('.folder-container').all();
    await dragDropUtils.dragAndDrop(folders[sourceIndex], folders[targetPosition]);

    // Wait for operation to complete
    await page.waitForTimeout(2000);

    const afterPositions = await positionValidator.getFolderPositions();
    await positionValidator.logPositionDetails('After Two Position Backward Move', afterPositions);

    // Validate the move
    const validation = await positionValidator.validatePositionConsistency(
      beforePositions,
      afterPositions,
      [{ folderTitle: sourceFolder.title, expectedPosition: targetPosition }]
    );

    if (!validation.isConsistent) {
      console.log('\n❌ Position Validation Issues:', validation.issues);
      console.log('\n🔍 Expected vs Actual Analysis:');
      console.log(`   Source: "${sourceFolder.title}" from position ${sourceIndex}`);
      console.log(`   Target: position ${targetPosition}`);

      const actualFolder = afterPositions.find(f => f.title === sourceFolder.title);
      if (actualFolder) {
        console.log(`   Actual: position ${actualFolder.position}`);
        console.log(`   Difference: ${actualFolder.position - targetPosition} positions`);
      }
    }

    expect(validation.isConsistent).toBeTruthy();
  });

  test('should maintain position consistency after page refresh', async ({ page }) => {
    // Perform a move operation first
    const beforePositions = await positionValidator.getFolderPositions();
    const sourceIndex = 1;
    const targetPosition = 3;
    const sourceFolder = beforePositions[sourceIndex];

    console.log(`\n🎯 TEST: Moving "${sourceFolder.title}" then refreshing page`);

    // Perform drag operation
    const folders = await page.locator('.folder-container').all();
    await dragDropUtils.dragAndDrop(folders[sourceIndex], folders[targetPosition]);
    await page.waitForTimeout(2000);

    // Get positions after move
    const afterMovePositions = await positionValidator.getFolderPositions();
    await positionValidator.logPositionDetails('After Move (Before Refresh)', afterMovePositions);

    // Refresh the page
    await page.reload();
    await ExtensionTestUtils.enableEditMode(page);
    await ExtensionTestUtils.waitForEnhancedDragDropSetup(page);
    await page.waitForSelector('.folder-container', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Get positions after refresh
    const afterRefreshPositions = await positionValidator.getFolderPositions();
    await positionValidator.logPositionDetails('After Page Refresh', afterRefreshPositions);

    // Validate positions are maintained
    expect(afterRefreshPositions.length).toBe(afterMovePositions.length);

    for (let i = 0; i < afterMovePositions.length; i++) {
      const beforeRefresh = afterMovePositions[i];
      const afterRefresh = afterRefreshPositions[i];

      expect(afterRefresh.title).toBe(beforeRefresh.title);
      expect(afterRefresh.position).toBe(beforeRefresh.position);
    }

    console.log('✅ Position consistency maintained after page refresh');
  });

  test('should maintain position consistency in new tab', async ({ page, context }) => {
    // Perform a move operation first
    const beforePositions = await positionValidator.getFolderPositions();
    const sourceIndex = 0;
    const targetPosition = 2;
    const sourceFolder = beforePositions[sourceIndex];

    console.log(`\n🎯 TEST: Moving "${sourceFolder.title}" then opening new tab`);

    // Perform drag operation
    const folders = await page.locator('.folder-container').all();
    await dragDropUtils.dragAndDrop(folders[sourceIndex], folders[targetPosition]);
    await page.waitForTimeout(2000);

    // Get positions after move
    const afterMovePositions = await positionValidator.getFolderPositions();
    await positionValidator.logPositionDetails('After Move (Original Tab)', afterMovePositions);

    // Open new tab and navigate to extension
    const newTab = await context.newPage();
    const newTabConsoleUtils = new ConsoleTestUtils(newTab);
    const newTabPositionValidator = new PositionValidator(newTab);

    await newTabConsoleUtils.startMonitoring();
    await ExtensionTestUtils.navigateToExtension(newTab);
    await ExtensionTestUtils.enableEditMode(newTab);
    await ExtensionTestUtils.waitForEnhancedDragDropSetup(newTab);
    await newTab.waitForSelector('.folder-container', { timeout: 10000 });
    await newTab.waitForTimeout(1000);

    // Get positions in new tab
    const newTabPositions = await newTabPositionValidator.getFolderPositions();
    await newTabPositionValidator.logPositionDetails('New Tab Positions', newTabPositions);

    // Validate positions are consistent
    expect(newTabPositions.length).toBe(afterMovePositions.length);

    for (let i = 0; i < afterMovePositions.length; i++) {
      const originalTab = afterMovePositions[i];
      const newTabFolder = newTabPositions[i];

      expect(newTabFolder.title).toBe(originalTab.title);
      expect(newTabFolder.position).toBe(originalTab.position);
    }

    console.log('✅ Position consistency maintained in new tab');

    await newTabConsoleUtils.stopMonitoring();
    await newTab.close();
  });

  test('should detect and report position inconsistencies with detailed analysis', async ({ page }) => {
    const testResults: PositionTestResult[] = [];

    // Test multiple drag operations to identify patterns
    const testCases = [
      { from: 0, to: 1, description: 'Move 1 position forward' },
      { from: 1, to: 0, description: 'Move 1 position backward' },
      { from: 0, to: 2, description: 'Move 2 positions forward' },
      { from: 2, to: 0, description: 'Move 2 positions backward' },
      { from: 1, to: 3, description: 'Move 2 positions forward from middle' },
      { from: 3, to: 1, description: 'Move 2 positions backward to middle' }
    ];

    for (const testCase of testCases) {
      console.log(`\n🧪 Running test case: ${testCase.description}`);

      // Reset to known state by refreshing
      await page.reload();
      await ExtensionTestUtils.enableEditMode(page);
      await ExtensionTestUtils.waitForEnhancedDragDropSetup(page);
      await page.waitForSelector('.folder-container', { timeout: 10000 });
      await page.waitForTimeout(1000);

      const beforePositions = await positionValidator.getFolderPositions();

      // Skip if not enough folders for this test
      if (testCase.from >= beforePositions.length || testCase.to >= beforePositions.length) {
        console.log(`⏭️ Skipping test case - not enough folders (need ${Math.max(testCase.from, testCase.to) + 1}, have ${beforePositions.length})`);
        continue;
      }

      const sourceFolder = beforePositions[testCase.from];
      const timestamp = Date.now();

      // Perform drag operation
      const folders = await page.locator('.folder-container').all();
      await dragDropUtils.dragAndDrop(folders[testCase.from], folders[testCase.to]);
      await page.waitForTimeout(2000);

      const afterPositions = await positionValidator.getFolderPositions();
      const actualFolder = afterPositions.find(f => f.title === sourceFolder.title);

      const result: PositionTestResult = {
        initialPosition: testCase.from,
        targetPosition: testCase.to,
        actualFinalPosition: actualFolder?.position ?? -1,
        expectedFinalPosition: testCase.to,
        positionDifference: (actualFolder?.position ?? -1) - testCase.to,
        success: actualFolder?.position === testCase.to,
        folderTitle: sourceFolder.title,
        timestamp
      };

      testResults.push(result);

      console.log(`📊 Result: ${result.success ? '✅' : '❌'} Expected: ${result.expectedFinalPosition}, Actual: ${result.actualFinalPosition}, Diff: ${result.positionDifference}`);
    }

    // Analyze results for patterns
    console.log('\n📈 POSITION INCONSISTENCY ANALYSIS:');
    console.log('=====================================');

    const failedTests = testResults.filter(r => !r.success);
    const successfulTests = testResults.filter(r => r.success);

    console.log(`Total tests: ${testResults.length}`);
    console.log(`Successful: ${successfulTests.length} (${(successfulTests.length / testResults.length * 100).toFixed(1)}%)`);
    console.log(`Failed: ${failedTests.length} (${(failedTests.length / testResults.length * 100).toFixed(1)}%)`);

    if (failedTests.length > 0) {
      console.log('\n❌ FAILED TESTS:');
      failedTests.forEach(result => {
        console.log(`  "${result.folderTitle}": ${result.initialPosition} → ${result.targetPosition} (expected) vs ${result.actualFinalPosition} (actual), diff: ${result.positionDifference}`);
      });

      // Pattern analysis
      const forwardMoves = failedTests.filter(r => r.targetPosition > r.initialPosition);
      const backwardMoves = failedTests.filter(r => r.targetPosition < r.initialPosition);

      if (forwardMoves.length > 0) {
        console.log(`\n🔍 Forward move failures: ${forwardMoves.length}`);
        const avgDiff = forwardMoves.reduce((sum, r) => sum + r.positionDifference, 0) / forwardMoves.length;
        console.log(`   Average position difference: ${avgDiff.toFixed(2)}`);
      }

      if (backwardMoves.length > 0) {
        console.log(`\n🔍 Backward move failures: ${backwardMoves.length}`);
        const avgDiff = backwardMoves.reduce((sum, r) => sum + r.positionDifference, 0) / backwardMoves.length;
        console.log(`   Average position difference: ${avgDiff.toFixed(2)}`);
      }
    }

    // Store results for potential debugging
    await page.evaluate((results) => {
      (window as any).positionTestResults = results;
    }, testResults);

    // The test should pass even if there are inconsistencies - we're documenting them
    expect(testResults.length).toBeGreaterThan(0);
  });
});
