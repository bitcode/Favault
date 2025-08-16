// Cross-browser compatibility test script for FaVault extension
// Copy and paste this into the browser console when the extension is loaded

console.log('🌐 Testing FaVault Cross-Browser Compatibility...');

// Browser detection utility
function detectBrowser() {
  const isChrome = !!(window.chrome) && !(navigator.brave);
  const isBrave = !!(navigator.brave);
  const isEdge = navigator.userAgent.includes('Edg/');
  const isFirefox = navigator.userAgent.includes('Firefox');
  
  return {
    isChrome,
    isBrave,
    isEdge,
    isFirefox,
    name: isChrome ? 'Chrome' : isBrave ? 'Brave' : isEdge ? 'Edge' : isFirefox ? 'Firefox' : 'Unknown',
    userAgent: navigator.userAgent
  };
}

// Test position accuracy across browsers
async function testPositionAccuracy() {
  console.log('🧪 Testing position accuracy across browsers...');
  
  try {
    const browser = detectBrowser();
    console.log(`🌐 Testing in ${browser.name} browser`);
    
    // Check if enhanced drag-drop manager is available
    if (typeof EnhancedDragDropManager === 'undefined') {
      console.error('❌ EnhancedDragDropManager not found');
      return false;
    }
    
    // Initialize and enable edit mode
    const initResult = await EnhancedDragDropManager.initialize();
    if (!initResult.success) {
      console.error('❌ Failed to initialize enhanced drag-drop:', initResult.error);
      return false;
    }
    
    await EnhancedDragDropManager.enableEditMode();
    console.log('✅ Enhanced drag-drop enabled');
    
    // Get initial folder state
    const folders = Array.from(document.querySelectorAll('.folder-container'));
    if (folders.length < 3) {
      console.error('❌ Need at least 3 folders for position accuracy testing');
      return false;
    }
    
    const initialOrder = folders.map(folder => {
      const title = folder.querySelector('.folder-title, h3, .folder-name')?.textContent;
      return title;
    });
    
    console.log('📊 Initial folder order:', initialOrder);
    
    // Test position accuracy: move first folder to each possible position
    const testResults = [];
    
    for (let targetPosition = 0; targetPosition <= folders.length; targetPosition++) {
      console.log(`🧪 Testing move to position ${targetPosition}...`);
      
      // Record state before move
      const beforeOrder = Array.from(document.querySelectorAll('.folder-container')).map(folder => {
        const title = folder.querySelector('.folder-title, h3, .folder-name')?.textContent;
        return title;
      });
      
      // Perform the move
      const moveResult = await EnhancedDragDropManager.moveFolderToPosition(0, targetPosition);
      
      if (!moveResult.success) {
        console.error(`❌ Move to position ${targetPosition} failed:`, moveResult.error);
        testResults.push({ targetPosition, success: false, error: moveResult.error });
        continue;
      }
      
      // Wait for UI update (browser-specific timing)
      const waitTime = browser.isChrome ? 1000 : browser.isBrave ? 500 : 750;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Check actual position
      const afterOrder = Array.from(document.querySelectorAll('.folder-container')).map(folder => {
        const title = folder.querySelector('.folder-title, h3, .folder-name')?.textContent;
        return title;
      });
      
      const movedFolder = beforeOrder[0];
      const actualPosition = afterOrder.indexOf(movedFolder);
      const positionCorrect = actualPosition === targetPosition;
      
      console.log(`📍 Target: ${targetPosition}, Actual: ${actualPosition}, Correct: ${positionCorrect}`);
      
      testResults.push({
        targetPosition,
        actualPosition,
        success: positionCorrect,
        movedFolder,
        beforeOrder: [...beforeOrder],
        afterOrder: [...afterOrder]
      });
      
      // Reset to initial state for next test
      if (actualPosition !== 0) {
        await EnhancedDragDropManager.moveFolderToPosition(actualPosition, 0);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    // Analyze results
    const successfulMoves = testResults.filter(r => r.success).length;
    const totalMoves = testResults.length;
    const accuracy = (successfulMoves / totalMoves) * 100;
    
    console.log(`📊 Position Accuracy Results for ${browser.name}:`);
    console.log(`  - Successful moves: ${successfulMoves}/${totalMoves}`);
    console.log(`  - Accuracy: ${accuracy.toFixed(1)}%`);
    
    // Log failed moves
    const failedMoves = testResults.filter(r => !r.success);
    if (failedMoves.length > 0) {
      console.log('❌ Failed moves:');
      failedMoves.forEach(move => {
        console.log(`  - Target ${move.targetPosition} → Actual ${move.actualPosition}`);
      });
    }
    
    return {
      browser: browser.name,
      accuracy,
      successfulMoves,
      totalMoves,
      testResults
    };
    
  } catch (error) {
    console.error('❌ Position accuracy test failed:', error);
    return false;
  }
}

// Test UI refresh mechanism across browsers
async function testUIRefreshMechanism() {
  console.log('🧪 Testing UI refresh mechanism across browsers...');
  
  try {
    const browser = detectBrowser();
    console.log(`🌐 Testing UI refresh in ${browser.name} browser`);
    
    // Check global functions
    const hasLoadBookmarks = typeof window.loadBookmarks === 'function';
    const hasBookmarkManager = typeof window.BookmarkManager !== 'undefined';
    
    console.log(`🌐 Global loadBookmarks: ${hasLoadBookmarks}`);
    console.log(`🌐 Global BookmarkManager: ${hasBookmarkManager}`);
    
    if (!hasLoadBookmarks || !hasBookmarkManager) {
      console.error('❌ Required global functions not available');
      return false;
    }
    
    // Test refreshUI method
    console.log('🧪 Testing EnhancedDragDropManager.refreshUI()...');
    const refreshResult = await EnhancedDragDropManager.refreshUI();
    
    if (!refreshResult) {
      console.error('❌ refreshUI() method failed');
      return false;
    }
    
    console.log('✅ refreshUI() method executed successfully');
    
    // Test actual folder move with UI verification
    const folders = Array.from(document.querySelectorAll('.folder-container'));
    if (folders.length < 2) {
      console.error('❌ Need at least 2 folders for UI refresh testing');
      return false;
    }
    
    const initialOrder = folders.map(folder => {
      const title = folder.querySelector('.folder-title, h3, .folder-name')?.textContent;
      return title;
    });
    
    console.log('📊 Initial order for UI test:', initialOrder);
    
    // Perform folder move
    const moveResult = await EnhancedDragDropManager.moveFolderToPosition(0, 1);
    
    if (!moveResult.success) {
      console.error('❌ Folder move failed:', moveResult.error);
      return false;
    }
    
    // Wait for UI update with browser-specific timing
    const waitTime = browser.isChrome ? 2000 : browser.isBrave ? 1000 : 1500;
    console.log(`⏳ Waiting ${waitTime}ms for UI update in ${browser.name}...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    // Check if UI updated
    const updatedFolders = Array.from(document.querySelectorAll('.folder-container'));
    const newOrder = updatedFolders.map(folder => {
      const title = folder.querySelector('.folder-title, h3, .folder-name')?.textContent;
      return title;
    });
    
    console.log('📊 New order after move:', newOrder);
    
    const orderChanged = JSON.stringify(initialOrder) !== JSON.stringify(newOrder);
    
    if (orderChanged) {
      console.log(`✅ UI refresh working correctly in ${browser.name}`);
      return true;
    } else {
      console.error(`❌ UI did not update in ${browser.name}`);
      return false;
    }
    
  } catch (error) {
    console.error('❌ UI refresh test failed:', error);
    return false;
  }
}

// Comprehensive cross-browser test suite
async function runCrossBrowserTestSuite() {
  console.log('🌐 Running comprehensive cross-browser test suite...');
  
  const browser = detectBrowser();
  console.log(`🌐 Browser: ${browser.name} (${browser.userAgent})`);
  
  const results = {
    browser: browser.name,
    userAgent: browser.userAgent,
    timestamp: new Date().toISOString(),
    tests: {}
  };
  
  // Test 1: Position Accuracy
  console.log('\n🧪 Test 1: Position Accuracy');
  try {
    results.tests.positionAccuracy = await testPositionAccuracy();
  } catch (error) {
    results.tests.positionAccuracy = { error: error.message };
  }
  
  // Test 2: UI Refresh Mechanism
  console.log('\n🧪 Test 2: UI Refresh Mechanism');
  try {
    results.tests.uiRefresh = await testUIRefreshMechanism();
  } catch (error) {
    results.tests.uiRefresh = { error: error.message };
  }
  
  // Test 3: Browser-Specific Features
  console.log('\n🧪 Test 3: Browser-Specific Features');
  results.tests.browserFeatures = {
    chromeAPI: !!(window.chrome),
    braveAPI: !!(navigator.brave),
    bookmarkAPI: !!(window.chrome?.bookmarks || window.browser?.bookmarks),
    dragEvents: typeof DragEvent !== 'undefined',
    dataTransfer: typeof DataTransfer !== 'undefined',
    customEvents: typeof CustomEvent !== 'undefined'
  };
  
  // Generate report
  console.log('\n📊 Cross-Browser Test Results:');
  console.log('=====================================');
  console.log(`Browser: ${results.browser}`);
  console.log(`Position Accuracy: ${results.tests.positionAccuracy?.accuracy || 'Failed'}%`);
  console.log(`UI Refresh: ${results.tests.uiRefresh ? 'Working' : 'Failed'}`);
  console.log(`Browser Features: ${Object.values(results.tests.browserFeatures).every(Boolean) ? 'All Supported' : 'Some Missing'}`);
  
  // Browser-specific recommendations
  if (browser.isChrome) {
    console.log('\n🌐 Chrome-Specific Notes:');
    console.log('  - Primary development target');
    console.log('  - Should have 100% position accuracy');
    console.log('  - UI refresh should work reliably');
  } else if (browser.isBrave) {
    console.log('\n🦁 Brave-Specific Notes:');
    console.log('  - Secondary support browser');
    console.log('  - May have minor positioning differences');
    console.log('  - UI refresh timing may differ');
  } else {
    console.log(`\n🌐 ${browser.name}-Specific Notes:`);
    console.log('  - Limited support browser');
    console.log('  - Some features may not work perfectly');
    console.log('  - Consider using Chrome for best experience');
  }
  
  return results;
}

// Export test functions to global scope
window.detectBrowser = detectBrowser;
window.testPositionAccuracy = testPositionAccuracy;
window.testUIRefreshMechanism = testUIRefreshMechanism;
window.runCrossBrowserTestSuite = runCrossBrowserTestSuite;

console.log('🌐 Cross-browser compatibility test functions loaded:');
console.log('  - detectBrowser() - Detect current browser');
console.log('  - testPositionAccuracy() - Test folder positioning accuracy');
console.log('  - testUIRefreshMechanism() - Test UI refresh functionality');
console.log('  - runCrossBrowserTestSuite() - Complete test suite');
console.log('');
console.log('🧪 Run runCrossBrowserTestSuite() for comprehensive testing');

// Auto-run browser detection
if (window.location.href.includes('chrome-extension://') || window.location.href.includes('moz-extension://')) {
  setTimeout(() => {
    const browser = detectBrowser();
    console.log(`🌐 Auto-detected browser: ${browser.name}`);
    
    if (browser.isChrome) {
      console.log('✅ Running in primary target browser (Chrome)');
    } else if (browser.isBrave) {
      console.log('⚠️ Running in secondary support browser (Brave)');
    } else {
      console.log('⚠️ Running in limited support browser - consider using Chrome');
    }
  }, 1000);
}
