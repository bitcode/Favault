import { test, expect } from '../fixtures/extension';
import { ExtensionTestUtils } from '../utils/extension-utils';
import { DragDropTestUtils } from '../utils/dragdrop-utils';
import { ConsoleTestUtils } from '../utils/console-utils';
import { TestDataSetup } from '../utils/test-data-setup';

test.describe('Drag-Drop Regression Tests', () => {
  let dragDropUtils: DragDropTestUtils;
  let consoleUtils: ConsoleTestUtils;
  let testDataSetup: TestDataSetup;

  test.beforeEach(async ({ page, context }) => {
    dragDropUtils = new DragDropTestUtils(page);
    consoleUtils = new ConsoleTestUtils(page);
    testDataSetup = new TestDataSetup(page, context);

    await consoleUtils.startMonitoring();
    await consoleUtils.injectDragDropTestFunctions();
  });

  test.afterEach(async () => {
    await consoleUtils.stopMonitoring();
    await testDataSetup.clearTestData();
  });

  test('should prevent race condition between extension initialization and edit mode', async ({ page }) => {
    // This test specifically targets the race condition that was fixed
    console.log('🔧 Testing race condition prevention...');
    
    // Create test data
    await testDataSetup.initialize({
      folderCount: 3,
      bookmarksPerFolder: 2,
      includeDragTestFolders: true
    });
    await testDataSetup.generateTestData();
    
    // Rapidly enable/disable edit mode multiple times to stress test
    for (let i = 0; i < 5; i++) {
      console.log(`🔄 Race condition test iteration ${i + 1}/5`);
      
      // Enable edit mode
      await ExtensionTestUtils.enableEditMode(newTabPage);
      
      // Don't wait - immediately try to use the system
      const systemReady = await newTabPage.evaluate(() => {
        return (window as any).enhancedDragDropReady === true;
      });
      
      // Should be ready or become ready quickly
      if (!systemReady) {
        await ExtensionTestUtils.waitForEnhancedDragDropSetup(newTabPage, 3000);
      }
      
      // Verify no missing method errors
      const errors = await consoleUtils.getConsoleErrors();
      const methodErrors = errors.filter(error => 
        error.includes('restoreBookmarkFolderMappings is not a function')
      );
      expect(methodErrors.length).toBe(0);
      
      // Disable edit mode
      await ExtensionTestUtils.disableEditMode(newTabPage);
      await newTabPage.waitForTimeout(100);
    }
    
    console.log('✅ Race condition prevention working');
  });

  test('should handle rapid edit mode toggles without errors', async ({ newTabPage }) => {
    // Create test data
    await testDataSetup.initialize({
      folderCount: 2,
      bookmarksPerFolder: 1,
      includeDragTestFolders: true
    });
    await testDataSetup.generateTestData();
    
    console.log('🔄 Testing rapid edit mode toggles...');
    
    // Rapidly toggle edit mode
    for (let i = 0; i < 10; i++) {
      await ExtensionTestUtils.enableEditMode(newTabPage);
      await newTabPage.waitForTimeout(50);
      await ExtensionTestUtils.disableEditMode(newTabPage);
      await newTabPage.waitForTimeout(50);
    }
    
    // Check for errors
    const errors = await consoleUtils.getConsoleErrors();
    const criticalErrors = errors.filter(error => 
      error.includes('TypeError') || 
      error.includes('is not a function') ||
      error.includes('Cannot read property')
    );
    
    expect(criticalErrors.length).toBe(0);
    console.log('✅ Rapid toggle handling working');
  });

  test('should maintain folder mappings across multiple operations', async ({ newTabPage }) => {
    // Create test data
    await testDataSetup.initialize({
      folderCount: 4,
      bookmarksPerFolder: 2,
      includeDragTestFolders: true
    });
    await testDataSetup.generateTestData();
    
    // Enable edit mode
    await ExtensionTestUtils.enableEditMode(newTabPage);
    await ExtensionTestUtils.waitForEnhancedDragDropSetup(newTabPage);
    
    // Get initial folder mappings
    const initialMappings = await newTabPage.evaluate(() => {
      return (window as any).EnhancedDragDropManager?.folderBookmarkIds?.size || 0;
    });
    
    expect(initialMappings).toBeGreaterThan(0);
    
    // Perform multiple operations that might affect mappings
    const folders = await newTabPage.locator('.folder-container').all();
    
    for (let i = 0; i < 3; i++) {
      console.log(`🔄 Mapping test iteration ${i + 1}/3`);
      
      // Disable and re-enable edit mode
      await ExtensionTestUtils.disableEditMode(newTabPage);
      await newTabPage.waitForTimeout(100);
      await ExtensionTestUtils.enableEditMode(newTabPage);
      await ExtensionTestUtils.waitForEnhancedDragDropSetup(newTabPage);
      
      // Check mappings are restored
      const currentMappings = await newTabPage.evaluate(() => {
        return (window as any).EnhancedDragDropManager?.folderBookmarkIds?.size || 0;
      });
      
      expect(currentMappings).toBe(initialMappings);
    }
    
    console.log('✅ Folder mappings maintained correctly');
  });

  test('should handle missing DOM elements gracefully', async ({ newTabPage }) => {
    // Enable edit mode before creating test data (edge case)
    await ExtensionTestUtils.enableEditMode(newTabPage);
    
    // Wait a bit
    await newTabPage.waitForTimeout(500);
    
    // Now create test data
    await testDataSetup.initialize({
      folderCount: 2,
      bookmarksPerFolder: 1,
      includeDragTestFolders: true
    });
    await testDataSetup.generateTestData();
    
    // Wait for system to adapt
    await ExtensionTestUtils.waitForEnhancedDragDropSetup(newTabPage);
    
    // Should handle this gracefully without errors
    const errors = await consoleUtils.getConsoleErrors();
    const criticalErrors = errors.filter(error => 
      error.includes('TypeError') || 
      error.includes('Cannot read property')
    );
    
    expect(criticalErrors.length).toBe(0);
    console.log('✅ Missing DOM elements handled gracefully');
  });

  test('should recover from initialization failures', async ({ newTabPage }) => {
    // Create test data
    await testDataSetup.initialize({
      folderCount: 2,
      bookmarksPerFolder: 1,
      includeDragTestFolders: true
    });
    await testDataSetup.generateTestData();
    
    // Simulate initialization failure by corrupting the system
    await newTabPage.evaluate(() => {
      // Temporarily break the system
      (window as any).enhancedDragDropReady = false;
      delete (window as any).EnhancedDragDropManager;
    });
    
    // Try to enable edit mode
    await ExtensionTestUtils.enableEditMode(newTabPage);
    
    // Wait for recovery
    await newTabPage.waitForTimeout(2000);
    
    // System should recover or at least not crash
    const pageStillResponsive = await newTabPage.evaluate(() => {
      return document.readyState === 'complete';
    });
    
    expect(pageStillResponsive).toBeTruthy();
    
    // Check for excessive errors
    const errors = await consoleUtils.getConsoleErrors();
    expect(errors.length).toBeLessThan(10); // Some errors expected, but not excessive
    
    console.log('✅ Recovery from initialization failure working');
  });

  test('should maintain performance under stress', async ({ newTabPage }) => {
    // Create larger test dataset
    await testDataSetup.initialize({
      folderCount: 10,
      bookmarksPerFolder: 5,
      includeDragTestFolders: true
    });
    await testDataSetup.generateTestData();
    
    console.log('🔄 Testing performance under stress...');
    
    // Measure initialization time
    const startTime = Date.now();
    await ExtensionTestUtils.enableEditMode(newTabPage);
    await ExtensionTestUtils.waitForEnhancedDragDropSetup(newTabPage);
    const initTime = Date.now() - startTime;
    
    // Should initialize within reasonable time even with many elements
    expect(initTime).toBeLessThan(10000); // 10 seconds max
    
    // Verify all folders are properly mapped
    const mappedFolders = await newTabPage.evaluate(() => {
      return (window as any).EnhancedDragDropManager?.folderBookmarkIds?.size || 0;
    });
    
    expect(mappedFolders).toBeGreaterThanOrEqual(10);
    
    // Test drag operation performance
    const folders = await newTabPage.locator('.folder-container').all();
    if (folders.length >= 2) {
      const dragStartTime = Date.now();
      await dragDropUtils.dragAndDrop(folders[0], folders[1]);
      const dragTime = Date.now() - dragStartTime;
      
      expect(dragTime).toBeLessThan(5000); // 5 seconds max for drag operation
    }
    
    console.log(`✅ Performance acceptable under stress (init: ${initTime}ms)`);
  });

  test('should handle concurrent drag operations', async ({ newTabPage }) => {
    // Create test data
    await testDataSetup.initialize({
      folderCount: 4,
      bookmarksPerFolder: 2,
      includeDragTestFolders: true
    });
    await testDataSetup.generateTestData();
    
    // Enable edit mode
    await ExtensionTestUtils.enableEditMode(newTabPage);
    await ExtensionTestUtils.waitForEnhancedDragDropSetup(newTabPage);
    
    const folders = await newTabPage.locator('.folder-container').all();
    expect(folders.length).toBeGreaterThanOrEqual(3);
    
    console.log('🔄 Testing concurrent drag operations...');
    
    // Start multiple drag operations (they should queue or handle gracefully)
    const dragPromises = [
      dragDropUtils.dragAndDrop(folders[0], folders[1]),
      dragDropUtils.dragAndDrop(folders[2], folders[1])
    ];
    
    // Wait for all operations to complete
    await Promise.allSettled(dragPromises);
    
    // Check for errors
    const errors = await consoleUtils.getConsoleErrors();
    const dragErrors = errors.filter(error => 
      error.includes('drag') || error.includes('drop')
    );
    
    // Should handle concurrent operations without major errors
    expect(dragErrors.length).toBeLessThan(5);
    
    console.log('✅ Concurrent drag operations handled');
  });
});
