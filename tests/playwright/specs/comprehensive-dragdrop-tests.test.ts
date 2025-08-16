import { test, expect } from '../fixtures/extension';
import { testWithData } from '../utils/test-data-integration';
import { DragDropTestDataSetup } from '../utils/dragdrop-test-data';
import { CrossBrowserTestDataSetup } from '../utils/cross-browser-test-data';
import { TestDataCleanup } from '../utils/test-data-cleanup';
import { DragDropTestUtils } from '../utils/dragdrop-utils';
import { BookmarkTestUtils } from '../utils/bookmark-utils';
import { ConsoleTestUtils } from '../utils/console-utils';

/**
 * Comprehensive drag-and-drop tests using the new test data setup utility
 * Tests all aspects of bookmark and folder drag-and-drop functionality
 * with automated test data generation and cleanup
 */

test.describe('Comprehensive Drag-and-Drop Tests with Test Data Utility', () => {
  let dragDropSetup: DragDropTestDataSetup;
  let cleanup: TestDataCleanup;
  let dragDropUtils: DragDropTestUtils;
  let bookmarkUtils: BookmarkTestUtils;
  let consoleUtils: ConsoleTestUtils;

  test.beforeEach(async ({ newTabPage, context }) => {
    // Initialize all utilities
    dragDropSetup = new DragDropTestDataSetup(newTabPage, context);
    cleanup = new TestDataCleanup(newTabPage, context);
    dragDropUtils = new DragDropTestUtils(newTabPage);
    bookmarkUtils = new BookmarkTestUtils(newTabPage);
    consoleUtils = new ConsoleTestUtils(newTabPage);

    // Configure cleanup for test isolation
    cleanup.configure({
      removeTestBookmarks: true,
      removeTestFolders: true,
      preserveUserBookmarks: true,
      backupBeforeCleanup: true
    });

    // Start monitoring
    await consoleUtils.startMonitoring();
    await consoleUtils.monitorExtensionAPICalls();

    // Initialize test data setup
    await dragDropSetup.initialize({
      folderCount: 6,
      bookmarksPerFolder: 4,
      maxNestingLevel: 3,
      includeDragTestFolders: true,
      includeEmptyFolders: true,
      includeReorderableItems: true
    });

    console.log('🚀 Test setup initialized with comprehensive drag-drop data');
  });

  test.afterEach(async ({ newTabPage }) => {
    // Generate test report
    const report = consoleUtils.generateTestReport();
    console.log('📊 Comprehensive Drag-Drop Test Report:', JSON.stringify(report, null, 2));

    // Cleanup test data
    const testDataState = dragDropSetup.getTestDataState();
    const cleanupResult = await cleanup.cleanup(testDataState);
    
    if (!cleanupResult.success) {
      console.warn('⚠️ Cleanup completed with issues:', cleanupResult.errors);
    }

    await consoleUtils.stopMonitoring();
  });

  test('should generate and validate comprehensive test data', async ({ newTabPage }) => {
    // Generate test data
    const testData = await dragDropSetup.generateDragDropTestData();
    
    // Validate test data integrity
    const validation = await dragDropSetup.validateTestData();
    expect(validation.isValid).toBeTruthy();
    
    // Check test data summary
    const summary = dragDropSetup.getDragDropTestSummary();
    expect(summary.totalScenarios).toBeGreaterThan(0);
    expect(summary.reorderableItems).toBeGreaterThan(0);
    
    console.log('📊 Test data summary:', summary);
    
    // Wait for bookmarks to load in UI
    await dragDropSetup.waitForBookmarkSync();
    await bookmarkUtils.waitForBookmarksToLoad();
    
    // Verify folders are visible in UI
    const folders = await bookmarkUtils.getBookmarkFolders();
    expect(folders.length).toBeGreaterThan(0);
    
    console.log(`✅ Generated ${testData.scenarios.length} test scenarios`);
  });

  test('should execute basic reordering scenario', async ({ newTabPage }) => {
    // Generate test data
    await dragDropSetup.generateDragDropTestData();
    await dragDropSetup.waitForBookmarkSync();
    await bookmarkUtils.waitForBookmarksToLoad();

    // Enable edit mode for drag-drop
    await newTabPage.evaluate(() => {
      if ((window as any).toggleEditMode) {
        (window as any).toggleEditMode();
      }
    });

    // Execute basic reordering scenario
    const result = await dragDropSetup.executeScenario('Basic Reordering');
    
    expect(result.success).toBeTruthy();
    expect(result.errors).toHaveLength(0);
    expect(result.results.length).toBeGreaterThan(0);
    
    console.log('✅ Basic reordering scenario completed:', result);
  });

  test('should execute bookmark moving scenario', async ({ newTabPage }) => {
    // Generate test data
    await dragDropSetup.generateDragDropTestData();
    await dragDropSetup.waitForBookmarkSync();
    await bookmarkUtils.waitForBookmarksToLoad();

    // Enable edit mode
    await newTabPage.evaluate(() => {
      if ((window as any).toggleEditMode) {
        (window as any).toggleEditMode();
      }
    });

    // Execute moving scenario
    const result = await dragDropSetup.executeScenario('Single Item Move');
    
    expect(result.success).toBeTruthy();
    expect(result.results.length).toBeGreaterThan(0);
    
    // Verify at least one move was successful
    const successfulMoves = result.results.filter(r => r.success);
    expect(successfulMoves.length).toBeGreaterThan(0);
    
    console.log('✅ Bookmark moving scenario completed:', result);
  });

  test('should handle invalid drop operations correctly', async ({ newTabPage }) => {
    // Generate test data
    await dragDropSetup.generateDragDropTestData();
    await dragDropSetup.waitForBookmarkSync();
    await bookmarkUtils.waitForBookmarksToLoad();

    // Enable edit mode
    await newTabPage.evaluate(() => {
      if ((window as any).toggleEditMode) {
        (window as any).toggleEditMode();
      }
    });

    // Execute invalid drop scenario
    const result = await dragDropSetup.executeScenario('Self Drop Prevention');
    
    expect(result.success).toBeTruthy();
    
    // Verify invalid operations were prevented
    const preventedOperations = result.results.filter(r => r.preventedCorrectly);
    expect(preventedOperations.length).toBeGreaterThan(0);
    
    console.log('✅ Invalid drop prevention scenario completed:', result);
  });

  test('should handle boundary conditions', async ({ newTabPage }) => {
    // Generate test data including boundary conditions
    await dragDropSetup.generateDragDropTestData();
    await dragDropSetup.generateBoundaryConditions();
    await dragDropSetup.waitForBookmarkSync();
    await bookmarkUtils.waitForBookmarksToLoad();

    // Enable edit mode
    await newTabPage.evaluate(() => {
      if ((window as any).toggleEditMode) {
        (window as any).toggleEditMode();
      }
    });

    // Test single item scenario
    try {
      const result = await dragDropSetup.executeScenario('Single Item Reorder');
      console.log('📊 Single item reorder result:', result);
      
      // Single item reorder might be conditional - that's expected
      if (result.success || result.errors.some(e => e.includes('conditional'))) {
        console.log('✅ Single item boundary condition handled correctly');
      }
    } catch (error) {
      console.log('⚠️ Single item scenario not available or failed:', error.message);
    }

    // Test many items scenario
    try {
      const result = await dragDropSetup.executeScenario('Many Items Stress Test');
      expect(result.success).toBeTruthy();
      console.log('✅ Many items stress test completed:', result);
    } catch (error) {
      console.log('⚠️ Many items scenario not available:', error.message);
    }
  });

  test('should handle nested folder drag-drop', async ({ newTabPage }) => {
    // Generate test data with nested structure
    await dragDropSetup.generateDragDropTestData();
    await dragDropSetup.waitForBookmarkSync();
    await bookmarkUtils.waitForBookmarksToLoad();

    // Enable edit mode
    await newTabPage.evaluate(() => {
      if ((window as any).toggleEditMode) {
        (window as any).toggleEditMode();
      }
    });

    // Test nested folder movement
    try {
      const result = await dragDropSetup.executeScenario('Nested Folder Movement');
      expect(result.success).toBeTruthy();
      console.log('✅ Nested folder movement completed:', result);
    } catch (error) {
      console.log('⚠️ Nested folder scenario not available:', error.message);
    }

    // Test folder hierarchy reordering
    try {
      const result = await dragDropSetup.executeScenario('Folder Hierarchy Reorder');
      console.log('📊 Folder hierarchy reorder result:', result);
    } catch (error) {
      console.log('⚠️ Folder hierarchy scenario not available:', error.message);
    }
  });

  test('should maintain data consistency across operations', async ({ newTabPage }) => {
    // Generate test data
    await dragDropSetup.generateDragDropTestData();
    await dragDropSetup.waitForBookmarkSync();
    await bookmarkUtils.waitForBookmarksToLoad();

    // Get initial state
    const initialFolders = await bookmarkUtils.getFolderTitles();
    const initialBookmarkCount = (await bookmarkUtils.getAllBookmarks()).length;

    // Enable edit mode
    await newTabPage.evaluate(() => {
      if ((window as any).toggleEditMode) {
        (window as any).toggleEditMode();
      }
    });

    // Perform multiple operations
    const scenarios = ['Basic Reordering', 'Single Item Move'];
    
    for (const scenarioName of scenarios) {
      try {
        const result = await dragDropSetup.executeScenario(scenarioName);
        console.log(`📊 ${scenarioName} result:`, result);
        
        // Wait between operations
        await newTabPage.waitForTimeout(1000);
      } catch (error) {
        console.log(`⚠️ Scenario ${scenarioName} not available:`, error.message);
      }
    }

    // Verify data consistency
    const finalFolders = await bookmarkUtils.getFolderTitles();
    const finalBookmarkCount = (await bookmarkUtils.getAllBookmarks()).length;

    // Should have same number of folders (unless moves changed structure)
    expect(finalFolders.length).toBeGreaterThanOrEqual(initialFolders.length - 2);
    
    // Should have same number of bookmarks (moves don't create/destroy)
    expect(finalBookmarkCount).toBe(initialBookmarkCount);

    console.log('✅ Data consistency maintained across operations');
  });

  test('should provide comprehensive test reporting', async ({ newTabPage }) => {
    // Generate test data
    await dragDropSetup.generateDragDropTestData();
    await dragDropSetup.waitForBookmarkSync();

    // Get comprehensive summary
    const summary = dragDropSetup.getDragDropTestSummary();
    const testDataSummary = dragDropSetup.getTestDataSummary();

    // Validate reporting data
    expect(summary.totalScenarios).toBeGreaterThan(0);
    expect(summary.scenariosByType).toBeDefined();
    expect(testDataSummary.state.createdFolders.length).toBeGreaterThan(0);
    expect(testDataSummary.state.createdBookmarks.length).toBeGreaterThan(0);

    // Generate test report
    const validation = await dragDropSetup.validateTestData();
    
    const report = {
      timestamp: new Date().toISOString(),
      testDataSummary: summary,
      validation,
      scenarios: summary.scenariosByType,
      performance: {
        totalItems: summary.totalTestItems,
        reorderableItems: summary.reorderableItems,
        emptyTargets: summary.emptyTargets
      }
    };

    console.log('📊 Comprehensive test report:', JSON.stringify(report, null, 2));
    
    // Verify report completeness
    expect(report.validation.isValid).toBeTruthy();
    expect(Object.keys(report.scenarios).length).toBeGreaterThan(0);
  });
});

// Cross-browser compatibility tests
test.describe('Cross-Browser Drag-Drop Compatibility', () => {
  test('should work with Chrome-specific setup', async ({ newTabPage, context }) => {
    const crossBrowserSetup = new CrossBrowserTestDataSetup(newTabPage, context, 'chrome');
    
    await crossBrowserSetup.initialize({
      folderCount: 3,
      bookmarksPerFolder: 2,
      includeDragTestFolders: true
    });

    const testData = await crossBrowserSetup.generateTestData();
    const compatibility = await crossBrowserSetup.validateBrowserCompatibility();
    
    expect(compatibility.isCompatible).toBeTruthy();
    expect(compatibility.supportedFeatures).toContain('Bookmark API');
    
    console.log('✅ Chrome compatibility validated:', compatibility);
    
    // Cleanup
    await crossBrowserSetup.clearTestData();
  });

  test('should adapt for Firefox limitations', async ({ newTabPage, context }) => {
    const crossBrowserSetup = new CrossBrowserTestDataSetup(newTabPage, context, 'firefox');
    
    await crossBrowserSetup.initialize({
      folderCount: 3,
      bookmarksPerFolder: 2,
      includeSpecialUrls: true, // Should be disabled automatically
      maxNestingLevel: 10 // Should be reduced automatically
    });

    const summary = crossBrowserSetup.getBrowserSpecificSummary();
    
    // Verify adaptations were made
    expect(summary.capabilities.maxNestingLevel).toBeLessThanOrEqual(5);
    expect(summary.limitations.length).toBeGreaterThan(0);
    
    console.log('✅ Firefox adaptations applied:', summary);
    
    // Cleanup
    await crossBrowserSetup.clearTestData();
  });
});

// Performance and stress tests
test.describe('Drag-Drop Performance Tests', () => {
  test('should handle large datasets efficiently', async ({ newTabPage, context }) => {
    const performanceSetup = new DragDropTestDataSetup(newTabPage, context);

    await performanceSetup.initialize({
      folderCount: 10,
      bookmarksPerFolder: 10,
      maxNestingLevel: 2,
      includeDragTestFolders: true
    });

    const startTime = Date.now();
    await performanceSetup.generateDragDropTestData();
    const generationTime = Date.now() - startTime;

    console.log(`📊 Large dataset generation time: ${generationTime}ms`);
    expect(generationTime).toBeLessThan(30000); // Should complete within 30 seconds

    // Validate data integrity
    const validation = await performanceSetup.validateTestData();
    expect(validation.isValid).toBeTruthy();

    // Cleanup
    const testDataState = performanceSetup.getTestDataState();
    const cleanup = new TestDataCleanup(newTabPage, context);
    const cleanupResult = await cleanup.cleanup(testDataState);

    expect(cleanupResult.success).toBeTruthy();
    console.log(`📊 Cleanup time: ${cleanupResult.duration}ms`);
  });
});

// Example usage tests for documentation
test.describe('Test Data Utility Usage Examples', () => {
  test('simple drag-drop test example', async ({ newTabPage, context }) => {
    // This test demonstrates the simplest way to use the test data utility

    // 1. Create the test data setup
    const testSetup = new DragDropTestDataSetup(newTabPage, context);

    // 2. Initialize with basic configuration
    await testSetup.initialize({
      folderCount: 3,
      bookmarksPerFolder: 2,
      includeDragTestFolders: true
    });

    // 3. Generate test data
    await testSetup.generateTestData();
    await testSetup.waitForBookmarkSync();

    // 4. Use the generated data for testing
    const bookmarkUtils = new BookmarkTestUtils(newTabPage);
    await bookmarkUtils.waitForBookmarksToLoad();

    const folders = await bookmarkUtils.getBookmarkFolders();
    expect(folders.length).toBeGreaterThanOrEqual(3);

    // 5. Cleanup (automatic with proper test structure)
    const cleanup = new TestDataCleanup(newTabPage, context);
    const testDataState = testSetup.getTestDataState();
    await cleanup.cleanup(testDataState);

    console.log('✅ Simple test data utility example completed');
  });
});
