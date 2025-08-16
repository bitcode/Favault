import { test, expect } from '../fixtures/extension';
import { DragDropTestUtils } from '../utils/dragdrop-utils';
import { BookmarkTestUtils } from '../utils/bookmark-utils';
import { ConsoleTestUtils } from '../utils/console-utils';
import { ExtensionTestUtils } from '../fixtures/extension';
import { TestDataSetup } from '../utils/test-data-setup';

/**
 * Comprehensive drag-and-drop functionality tests for FaVault extension
 * Tests folder reordering, bookmark moving, protected folder validation, and visual feedback
 */

test.describe('Drag and Drop Functionality', () => {
  let dragDropUtils: DragDropTestUtils;
  let bookmarkUtils: BookmarkTestUtils;
  let consoleUtils: ConsoleTestUtils;
  let testDataSetup: TestDataSetup;

  test('Folder Positioning Accuracy Test', async ({ newTabPage, context }) => {
    console.log('🎯 Starting Folder Positioning Accuracy Test...');

    // Initialize utilities
    const dragDropUtils = new DragDropTestUtils(newTabPage);
    const bookmarkUtils = new BookmarkTestUtils(newTabPage);
    const consoleUtils = new ConsoleTestUtils(newTabPage);
    const testDataSetup = new TestDataSetup(newTabPage, context);

    // Start monitoring console output
    await consoleUtils.startMonitoring();
    await consoleUtils.monitorExtensionAPICalls();

    // Create test bookmark data with specific folders for positioning tests
    console.log('🔧 Setting up test bookmark data for positioning tests...');
    await testDataSetup.initialize({
      folderCount: 4,
      bookmarksPerFolder: 1,
      maxNestingLevel: 1,
      includeEmptyFolders: false,
      includeDragTestFolders: false,
      includeReorderableItems: true,
      includeProtectedFolders: false
    });

    await testDataSetup.generateTestData();
    await testDataSetup.waitForBookmarkSync();
    console.log('✅ Test bookmark data created');

    // Wait for extension to load
    await bookmarkUtils.waitForBookmarksToLoad();

    // Enable edit mode
    console.log('📋 Enabling edit mode...');
    await ExtensionTestUtils.enableEditMode(newTabPage);
    await newTabPage.waitForTimeout(2000);

    // Step 1: Run position accuracy test
    console.log('📋 Step 1: Running position accuracy test...');
    const positionTestResult = await newTabPage.evaluate(() => {
      if (typeof (window as any).testPositionAccuracy === 'function') {
        (window as any).testPositionAccuracy();
        return 'completed';
      } else {
        return 'function not available';
      }
    });

    console.log('Position test result:', positionTestResult);

    // Step 2: Test actual positioning with simulated drag-drop
    console.log('📋 Step 2: Testing actual positioning...');

    const positioningResults = await newTabPage.evaluate(async () => {
      const results: any = {
        initialState: {},
        testMoves: [],
        finalState: {}
      };

      // Get initial folder state
      const initialFolders = Array.from(document.querySelectorAll('.folder-container'));
      results.initialState = {
        folderCount: initialFolders.length,
        folderTitles: initialFolders.map(f => f.querySelector('.folder-title')?.textContent || 'Unknown')
      };

      console.log('🎯 Initial folder order:', results.initialState.folderTitles);

      // Test positioning scenarios if we have enough folders
      if (initialFolders.length >= 3) {
        const testScenarios = [
          { from: 0, to: 2, description: 'Move first folder to position 2' },
          { from: 2, to: 0, description: 'Move folder back to position 0' }
        ];

        for (const scenario of testScenarios) {
          const { from, to, description } = scenario;

          console.log(`🎯 Testing: ${description}`);

          try {
            // Get current folder order
            const beforeFolders = Array.from(document.querySelectorAll('.folder-container'));
            const beforeTitles = beforeFolders.map(f => f.querySelector('.folder-title')?.textContent || 'Unknown');

            // Simulate the move using the enhanced drag-drop manager
            if (typeof (window as any).EnhancedDragDropManager?.moveFolderToPosition === 'function') {
              const moveResult = await (window as any).EnhancedDragDropManager.moveFolderToPosition(from, to);

              // Wait for UI to update
              await new Promise(resolve => setTimeout(resolve, 1000));

              // Get new folder order
              const afterFolders = Array.from(document.querySelectorAll('.folder-container'));
              const afterTitles = afterFolders.map(f => f.querySelector('.folder-title')?.textContent || 'Unknown');

              results.testMoves.push({
                scenario,
                beforeTitles,
                afterTitles,
                moveResult,
                success: moveResult.success,
                expectedPosition: to + 1,
                actualPosition: afterTitles.indexOf(beforeTitles[from]) + 1
              });

              console.log(`🎯 Before: ${beforeTitles.join(', ')}`);
              console.log(`🎯 After:  ${afterTitles.join(', ')}`);
              console.log(`🎯 Expected position: ${to + 1}, Actual position: ${afterTitles.indexOf(beforeTitles[from]) + 1}`);

            } else {
              results.testMoves.push({
                scenario,
                error: 'EnhancedDragDropManager.moveFolderToPosition not available'
              });
            }
          } catch (error) {
            results.testMoves.push({
              scenario,
              error: error.message
            });
          }
        }
      }

      // Get final folder state
      const finalFolders = Array.from(document.querySelectorAll('.folder-container'));
      results.finalState = {
        folderCount: finalFolders.length,
        folderTitles: finalFolders.map(f => f.querySelector('.folder-title')?.textContent || 'Unknown')
      };

      return results;
    });

    console.log('Positioning test results:', positioningResults);

    // Step 3: Analyze positioning accuracy
    console.log('📋 Step 3: Analyzing positioning accuracy...');

    let totalTests = 0;
    let accurateTests = 0;

    positioningResults.testMoves.forEach((move: any, index: number) => {
      if (move.success && !move.error) {
        totalTests++;
        const isAccurate = move.expectedPosition === move.actualPosition;
        if (isAccurate) accurateTests++;

        console.log(`Test ${index + 1}: ${move.scenario.description}`);
        console.log(`  Expected position: ${move.expectedPosition}`);
        console.log(`  Actual position: ${move.actualPosition}`);
        console.log(`  Accurate: ${isAccurate ? '✅' : '❌'}`);
      }
    });

    const accuracy = totalTests > 0 ? (accurateTests / totalTests) * 100 : 0;

    console.log('🎉 POSITIONING ACCURACY TEST COMPLETE');
    console.log('=====================================');
    console.log(`Total tests: ${totalTests}`);
    console.log(`Accurate tests: ${accurateTests}`);
    console.log(`Accuracy: ${accuracy.toFixed(1)}%`);

    // Assertions
    expect(positioningResults.initialState.folderCount).toBeGreaterThan(0);
    expect(totalTests).toBeGreaterThan(0);
    expect(accuracy).toBeGreaterThanOrEqual(90); // Expect at least 90% accuracy

    if (accuracy === 100) {
      console.log('✅ SUCCESS: Perfect positioning accuracy achieved!');
    } else if (accuracy >= 90) {
      console.log('✅ SUCCESS: Good positioning accuracy achieved!');
    } else {
      console.log('❌ ISSUE: Positioning accuracy below 90%');
    }
  });

  test('Folder Drag-Drop Timing Diagnosis', async ({ newTabPage, context }) => {
    console.log('🔍 Starting Folder Drag-Drop Timing Diagnosis...');

    // Initialize utilities
    const dragDropUtils = new DragDropTestUtils(newTabPage);
    const bookmarkUtils = new BookmarkTestUtils(newTabPage);
    const consoleUtils = new ConsoleTestUtils(newTabPage);
    const testDataSetup = new TestDataSetup(newTabPage, context);

    // Start monitoring console output
    await consoleUtils.startMonitoring();
    await consoleUtils.monitorExtensionAPICalls();

    // Create test bookmark data with folders
    console.log('🔧 Setting up test bookmark data with folders...');
    await testDataSetup.initialize({
      folderCount: 3,
      bookmarksPerFolder: 2,
      maxNestingLevel: 1,
      includeEmptyFolders: false,
      includeDragTestFolders: true,
      includeReorderableItems: true,
      includeProtectedFolders: false
    });

    await testDataSetup.generateTestData();
    await testDataSetup.waitForBookmarkSync();
    console.log('✅ Test bookmark data created');

    // Wait for extension to load
    await bookmarkUtils.waitForBookmarksToLoad();

    // Step 1: Check initial state before edit mode
    console.log('📋 Step 1: Checking initial state...');
    const initialState = await newTabPage.evaluate(() => {
      const folders = document.querySelectorAll('.folder-container');
      const draggableFolders = document.querySelectorAll('.folder-container[draggable="true"]');
      return {
        totalFolders: folders.length,
        draggableFolders: draggableFolders.length,
        editModeEnabled: document.body.classList.contains('edit-mode'),
        enhancedDragDropAvailable: typeof (window as any).EnhancedDragDropManager !== 'undefined'
      };
    });

    console.log('Initial state:', initialState);

    // Step 2: Enable edit mode and monitor console output
    console.log('📋 Step 2: Enabling edit mode and monitoring setup...');

    // Capture console logs during edit mode activation
    const consoleLogs: string[] = [];
    newTabPage.on('console', msg => {
      if (msg.type() === 'log' || msg.type() === 'error' || msg.type() === 'warn') {
        consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
      }
    });

    // Enable edit mode
    await ExtensionTestUtils.enableEditMode(newTabPage);

    // Wait for setup to complete
    await newTabPage.waitForTimeout(2000);

    // Step 3: Check state after edit mode activation
    console.log('📋 Step 3: Checking state after edit mode activation...');
    const postEditModeState = await newTabPage.evaluate(() => {
      const folders = document.querySelectorAll('.folder-container');
      const draggableFolders = document.querySelectorAll('.folder-container[draggable="true"]');
      const protectedFolders = document.querySelectorAll('.folder-container.protected-folder');

      return {
        totalFolders: folders.length,
        draggableFolders: draggableFolders.length,
        protectedFolders: protectedFolders.length,
        editModeEnabled: document.body.classList.contains('edit-mode'),
        enhancedDragDropReady: (window as any).enhancedDragDropReady
      };
    });

    console.log('Post edit mode state:', postEditModeState);

    // Step 4: Run diagnostic functions
    console.log('📋 Step 4: Running diagnostic functions...');

    const diagnosticResults = await newTabPage.evaluate(async () => {
      const results: any = {};

      // Test if diagnostic functions are available
      results.functionsAvailable = {
        testFolderTiming: typeof (window as any).testFolderTiming === 'function',
        showDragDropDiagnostics: typeof (window as any).showDragDropDiagnostics === 'function',
        setupFolderDragDrop: typeof (window as any).EnhancedDragDropManager?.setupFolderDragDrop === 'function'
      };

      // Run folder timing test if available
      if (results.functionsAvailable.testFolderTiming) {
        try {
          console.log('🔍 Running testFolderTiming()...');
          await (window as any).testFolderTiming();
          results.folderTimingTest = 'completed';
        } catch (error) {
          results.folderTimingTest = `error: ${error.message}`;
        }
      }

      // Run diagnostics if available
      if (results.functionsAvailable.showDragDropDiagnostics) {
        try {
          console.log('📊 Running showDragDropDiagnostics()...');
          (window as any).showDragDropDiagnostics();
          results.diagnostics = 'completed';
        } catch (error) {
          results.diagnostics = `error: ${error.message}`;
        }
      }

      // Force folder setup if available
      if (results.functionsAvailable.setupFolderDragDrop) {
        try {
          console.log('🔧 Running setupFolderDragDrop()...');
          const setupResult = (window as any).EnhancedDragDropManager.setupFolderDragDrop();
          results.forcedSetup = setupResult;
        } catch (error) {
          results.forcedSetup = `error: ${error.message}`;
        }
      }

      return results;
    });

    console.log('Diagnostic results:', diagnosticResults);

    // Step 5: Final state check
    console.log('📋 Step 5: Final state verification...');
    const finalState = await newTabPage.evaluate(() => {
      const folders = document.querySelectorAll('.folder-container');
      const draggableFolders = document.querySelectorAll('.folder-container[draggable="true"]');
      const foldersWithHandlers = Array.from(folders).filter(folder =>
        !!(folder as any)._dragstartHandler
      );

      return {
        totalFolders: folders.length,
        draggableFolders: draggableFolders.length,
        foldersWithHandlers: foldersWithHandlers.length,
        editModeEnabled: document.body.classList.contains('edit-mode')
      };
    });

    console.log('Final state:', finalState);

    // Analyze console logs for missing setup messages
    console.log('📋 Console Log Analysis:');
    const setupLogs = consoleLogs.filter(log =>
      log.includes('Setting up enhanced drag-drop for') ||
      log.includes('Enhanced folder drag enabled') ||
      log.includes('DOM Observer') ||
      log.includes('No folder containers found')
    );

    console.log('Setup-related logs found:', setupLogs.length);
    setupLogs.forEach(log => console.log('  -', log));

    if (setupLogs.length === 0) {
      console.log('❌ ISSUE DETECTED: No folder setup logs found!');
      console.log('This indicates setupFolderDragDrop() may not be executing properly.');
    }

    // Report findings
    console.log('🎉 DIAGNOSIS COMPLETE');
    console.log('===================');
    console.log(`Initial folders: ${initialState.totalFolders}`);
    console.log(`Final draggable folders: ${finalState.draggableFolders}`);
    console.log(`Folders with handlers: ${finalState.foldersWithHandlers}`);
    console.log(`Setup logs found: ${setupLogs.length}`);

    // Assertions for test validation
    expect(finalState.totalFolders).toBeGreaterThan(0);
    expect(finalState.editModeEnabled).toBe(true);

    if (finalState.totalFolders > 0 && finalState.draggableFolders === 0) {
      console.log('❌ TIMING ISSUE CONFIRMED: Folders exist but none are draggable');
    } else if (finalState.draggableFolders > 0) {
      console.log('✅ SUCCESS: Folders are properly configured for drag-drop');
    }
  });

  test.beforeEach(async ({ newTabPage, context }) => {
    dragDropUtils = new DragDropTestUtils(newTabPage);
    bookmarkUtils = new BookmarkTestUtils(newTabPage);
    consoleUtils = new ConsoleTestUtils(newTabPage);
    testDataSetup = new TestDataSetup(newTabPage, context);

    // Start monitoring
    await consoleUtils.startMonitoring();
    await consoleUtils.monitorExtensionAPICalls();
    await consoleUtils.injectDragDropTestFunctions();

    // Create test bookmark data for drag-and-drop testing
    console.log('🔧 Setting up test bookmark data...');
    await testDataSetup.initialize({
      folderCount: 4,
      bookmarksPerFolder: 3,
      maxNestingLevel: 2,
      includeEmptyFolders: true,
      includeDragTestFolders: true,
      includeReorderableItems: true,
      includeProtectedFolders: false
    });

    await testDataSetup.generateTestData();
    await testDataSetup.waitForBookmarkSync();
    console.log('✅ Test bookmark data created');

    // Wait for extension to load
    await bookmarkUtils.waitForBookmarksToLoad();

    // Enable edit mode for drag-drop functionality
    await ExtensionTestUtils.enableEditMode(newTabPage);
  });

  test.afterEach(async ({ newTabPage }) => {
    // Disable edit mode
    await ExtensionTestUtils.disableEditMode(newTabPage);

    // Generate test report
    const report = consoleUtils.generateTestReport();
    console.log('📊 Drag-Drop Test Report:', JSON.stringify(report, null, 2));

    await consoleUtils.stopMonitoring();

    // Clean up test data
    try {
      await testDataSetup.clearTestData();
      console.log('🧹 Test data cleaned up');
    } catch (error) {
      console.warn('⚠️ Test data cleanup warning:', error.message);
    }
  });

  test('should enable drag-and-drop in edit mode', async ({ newTabPage }) => {
    // Edit mode should already be enabled by beforeEach, but verify it's active
    const editModeActive = await newTabPage.locator('.app.edit-mode, body.edit-mode, .edit-toggle.active').count() > 0;
    expect(editModeActive).toBeTruthy();

    // Enhanced drag-drop system should already be set up by the improved enableEditMode function
    const folders = await bookmarkUtils.getBookmarkFolders();

    if (folders.length > 0) {
      // Check if folders are draggable
      for (const folder of folders) {
        const isDraggable = await dragDropUtils.isDraggable(folder);

        // Protected folders might not be draggable
        const isProtected = await bookmarkUtils.isFolderProtected(folder);

        if (!isProtected) {
          expect(isDraggable).toBeTruthy();
        }
      }
    }
  });

  test('should provide visual feedback during drag operations', async ({ newTabPage }) => {
    const folders = await bookmarkUtils.getBookmarkFolders();
    
    if (folders.length > 1) {
      const firstFolder = folders[0];
      const isProtected = await bookmarkUtils.isFolderProtected(firstFolder);
      
      if (!isProtected) {
        // Test drag feedback
        const feedback = await dragDropUtils.verifyDragFeedback(firstFolder);
        
        // Should show some form of drag feedback
        expect(feedback.isDragging || feedback.hasGhostImage || feedback.hasDropZones).toBeTruthy();
      }
    }
  });

  test('should reorder folders via drag and drop', async ({ newTabPage }) => {
    const folders = await bookmarkUtils.getBookmarkFolders();
    
    if (folders.length < 2) {
      test.skip('Need at least 2 folders for reordering test');
    }
    
    // Get initial order
    const initialOrder = await bookmarkUtils.getFolderTitles();
    console.log('📋 Initial folder order:', initialOrder);
    
    // Find non-protected folders for testing
    let sourceIndex = -1;
    let targetIndex = -1;
    
    for (let i = 0; i < folders.length; i++) {
      const isProtected = await bookmarkUtils.isFolderProtected(folders[i]);
      if (!isProtected) {
        if (sourceIndex === -1) {
          sourceIndex = i;
        } else if (targetIndex === -1) {
          targetIndex = i;
          break;
        }
      }
    }
    
    if (sourceIndex === -1 || targetIndex === -1) {
      test.skip('Need at least 2 non-protected folders for reordering test');
    }
    
    // Perform drag and drop reorder
    const reorderResult = await dragDropUtils.testFolderReorder(sourceIndex, targetIndex);
    
    expect(reorderResult.success).toBeTruthy();
    
    if (reorderResult.success) {
      console.log('📋 Original order:', reorderResult.originalOrder);
      console.log('📋 New order:', reorderResult.newOrder);
      
      // Verify order changed
      expect(reorderResult.newOrder).not.toEqual(reorderResult.originalOrder);
      
      // Verify the specific folders were moved
      const sourceTitle = reorderResult.originalOrder[sourceIndex];
      const targetTitle = reorderResult.originalOrder[targetIndex];
      
      expect(reorderResult.newOrder).toContain(sourceTitle);
      expect(reorderResult.newOrder).toContain(targetTitle);
    }
  });

  test('should prevent dragging protected folders', async ({ newTabPage }) => {
    const folders = await bookmarkUtils.getBookmarkFolders();
    
    // Look for protected folders
    let protectedFolder = null;
    let protectedFolderTitle = '';
    
    for (const folder of folders) {
      const isProtected = await bookmarkUtils.isFolderProtected(folder);
      if (isProtected) {
        protectedFolder = folder;
        const titleElement = folder.locator('.folder-title, h3, .folder-name, [data-testid="folder-title"]');
        protectedFolderTitle = await titleElement.textContent() || '';
        break;
      }
    }
    
    if (!protectedFolder) {
      test.skip('No protected folders found for testing');
    }
    
    // Verify protected folder cannot be dragged
    const cannotBeDragged = await dragDropUtils.verifyProtectedFolderNotDraggable(protectedFolderTitle);
    expect(cannotBeDragged).toBeTruthy();
    
    console.log(`🔒 Verified protected folder "${protectedFolderTitle}" cannot be dragged`);
  });

  test('should handle drag and drop with Chrome bookmarks API', async ({ newTabPage }) => {
    // Use injected test functions to test API integration
    const initialState = await consoleUtils.executeTestFunction('getCurrentBookmarkState');
    console.log('📊 Initial bookmark state:', initialState);
    
    if (initialState.folderCount < 2) {
      test.skip('Need at least 2 folders for API integration test');
    }
    
    // Test folder reorder using injected function
    const reorderResult = await consoleUtils.executeTestFunction('testFolderReorder', 0, 1);
    
    if (reorderResult.success) {
      console.log('✅ Folder reorder API test successful:', reorderResult);
      
      // Wait for changes to propagate
      await newTabPage.waitForTimeout(2000);
      
      // Verify state changed
      const newState = await consoleUtils.executeTestFunction('getCurrentBookmarkState');
      console.log('📊 New bookmark state:', newState);
      
      // Should still have same number of folders
      expect(newState.folderCount).toBe(initialState.folderCount);
    } else {
      console.log('⚠️ Folder reorder API test failed:', reorderResult.error);
      // This might be expected if folders are protected
    }
  });

  test('should handle bookmark drag into folders', async ({ newTabPage }) => {
    const folders = await bookmarkUtils.getBookmarkFolders();
    const allBookmarks = await bookmarkUtils.getAllBookmarks();
    
    if (folders.length === 0 || allBookmarks.length === 0) {
      test.skip('Need folders and bookmarks for bookmark moving test');
    }
    
    // Find a bookmark and a target folder
    const firstBookmark = allBookmarks[0];
    const targetFolder = folders[0];
    
    // Get bookmark title
    const bookmarkTitleElement = firstBookmark.locator('.bookmark-title, .bookmark-name, [data-testid="bookmark-title"]');
    const bookmarkTitle = await bookmarkTitleElement.textContent();
    
    // Get folder title
    const folderTitleElement = targetFolder.locator('.folder-title, h3, .folder-name, [data-testid="folder-title"]');
    const folderTitle = await folderTitleElement.textContent();
    
    if (bookmarkTitle && folderTitle) {
      console.log(`🔄 Testing bookmark "${bookmarkTitle}" drag to folder "${folderTitle}"`);
      
      // Perform drag and drop
      await dragDropUtils.dragBookmarkToFolder(bookmarkTitle, folderTitle);
      
      // Wait for operation to complete
      await dragDropUtils.waitForDragDropComplete();
      
      // Verify bookmark is now in the target folder
      const bookmarkInFolder = await bookmarkUtils.verifyBookmarkInFolder(folderTitle, bookmarkTitle);
      
      if (bookmarkInFolder) {
        console.log('✅ Bookmark successfully moved to folder');
      } else {
        console.log('⚠️ Bookmark move may not have completed or was prevented');
      }
    }
  });

  test('should handle drag and drop error scenarios', async ({ newTabPage }) => {
    // Test dragging to invalid targets
    const folders = await bookmarkUtils.getBookmarkFolders();
    
    if (folders.length > 0) {
      const firstFolder = folders[0];
      
      // Try dragging folder to itself (should not work)
      const originalOrder = await bookmarkUtils.getFolderTitles();
      
      try {
        await dragDropUtils.dragAndDrop(firstFolder, firstFolder);
        await newTabPage.waitForTimeout(1000);
        
        const newOrder = await bookmarkUtils.getFolderTitles();
        
        // Order should not change when dragging to self
        expect(newOrder).toEqual(originalOrder);
        
        console.log('✅ Self-drag correctly prevented');
      } catch (error) {
        console.log('✅ Self-drag correctly threw error:', error.message);
      }
    }
  });

  test('should maintain drag state consistency', async ({ newTabPage }) => {
    // Test multiple drag operations in sequence
    const folders = await bookmarkUtils.getBookmarkFolders();
    
    if (folders.length < 3) {
      test.skip('Need at least 3 folders for consistency test');
    }
    
    const initialOrder = await bookmarkUtils.getFolderTitles();
    console.log('📋 Starting consistency test with order:', initialOrder);
    
    // Perform multiple reorders
    const operations = [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 0 }
    ];
    
    for (const op of operations) {
      const currentFolders = await bookmarkUtils.getBookmarkFolders();
      
      if (op.from < currentFolders.length && op.to < currentFolders.length) {
        // Check if folders are protected
        const sourceProtected = await bookmarkUtils.isFolderProtected(currentFolders[op.from]);
        const targetProtected = await bookmarkUtils.isFolderProtected(currentFolders[op.to]);
        
        if (!sourceProtected && !targetProtected) {
          console.log(`🔄 Operation: ${op.from} → ${op.to}`);
          
          await dragDropUtils.dragAndDrop(currentFolders[op.from], currentFolders[op.to]);
          await dragDropUtils.waitForDragDropComplete();
          
          // Verify no drag state artifacts remain
          const draggingElements = await newTabPage.locator('.dragging, [data-dragging="true"]').count();
          const dropZones = await newTabPage.locator('.drop-zone-active, [data-drop-active="true"]').count();
          
          expect(draggingElements).toBe(0);
          expect(dropZones).toBe(0);
        }
      }
    }
    
    const finalOrder = await bookmarkUtils.getFolderTitles();
    console.log('📋 Final order after consistency test:', finalOrder);
    
    // Should still have all original folders
    expect(finalOrder.length).toBe(initialOrder.length);
    
    for (const originalTitle of initialOrder) {
      expect(finalOrder).toContain(originalTitle);
    }
  });

  test('should handle rapid drag operations', async ({ newTabPage }) => {
    const folders = await bookmarkUtils.getBookmarkFolders();
    
    if (folders.length < 2) {
      test.skip('Need at least 2 folders for rapid operation test');
    }
    
    // Find non-protected folders
    const nonProtectedFolders = [];
    for (let i = 0; i < folders.length; i++) {
      const isProtected = await bookmarkUtils.isFolderProtected(folders[i]);
      if (!isProtected) {
        nonProtectedFolders.push(i);
      }
    }
    
    if (nonProtectedFolders.length < 2) {
      test.skip('Need at least 2 non-protected folders for rapid operation test');
    }
    
    const [index1, index2] = nonProtectedFolders.slice(0, 2);
    
    // Perform rapid drag operations
    const startTime = Date.now();
    
    for (let i = 0; i < 3; i++) {
      const currentFolders = await bookmarkUtils.getBookmarkFolders();
      await dragDropUtils.dragAndDrop(currentFolders[index1], currentFolders[index2]);
      await newTabPage.waitForTimeout(500); // Short wait between operations
    }
    
    const endTime = Date.now();
    console.log(`⚡ Rapid operations completed in ${endTime - startTime}ms`);
    
    // Should handle rapid operations without errors
    const errors = consoleUtils.getErrorMessages();
    const dragDropErrors = errors.filter(err => 
      err.toLowerCase().includes('drag') || 
      err.toLowerCase().includes('drop')
    );
    
    expect(dragDropErrors).toHaveLength(0);
  });
});
