import { test, expect } from '@playwright/test';
import { ExtensionHelper } from './extension-helper.js';

test.describe('Drop Zone Functionality Tests', () => {
  let helper;
  let getConsoleErrors;

  test.beforeEach(async ({ page, context }) => {
    helper = new ExtensionHelper(page, context);
    getConsoleErrors = await helper.captureConsoleErrors();
    
    await helper.navigateToExtension();
    await helper.waitForExtensionReady();
    await helper.enableEditMode();
  });

  test('should display correct number of insertion points', async () => {
    const folderOrder = await helper.getFolderOrder();
    const insertionPointCount = await helper.getInsertionPointCount();
    
    const results = {
      folderCount: folderOrder.length,
      insertionPointCount,
      expectedInsertionPoints: folderOrder.length + 1,
      correctCount: insertionPointCount === folderOrder.length + 1,
      consoleErrors: getConsoleErrors()
    };
    
    test.info().attach('insertion-points-results', {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json'
    });
    
    expect(results.correctCount).toBe(true);
    expect(results.consoleErrors.length).toBe(0);
  });

  test('should accept folder drops on insertion points', async () => {
    const folderOrder = await helper.getFolderOrder();
    
    expect(folderOrder.length).toBeGreaterThanOrEqual(2);
    
    const results = {
      dropTests: [],
      allDropsSuccessful: true,
      averageDropTime: 0
    };

    // Test dropping on first few insertion points
    const testPositions = Math.min(3, folderOrder.length);
    
    for (let i = 0; i < testPositions; i++) {
      const insertionPointSelector = `.insertion-point[data-insertion-index="${i + 1}"]`;
      const folderSelector = '.folder-container:first-child';
      
      // Check if insertion point exists
      const insertionPointExists = await helper.page.locator(insertionPointSelector).count() > 0;
      
      if (!insertionPointExists) {
        results.dropTests.push({
          position: i + 1,
          success: false,
          error: 'Insertion point not found',
          executionTime: 0
        });
        results.allDropsSuccessful = false;
        continue;
      }
      
      // Simulate drag and drop
      const dropResult = await helper.simulateDragDrop(folderSelector, insertionPointSelector);
      
      results.dropTests.push({
        position: i + 1,
        success: dropResult.success,
        error: dropResult.error || null,
        executionTime: dropResult.executionTime
      });
      
      if (!dropResult.success) {
        results.allDropsSuccessful = false;
      }
      
      // Reset position for next test
      if (dropResult.success) {
        await helper.moveFolderToPosition(i + 1, 0);
      }
    }
    
    results.averageDropTime = results.dropTests.reduce((sum, test) => sum + test.executionTime, 0) / results.dropTests.length;
    results.consoleErrors = getConsoleErrors();
    
    test.info().attach('drop-zone-results', {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json'
    });
    
    expect(results.allDropsSuccessful).toBe(true);
    expect(results.averageDropTime).toBeLessThan(5000);
    expect(results.consoleErrors.length).toBe(0);
  });

  test('should show visual feedback during drag operations', async () => {
    const results = {
      visualFeedbackTests: [],
      allFeedbackWorking: true
    };

    // Test drag start visual feedback
    const folderSelector = '.folder-container:first-child';
    
    // Start drag operation
    await helper.page.hover(folderSelector);
    await helper.page.mouse.down();
    
    // Check for drag-active class
    const hasDragActiveBody = await helper.page.evaluate(() => {
      return document.body.classList.contains('drag-active');
    });
    
    const hasDragActiveApp = await helper.page.evaluate(() => {
      return document.querySelector('.app')?.classList.contains('drag-active');
    });
    
    // Check insertion point visibility
    const visibleInsertionPoints = await helper.page.evaluate(() => {
      const points = Array.from(document.querySelectorAll('.insertion-point'));
      return points.filter(point => {
        const style = window.getComputedStyle(point);
        return parseFloat(style.height) > 20 && parseFloat(style.opacity) > 0.5;
      }).length;
    });
    
    const totalInsertionPoints = await helper.getInsertionPointCount();
    
    // End drag operation
    await helper.page.mouse.up();
    
    const dragFeedbackTest = {
      name: 'drag_visual_feedback',
      bodyHasDragActive: hasDragActiveBody,
      appHasDragActive: hasDragActiveApp,
      visibleInsertionPoints,
      totalInsertionPoints,
      allInsertionPointsVisible: visibleInsertionPoints === totalInsertionPoints,
      success: hasDragActiveBody && hasDragActiveApp && visibleInsertionPoints > 0
    };
    
    results.visualFeedbackTests.push(dragFeedbackTest);
    
    if (!dragFeedbackTest.success) {
      results.allFeedbackWorking = false;
    }
    
    // Test drag end cleanup
    await helper.page.waitForTimeout(500);
    
    const dragCleanupTest = await helper.page.evaluate(() => {
      const bodyStillHasDragActive = document.body.classList.contains('drag-active');
      const appStillHasDragActive = document.querySelector('.app')?.classList.contains('drag-active');
      
      return {
        name: 'drag_cleanup',
        bodyCleanedUp: !bodyStillHasDragActive,
        appCleanedUp: !appStillHasDragActive,
        success: !bodyStillHasDragActive && !appStillHasDragActive
      };
    });
    
    results.visualFeedbackTests.push(dragCleanupTest);
    
    if (!dragCleanupTest.success) {
      results.allFeedbackWorking = false;
    }
    
    results.consoleErrors = getConsoleErrors();
    
    test.info().attach('visual-feedback-results', {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json'
    });
    
    expect(results.allFeedbackWorking).toBe(true);
    expect(results.consoleErrors.length).toBe(0);
  });

  test('should prevent auto-scrolling during drag operations', async () => {
    const results = {
      scrollPreventionTests: [],
      scrollPreventionWorking: true
    };

    // Record initial scroll position
    const initialScrollPosition = await helper.page.evaluate(() => ({
      x: window.scrollX,
      y: window.scrollY
    }));

    // Start drag operation
    const folderSelector = '.folder-container:first-child';
    await helper.page.hover(folderSelector);
    await helper.page.mouse.down();
    
    // Wait for drag state to be applied
    await helper.page.waitForTimeout(500);
    
    // Check scroll position hasn't changed
    const scrollAfterDragStart = await helper.page.evaluate(() => ({
      x: window.scrollX,
      y: window.scrollY
    }));
    
    const scrollPreventionTest = {
      name: 'scroll_prevention_during_drag',
      initialPosition: initialScrollPosition,
      positionAfterDragStart: scrollAfterDragStart,
      scrollChanged: initialScrollPosition.x !== scrollAfterDragStart.x || initialScrollPosition.y !== scrollAfterDragStart.y,
      success: initialScrollPosition.x === scrollAfterDragStart.x && initialScrollPosition.y === scrollAfterDragStart.y
    };
    
    results.scrollPreventionTests.push(scrollPreventionTest);
    
    if (!scrollPreventionTest.success) {
      results.scrollPreventionWorking = false;
    }
    
    // End drag operation
    await helper.page.mouse.up();
    
    results.consoleErrors = getConsoleErrors();
    
    test.info().attach('scroll-prevention-results', {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json'
    });
    
    expect(results.scrollPreventionWorking).toBe(true);
    expect(results.consoleErrors.length).toBe(0);
  });
});
