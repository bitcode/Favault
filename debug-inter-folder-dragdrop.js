// Debug script for inter-folder drag-drop issues
// Run this in the browser console to trace the drag-drop operation

console.log('🔍 Inter-Folder Drag-Drop Debug Script Loaded');

// Store original functions to monitor calls
const originalMoveBookmark = window.BookmarkEditAPI?.moveBookmark;
const originalClearCache = window.BookmarkManager?.clearCache;
const originalGetOrganizedBookmarks = window.BookmarkManager?.getOrganizedBookmarks;

// Debug flags
let debugData = {
  dragStarted: false,
  dropCompleted: false,
  apiCalled: false,
  cacheCleared: false,
  refreshCalled: false,
  eventDispatched: false,
  apiResult: null,
  refreshResult: null,
  timeline: []
};

function logEvent(event, data = {}) {
  const timestamp = new Date().toISOString().split('T')[1];
  debugData.timeline.push({ timestamp, event, data });
  console.log(`🔍 [${timestamp}] ${event}:`, data);
}

// Monitor BookmarkEditAPI.moveBookmark calls
if (window.BookmarkEditAPI && originalMoveBookmark) {
  window.BookmarkEditAPI.moveBookmark = async function(id, destination) {
    logEvent('API_CALL_START', { bookmarkId: id, destination });
    debugData.apiCalled = true;
    
    try {
      const result = await originalMoveBookmark.call(this, id, destination);
      debugData.apiResult = result;
      logEvent('API_CALL_SUCCESS', { result });
      return result;
    } catch (error) {
      debugData.apiResult = { success: false, error: error.message };
      logEvent('API_CALL_ERROR', { error: error.message });
      throw error;
    }
  };
}

// Monitor BookmarkManager.clearCache calls
if (window.BookmarkManager && originalClearCache) {
  window.BookmarkManager.clearCache = function() {
    logEvent('CACHE_CLEARED');
    debugData.cacheCleared = true;
    return originalClearCache.call(this);
  };
}

// Monitor BookmarkManager.getOrganizedBookmarks calls
if (window.BookmarkManager && originalGetOrganizedBookmarks) {
  window.BookmarkManager.getOrganizedBookmarks = async function(forceRefresh = false) {
    logEvent('REFRESH_START', { forceRefresh });
    debugData.refreshCalled = true;
    
    try {
      const result = await originalGetOrganizedBookmarks.call(this, forceRefresh);
      debugData.refreshResult = { success: true, folderCount: result.length };
      logEvent('REFRESH_SUCCESS', { folderCount: result.length, forceRefresh });
      return result;
    } catch (error) {
      debugData.refreshResult = { success: false, error: error.message };
      logEvent('REFRESH_ERROR', { error: error.message });
      throw error;
    }
  };
}

// Monitor custom events
document.addEventListener('favault-bookmark-moved', (event) => {
  logEvent('CUSTOM_EVENT_RECEIVED', event.detail);
  debugData.eventDispatched = true;
});

// Monitor DOM drop events to see if they're being triggered
document.addEventListener('drop', (event) => {
  const target = event.target;
  const folderContainer = target.closest('.folder-container');
  const folderHeader = target.closest('.folder-header');

  if (folderContainer || folderHeader) {
    logEvent('DOM_DROP_EVENT', {
      targetType: folderContainer ? 'folder-container' : 'folder-header',
      folderTitle: folderContainer?.querySelector('.folder-title')?.textContent ||
                   folderHeader?.querySelector('.folder-title')?.textContent,
      hasDropHandler: !!(target._dropCleanup || target.onDrop)
    });
  }
}, true); // Use capture phase to catch all drops

// Monitor drag over events to see if drop zones are active
document.addEventListener('dragover', (event) => {
  const target = event.target;
  const folderContainer = target.closest('.folder-container');

  if (folderContainer && folderContainer.classList.contains('folder-drop-zone-active')) {
    // Only log occasionally to avoid spam
    if (Math.random() < 0.01) { // 1% chance
      logEvent('DRAGOVER_ACTIVE_ZONE', {
        folderTitle: folderContainer.querySelector('.folder-title')?.textContent
      });
    }
  }
}, true);

// Monitor drag events
document.addEventListener('dragstart', (event) => {
  if (event.target.closest('.bookmark-item')) {
    logEvent('DRAG_START', { 
      bookmarkTitle: event.target.querySelector('.bookmark-title')?.textContent,
      bookmarkId: event.target.getAttribute('data-bookmark-id')
    });
    debugData.dragStarted = true;
    debugData = { ...debugData, timeline: [] }; // Reset for new operation
  }
});

document.addEventListener('drop', (event) => {
  if (event.target.closest('.folder-container')) {
    logEvent('DROP_DETECTED', { 
      targetFolder: event.target.closest('.folder-container').querySelector('.folder-title')?.textContent 
    });
    debugData.dropCompleted = true;
  }
});

// Utility functions for manual testing
window.debugInterFolderDragDrop = {
  // Get current debug data
  getDebugData: () => {
    console.log('🔍 Current Debug Data:', debugData);
    return debugData;
  },
  
  // Reset debug data
  reset: () => {
    debugData = {
      dragStarted: false,
      dropCompleted: false,
      apiCalled: false,
      cacheCleared: false,
      refreshCalled: false,
      eventDispatched: false,
      apiResult: null,
      refreshResult: null,
      timeline: []
    };
    console.log('🔍 Debug data reset');
  },
  
  // Test API call directly
  testApiCall: async (bookmarkId, targetFolderId) => {
    console.log('🔍 Testing direct API call...');
    try {
      const result = await window.BookmarkEditAPI.moveBookmark(bookmarkId, {
        parentId: targetFolderId
      });
      console.log('🔍 Direct API test result:', result);
      return result;
    } catch (error) {
      console.error('🔍 Direct API test failed:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Test cache and refresh
  testRefresh: async () => {
    console.log('🔍 Testing cache clear and refresh...');
    window.BookmarkManager.clearCache();
    const result = await window.BookmarkManager.getOrganizedBookmarks(true);
    console.log('🔍 Refresh test result:', { folderCount: result.length });
    return result;
  },
  
  // Check bookmark current location
  checkBookmarkLocation: async (bookmarkId) => {
    console.log('🔍 Checking bookmark location...');
    try {
      if (chrome?.bookmarks?.get) {
        const [bookmark] = await chrome.bookmarks.get(bookmarkId);
        console.log('🔍 Bookmark location:', {
          id: bookmark.id,
          title: bookmark.title,
          parentId: bookmark.parentId,
          index: bookmark.index
        });
        return bookmark;
      } else {
        console.log('🔍 Chrome bookmarks API not available');
        return null;
      }
    } catch (error) {
      console.error('🔍 Failed to check bookmark location:', error);
      return null;
    }
  },

  // Check if drop handlers are properly attached
  checkDropHandlers: () => {
    console.log('🔍 Checking drop handler attachments...');
    const folderContainers = document.querySelectorAll('.folder-container');
    const folderHeaders = document.querySelectorAll('.folder-header');

    const results = {
      folderContainers: [],
      folderHeaders: []
    };

    folderContainers.forEach((container, index) => {
      const folderTitle = container.querySelector('.folder-title')?.textContent;
      const hasDropCleanup = !!(container as any)._dropCleanup;
      const hasDropZoneClass = container.classList.contains('folder-drop-zone-active');

      results.folderContainers.push({
        index,
        title: folderTitle,
        hasDropHandler: hasDropCleanup,
        isActiveDropZone: hasDropZoneClass
      });
    });

    folderHeaders.forEach((header, index) => {
      const folderTitle = header.querySelector('.folder-title')?.textContent;
      const hasDropCleanup = !!(header as any)._dropCleanup;
      const hasDropZoneClass = header.classList.contains('folder-header-drop-zone-active');

      results.folderHeaders.push({
        index,
        title: folderTitle,
        hasDropHandler: hasDropCleanup,
        isActiveDropZone: hasDropZoneClass
      });
    });

    console.log('🔍 Drop handler results:', results);
    return results;
  },
  
  // Generate debug report
  generateReport: () => {
    const report = `
🔍 INTER-FOLDER DRAG-DROP DEBUG REPORT
=====================================

Operation Status:
- Drag Started: ${debugData.dragStarted ? '✅' : '❌'}
- Drop Completed: ${debugData.dropCompleted ? '✅' : '❌'}
- API Called: ${debugData.apiCalled ? '✅' : '❌'}
- Cache Cleared: ${debugData.cacheCleared ? '✅' : '❌'}
- Refresh Called: ${debugData.refreshCalled ? '✅' : '❌'}
- Custom Event Dispatched: ${debugData.eventDispatched ? '✅' : '❌'}

API Result: ${debugData.apiResult ? JSON.stringify(debugData.apiResult, null, 2) : 'None'}

Refresh Result: ${debugData.refreshResult ? JSON.stringify(debugData.refreshResult, null, 2) : 'None'}

Timeline:
${debugData.timeline.map(entry => `[${entry.timestamp}] ${entry.event}: ${JSON.stringify(entry.data)}`).join('\n')}

Recommendations:
${debugData.apiCalled && debugData.apiResult?.success ? '✅ API call succeeded' : '❌ API call failed or not made'}
${debugData.cacheCleared ? '✅ Cache was cleared' : '❌ Cache was not cleared'}
${debugData.refreshCalled ? '✅ Refresh was called' : '❌ Refresh was not called'}
${debugData.eventDispatched ? '✅ Custom event was dispatched' : '❌ Custom event was not dispatched'}
    `;
    
    console.log(report);
    return report;
  }
};

console.log('🔍 Debug functions available:');
console.log('- debugInterFolderDragDrop.getDebugData() - Get current debug data');
console.log('- debugInterFolderDragDrop.reset() - Reset debug data');
console.log('- debugInterFolderDragDrop.testApiCall(bookmarkId, folderId) - Test API directly');
console.log('- debugInterFolderDragDrop.testRefresh() - Test cache and refresh');
console.log('- debugInterFolderDragDrop.checkBookmarkLocation(bookmarkId) - Check bookmark location');
console.log('- debugInterFolderDragDrop.checkDropHandlers() - Check if drop handlers are attached');
console.log('- debugInterFolderDragDrop.generateReport() - Generate debug report');

console.log('🔍 Now perform a drag-drop operation and then call debugInterFolderDragDrop.generateReport()');
