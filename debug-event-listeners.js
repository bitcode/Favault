/**
 * Debug script to check if bookmark event listeners are working
 * 
 * Copy and paste this into the browser console to diagnose the issue
 */

console.log('🔍 Debugging Bookmark Event Listeners...');

// Check if the event listener setup function exists
console.log('1. Checking if BookmarkEditAPI exists:', typeof BookmarkEditAPI !== 'undefined');

if (typeof BookmarkEditAPI !== 'undefined') {
  console.log('2. BookmarkEditAPI methods available:', Object.getOwnPropertyNames(BookmarkEditAPI));
  
  // Check if setupEventListeners exists
  console.log('3. setupEventListeners method exists:', typeof BookmarkEditAPI.setupEventListeners === 'function');
  
  // Check if addEventListener exists
  console.log('4. addEventListener method exists:', typeof BookmarkEditAPI.addEventListener === 'function');
  
  // Check current event listeners
  console.log('5. Current event listeners:', BookmarkEditAPI.eventListeners || 'Not accessible');
} else {
  console.log('❌ BookmarkEditAPI is not available in global scope');
}

// Check if Chrome bookmark API events are available
console.log('6. Chrome bookmark API available:', typeof chrome !== 'undefined' && chrome.bookmarks);

if (typeof chrome !== 'undefined' && chrome.bookmarks) {
  console.log('7. Chrome bookmark events available:');
  console.log('   - onMoved:', !!chrome.bookmarks.onMoved);
  console.log('   - onCreated:', !!chrome.bookmarks.onCreated);
  console.log('   - onChanged:', !!chrome.bookmarks.onChanged);
  console.log('   - onRemoved:', !!chrome.bookmarks.onRemoved);
  console.log('   - onChildrenReordered:', !!chrome.bookmarks.onChildrenReordered);
}

// Check if refreshBookmarks function is available
console.log('8. refreshBookmarks function available:', typeof refreshBookmarks === 'function');

// Check if BookmarkManager is available
console.log('9. BookmarkManager available:', typeof BookmarkManager !== 'undefined');

if (typeof BookmarkManager !== 'undefined') {
  console.log('10. BookmarkManager methods:', Object.getOwnPropertyNames(BookmarkManager));
}

// Test manual event listener setup
console.log('\n🧪 Testing manual event listener setup...');

function testEventListenerSetup() {
  try {
    // Try to set up a test event listener
    if (typeof chrome !== 'undefined' && chrome.bookmarks && chrome.bookmarks.onMoved) {
      console.log('Setting up test onMoved listener...');
      
      const testListener = (id, moveInfo) => {
        console.log('🎯 TEST EVENT DETECTED: Bookmark moved!', { id, moveInfo });
      };
      
      chrome.bookmarks.onMoved.addListener(testListener);
      console.log('✅ Test listener added successfully');
      
      // Store the listener so we can remove it later
      window.testBookmarkListener = testListener;
      
      return true;
    } else {
      console.log('❌ Chrome bookmark onMoved API not available');
      return false;
    }
  } catch (error) {
    console.error('❌ Error setting up test listener:', error);
    return false;
  }
}

const listenerSetupSuccess = testEventListenerSetup();

// Test cache status
console.log('\n📦 Testing cache status...');

if (typeof BookmarkManager !== 'undefined') {
  try {
    // Check if we can access cache info
    console.log('Cache info (if accessible):', {
      clearCache: typeof BookmarkManager.clearCache === 'function',
      getOrganizedBookmarks: typeof BookmarkManager.getOrganizedBookmarks === 'function'
    });
  } catch (error) {
    console.error('Error checking cache:', error);
  }
}

// Provide next steps
console.log('\n📋 Next Steps:');
if (listenerSetupSuccess) {
  console.log('✅ Test listener is set up. Try running testMove(4, 2) and watch for "TEST EVENT DETECTED" message');
  console.log('💡 If you see the test event but UI doesn\'t update, the issue is in the refresh logic');
  console.log('💡 If you don\'t see the test event, the Chrome API events aren\'t firing');
} else {
  console.log('❌ Could not set up test listener. Check Chrome extension permissions.');
}

console.log('\n🔧 Manual commands to try:');
console.log('- testMove(4, 2) - Test a move operation');
console.log('- refreshBookmarks() - Manually refresh the UI');
console.log('- BookmarkManager.clearCache() - Clear the cache manually');

// Function to remove the test listener
window.removeTestListener = function() {
  if (window.testBookmarkListener && chrome.bookmarks && chrome.bookmarks.onMoved) {
    chrome.bookmarks.onMoved.removeListener(window.testBookmarkListener);
    console.log('🗑️ Test listener removed');
    delete window.testBookmarkListener;
  }
};

console.log('- removeTestListener() - Remove the test event listener');
