/**
 * Simple test to verify bookmark events are working
 * 
 * Copy and paste this into the browser console
 */

console.log('🧪 Simple Bookmark Event Test');

// Step 1: Set up a simple event listener
console.log('Step 1: Setting up simple event listener...');

if (typeof chrome !== 'undefined' && chrome.bookmarks && chrome.bookmarks.onMoved) {
  const simpleListener = (id, moveInfo) => {
    console.log('🎯 BOOKMARK MOVED EVENT DETECTED!');
    console.log('   ID:', id);
    console.log('   Move Info:', moveInfo);
    console.log('   From index:', moveInfo.oldIndex);
    console.log('   To index:', moveInfo.index);
    console.log('   Parent:', moveInfo.parentId);
  };
  
  chrome.bookmarks.onMoved.addListener(simpleListener);
  console.log('✅ Simple event listener added');
  
  // Store for cleanup
  window.simpleBookmarkListener = simpleListener;
} else {
  console.log('❌ Chrome bookmark API not available');
}

// Step 2: Test the move
console.log('\nStep 2: Now run testMove(4, 2) and watch for the event...');

// Cleanup function
window.cleanupSimpleTest = function() {
  if (window.simpleBookmarkListener && chrome.bookmarks && chrome.bookmarks.onMoved) {
    chrome.bookmarks.onMoved.removeListener(window.simpleBookmarkListener);
    console.log('🗑️ Simple listener removed');
    delete window.simpleBookmarkListener;
  }
};

console.log('\n📋 Commands:');
console.log('1. testMove(4, 2) - Test the move (watch for event message)');
console.log('2. cleanupSimpleTest() - Remove the test listener');
console.log('\nIf you see "BOOKMARK MOVED EVENT DETECTED!" then Chrome events work.');
console.log('If not, there may be a permission or API issue.');
