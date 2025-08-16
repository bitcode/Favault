/**
 * Test script for automatic cache invalidation after bookmark operations
 * 
 * This script tests the new automatic cache invalidation system that should:
 * 1. Detect bookmark moves via Chrome API events
 * 2. Automatically clear the cache
 * 3. Refresh the UI without manual intervention
 * 
 * Usage: Copy and paste this entire script into the browser console
 */

console.log('🧪 Starting Automatic Cache Invalidation Test Suite...');

// Test configuration
const TEST_CONFIG = {
  // Test moves to perform
  moves: [
    { from: 4, to: 2, description: 'Move folder from position 4 to 2' },
    { from: 2, to: 0, description: 'Move folder from position 2 to 0' },
    { from: 0, to: 3, description: 'Move folder from position 0 to 3' }
  ],
  
  // Delay between operations (ms)
  operationDelay: 2000,
  
  // Timeout for UI updates (ms)
  uiUpdateTimeout: 5000
};

// Test state tracking
let testResults = {
  totalTests: 0,
  passed: 0,
  failed: 0,
  details: []
};

/**
 * Wait for a specified amount of time
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get current bookmark state from Chrome API
 */
async function getChromeBookmarkState() {
  try {
    const children = await chrome.bookmarks.getChildren('1');
    const folders = children.filter(child => !child.url);
    return {
      success: true,
      folders: folders.map((folder, index) => ({
        index,
        title: folder.title,
        id: folder.id
      }))
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get current UI state by examining DOM elements
 */
function getUIState() {
  try {
    const folderElements = document.querySelectorAll('.folder-container');
    const folders = Array.from(folderElements).map((element, index) => {
      const titleElement = element.querySelector('.folder-title, h3, .folder-name');
      return {
        index,
        title: titleElement ? titleElement.textContent.trim() : 'Unknown',
        element
      };
    });
    
    return { success: true, folders };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Compare Chrome API state with UI state
 */
function compareStates(chromeState, uiState) {
  if (!chromeState.success || !uiState.success) {
    return {
      match: false,
      error: `State retrieval failed: Chrome=${chromeState.success}, UI=${uiState.success}`
    };
  }
  
  const chromeFolders = chromeState.folders;
  const uiFolders = uiState.folders;
  
  if (chromeFolders.length !== uiFolders.length) {
    return {
      match: false,
      error: `Folder count mismatch: Chrome=${chromeFolders.length}, UI=${uiFolders.length}`
    };
  }
  
  const mismatches = [];
  for (let i = 0; i < chromeFolders.length; i++) {
    if (chromeFolders[i].title !== uiFolders[i].title) {
      mismatches.push({
        index: i,
        chrome: chromeFolders[i].title,
        ui: uiFolders[i].title
      });
    }
  }
  
  return {
    match: mismatches.length === 0,
    mismatches,
    chromeFolders,
    uiFolders
  };
}

/**
 * Perform a bookmark move operation
 */
async function performMove(fromIndex, toIndex) {
  try {
    console.log(`🔄 Performing move: ${fromIndex} → ${toIndex}`);
    
    // Get current state before move
    const beforeState = await getChromeBookmarkState();
    if (!beforeState.success) {
      throw new Error(`Failed to get before state: ${beforeState.error}`);
    }
    
    const folderToMove = beforeState.folders[fromIndex];
    if (!folderToMove) {
      throw new Error(`No folder found at index ${fromIndex}`);
    }
    
    console.log(`📁 Moving folder: "${folderToMove.title}"`);
    
    // Perform the move
    const result = await chrome.bookmarks.move(folderToMove.id, {
      parentId: '1',
      index: toIndex
    });
    
    console.log(`✅ Move completed: "${folderToMove.title}" moved to index ${result.index}`);
    
    return {
      success: true,
      folderTitle: folderToMove.title,
      fromIndex,
      toIndex: result.index,
      result
    };
    
  } catch (error) {
    console.error(`❌ Move failed:`, error);
    return {
      success: false,
      error: error.message,
      fromIndex,
      toIndex
    };
  }
}

/**
 * Wait for UI to update and verify synchronization
 */
async function waitForUISync(expectedChromeState, timeoutMs = 5000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const uiState = getUIState();
    const comparison = compareStates(expectedChromeState, uiState);
    
    if (comparison.match) {
      return {
        success: true,
        syncTime: Date.now() - startTime,
        comparison
      };
    }
    
    // Wait a bit before checking again
    await delay(100);
  }
  
  // Final check to get detailed mismatch info
  const finalUIState = getUIState();
  const finalComparison = compareStates(expectedChromeState, finalUIState);
  
  return {
    success: false,
    timeout: true,
    syncTime: timeoutMs,
    comparison: finalComparison
  };
}

/**
 * Run a single test case
 */
async function runSingleTest(testCase, testIndex) {
  console.log(`\n🧪 Test ${testIndex + 1}: ${testCase.description}`);
  
  testResults.totalTests++;
  
  try {
    // Step 1: Perform the move
    const moveResult = await performMove(testCase.from, testCase.to);
    if (!moveResult.success) {
      throw new Error(`Move operation failed: ${moveResult.error}`);
    }
    
    // Step 2: Get expected Chrome state after move
    await delay(500); // Brief delay to ensure Chrome state is updated
    const expectedChromeState = await getChromeBookmarkState();
    if (!expectedChromeState.success) {
      throw new Error(`Failed to get expected Chrome state: ${expectedChromeState.error}`);
    }
    
    // Step 3: Wait for UI to automatically sync
    console.log(`⏳ Waiting for automatic UI sync (timeout: ${TEST_CONFIG.uiUpdateTimeout}ms)...`);
    const syncResult = await waitForUISync(expectedChromeState, TEST_CONFIG.uiUpdateTimeout);
    
    if (syncResult.success) {
      console.log(`✅ Test ${testIndex + 1} PASSED - UI synced automatically in ${syncResult.syncTime}ms`);
      testResults.passed++;
      testResults.details.push({
        test: testIndex + 1,
        description: testCase.description,
        status: 'PASSED',
        syncTime: syncResult.syncTime,
        moveResult
      });
    } else {
      console.error(`❌ Test ${testIndex + 1} FAILED - UI did not sync within timeout`);
      console.error('Comparison details:', syncResult.comparison);
      testResults.failed++;
      testResults.details.push({
        test: testIndex + 1,
        description: testCase.description,
        status: 'FAILED',
        error: 'UI sync timeout',
        comparison: syncResult.comparison,
        moveResult
      });
    }
    
  } catch (error) {
    console.error(`❌ Test ${testIndex + 1} FAILED with error:`, error);
    testResults.failed++;
    testResults.details.push({
      test: testIndex + 1,
      description: testCase.description,
      status: 'FAILED',
      error: error.message
    });
  }
}

/**
 * Run the complete test suite
 */
async function runTestSuite() {
  console.log('🚀 Starting Automatic Cache Invalidation Test Suite');
  console.log(`📋 Running ${TEST_CONFIG.moves.length} test cases with ${TEST_CONFIG.operationDelay}ms delay between tests`);
  
  // Reset test results
  testResults = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    details: []
  };
  
  // Show initial state
  console.log('\n📊 Initial state:');
  const initialChromeState = await getChromeBookmarkState();
  const initialUIState = getUIState();
  const initialComparison = compareStates(initialChromeState, initialUIState);
  
  console.log('Chrome folders:', initialChromeState.folders?.map(f => f.title) || 'Error');
  console.log('UI folders:', initialUIState.folders?.map(f => f.title) || 'Error');
  console.log('Initial sync status:', initialComparison.match ? '✅ Synced' : '❌ Not synced');
  
  // Run each test case
  for (let i = 0; i < TEST_CONFIG.moves.length; i++) {
    await runSingleTest(TEST_CONFIG.moves[i], i);
    
    // Delay between tests (except after the last test)
    if (i < TEST_CONFIG.moves.length - 1) {
      console.log(`⏳ Waiting ${TEST_CONFIG.operationDelay}ms before next test...`);
      await delay(TEST_CONFIG.operationDelay);
    }
  }
  
  // Show final results
  console.log('\n📊 Test Suite Results:');
  console.log(`Total Tests: ${testResults.totalTests}`);
  console.log(`Passed: ${testResults.passed} ✅`);
  console.log(`Failed: ${testResults.failed} ❌`);
  console.log(`Success Rate: ${((testResults.passed / testResults.totalTests) * 100).toFixed(1)}%`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.details.filter(t => t.status === 'FAILED').forEach(test => {
      console.log(`  Test ${test.test}: ${test.description} - ${test.error || 'UI sync timeout'}`);
    });
  }
  
  if (testResults.passed > 0) {
    console.log('\n✅ Passed Tests:');
    testResults.details.filter(t => t.status === 'PASSED').forEach(test => {
      console.log(`  Test ${test.test}: ${test.description} - Synced in ${test.syncTime}ms`);
    });
  }
  
  return testResults;
}

// Expose functions globally for manual testing
window.testAutomaticCacheInvalidation = {
  runTestSuite,
  runSingleTest: (from, to, description = `Move ${from} → ${to}`) => 
    runSingleTest({ from, to, description }, 0),
  getChromeBookmarkState,
  getUIState,
  compareStates,
  performMove,
  waitForUISync
};

console.log('✅ Automatic Cache Invalidation Test Suite loaded!');
console.log('📋 Available commands:');
console.log('  - testAutomaticCacheInvalidation.runTestSuite() - Run full test suite');
console.log('  - testAutomaticCacheInvalidation.runSingleTest(from, to) - Run single test');
console.log('  - testAutomaticCacheInvalidation.getChromeBookmarkState() - Get Chrome state');
console.log('  - testAutomaticCacheInvalidation.getUIState() - Get UI state');
console.log('  - testAutomaticCacheInvalidation.compareStates(chrome, ui) - Compare states');
