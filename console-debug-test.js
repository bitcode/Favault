// Simple console test for inter-folder drag-drop debugging
// Copy and paste this into the browser console

console.log('🔍 Starting Inter-Folder Drag-Drop Debug Test');

// Test 1: Check if edit mode is enabled
function testEditMode() {
  const editModeEnabled = document.body.classList.contains('edit-mode');
  console.log('✅ Edit Mode Test:', editModeEnabled ? 'ENABLED' : 'DISABLED');
  return editModeEnabled;
}

// Test 2: Check if bookmarks have proper data attributes
function testBookmarkDataAttributes() {
  const bookmarks = document.querySelectorAll('.bookmark-item');
  console.log('✅ Found', bookmarks.length, 'bookmarks');
  
  const results = [];
  bookmarks.forEach((bookmark, index) => {
    const title = bookmark.querySelector('.bookmark-title')?.textContent;
    const bookmarkId = bookmark.getAttribute('data-bookmark-id');
    const parentId = bookmark.getAttribute('data-parent-id');
    
    results.push({
      index,
      title,
      bookmarkId,
      parentId,
      hasDataAttributes: !!(bookmarkId && parentId)
    });
  });
  
  console.log('✅ Bookmark Data Attributes:', results);
  return results;
}

// Test 3: Check if folders have drop handlers
function testFolderDropHandlers() {
  const folders = document.querySelectorAll('.folder-container');
  console.log('✅ Found', folders.length, 'folders');
  
  const results = [];
  folders.forEach((folder, index) => {
    const title = folder.querySelector('.folder-title')?.textContent;
    const hasDropHandler = !!(folder as any)._dropCleanup;
    
    results.push({
      index,
      title,
      hasDropHandler
    });
  });
  
  console.log('✅ Folder Drop Handlers:', results);
  return results;
}

// Test 4: Test API availability
function testAPIAvailability() {
  const apis = {
    BookmarkEditAPI: !!(window as any).BookmarkEditAPI,
    BookmarkManager: !!(window as any).BookmarkManager,
    DragDropManager: !!(window as any).DragDropManager,
    chrome_bookmarks: !!(window as any).chrome?.bookmarks
  };
  
  console.log('✅ API Availability:', apis);
  return apis;
}

// Test 5: Simulate a direct API call
async function testDirectAPICall() {
  console.log('✅ Testing Direct API Call...');
  
  // Find a bookmark to test with
  const firstBookmark = document.querySelector('.bookmark-item');
  if (!firstBookmark) {
    console.log('❌ No bookmarks found for testing');
    return null;
  }
  
  const bookmarkId = firstBookmark.getAttribute('data-bookmark-id');
  const currentParentId = firstBookmark.getAttribute('data-parent-id');
  
  // Find a different folder to move to
  const folders = document.querySelectorAll('.folder-container');
  let targetFolder = null;
  
  for (const folder of folders) {
    const folderId = folder.getAttribute('data-folder-id') || 
                     folder.querySelector('[data-folder-id]')?.getAttribute('data-folder-id');
    if (folderId && folderId !== currentParentId) {
      targetFolder = { id: folderId, title: folder.querySelector('.folder-title')?.textContent };
      break;
    }
  }
  
  if (!targetFolder) {
    console.log('❌ No target folder found for testing');
    return null;
  }
  
  console.log('🔍 Test Parameters:', {
    bookmarkId,
    currentParentId,
    targetFolderId: targetFolder.id,
    targetFolderTitle: targetFolder.title
  });
  
  try {
    const BookmarkEditAPI = (window as any).BookmarkEditAPI;
    if (!BookmarkEditAPI) {
      console.log('❌ BookmarkEditAPI not available');
      return null;
    }
    
    const result = await BookmarkEditAPI.moveBookmark(bookmarkId, {
      parentId: targetFolder.id
    });
    
    console.log('✅ Direct API Call Result:', result);
    return result;
  } catch (error) {
    console.log('❌ Direct API Call Failed:', error);
    return { success: false, error: error.message };
  }
}

// Test 6: Check current bookmark locations via Chrome API
async function testChromeAPIBookmarkLocations() {
  console.log('✅ Testing Chrome API Bookmark Locations...');
  
  if (!(window as any).chrome?.bookmarks) {
    console.log('❌ Chrome bookmarks API not available');
    return null;
  }
  
  try {
    const bookmarkTree = await (window as any).chrome.bookmarks.getTree();
    console.log('✅ Chrome Bookmark Tree:', bookmarkTree);
    
    // Extract all bookmarks with their locations
    const allBookmarks = [];
    
    function extractBookmarks(nodes, parentTitle = '') {
      for (const node of nodes) {
        if (node.url) {
          allBookmarks.push({
            id: node.id,
            title: node.title,
            url: node.url,
            parentId: node.parentId,
            parentTitle,
            index: node.index
          });
        }
        if (node.children) {
          extractBookmarks(node.children, node.title);
        }
      }
    }
    
    extractBookmarks(bookmarkTree);
    console.log('✅ All Bookmarks:', allBookmarks);
    return allBookmarks;
  } catch (error) {
    console.log('❌ Chrome API Test Failed:', error);
    return null;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Running All Debug Tests...');
  
  const results = {
    editMode: testEditMode(),
    bookmarkData: testBookmarkDataAttributes(),
    folderHandlers: testFolderDropHandlers(),
    apiAvailability: testAPIAvailability(),
    directAPICall: null,
    chromeAPILocations: null
  };
  
  // Run async tests
  results.directAPICall = await testDirectAPICall();
  results.chromeAPILocations = await testChromeAPIBookmarkLocations();
  
  console.log('🎯 Complete Test Results:', results);
  
  // Generate recommendations
  const recommendations = [];
  
  if (!results.editMode) {
    recommendations.push('❌ Enable edit mode first');
  }
  
  if (results.bookmarkData.some(b => !b.hasDataAttributes)) {
    recommendations.push('❌ Some bookmarks missing data attributes');
  }
  
  if (results.folderHandlers.some(f => !f.hasDropHandler)) {
    recommendations.push('❌ Some folders missing drop handlers');
  }
  
  if (!results.apiAvailability.BookmarkEditAPI) {
    recommendations.push('❌ BookmarkEditAPI not available');
  }
  
  if (results.directAPICall && !results.directAPICall.success) {
    recommendations.push('❌ Direct API calls failing');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('✅ All basic tests passed - issue may be in drop handler execution');
  }
  
  console.log('💡 Recommendations:', recommendations);
  
  return { results, recommendations };
}

// Make functions available globally
(window as any).debugTests = {
  runAllTests,
  testEditMode,
  testBookmarkDataAttributes,
  testFolderDropHandlers,
  testAPIAvailability,
  testDirectAPICall,
  testChromeAPIBookmarkLocations
};

console.log('🔍 Debug test functions loaded. Run debugTests.runAllTests() to start.');
