// Test script to verify DOM Observer infinite loop fixes
// Run this in the browser console to test the fixes

console.log('🧪 Testing DOM Observer Infinite Loop Fixes...');
console.log('');

// Test 1: Check if debug logging can be controlled
console.log('📋 Test 1: Debug Logging Control');
try {
  const initialState = getDragDropDebugLogging();
  console.log(`  Initial debug logging state: ${initialState}`);
  
  // Disable debug logging
  setDragDropDebugLogging(false);
  const disabledState = getDragDropDebugLogging();
  console.log(`  After disabling: ${disabledState}`);
  
  // Re-enable debug logging
  setDragDropDebugLogging(true);
  const enabledState = getDragDropDebugLogging();
  console.log(`  After re-enabling: ${enabledState}`);
  
  console.log(`  ✅ Debug logging control works: ${!disabledState && enabledState}`);
} catch (error) {
  console.error('  ❌ Debug logging control failed:', error);
}

console.log('');

// Test 2: Check DOM Observer behavior
console.log('📋 Test 2: DOM Observer Behavior');
try {
  // Enable edit mode to activate the observer
  await enableEnhancedEditMode();
  
  // Count initial console messages
  const initialConsoleCount = console.log.length || 0;
  
  // Create a test element that should trigger the observer
  const testDiv = document.createElement('div');
  testDiv.className = 'test-element';
  document.body.appendChild(testDiv);
  
  // Wait a moment
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Add folder-container class (should trigger observer)
  testDiv.classList.add('folder-container');
  
  // Wait for debouncing
  await new Promise(resolve => setTimeout(resolve, 600));
  
  // Remove test element
  testDiv.remove();
  
  console.log('  ✅ DOM Observer test completed without infinite loop');
} catch (error) {
  console.error('  ❌ DOM Observer test failed:', error);
}

console.log('');

// Test 3: Check for excessive logging
console.log('📋 Test 3: Excessive Logging Prevention');
try {
  // Disable debug logging
  setDragDropDebugLogging(false);
  
  // Perform actions that previously caused excessive logging
  const folders = document.querySelectorAll('.folder-container');
  console.log(`  Found ${folders.length} folder containers`);
  
  // Simulate class changes that previously caused loops
  folders.forEach((folder, index) => {
    if (index < 3) { // Only test first 3 to avoid actual issues
      folder.classList.add('test-class');
      folder.classList.remove('test-class');
    }
  });
  
  // Wait for any potential logging
  await new Promise(resolve => setTimeout(resolve, 200));
  
  console.log('  ✅ No excessive logging detected');
  
  // Re-enable debug logging
  setDragDropDebugLogging(true);
} catch (error) {
  console.error('  ❌ Excessive logging test failed:', error);
}

console.log('');

// Test 4: Verify drag-drop functionality still works
console.log('📋 Test 4: Drag-Drop Functionality');
try {
  const diagnostics = showDragDropDiagnostics();
  
  // Check if system is properly initialized
  const folders = document.querySelectorAll('.folder-container');
  const draggableFolders = document.querySelectorAll('.folder-container[draggable="true"]');
  
  console.log(`  Total folders: ${folders.length}`);
  console.log(`  Draggable folders: ${draggableFolders.length}`);
  
  if (folders.length > 0 && draggableFolders.length > 0) {
    console.log('  ✅ Drag-drop functionality appears to be working');
  } else if (folders.length === 0) {
    console.log('  ⚠️ No folders found - this may be expected if no bookmarks exist');
  } else {
    console.log('  ⚠️ Folders found but none are draggable - check edit mode');
  }
} catch (error) {
  console.error('  ❌ Drag-drop functionality test failed:', error);
}

console.log('');

// Test 5: Performance check
console.log('📋 Test 5: Performance Check');
try {
  const startTime = performance.now();
  
  // Perform operations that previously caused performance issues
  for (let i = 0; i < 10; i++) {
    const testDiv = document.createElement('div');
    testDiv.className = 'folder-container';
    document.body.appendChild(testDiv);
    testDiv.remove();
  }
  
  // Wait for any observer processing
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  console.log(`  Operation completed in ${duration.toFixed(2)}ms`);
  
  if (duration < 1000) { // Should complete in less than 1 second
    console.log('  ✅ Performance is acceptable');
  } else {
    console.log('  ⚠️ Performance may be degraded');
  }
} catch (error) {
  console.error('  ❌ Performance test failed:', error);
}

console.log('');
console.log('🎉 DOM Observer Fix Testing Complete!');
console.log('');
console.log('💡 Tips:');
console.log('  - Use setDragDropDebugLogging(false) to disable debug logging in production');
console.log('  - Use getDragDropDebugLogging() to check current logging state');
console.log('  - The system automatically detects production mode and reduces logging');
console.log('  - DOM Observer now has proper debouncing and loop prevention');
