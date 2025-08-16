// Manual Enhanced Drag-Drop Setup Script
// Run this in the browser console if the automatic integration isn't working

console.log('🦁 Manual Enhanced Drag-Drop Setup Starting...');

// Check if we're in the right context
if (!document.querySelector('.app')) {
  console.error('❌ This script must be run on the FaVault extension page');
  throw new Error('Not on FaVault extension page');
}

// Simple enhanced drag-drop functionality based on the working console script
window.ManualEnhancedDragDrop = {
  // State management
  currentDragData: null,
  dragEnterCounters: new Map(),
  folderBookmarkIds: new Map(),
  protectedFolderIds: new Set(),
  systemState: {
    initialized: false,
    lastError: null,
    operationCount: 0,
    failedOperations: 0
  },

  // Protected folder patterns
  PROTECTED_TITLES: [
    'Bookmarks Bar',
    'Bookmarks',
    'Other Bookmarks', 
    'Mobile Bookmarks',
    'Bookmarks Menu'
  ],

  // Check if a folder is protected
  isProtectedFolder(bookmarkId, folderTitle) {
    const isRootId = bookmarkId && (bookmarkId === '1' || bookmarkId === '2' || bookmarkId === '3');
    const isProtectedTitle = this.PROTECTED_TITLES.includes(folderTitle);
    
    if (isRootId || isProtectedTitle) {
      this.protectedFolderIds.add(bookmarkId);
      return true;
    }
    
    return false;
  },

  // Show notification
  showNotification(message, type = 'success') {
    const bgColor = type === 'success' ? '#10b981' : '#ef4444';
    const icon = type === 'success' ? '✅' : '❌';
    
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${bgColor};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: bold;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      max-width: 300px;
      animation: slideInRight 0.3s ease;
    `;
    notification.textContent = `${icon} ${message}`;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, type === 'success' ? 4000 : 6000);
  },

  // Check Chrome bookmark API
  async checkBookmarkAPI() {
    try {
      if (typeof chrome === 'undefined' || !chrome.bookmarks) {
        throw new Error('Chrome bookmark API not available');
      }
      
      const tree = await chrome.bookmarks.getTree();
      return { success: true, tree };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Find bookmark folder by title
  findBookmarkFolderByTitle(bookmarkTree, title) {
    const searchNode = (node) => {
      if (node.title === title && node.children && !node.url) {
        return node;
      }
      
      if (node.children) {
        for (const child of node.children) {
          const result = searchNode(child);
          if (result) return result;
        }
      }
      
      return null;
    };
    
    for (const rootNode of bookmarkTree) {
      const result = searchNode(rootNode);
      if (result) return result;
    }
    
    return null;
  },

  // Restore bookmark mappings
  async restoreBookmarkMapping() {
    console.log('🦁 Restoring bookmark folder mappings...');
    
    try {
      const apiCheck = await this.checkBookmarkAPI();
      if (!apiCheck.success) {
        throw new Error(`Bookmark API not accessible: ${apiCheck.error}`);
      }
      
      const bookmarkTree = apiCheck.tree;
      this.folderBookmarkIds.clear();
      this.protectedFolderIds.clear();
      
      const folders = document.querySelectorAll('.folder-container');
      let mappedCount = 0;
      let protectedCount = 0;
      
      console.log(`🦁 Found ${folders.length} folder containers in DOM`);
      
      folders.forEach((folder, index) => {
        const folderTitle = folder.querySelector('.folder-title, h3, .folder-name')?.textContent?.trim();
        
        if (folderTitle) {
          const bookmarkFolder = this.findBookmarkFolderByTitle(bookmarkTree, folderTitle);
          
          if (bookmarkFolder) {
            this.folderBookmarkIds.set(index, bookmarkFolder.id);
            
            if (this.isProtectedFolder(bookmarkFolder.id, folderTitle)) {
              console.log(`🔒 Protected: "${folderTitle}" (${index}) → ${bookmarkFolder.id} [PROTECTED]`);
              protectedCount++;
            } else {
              console.log(`📁 Mapped: "${folderTitle}" (${index}) → ${bookmarkFolder.id}`);
            }
            mappedCount++;
          } else {
            console.warn(`⚠️ Could not find bookmark folder for "${folderTitle}"`);
            this.folderBookmarkIds.set(index, `placeholder-${index}`);
          }
        }
      });
      
      console.log(`✅ Restored ${mappedCount} bookmark mappings (${protectedCount} protected) out of ${folders.length} folders`);
      return { 
        success: true, 
        mappedCount, 
        protectedCount,
        totalFolders: folders.length 
      };
      
    } catch (error) {
      console.error('🦁 ERROR: Failed to restore bookmark mappings:', error);
      return { success: false, mappedCount: 0, protectedCount: 0, totalFolders: 0, error: error.message };
    }
  },

  // Reorder folders
  async reorderFolder(fromIndex, toIndex) {
    console.log(`🦁 API: reorderFolder(${fromIndex}, ${toIndex})`);
    this.systemState.operationCount++;
    
    try {
      const fromBookmarkId = this.folderBookmarkIds.get(fromIndex);
      const toBookmarkId = this.folderBookmarkIds.get(toIndex);
      
      if (!fromBookmarkId || !toBookmarkId || 
          fromBookmarkId.startsWith('placeholder-') || 
          toBookmarkId.startsWith('placeholder-')) {
        throw new Error(`Missing real bookmark IDs: from=${fromBookmarkId}, to=${toBookmarkId}`);
      }
      
      console.log(`🦁 Swapping positions: ${fromBookmarkId} ↔ ${toBookmarkId}`);
      
      const [fromFolder] = await chrome.bookmarks.get(fromBookmarkId);
      const [toFolder] = await chrome.bookmarks.get(toBookmarkId);
      
      const parentChildren = await chrome.bookmarks.getChildren(fromFolder.parentId);
      
      const currentFromIndex = parentChildren.findIndex(child => child.id === fromBookmarkId);
      const currentToIndex = parentChildren.findIndex(child => child.id === toBookmarkId);
      
      console.log(`🦁 Current bookmark indices: from=${currentFromIndex}, to=${currentToIndex}`);
      
      if (currentFromIndex === -1 || currentToIndex === -1) {
        throw new Error('Could not find current positions in bookmark system');
      }
      
      const result = await chrome.bookmarks.move(fromBookmarkId, {
        parentId: fromFolder.parentId,
        index: currentToIndex
      });
      
      console.log(`🦁 Moved folder ${fromBookmarkId} to position ${currentToIndex}`);
      
      this.showNotification(`Folders "${fromFolder.title}" and "${toFolder.title}" reordered`);
      
      return {
        success: true,
        fromBookmarkId,
        toBookmarkId,
        fromIndex,
        toIndex,
        result
      };
      
    } catch (error) {
      console.error('🦁 REORDER ERROR:', error);
      this.showNotification(`Reorder failed: ${error.message}`, 'error');
      
      return {
        success: false,
        error: error.message,
        fromIndex,
        toIndex
      };
    }
  },

  // Initialize the system
  async initialize() {
    console.log('🦁 Initializing manual enhanced drag-drop system...');
    
    try {
      // Check Chrome API
      const apiCheck = await this.checkBookmarkAPI();
      if (!apiCheck.success) {
        throw new Error(`Chrome bookmark API not accessible: ${apiCheck.error}`);
      }

      // Restore bookmark mappings
      const mappingResult = await this.restoreBookmarkMapping();
      if (!mappingResult.success) {
        throw new Error(`Failed to restore bookmark mappings: ${mappingResult.error}`);
      }

      this.systemState.initialized = true;

      console.log('✅ Manual enhanced drag-drop system initialized successfully');
      console.log(`📊 ${mappingResult.mappedCount}/${mappingResult.totalFolders} folders mapped`);
      console.log(`🔒 ${mappingResult.protectedCount} protected folders identified`);

      this.showNotification('Manual enhanced drag-drop system ready!');

      return { success: true };
    } catch (error) {
      console.error('❌ Manual enhanced drag-drop initialization failed:', error);
      this.showNotification(`Initialization failed: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  },

  // Test the system
  async test() {
    console.log('🧪 Testing manual enhanced drag-drop system...');
    
    try {
      const initResult = await this.initialize();
      if (!initResult.success) {
        throw new Error('Initialization failed');
      }

      const folders = document.querySelectorAll('.folder-container');
      console.log(`📁 Found ${folders.length} folder containers`);
      
      let protectedCount = 0;
      folders.forEach((folder, index) => {
        const title = folder.querySelector('.folder-title, h3, .folder-name')?.textContent?.trim();
        const bookmarkId = this.folderBookmarkIds.get(index);
        if (title && bookmarkId && this.protectedFolderIds.has(bookmarkId)) {
          console.log(`🔒 Protected folder: "${title}"`);
          protectedCount++;
        }
      });

      console.log('🎉 MANUAL ENHANCED DRAG-DROP TEST COMPLETE!');
      console.log(`✅ System initialized and ready`);
      console.log(`📁 ${folders.length} folder containers found`);
      console.log(`🔒 ${protectedCount} protected folders detected`);
      console.log('');
      console.log('🚀 To test drag-drop functionality:');
      console.log('  1. Enable edit mode in the extension');
      console.log('  2. Try: ManualEnhancedDragDrop.reorderFolder(1, 3)');
      console.log('  3. Check that changes persist in Chrome bookmarks');

      this.showNotification('Manual system test completed successfully!');

    } catch (error) {
      console.error('❌ Manual system test failed:', error);
      this.showNotification(`Test failed: ${error.message}`, 'error');
    }
  }
};

// Expose convenient global functions
window.testManualEnhancedDragDrop = () => window.ManualEnhancedDragDrop.test();
window.initManualEnhancedDragDrop = () => window.ManualEnhancedDragDrop.initialize();
window.manualReorderFolder = (from, to) => window.ManualEnhancedDragDrop.reorderFolder(from, to);

console.log('✅ Manual Enhanced Drag-Drop Setup Complete!');
console.log('');
console.log('🧪 Available functions:');
console.log('  - testManualEnhancedDragDrop() - Test the system');
console.log('  - initManualEnhancedDragDrop() - Initialize the system');
console.log('  - manualReorderFolder(fromIndex, toIndex) - Reorder folders');
console.log('  - ManualEnhancedDragDrop - Full object with all methods');
console.log('');
console.log('🚀 Quick start: Run testManualEnhancedDragDrop() to test everything');

// Auto-run test
setTimeout(() => {
  console.log('🦁 Auto-running test in 2 seconds...');
  window.testManualEnhancedDragDrop();
}, 2000);
