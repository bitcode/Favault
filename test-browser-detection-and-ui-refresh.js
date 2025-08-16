// Test script for browser detection and UI refresh fixes in FaVault extension
// Copy and paste this into the browser console when the extension is loaded

console.log('🧪 Testing FaVault Browser Detection and UI Refresh Fixes...');

// Test function to verify browser detection is working correctly
async function testBrowserDetection() {
  console.log('🧪 Starting browser detection test...');
  
  try {
    // Check if we're in the extension context
    if (!window.location.href.includes('chrome-extension://') && !window.location.href.includes('moz-extension://')) {
      console.error('❌ This test should be run in the extension context');
      return false;
    }
    
    console.log('✅ Extension context confirmed');
    
    // Check if Brave debugging is properly disabled in production
    const hasBraveDebugger = typeof window.BraveDebugger !== 'undefined';
    const hasTestBraveDrag = typeof window.testBraveDrag !== 'undefined';
    const hasTestBrowserDetection = typeof window.testBrowserDetection !== 'undefined';
    
    console.log(`🔧 BraveDebugger available: ${hasBraveDebugger}`);
    console.log(`🔧 testBraveDrag available: ${hasTestBraveDrag}`);
    console.log(`🔧 testBrowserDetection available: ${hasTestBrowserDetection}`);
    
    // Check if we're in development mode
    const isDevelopment = window.location.hostname === 'localhost' || window.location.protocol === 'file:';
    console.log(`🔧 Development mode: ${isDevelopment}`);
    
    if (isDevelopment) {
      if (hasBraveDebugger && hasTestBrowserDetection) {
        console.log('✅ Development mode: Browser debugging functions properly exposed');
        
        // Test browser detection
        const detection = window.testBrowserDetection();
        console.log('🔧 Browser detection result:', detection);
        
        return true;
      } else {
        console.error('❌ Development mode: Browser debugging functions not properly exposed');
        return false;
      }
    } else {
      if (!hasBraveDebugger && !hasTestBraveDrag) {
        console.log('✅ Production mode: Browser debugging properly disabled');
        return true;
      } else {
        console.warn('⚠️ Production mode: Browser debugging functions still exposed');
        return false;
      }
    }
    
  } catch (error) {
    console.error('❌ Browser detection test failed:', error);
    return false;
  }
}

// Test function to verify UI refresh mechanism is working
async function testUIRefreshMechanism() {
  console.log('🧪 Starting UI refresh mechanism test...');
  
  try {
    // Check if enhanced drag-drop manager is available
    if (typeof EnhancedDragDropManager === 'undefined') {
      console.error('❌ EnhancedDragDropManager not found');
      return false;
    }
    
    console.log('✅ EnhancedDragDropManager found');
    
    // Check if global functions are exposed
    const hasLoadBookmarks = typeof window.loadBookmarks === 'function';
    const hasBookmarkManager = typeof window.BookmarkManager !== 'undefined';
    
    console.log(`🌐 Global loadBookmarks: ${hasLoadBookmarks}`);
    console.log(`🌐 Global BookmarkManager: ${hasBookmarkManager}`);
    
    if (!hasLoadBookmarks) {
      console.error('❌ Global loadBookmarks function not exposed');
      return false;
    }
    
    if (!hasBookmarkManager) {
      console.error('❌ Global BookmarkManager not exposed');
      return false;
    }
    
    // Test the refreshUI method
    console.log('🧪 Testing EnhancedDragDropManager.refreshUI()...');
    
    const refreshResult = await EnhancedDragDropManager.refreshUI();
    
    if (refreshResult) {
      console.log('✅ refreshUI() method executed successfully');
    } else {
      console.error('❌ refreshUI() method failed');
      return false;
    }
    
    // Test custom event mechanism
    console.log('🧪 Testing custom bookmark refresh event...');
    
    const refreshEvent = new CustomEvent('favault-refresh-bookmarks', {
      detail: { 
        source: 'test',
        timestamp: Date.now(),
        clearCache: true
      }
    });
    
    document.dispatchEvent(refreshEvent);
    console.log('✅ Custom refresh event dispatched');
    
    // Test cache clearing
    if (typeof window.BookmarkManager.clearCache === 'function') {
      console.log('🧪 Testing bookmark cache clearing...');
      window.BookmarkManager.clearCache();
      console.log('✅ Bookmark cache cleared');
    } else {
      console.warn('⚠️ BookmarkManager.clearCache not available');
    }
    
    console.log('✅ UI refresh mechanism test completed successfully');
    return true;
    
  } catch (error) {
    console.error('❌ UI refresh mechanism test failed:', error);
    return false;
  }
}

// Test complete folder reordering with UI verification
async function testCompleteReorderingWithUIRefresh() {
  console.log('🧪 Starting complete folder reordering with UI refresh test...');
  
  try {
    // Enable edit mode
    const editToggle = document.querySelector('[data-testid="edit-mode-toggle"], .edit-mode-toggle, button[title*="edit"], button[title*="Edit"]');
    if (editToggle) {
      const isEditMode = document.body.classList.contains('edit-mode') || 
                        document.querySelector('.app')?.classList.contains('edit-mode');
      
      if (!isEditMode) {
        console.log('🔄 Enabling edit mode...');
        editToggle.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Initialize enhanced drag-drop
    const initResult = await EnhancedDragDropManager.initialize();
    if (!initResult.success) {
      console.error('❌ Failed to initialize enhanced drag-drop:', initResult.error);
      return false;
    }
    
    await EnhancedDragDropManager.enableEditMode();
    console.log('✅ Enhanced drag-drop enabled');
    
    // Get initial folder state
    const initialFolders = Array.from(document.querySelectorAll('.folder-container'));
    if (initialFolders.length < 2) {
      console.error('❌ Need at least 2 folders for reordering test');
      return false;
    }
    
    const initialOrder = initialFolders.map(folder => {
      const title = folder.querySelector('.folder-title, h3, .folder-name')?.textContent;
      return title;
    });
    
    console.log('📊 Initial folder order:', initialOrder);
    
    // Record initial bookmark store state
    console.log('🧪 Recording initial bookmark store state...');
    const initialStoreState = JSON.stringify(initialOrder);
    
    // Perform folder reordering
    console.log('🔄 Performing folder reordering: position 0 → position 2');
    const moveResult = await EnhancedDragDropManager.moveFolderToPosition(0, 2);
    
    if (!moveResult.success) {
      console.error('❌ Folder move operation failed:', moveResult.error);
      return false;
    }
    
    console.log('✅ Folder move operation completed');
    
    // Wait for UI refresh
    console.log('⏳ Waiting for UI refresh...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check if UI updated
    const updatedFolders = Array.from(document.querySelectorAll('.folder-container'));
    const newOrder = updatedFolders.map(folder => {
      const title = folder.querySelector('.folder-title, h3, .folder-name')?.textContent;
      return title;
    });
    
    console.log('📊 New folder order:', newOrder);
    
    // Verify the order changed
    const newStoreState = JSON.stringify(newOrder);
    const orderChanged = initialStoreState !== newStoreState;
    
    if (orderChanged) {
      console.log('✅ SUCCESS: UI updated correctly after folder reordering!');
      
      // Verify the specific change
      const movedFolder = initialOrder[0];
      const newPosition = newOrder.indexOf(movedFolder);
      console.log(`📍 "${movedFolder}" moved from position 0 to position ${newPosition}`);
      
      if (newPosition === 2) {
        console.log('✅ PERFECT: Folder moved to exactly the expected position!');
      } else {
        console.log(`⚠️ Folder moved but not to expected position (expected: 2, actual: ${newPosition})`);
      }
      
      return true;
    } else {
      console.error('❌ FAILURE: UI did not update after folder reordering');
      console.error('This indicates the UI refresh mechanism is still not working properly');
      
      // Additional debugging
      console.log('🔍 Debugging information:');
      console.log('  - Move operation succeeded:', moveResult.success);
      console.log('  - Initial order:', initialOrder);
      console.log('  - Current order:', newOrder);
      console.log('  - Orders are identical:', initialStoreState === newStoreState);
      
      return false;
    }
    
  } catch (error) {
    console.error('❌ Complete reordering test failed:', error);
    return false;
  }
}

// Test console output filtering
function testConsoleOutputFiltering() {
  console.log('🧪 Testing console output filtering...');
  
  // Count Brave-related console messages
  const originalConsoleLog = console.log;
  let braveMessages = 0;
  let standardMessages = 0;
  
  // Temporarily intercept console.log to count messages
  console.log = function(...args) {
    const message = args.join(' ');
    if (message.includes('🦁') || message.toLowerCase().includes('brave')) {
      braveMessages++;
    } else {
      standardMessages++;
    }
    originalConsoleLog.apply(console, args);
  };
  
  // Trigger some operations
  if (typeof window.testBrowserDetection === 'function') {
    window.testBrowserDetection();
  }
  
  // Restore original console.log
  console.log = originalConsoleLog;
  
  console.log(`🔍 Console message analysis:`);
  console.log(`  - Brave-related messages: ${braveMessages}`);
  console.log(`  - Standard messages: ${standardMessages}`);
  
  const isDevelopment = window.location.hostname === 'localhost' || window.location.protocol === 'file:';
  
  if (isDevelopment) {
    console.log('✅ Development mode: Brave messages are acceptable');
  } else {
    if (braveMessages === 0) {
      console.log('✅ Production mode: No unwanted Brave messages');
    } else {
      console.warn(`⚠️ Production mode: Found ${braveMessages} Brave-related messages`);
    }
  }
}

// Export test functions to global scope
window.testBrowserDetection = testBrowserDetection;
window.testUIRefreshMechanism = testUIRefreshMechanism;
window.testCompleteReorderingWithUIRefresh = testCompleteReorderingWithUIRefresh;
window.testConsoleOutputFiltering = testConsoleOutputFiltering;

console.log('🧪 Browser detection and UI refresh test functions loaded:');
console.log('  - testBrowserDetection() - Test browser detection fixes');
console.log('  - testUIRefreshMechanism() - Test UI refresh mechanism');
console.log('  - testCompleteReorderingWithUIRefresh() - End-to-end test with UI verification');
console.log('  - testConsoleOutputFiltering() - Test console output filtering');
console.log('');
console.log('🧪 Run testCompleteReorderingWithUIRefresh() for the most comprehensive test');

// Auto-run tests if in extension context
if (window.location.href.includes('chrome-extension://') || window.location.href.includes('moz-extension://')) {
  setTimeout(() => {
    console.log('🧪 Auto-running browser detection test...');
    testBrowserDetection();
    
    setTimeout(() => {
      console.log('🧪 Auto-running UI refresh mechanism test...');
      testUIRefreshMechanism();
    }, 2000);
  }, 1000);
}
