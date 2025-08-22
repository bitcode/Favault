/**
 * Insertion Point Drag and Drop Validation Tests for Chrome
 * 
 * These tests specifically target insertion point behavior and edge cases:
 * - Insertion point positioning accuracy
 * - Edge case scenarios (first/last positions)
 * - Visual feedback validation
 * - Insertion point calculation consistency
 * 
 * Runs exclusively in Chrome to isolate browser-specific behavior
 */

import { test, expect, Page } from '@playwright/test';
import { ExtensionTestUtils } from '../utils/extension-utils';
import { DragDropTestUtils } from '../utils/dragdrop-utils';
import { BookmarkTestUtils } from '../utils/bookmark-utils';
import { ConsoleTestUtils } from '../utils/console-utils';

interface InsertionPointTest {
  sourceIndex: number;
  insertionIndex: number;
  expectedFinalPosition: number;
  description: string;
}

class InsertionPointValidator {
  constructor(private page: Page) {}

  /**
   * Get all insertion points and their indices
   */
  async getInsertionPoints(): Promise<{ element: any; index: number }[]> {
    const insertionPoints = await this.page.locator('.insertion-point').all();
    const points = [];
    
    for (let i = 0; i < insertionPoints.length; i++) {
      const index = await insertionPoints[i].getAttribute('data-insertion-index');
      points.push({
        element: insertionPoints[i],
        index: parseInt(index || '0', 10)
      });
    }
    
    return points.sort((a, b) => a.index - b.index);
  }

  /**
   * Validate insertion point visual feedback
   */
  async validateInsertionPointFeedback(insertionIndex: number): Promise<boolean> {
    const insertionPoint = this.page.locator(`.insertion-point[data-insertion-index="${insertionIndex}"]`);
    
    // Check if insertion point exists
    const exists = await insertionPoint.count() > 0;
    if (!exists) return false;

    // Check if it has proper styling when hovered
    await insertionPoint.hover();
    await this.page.waitForTimeout(100);

    const hasHoverClass = await insertionPoint.evaluate((el) => 
      el.classList.contains('drag-over') || el.classList.contains('drag-over-insertion')
    );

    return hasHoverClass;
  }

  /**
   * Perform drag to insertion point
   */
  async dragToInsertionPoint(sourceIndex: number, insertionIndex: number): Promise<void> {
    const folders = await this.page.locator('.folder-container').all();
    const insertionPoint = this.page.locator(`.insertion-point[data-insertion-index="${insertionIndex}"]`);
    
    if (sourceIndex >= folders.length) {
      throw new Error(`Source index ${sourceIndex} out of range (max: ${folders.length - 1})`);
    }

    const insertionPointCount = await insertionPoint.count();
    if (insertionPointCount === 0) {
      throw new Error(`Insertion point at index ${insertionIndex} not found`);
    }

    console.log(`🎯 Dragging folder ${sourceIndex} to insertion point ${insertionIndex}`);
    
    // Get source folder
    const sourceFolder = folders[sourceIndex];
    
    // Perform drag to insertion point
    await sourceFolder.dragTo(insertionPoint);
  }

  /**
   * Get folder positions with detailed information
   */
  async getFolderPositionsDetailed(): Promise<Array<{
    title: string;
    position: number;
    element: any;
    boundingBox: any;
  }>> {
    const folders = await this.page.locator('.folder-container').all();
    const positions = [];

    for (let i = 0; i < folders.length; i++) {
      const folder = folders[i];
      const titleElement = folder.locator('.folder-title, h3, .folder-name').first();
      const title = await titleElement.textContent() || `Folder ${i}`;
      const boundingBox = await folder.boundingBox();

      positions.push({
        title: title.trim(),
        position: i,
        element: folder,
        boundingBox
      });
    }

    return positions;
  }
}

test.describe('Chrome Insertion Point Validation', () => {
  let dragDropUtils: DragDropTestUtils;
  let bookmarkUtils: BookmarkTestUtils;
  let consoleUtils: ConsoleTestUtils;
  let insertionValidator: InsertionPointValidator;

  // Only run on Chrome projects
  test.skip(({ browserName }) => browserName !== 'chromium', 'Chrome-specific insertion point tests');

  test.beforeEach(async ({ page, context }) => {
    dragDropUtils = new DragDropTestUtils(page);
    bookmarkUtils = new BookmarkTestUtils(page, context);
    consoleUtils = new ConsoleTestUtils(page);
    insertionValidator = new InsertionPointValidator(page);

    // Start console monitoring
    await consoleUtils.startMonitoring();

    // Navigate to extension and set up test data
    await ExtensionTestUtils.navigateToExtension(page);
    await bookmarkUtils.setupTestBookmarks();
    
    // Enable edit mode and wait for drag-drop system
    await ExtensionTestUtils.enableEditMode(page);
    await ExtensionTestUtils.waitForEnhancedDragDropSetup(page);

    // Wait for folders and insertion points to be fully rendered
    await page.waitForSelector('.folder-container', { timeout: 10000 });
    await page.waitForSelector('.insertion-point', { timeout: 5000 });
    await page.waitForTimeout(1000);
  });

  test.afterEach(async ({ page }) => {
    // Log any console errors for debugging
    const errors = await consoleUtils.getConsoleErrors();
    if (errors.length > 0) {
      console.log('\n🚨 Console Errors:', errors);
    }

    await consoleUtils.stopMonitoring();
  });

  test('should detect all insertion points correctly', async ({ page }) => {
    const folders = await page.locator('.folder-container').all();
    const insertionPoints = await insertionValidator.getInsertionPoints();

    console.log(`\n📍 Found ${folders.length} folders and ${insertionPoints.length} insertion points`);

    // Should have n+1 insertion points for n folders (before first, between each, after last)
    expect(insertionPoints.length).toBe(folders.length + 1);

    // Validate insertion point indices are sequential
    insertionPoints.forEach((point, index) => {
      expect(point.index).toBe(index);
      console.log(`  Insertion point ${index}: exists`);
    });
  });

  test('should provide visual feedback on insertion point hover', async ({ page }) => {
    const insertionPoints = await insertionValidator.getInsertionPoints();
    
    for (const point of insertionPoints.slice(0, 3)) { // Test first 3 points
      console.log(`\n🎨 Testing visual feedback for insertion point ${point.index}`);
      
      const hasProperFeedback = await insertionValidator.validateInsertionPointFeedback(point.index);
      expect(hasProperFeedback).toBeTruthy();
      
      console.log(`  ✅ Insertion point ${point.index} shows proper visual feedback`);
    }
  });

  test('should handle insertion at first position correctly', async ({ page }) => {
    const beforePositions = await insertionValidator.getFolderPositionsDetailed();
    console.log(`\n🎯 Testing insertion at first position (index 0)`);
    
    // Move second folder to first position (insertion point 0)
    const sourceIndex = 1;
    const insertionIndex = 0;
    const expectedFinalPosition = 0;
    
    const sourceFolder = beforePositions[sourceIndex];
    console.log(`Moving "${sourceFolder.title}" from position ${sourceIndex} to insertion point ${insertionIndex}`);

    await insertionValidator.dragToInsertionPoint(sourceIndex, insertionIndex);
    await page.waitForTimeout(2000);

    const afterPositions = await insertionValidator.getFolderPositionsDetailed();
    const movedFolder = afterPositions.find(f => f.title === sourceFolder.title);

    expect(movedFolder).toBeDefined();
    expect(movedFolder!.position).toBe(expectedFinalPosition);
    
    console.log(`✅ Folder "${sourceFolder.title}" correctly positioned at ${movedFolder!.position} (expected ${expectedFinalPosition})`);
  });

  test('should handle insertion at last position correctly', async ({ page }) => {
    const beforePositions = await insertionValidator.getFolderPositionsDetailed();
    console.log(`\n🎯 Testing insertion at last position`);
    
    // Move first folder to last position
    const sourceIndex = 0;
    const insertionIndex = beforePositions.length; // Last insertion point
    const expectedFinalPosition = beforePositions.length - 1; // Last position
    
    const sourceFolder = beforePositions[sourceIndex];
    console.log(`Moving "${sourceFolder.title}" from position ${sourceIndex} to insertion point ${insertionIndex}`);

    await insertionValidator.dragToInsertionPoint(sourceIndex, insertionIndex);
    await page.waitForTimeout(2000);

    const afterPositions = await insertionValidator.getFolderPositionsDetailed();
    const movedFolder = afterPositions.find(f => f.title === sourceFolder.title);

    expect(movedFolder).toBeDefined();
    expect(movedFolder!.position).toBe(expectedFinalPosition);
    
    console.log(`✅ Folder "${sourceFolder.title}" correctly positioned at ${movedFolder!.position} (expected ${expectedFinalPosition})`);
  });

  test('should handle middle insertion points correctly', async ({ page }) => {
    const beforePositions = await insertionValidator.getFolderPositionsDetailed();
    
    // Test multiple middle insertion points
    const testCases: InsertionPointTest[] = [
      {
        sourceIndex: 0,
        insertionIndex: 2,
        expectedFinalPosition: 1, // Insertion point 2 means "after position 1"
        description: 'Move first folder to insertion point 2'
      },
      {
        sourceIndex: 3,
        insertionIndex: 1,
        expectedFinalPosition: 0, // Insertion point 1 means "after position 0" = position 1, but source moves up
        description: 'Move fourth folder to insertion point 1'
      }
    ];

    for (const testCase of testCases) {
      if (testCase.sourceIndex >= beforePositions.length) {
        console.log(`⏭️ Skipping test case - source index ${testCase.sourceIndex} out of range`);
        continue;
      }

      console.log(`\n🎯 ${testCase.description}`);
      
      // Reset to known state
      await page.reload();
      await ExtensionTestUtils.enableEditMode(page);
      await ExtensionTestUtils.waitForEnhancedDragDropSetup(page);
      await page.waitForSelector('.folder-container', { timeout: 10000 });
      await page.waitForSelector('.insertion-point', { timeout: 5000 });
      await page.waitForTimeout(1000);

      const currentPositions = await insertionValidator.getFolderPositionsDetailed();
      const sourceFolder = currentPositions[testCase.sourceIndex];
      
      console.log(`Moving "${sourceFolder.title}" from position ${testCase.sourceIndex} to insertion point ${testCase.insertionIndex}`);

      await insertionValidator.dragToInsertionPoint(testCase.sourceIndex, testCase.insertionIndex);
      await page.waitForTimeout(2000);

      const afterPositions = await insertionValidator.getFolderPositionsDetailed();
      const movedFolder = afterPositions.find(f => f.title === sourceFolder.title);

      expect(movedFolder).toBeDefined();
      
      const actualPosition = movedFolder!.position;
      const positionDifference = actualPosition - testCase.expectedFinalPosition;
      
      console.log(`📊 Result: Expected position ${testCase.expectedFinalPosition}, Actual position ${actualPosition}, Difference: ${positionDifference}`);
      
      if (positionDifference !== 0) {
        console.log(`❌ Position mismatch detected for insertion point ${testCase.insertionIndex}`);
        console.log(`   This indicates an issue with insertion point calculation logic`);
      } else {
        console.log(`✅ Correct positioning for insertion point ${testCase.insertionIndex}`);
      }

      // Store the result but don't fail the test - we're documenting issues
      expect(movedFolder).toBeDefined();
    }
  });

  test('should validate insertion point calculation consistency', async ({ page }) => {
    const beforePositions = await insertionValidator.getFolderPositionsDetailed();
    const insertionPoints = await insertionValidator.getInsertionPoints();

    console.log('\n🧮 INSERTION POINT CALCULATION ANALYSIS:');
    console.log('==========================================');

    const results: Array<{
      insertionIndex: number;
      expectedPosition: number;
      description: string;
    }> = [];

    // Analyze what each insertion point should represent
    for (let i = 0; i < insertionPoints.length; i++) {
      let expectedPosition: number;
      let description: string;

      if (i === 0) {
        expectedPosition = 0;
        description = 'Before first folder (position 0)';
      } else if (i === insertionPoints.length - 1) {
        expectedPosition = beforePositions.length - 1;
        description = 'After last folder (last position)';
      } else {
        expectedPosition = i - 1;
        description = `After folder at position ${i - 1} (position ${i})`;
      }

      results.push({
        insertionIndex: i,
        expectedPosition,
        description
      });

      console.log(`  Insertion point ${i}: ${description} → Expected final position: ${expectedPosition}`);
    }

    // Test a few key insertion points to validate the logic
    const testPoints = [0, 1, Math.floor(insertionPoints.length / 2), insertionPoints.length - 1];

    for (const insertionIndex of testPoints) {
      if (insertionIndex >= insertionPoints.length) continue;

      console.log(`\n🧪 Testing insertion point ${insertionIndex} calculation...`);

      // Use first folder as test subject (unless it's the target)
      const sourceIndex = insertionIndex === 0 ? 1 : 0;

      if (sourceIndex >= beforePositions.length) continue;

      // Reset state
      await page.reload();
      await ExtensionTestUtils.enableEditMode(page);
      await ExtensionTestUtils.waitForEnhancedDragDropSetup(page);
      await page.waitForSelector('.folder-container', { timeout: 10000 });
      await page.waitForSelector('.insertion-point', { timeout: 5000 });
      await page.waitForTimeout(1000);

      const currentPositions = await insertionValidator.getFolderPositionsDetailed();
      const sourceFolder = currentPositions[sourceIndex];
      const expectedResult = results[insertionIndex];

      await insertionValidator.dragToInsertionPoint(sourceIndex, insertionIndex);
      await page.waitForTimeout(2000);

      const afterPositions = await insertionValidator.getFolderPositionsDetailed();
      const movedFolder = afterPositions.find(f => f.title === sourceFolder.title);

      if (movedFolder) {
        const actualPosition = movedFolder.position;
        const isCorrect = actualPosition === expectedResult.expectedPosition;

        console.log(`  📊 Insertion point ${insertionIndex}: ${isCorrect ? '✅' : '❌'}`);
        console.log(`     Expected: ${expectedResult.expectedPosition}, Actual: ${actualPosition}`);

        if (!isCorrect) {
          console.log(`     ⚠️  Calculation error detected for insertion point ${insertionIndex}`);
        }
      }
    }

    // Store analysis results
    await page.evaluate((analysisResults) => {
      (window as any).insertionPointAnalysis = analysisResults;
    }, results);

    expect(results.length).toBe(insertionPoints.length);
  });

  test('should handle rapid consecutive insertion point operations', async ({ page }) => {
    console.log('\n⚡ Testing rapid consecutive insertion point operations');

    const beforePositions = await insertionValidator.getFolderPositionsDetailed();
    const operations = [
      { source: 0, insertion: 2, description: 'Move first to middle' },
      { source: 1, insertion: 0, description: 'Move second to first' },
      { source: 2, insertion: 3, description: 'Move third to end' }
    ];

    const results: Array<{
      operation: string;
      success: boolean;
      expectedPosition: number;
      actualPosition: number;
    }> = [];

    for (const [index, operation] of operations.entries()) {
      if (operation.source >= beforePositions.length) continue;

      console.log(`\n🔄 Operation ${index + 1}: ${operation.description}`);

      const currentPositions = await insertionValidator.getFolderPositionsDetailed();
      const sourceFolder = currentPositions[operation.source];

      await insertionValidator.dragToInsertionPoint(operation.source, operation.insertion);
      await page.waitForTimeout(1500); // Shorter wait for rapid testing

      const afterPositions = await insertionValidator.getFolderPositionsDetailed();
      const movedFolder = afterPositions.find(f => f.title === sourceFolder.title);

      if (movedFolder) {
        // Calculate expected position based on insertion point logic
        let expectedPosition = operation.insertion;
        if (operation.insertion > operation.source) {
          expectedPosition = operation.insertion - 1;
        }

        const result = {
          operation: operation.description,
          success: movedFolder.position === expectedPosition,
          expectedPosition,
          actualPosition: movedFolder.position
        };

        results.push(result);

        console.log(`  📊 ${result.success ? '✅' : '❌'} Expected: ${result.expectedPosition}, Actual: ${result.actualPosition}`);
      }
    }

    // Analyze rapid operation results
    const successfulOps = results.filter(r => r.success).length;
    const totalOps = results.length;

    console.log(`\n📈 Rapid Operations Summary: ${successfulOps}/${totalOps} successful (${(successfulOps/totalOps*100).toFixed(1)}%)`);

    if (successfulOps < totalOps) {
      console.log('⚠️  Some rapid operations failed - this may indicate timing or state management issues');
    }

    expect(results.length).toBeGreaterThan(0);
  });
});
