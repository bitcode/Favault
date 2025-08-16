// 🦁 COMPLETE FIXED DRAG-DROP SYSTEM WITH ERROR RECOVERY
console.log('🦁 Initializing fixed drag-drop system with error recovery...');

// ========================================
// 1. GLOBAL VARIABLES AND STATE MANAGEMENT
// ========================================

window.currentDragData = null;
window.folderBookmarkIds = new Map();
window.dragEnterCounters = new Map();
window.protectedFolderIds = new Set(); // Track protected folders
window.systemState = {
  initialized: false,
  lastError: null,
  operationCount: 0,
  failedOperations: 0
};

console.log('✅ Global variables and state management initialized');

// ========================================
// 2. PROTECTED FOLDER DETECTION
// ========================================

function isProtectedFolder(bookmarkId, folderTitle) {
  // Common protected folder patterns
  const protectedTitles = [
    'Bookmarks Bar',
    'Bookmarks',
    'Other Bookmarks', 
    'Mobile Bookmarks',
    'Bookmarks Menu'
  ];
  
  // Root folder IDs are typically '1', '2', '3'
  const isRootId = bookmarkId && (bookmarkId === '1' || bookmarkId === '2' || bookmarkId === '3');
  const isProtectedTitle = protectedTitles.includes(folderTitle);
  
  if (isRootId || isProtectedTitle) {
    window.protectedFolderIds.add(bookmarkId);
    return true;
  }
  
  return false;
}

function checkFolderProtection(fromIndex, toIndex = null) {
  const fromBookmarkId = window.folderBookmarkIds.get(fromIndex);
  const fromFolder = document.querySelectorAll('.folder-container')[fromIndex];
  const fromTitle = fromFolder?.querySelector('.folder-title, h3, .folder-name')?.textContent?.trim();
  
  if (isProtectedFolder(fromBookmarkId, fromTitle)) {
    console.warn(`🦁 PROTECTED FOLDER: "${fromTitle}" (ID: ${fromBookmarkId}) cannot be moved`);
    showNotification(`Cannot move protected folder "${fromTitle}"`, 'error');
    return false;
  }
  
  if (toIndex !== null) {
    const toBookmarkId = window.folderBookmarkIds.get(toIndex);
    const toFolder = document.querySelectorAll('.folder-container')[toIndex];
    const toTitle = toFolder?.querySelector('.folder-title, h3, .folder-name')?.textContent?.trim();
    
    if (isProtectedFolder(toBookmarkId, toTitle)) {
      console.warn(`🦁 PROTECTED TARGET: "${toTitle}" (ID: ${toBookmarkId}) cannot be used as target`);
      showNotification(`Cannot use protected folder "${toTitle}" as target`, 'error');
      return false;
    }
  }
  
  return true;
}

// ========================================
// 3. ENHANCED ERROR HANDLING AND RECOVERY
// ========================================

function handleOperationError(error, operation, context = {}) {
  window.systemState.lastError = error;
  window.systemState.failedOperations++;
  
  console.error(`🦁 OPERATION ERROR [${operation}]:`, error);
  console.error('🦁 Context:', context);
  
  // Specific error handling
  if (error.message.includes("Can't modify the root bookmark folders")) {
    const folderTitle = context.folderTitle || 'Unknown folder';
    showNotification(`Cannot move system folder "${folderTitle}" - it's protected by Chrome`, 'error');
    
    // Mark as protected for future operations
    if (context.bookmarkId) {
      window.protectedFolderIds.add(context.bookmarkId);
    }
    
    return { handled: true, recoverable: true };
  }
  
  if (error.message.includes('Cannot read properties of null')) {
    console.warn('🦁 Null reference error - attempting recovery...');
    
    // Attempt to refresh the system state
    setTimeout(() => {
      refreshSystemState();
    }, 1000);
    
    return { handled: true, recoverable: true };
  }
  
  // Generic error handling
  showNotification(`Operation failed: ${error.message}`, 'error');
  return { handled: false, recoverable: false };
}

async function refreshSystemState() {
  console.log('🦁 Refreshing system state after error...');
  
  try {
    // Re-restore bookmark mappings
    const mappingResult = await restoreBookmarkMapping();
    
    if (mappingResult.success) {
      console.log(`✅ System state refreshed - ${mappingResult.mappedCount} mappings restored`);
      
      // Re-setup drag-drop handlers
      setupFolderDragDrop();
      setupInsertionPoints();
      
      showNotification('System state refreshed successfully');
      return true;
    } else {
      throw new Error('Failed to refresh bookmark mappings');
    }
  } catch (error) {
    console.error('🦁 Failed to refresh system state:', error);
    showNotification('Failed to refresh system state', 'error');
    return false;
  }
}

// ========================================
// 4. CHROME BOOKMARK API WITH ERROR HANDLING
// ========================================

async function checkChromeBookmarkAPI() {
  console.log('🦁 Checking Chrome bookmark API access...');
  
  try {
    if (typeof chrome === 'undefined' || !chrome.bookmarks) {
      throw new Error('Chrome bookmark API not available');
    }
    
    const tree = await chrome.bookmarks.getTree();
    console.log('✅ Chrome bookmark API is accessible');
    
    return { success: true, tree };
  } catch (error) {
    console.error('❌ Chrome bookmark API check failed:', error);
    return { success: false, error: error.message };
  }
}

function findBookmarkFolderByTitle(bookmarkTree, title) {
  function searchNode(node) {
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
  }
  
  for (const rootNode of bookmarkTree) {
    const result = searchNode(rootNode);
    if (result) return result;
  }
  
  return null;
}

async function restoreBookmarkMapping() {
  console.log('🦁 Restoring bookmark folder mappings...');
  
  try {
    const apiCheck = await checkChromeBookmarkAPI();
    if (!apiCheck.success) {
      throw new Error(`Chrome bookmark API not accessible: ${apiCheck.error}`);
    }
    
    const bookmarkTree = apiCheck.tree;
    window.folderBookmarkIds.clear();
    window.protectedFolderIds.clear();
    
    const folders = document.querySelectorAll('.folder-container');
    let mappedCount = 0;
    let protectedCount = 0;
    
    console.log(`🦁 Found ${folders.length} folder containers in DOM`);
    
    folders.forEach((folder, index) => {
      const folderTitle = folder.querySelector('.folder-title, h3, .folder-name')?.textContent?.trim();
      
      if (folderTitle) {
        const bookmarkFolder = findBookmarkFolderByTitle(bookmarkTree, folderTitle);
        
        if (bookmarkFolder) {
          window.folderBookmarkIds.set(index, bookmarkFolder.id);
          
          // Check if this is a protected folder
          if (isProtectedFolder(bookmarkFolder.id, folderTitle)) {
            console.log(`🦁 Protected: "${folderTitle}" (${index}) → ${bookmarkFolder.id} [PROTECTED]`);
            protectedCount++;
          } else {
            console.log(`🦁 Mapped: "${folderTitle}" (${index}) → ${bookmarkFolder.id}`);
          }
          mappedCount++;
        } else {
          console.warn(`🦁 Could not find bookmark folder for "${folderTitle}"`);
          window.folderBookmarkIds.set(index, `placeholder-${index}`);
        }
      } else {
        console.warn(`🦁 No title found for folder at index ${index}`);
        window.folderBookmarkIds.set(index, `placeholder-${index}`);
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
    return { success: false, error: error.message };
  }
}

// ========================================
// 5. NOTIFICATION SYSTEM
// ========================================

function showNotification(message, type = 'success') {
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
  
  if (!document.getElementById('notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, type === 'success' ? 4000 : 6000);
}

function showRefreshPrompt() {
  const existing = document.getElementById('refresh-prompt');
  if (existing) existing.remove();
  
  const refreshDiv = document.createElement('div');
  refreshDiv.id = 'refresh-prompt';
  refreshDiv.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #3b82f6;
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: bold;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    cursor: pointer;
    transition: all 0.3s ease;
  `;
  refreshDiv.innerHTML = `
    🔄 Refresh page to see new bookmark order<br>
    <small style="opacity: 0.8;">Click to refresh now</small>
  `;
  
  refreshDiv.onclick = () => {
    console.log('🦁 Refreshing page to show new bookmark order...');
    window.location.reload();
  };
  
  refreshDiv.onmouseenter = () => {
    refreshDiv.style.transform = 'scale(1.05)';
  };
  
  refreshDiv.onmouseleave = () => {
    refreshDiv.style.transform = 'scale(1)';
  };
  
  document.body.appendChild(refreshDiv);
  
  setTimeout(() => {
    if (refreshDiv.parentNode) {
      refreshDiv.remove();
    }
  }, 10000);
}

// ========================================
// 6. FIXED BOOKMARK API FUNCTIONS
// ========================================

window.insertFolderAtPosition = async function(fromIndex, toIndex) {
  console.log(`🦁 API: insertFolderAtPosition(${fromIndex}, ${toIndex})`);
  window.systemState.operationCount++;
  
  try {
    // Check for protected folders
    if (!checkFolderProtection(fromIndex)) {
      return { success: false, error: 'Protected folder cannot be moved', fromIndex, toIndex };
    }
    
    const folderBookmarkId = window.folderBookmarkIds.get(fromIndex);
    
    if (!folderBookmarkId || folderBookmarkId.startsWith('placeholder-')) {
      throw new Error(`No real bookmark ID found for folder at index ${fromIndex}. ID: ${folderBookmarkId}`);
    }
    
    console.log(`🦁 Moving bookmark folder ID ${folderBookmarkId} from position ${fromIndex} to ${toIndex}`);
    
    const [bookmarkFolder] = await chrome.bookmarks.get(folderBookmarkId);
    console.log('🦁 Current bookmark folder:', bookmarkFolder);
    
    const parentId = bookmarkFolder.parentId;
    const parentChildren = await chrome.bookmarks.getChildren(parentId);
    console.log(`🦁 Parent folder has ${parentChildren.length} children`);
    
    const currentIndex = parentChildren.findIndex(child => child.id === folderBookmarkId);
    console.log(`🦁 Current index in bookmark system: ${currentIndex}`);
    
    let newIndex = toIndex;
    if (currentIndex !== -1 && currentIndex < toIndex) {
      newIndex = toIndex - 1;
    }
    newIndex = Math.max(0, Math.min(newIndex, parentChildren.length - 1));
    
    console.log(`🦁 Moving to index ${newIndex} in parent ${parentId}`);
    
    const result = await chrome.bookmarks.move(folderBookmarkId, {
      parentId: parentId,
      index: newIndex
    });
    
    console.log('🦁 SUCCESS: Bookmark folder moved:', result);
    
    showNotification(`Folder "${bookmarkFolder.title}" moved to position ${toIndex + 1}`);
    
    // Schedule system state refresh
    setTimeout(() => {
      refreshSystemState();
    }, 500);
    
    return {
      success: true,
      bookmarkId: folderBookmarkId,
      fromIndex,
      toIndex,
      newIndex,
      result
    };
    
  } catch (error) {
    const context = {
      operation: 'insertFolderAtPosition',
      fromIndex,
      toIndex,
      bookmarkId: window.folderBookmarkIds.get(fromIndex),
      folderTitle: document.querySelectorAll('.folder-container')[fromIndex]?.querySelector('.folder-title, h3, .folder-name')?.textContent?.trim()
    };
    
    const errorResult = handleOperationError(error, 'insertFolderAtPosition', context);
    
    return {
      success: false,
      error: error.message,
      fromIndex,
      toIndex,
      handled: errorResult.handled,
      recoverable: errorResult.recoverable
    };
  }
};

window.reorderFolder = async function(fromIndex, toIndex) {
  console.log(`🦁 API: reorderFolder(${fromIndex}, ${toIndex})`);
  window.systemState.operationCount++;
  
  try {
    // Check for protected folders
    if (!checkFolderProtection(fromIndex, toIndex)) {
      return { success: false, error: 'Protected folder cannot be moved', fromIndex, toIndex };
    }
    
    const fromBookmarkId = window.folderBookmarkIds.get(fromIndex);
    const toBookmarkId = window.folderBookmarkIds.get(toIndex);
    
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
    
    showNotification(`Folders "${fromFolder.title}" and "${toFolder.title}" reordered`);
    
    // Schedule system state refresh
    setTimeout(() => {
      refreshSystemState();
    }, 500);
    
    return {
      success: true,
      fromBookmarkId,
      toBookmarkId,
      fromIndex,
      toIndex,
      result
    };
    
  } catch (error) {
    const context = {
      operation: 'reorderFolder',
      fromIndex,
      toIndex,
      fromBookmarkId: window.folderBookmarkIds.get(fromIndex),
      toBookmarkId: window.folderBookmarkIds.get(toIndex),
      fromFolderTitle: document.querySelectorAll('.folder-container')[fromIndex]?.querySelector('.folder-title, h3, .folder-name')?.textContent?.trim(),
      toFolderTitle: document.querySelectorAll('.folder-container')[toIndex]?.querySelector('.folder-title, h3, .folder-name')?.textContent?.trim()
    };
    
    const errorResult = handleOperationError(error, 'reorderFolder', context);
    
    return {
      success: false,
      error: error.message,
      fromIndex,
      toIndex,
      handled: errorResult.handled,
      recoverable: errorResult.recoverable
    };
  }
};

// ========================================
// 7. ENHANCED DRAG-DROP UI SETUP
// ========================================

function setupDragDropStyles() {
  const styles = document.createElement('style');
  styles.id = 'fixed-drag-drop-styles';
  styles.textContent = `
    /* Draggable elements */
    .folder-container[draggable="true"]:not(.protected-folder) {
      cursor: grab !important;
      transition: all 0.2s ease !important;
      border: 2px solid transparent !important;
      border-radius: 8px !important;
      position: relative !important;
    }
    
    .folder-container.protected-folder {
      cursor: not-allowed !important;
      opacity: 0.6 !important;
      background: rgba(239, 68, 68, 0.05) !important;
      border: 2px dashed rgba(239, 68, 68, 0.3) !important;
    }
    
    .folder-container[draggable="true"]:not(.protected-folder):hover {
      border-color: #3b82f6 !important;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2) !important;
      transform: translateY(-2px) !important;
      background: rgba(59, 130, 246, 0.05) !important;
    }
    
    .folder-container[draggable="true"]:not(.protected-folder):hover .drag-handle {
      opacity: 1 !important;
    }
    
    .folder-container.protected-folder:hover::after {
      content: "Protected folder - cannot be moved";
      position: absolute;
      top: -30px;
      left: 50%;
      transform: translateX(-50%);
      background: #ef4444;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      white-space: nowrap;
      z-index: 1001;
    }
    
    /* Drag handles */
    .drag-handle {
      position: absolute;
      top: 8px;
      right: 8px;
      color: #6b7280;
      font-size: 14px;
      opacity: 0;
      transition: opacity 0.2s ease;
      pointer-events: none;
      z-index: 10;
    }
    
    .protected-folder .drag-handle {
      color: #ef4444 !important;
      opacity: 0.5 !important;
    }
    
    /* Dragging states */
    .dragging {
      opacity: 0.5 !important;
      transform: rotate(3deg) scale(0.95) !important;
      z-index: 1000 !important;
      box-shadow: 0 15px 30px rgba(0,0,0,0.3) !important;
    }
    
    /* Body states */
    body.dragging-folder-active .folder-container:not(.dragging) {
      opacity: 0.7 !important;
    }
    
    body.dragging-folder-active .folder-insertion-point {
      display: flex !important;
      opacity: 0.5 !important;
      background: rgba(59, 130, 246, 0.1) !important;
      border: 2px dashed rgba(59, 130, 246, 0.5) !important;
    }
    
    /* Insertion points */
    .folder-insertion-point {
      height: 30px;
      background: transparent;
      margin: 8px 0;
      border-radius: 6px;
      transition: all 0.3s ease;
      opacity: 0;
      position: relative;
      z-index: 1000;
      cursor: pointer;
      border: 3px solid transparent;
      display: none;
      align-items: center;
      justify-content: center;
      pointer-events: all;
    }
    
    .folder-insertion-point:hover {
      opacity: 1 !important;
      background: rgba(59, 130, 246, 0.2) !important;
      border-color: #3b82f6 !important;
      height: 40px !important;
    }
    
    /* Drop zones */
    .drop-zone-active {
      background: rgba(16, 185, 129, 0.1) !important;
      border: 2px dashed #10b981 !important;
      transform: scale(1.02) !important;
    }
    
    .drop-zone-folder-reorder {
      background: rgba(59, 130, 246, 0.1) !important;
      border-top: 4px solid #3b82f6 !important;
      border-bottom: 4px solid #3b82f6 !important;
    }
    
    /* Success animation */
    @keyframes successPulse {
      0%, 100% { transform: scale(1); }
      25% { transform: scale(1.05); box-shadow: 0 0 20px rgba(16, 185, 129, 0.4); }
      50% { transform: scale(1.02); }
      75% { transform: scale(1.05); box-shadow: 0 0 20px rgba(16, 185, 129, 0.4); }
    }
    
    .drop-success {
      background: rgba(16, 185, 129, 0.2) !important;
      border: 2px solid #10b981 !important;
      animation: successPulse 2s ease !important;
    }
  `;
  
  const existing = document.getElementById('fixed-drag-drop-styles');
  if (existing) existing.remove();
  
  document.head.appendChild(styles);
  console.log('✅ Fixed drag-drop styles added');
}

function setupFolderDragDrop() {
  const folders = document.querySelectorAll('.folder-container');
  console.log(`🦁 Setting up fixed drag-drop for ${folders.length} folders...`);
  
  let draggableCount = 0;
  let protectedCount = 0;
  
  folders.forEach((folder, folderIndex) => {
    // Clear existing handlers
    ['dragstart', 'dragend', 'dragover', 'dragenter', 'dragleave', 'drop'].forEach(event => {
      const handler = folder[`_${event}Handler`];
      if (handler) {
        folder.removeEventListener(event, handler);
      }
    });
    
    const folderTitle = folder.querySelector('.folder-title, h3, .folder-name')?.textContent?.trim() || `Folder ${folderIndex + 1}`;
    const bookmarkId = window.folderBookmarkIds.get(folderIndex);
    
    // Check if this is a protected folder
    const isProtected = window.protectedFolderIds.has(bookmarkId) || isProtectedFolder(bookmarkId, folderTitle);
    
    if (isProtected) {
      // Mark as protected and make non-draggable
      folder.classList.add('protected-folder');
      folder.setAttribute('draggable', 'false');
      folder.draggable = false;
      folder.style.cursor = 'not-allowed';
      
      // Add protected indicator
      if (!folder.querySelector('.protected-indicator')) {
        const indicator = document.createElement('div');
        indicator.className = 'protected-indicator';
        indicator.innerHTML = '🔒';
        indicator.style.cssText = `
          position: absolute;
          top: 8px;
          left: 8px;
          color: #ef4444;
          font-size: 14px;
          z-index: 10;
        `;
        folder.appendChild(indicator);
      }
      
      console.log(`🔒 Protected folder: "${folderTitle}" (index: ${folderIndex})`);
      protectedCount++;
      return; // Skip drag-drop setup for protected folders
    }
    
    // Setup draggable folder
    folder.classList.remove('protected-folder');
    folder.setAttribute('draggable', 'true');
    folder.draggable = true;
    folder.classList.add('draggable-folder');
    folder.style.cursor = 'grab';
    folder.style.position = 'relative';
    
    // Add drag handle
    if (!folder.querySelector('.drag-handle')) {
      const handle = document.createElement('div');
      handle.className = 'drag-handle';
      handle.innerHTML = '⋮⋮';
      folder.appendChild(handle);
    }
    
    // Drag start handler
    folder._dragstartHandler = (e) => {
      // Double-check protection at drag start
      if (window.protectedFolderIds.has(bookmarkId) || isProtectedFolder(bookmarkId, folderTitle)) {
        e.preventDefault();
        showNotification(`Cannot move protected folder "${folderTitle}"`, 'error');
        return;
      }
      
      window.currentDragData = {
        type: 'folder',
        index: folderIndex,
        title: folderTitle,
        element: folder,
        bookmarkId: bookmarkId
      };
      
      console.log(`🦁 DRAG START: "${folderTitle}" (index: ${folderIndex}, bookmarkId: ${bookmarkId})`);
      
      e.dataTransfer.setData('text/plain', JSON.stringify(window.currentDragData));
      e.dataTransfer.effectAllowed = 'move';
      
      // Visual feedback
      folder.classList.add('dragging');
      document.body.classList.add('dragging-folder-active');
      document.body.style.cursor = 'grabbing';
    };
    
    // Drag end handler
    folder._dragendHandler = (e) => {
      console.log(`🦁 DRAG END: "${folderTitle}"`);
      
      folder.classList.remove('dragging');
      document.body.classList.remove('dragging-folder-active');
      document.body.style.cursor = '';
      
      // Clean up visual states
      document.querySelectorAll('.folder-container').forEach(f => {
        f.classList.remove('drop-zone-active', 'drop-zone-folder-reorder', 'drop-success');
      });
      
      window.currentDragData = null;
      window.dragEnterCounters.clear();
    };
    
    // Drop zone handlers
    folder._dragoverHandler = (e) => {
      if (window.currentDragData?.type === 'folder' && 
          window.currentDragData.index !== folderIndex &&
          !window.protectedFolderIds.has(bookmarkId)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }
    };
    
    folder._dragenterHandler = (e) => {
      const folderId = `folder-${folderIndex}`;
      if (!window.dragEnterCounters.has(folderId)) {
        window.dragEnterCounters.set(folderId, 0);
      }
      window.dragEnterCounters.set(folderId, window.dragEnterCounters.get(folderId) + 1);
      
      if (window.dragEnterCounters.get(folderId) === 1) {
        if (window.currentDragData?.type === 'folder' && 
            window.currentDragData.index !== folderIndex &&
            !window.protectedFolderIds.has(bookmarkId)) {
          console.log(`🦁 FOLDER REORDER TARGET: "${folderTitle}"`);
          folder.classList.add('drop-zone-folder-reorder');
        }
      }
    };
    
    folder._dragleaveHandler = (e) => {
      const folderId = `folder-${folderIndex}`;
      const count = window.dragEnterCounters.get(folderId) || 0;
      window.dragEnterCounters.set(folderId, Math.max(0, count - 1));
      
      if (window.dragEnterCounters.get(folderId) === 0) {
        folder.classList.remove('drop-zone-folder-reorder');
      }
    };
    
    // Fixed drop handler with proper error handling
    folder._dropHandler = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const folderId = `folder-${folderIndex}`;
      window.dragEnterCounters.set(folderId, 0);
      folder.classList.remove('drop-zone-folder-reorder');
      
      if (window.currentDragData?.type === 'folder' && 
          window.currentDragData.index !== folderIndex &&
          !window.protectedFolderIds.has(bookmarkId)) {
        
        console.log(`🦁 FOLDER DROP: "${window.currentDragData.title}" → "${folderTitle}"`);
        console.log(`🦁 Calling reorderFolder(${window.currentDragData.index}, ${folderIndex})`);
        
        // Show loading state
        folder.classList.add('drop-zone-active');
        
        try {
          const result = await window.reorderFolder(window.currentDragData.index, folderIndex);
          
          if (result.success) {
            console.log('✅ FOLDER DROP SUCCESS:', result);
            folder.classList.add('drop-success');
            
            // Auto-refresh after successful move
            setTimeout(() => {
              showRefreshPrompt();
            }, 1000);
          } else {
            console.error('❌ FOLDER DROP FAILED:', result);
            if (!result.handled) {
              showNotification(`Drop failed: ${result.error}`, 'error');
            }
          }
        } catch (error) {
          console.error('🦁 FOLDER DROP ERROR:', error);
          handleOperationError(error, 'folderDrop', {
            fromIndex: window.currentDragData.index,
            toIndex: folderIndex,
            fromTitle: window.currentDragData.title,
            toTitle: folderTitle
          });
        }
        
        // Reset visual state
        setTimeout(() => {
          folder.classList.remove('drop-zone-active', 'drop-success');
        }, 3000);
      }
    };
    
    // Attach all event listeners
    folder.addEventListener('dragstart', folder._dragstartHandler);
    folder.addEventListener('dragend', folder._dragendHandler);
    folder.addEventListener('dragover', folder._dragoverHandler);
    folder.addEventListener('dragenter', folder._dragenterHandler);
    folder.addEventListener('dragleave', folder._dragleaveHandler);
    folder.addEventListener('drop', folder._dropHandler);
    
    draggableCount++;
  });
  
  console.log(`✅ Fixed drag-drop setup complete: ${draggableCount} draggable, ${protectedCount} protected`);
  return { draggable: draggableCount, protected: protectedCount };
}

function setupInsertionPoints() {
  // Remove existing insertion points
  document.querySelectorAll('.folder-insertion-point').forEach(point => point.remove());
  
  const folders = document.querySelectorAll('.folder-container');
  console.log(`🦁 Creating ${folders.length} fixed insertion points...`);
  
  folders.forEach((folder, index) => {
    const insertionPoint = document.createElement('div');
    insertionPoint.className = 'folder-insertion-point';
    insertionPoint.dataset.insertIndex = index.toString();
    
    // Visual indicator
    const indicator = document.createElement('div');
    indicator.style.cssText = `
      width: 100%;
      height: 4px;
      background: transparent;
      border-radius: 2px;
      transition: all 0.3s ease;
    `;
    insertionPoint.appendChild(indicator);
    
    // Insert before folder
    folder.parentNode.insertBefore(insertionPoint, folder);
    
    let isActive = false;
    
    // Dragover handler
    insertionPoint.addEventListener('dragover', (e) => {
      if (window.currentDragData?.type === 'folder' && window.currentDragData.index !== index) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        
        if (!isActive) {
          isActive = true;
          console.log(`🦁 INSERTION POINT ${index}: Drag over`);
          
          insertionPoint.style.opacity = '1';
          insertionPoint.style.height = '40px';
          insertionPoint.style.background = 'rgba(59, 130, 246, 0.2)';
          insertionPoint.style.border = '3px dashed #3b82f6';
          
          indicator.style.background = '#3b82f6';
          indicator.style.height = '8px';
          indicator.style.boxShadow = '0 0 10px rgba(59, 130, 246, 0.5)';
          
          // Add text indicator with null check
          if (!insertionPoint.querySelector('.insert-text') && window.currentDragData && window.currentDragData.title) {
            const text = document.createElement('div');
            text.className = 'insert-text';
            text.textContent = `Insert "${window.currentDragData.title}" at position ${index + 1}`;
            text.style.cssText = `
              position: absolute;
              top: -25px;
              left: 50%;
              transform: translateX(-50%);
              background: #3b82f6;
              color: white;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 12px;
              white-space: nowrap;
              z-index: 1001;
            `;
            insertionPoint.appendChild(text);
          }
        }
      }
    });
    
    // Dragleave handler
    insertionPoint.addEventListener('dragleave', (e) => {
      const rect = insertionPoint.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || 
          e.clientY < rect.top || e.clientY > rect.bottom) {
        
        if (isActive) {
          isActive = false;
          insertionPoint.style.opacity = '0.5';
          insertionPoint.style.height = '30px';
          insertionPoint.style.background = 'rgba(59, 130, 246, 0.1)';
          insertionPoint.style.border = '2px dashed rgba(59, 130, 246, 0.5)';
          
          indicator.style.background = 'transparent';
          indicator.style.height = '4px';
          indicator.style.boxShadow = '';
          
          const text = insertionPoint.querySelector('.insert-text');
          if (text) text.remove();
        }
      }
    });
    
    // Fixed drop handler with comprehensive error handling
    insertionPoint.addEventListener('drop', async (e) => {
      if (!window.currentDragData || window.currentDragData.type !== 'folder') return;
      
      e.preventDefault();
      e.stopPropagation();
      
      console.log(`🦁 INSERTION POINT DROP: "${window.currentDragData.title}" at position ${index}`);
      console.log(`🦁 Calling insertFolderAtPosition(${window.currentDragData.index}, ${index})`);
      
      // Reset visual state
      isActive = false;
      const text = insertionPoint.querySelector('.insert-text');
      if (text) text.remove();
      
      // Show loading state
      insertionPoint.style.opacity = '1';
      insertionPoint.style.background = 'rgba(59, 130, 246, 0.3)';
      insertionPoint.style.border = '3px solid #3b82f6';
      
      try {
        const result = await window.insertFolderAtPosition(window.currentDragData.index, index);
        
        if (result.success) {
          console.log('✅ INSERTION POINT SUCCESS:', result);
          
          // Success feedback with null checks
          insertionPoint.style.background = 'rgba(16, 185, 129, 0.2)';
          insertionPoint.style.border = '3px solid #10b981';
          indicator.style.background = '#10b981';
          indicator.style.height = '12px';
          
          // Safe success text creation
          const dragTitle = window.currentDragData && window.currentDragData.title ? window.currentDragData.title : 'Folder';
          const successText = document.createElement('div');
          successText.textContent = `✅ Inserted "${dragTitle}" at position ${index + 1}`;
          successText.style.cssText = `
            position: absolute;
            top: -25px;
            left: 50%;
            transform: translateX(-50%);
            background: #10b981;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            white-space: nowrap;
            z-index: 1001;
          `;
          insertionPoint.appendChild(successText);
          
          // Auto-refresh after successful move
          setTimeout(() => {
            showRefreshPrompt();
          }, 1000);
          
        } else {
          console.error('❌ INSERTION POINT FAILED:', result);
          if (!result.handled) {
            showNotification(`Insertion failed: ${result.error}`, 'error');
          }
        }
      } catch (error) {
        console.error('🦁 INSERTION POINT ERROR:', error);
        handleOperationError(error, 'insertionPointDrop', {
          fromIndex: window.currentDragData ? window.currentDragData.index : 'unknown',
          toIndex: index,
          fromTitle: window.currentDragData ? window.currentDragData.title : 'unknown'
        });
      }
      
      // Reset after delay with safe cleanup
      setTimeout(() => {
        insertionPoint.style.display = 'none';
        insertionPoint.style.opacity = '0';
        insertionPoint.style.height = '30px';
        insertionPoint.style.background = 'transparent';
        insertionPoint.style.border = '3px solid transparent';
        
        indicator.style.background = 'transparent';
        indicator.style.height = '4px';
        indicator.style.boxShadow = '';
        
        // Safe text cleanup
        const successText = insertionPoint.querySelector('.insert-text');
        if (successText && successText.parentNode) {
          successText.remove();
        }
      }, 4000);
    });
  });
  
  console.log(`✅ Created ${folders.length} fixed insertion points`);
  return folders.length;
}

// ========================================
// 8. DIAGNOSTIC AND TEST FUNCTIONS
// ========================================

window.testFixedSystem = async function() {
  console.log('🦁 Testing fixed drag-drop system...');
  
  const results = {
    chromeAPI: false,
    bookmarkMappings: 0,
    protectedFolders: 0,
    totalFolders: 0,
    draggableFolders: 0,
    insertionPoints: 0,
    apiFunctions: false,
    systemState: { ...window.systemState },
    errors: []
  };
  
  try {
    // Test Chrome API
    const apiCheck = await checkChromeBookmarkAPI();
    results.chromeAPI = apiCheck.success;
    if (!apiCheck.success) {
      results.errors.push(`Chrome API: ${apiCheck.error}`);
    }
    
    // Test bookmark mappings
    const mappingResult = await restoreBookmarkMapping();
    results.bookmarkMappings = mappingResult.success ? mappingResult.mappedCount : 0;
    results.protectedFolders = mappingResult.success ? mappingResult.protectedCount : 0;
    results.totalFolders = mappingResult.totalFolders || 0;
    if (!mappingResult.success) {
      results.errors.push(`Bookmark mapping: ${mappingResult.error}`);
    }
    
    // Test UI elements
    results.draggableFolders = document.querySelectorAll('.folder-container[draggable="true"]:not(.protected-folder)').length;
    results.insertionPoints = document.querySelectorAll('.folder-insertion-point').length;
    
    // Test API functions
    results.apiFunctions = (
      typeof window.insertFolderAtPosition === 'function' &&
      typeof window.reorderFolder === 'function'
    );
    
    console.log('🦁 FIXED SYSTEM TEST RESULTS:');
    console.log(`  Chrome bookmark API: ${results.chromeAPI ? '✅' : '❌'}`);
    console.log(`  Bookmark mappings: ${results.bookmarkMappings}/${results.totalFolders} ${results.bookmarkMappings > 0 ? '✅' : '❌'}`);
    console.log(`  Protected folders: ${results.protectedFolders} 🔒`);
    console.log(`  Draggable folders: ${results.draggableFolders} ${results.draggableFolders > 0 ? '✅' : '❌'}`);
    console.log(`  Insertion points: ${results.insertionPoints} ${results.insertionPoints > 0 ? '✅' : '❌'}`);
    console.log(`  API functions: ${results.apiFunctions ? '✅' : '❌'}`);
    console.log(`  Operations: ${results.systemState.operationCount} total, ${results.systemState.failedOperations} failed`);
    
    if (results.errors.length > 0) {
      console.log('❌ ERRORS:');
      results.errors.forEach(error => console.log(`    ${error}`));
    }
    
    const allGood = results.chromeAPI && 
                   results.bookmarkMappings > 0 && 
                   results.draggableFolders > 0 && 
                   results.insertionPoints > 0 && 
                   results.apiFunctions;
    
    if (allGood) {
      console.log('🎉 FIXED SYSTEM IS READY FOR DRAG-DROP!');
      console.log(`🔒 ${results.protectedFolders} folders are protected and cannot be moved`);
      showNotification('Fixed drag-drop system is ready!');
    } else {
      console.log('❌ SYSTEM HAS ISSUES - CHECK ERRORS ABOVE');
      showNotification('System has issues - check console', 'error');
    }
    
    return results;
    
  } catch (error) {
    console.error('🦁 SYSTEM TEST ERROR:', error);
    results.errors.push(`System test: ${error.message}`);
    return results;
  }
};

window.showSystemDiagnostics = function() {
  console.log('🦁 SYSTEM DIAGNOSTICS:');
  console.log('');
  
  // System state
  console.log('📊 System State:');
  console.log(`  Initialized: ${window.systemState.initialized}`);
  console.log(`  Operations: ${window.systemState.operationCount} total, ${window.systemState.failedOperations} failed`);
  console.log(`  Last error: ${window.systemState.lastError || 'None'}`);
  console.log('');
  
  // Protected folders
  console.log('🔒 Protected Folders:');
  let protectedCount = 0;
  for (const [index, bookmarkId] of window.folderBookmarkIds.entries()) {
    if (window.protectedFolderIds.has(bookmarkId)) {
      const folder = document.querySelectorAll('.folder-container')[index];
      const title = folder?.querySelector('.folder-title, h3, .folder-name')?.textContent?.trim() || `Folder ${index}`;
      console.log(`  ${index}: "${title}" → ${bookmarkId} [PROTECTED]`);
      protectedCount++;
    }
  }
  console.log(`  Total protected: ${protectedCount}`);
  console.log('');
  
  // Draggable folders
  console.log('🎯 Draggable Folders:');
  let draggableCount = 0;
  for (const [index, bookmarkId] of window.folderBookmarkIds.entries()) {
    if (!window.protectedFolderIds.has(bookmarkId) && !bookmarkId.startsWith('placeholder-')) {
      const folder = document.querySelectorAll('.folder-container')[index];
      const title = folder?.querySelector('.folder-title, h3, .folder-name')?.textContent?.trim() || `Folder ${index}`;
      const isDraggable = folder?.draggable === true;
      const hasHandlers = !!folder?._dragstartHandler;
      console.log(`  ${index}: "${title}" → ${bookmarkId} [draggable: ${isDraggable}, handlers: ${hasHandlers}]`);
      draggableCount++;
    }
  }
  console.log(`  Total draggable: ${draggableCount}`);
  console.log('');
  
  // UI elements
  const totalFolders = document.querySelectorAll('.folder-container').length;
  const draggableElements = document.querySelectorAll('.folder-container[draggable="true"]:not(.protected-folder)').length;
  const protectedElements = document.querySelectorAll('.folder-container.protected-folder').length;
  const insertionPoints = document.querySelectorAll('.folder-insertion-point').length;
  
  console.log('🎨 UI Elements:');
  console.log(`  Total folders: ${totalFolders}`);
  console.log(`  Draggable elements: ${draggableElements}`);
  console.log(`  Protected elements: ${protectedElements}`);
  console.log(`  Insertion points: ${insertionPoints}`);
  
  return {
    systemState: window.systemState,
    protectedCount,
    draggableCount,
    uiElements: {
      totalFolders,
      draggableElements,
      protectedElements,
      insertionPoints
    }
  };
};

window.recoverSystem = async function() {
  console.log('🦁 Attempting system recovery...');
  
  try {
    // Reset system state
    window.systemState.lastError = null;
    window.currentDragData = null;
    window.dragEnterCounters.clear();
    
    // Refresh bookmark mappings
    const mappingResult = await restoreBookmarkMapping();
    if (!mappingResult.success) {
      throw new Error(`Failed to restore mappings: ${mappingResult.error}`);
    }
    
    // Re-setup drag-drop
    setupDragDropStyles();
    const folderSetup = setupFolderDragDrop();
    const insertionSetup = setupInsertionPoints();
    
    console.log('✅ System recovery complete');
    console.log(`  ${mappingResult.mappedCount} bookmark mappings restored`);
    console.log(`  ${folderSetup.draggable} draggable folders, ${folderSetup.protected} protected`);
    console.log(`  ${insertionSetup} insertion points created`);
    
    showNotification('System recovery successful!');
    
    return {
      success: true,
      mappings: mappingResult.mappedCount,
      draggable: folderSetup.draggable,
      protected: folderSetup.protected,
      insertionPoints: insertionSetup
    };
    
  } catch (error) {
    console.error('🦁 System recovery failed:', error);
    showNotification(`System recovery failed: ${error.message}`, 'error');
    
    return {
      success: false,
      error: error.message
    };
  }
};

// ========================================
// 9. MAIN INITIALIZATION
// ========================================

async function initializeFixedSystem() {
  console.log('🦁 Initializing fixed drag-drop system with error recovery...');
  
  try {
    // Step 1: Check Chrome API
    console.log('📋 Step 1: Checking Chrome bookmark API...');
    const apiCheck = await checkChromeBookmarkAPI();
    if (!apiCheck.success) {
      throw new Error(`Chrome bookmark API not accessible: ${apiCheck.error}`);
    }
    
    // Step 2: Restore bookmark mappings with protection detection
    console.log('📋 Step 2: Restoring bookmark mappings with protection detection...');
    const mappingResult = await restoreBookmarkMapping();
    if (!mappingResult.success) {
      throw new Error(`Failed to restore bookmark mappings: ${mappingResult.error}`);
    }
    
    // Step 3: Setup UI styles
    console.log('📋 Step 3: Setting up fixed drag-drop styles...');
    setupDragDropStyles();
    
    // Step 4: Setup folder drag-drop with protection
    console.log('📋 Step 4: Setting up protected folder drag-drop...');
    const folderSetup = setupFolderDragDrop();
    
    // Step 5: Setup insertion points with error handling
    console.log('📋 Step 5: Setting up fixed insertion points...');
    const insertionSetup = setupInsertionPoints();
    
    // Mark system as initialized
    window.systemState.initialized = true;
    
    console.log('🎉 FIXED SYSTEM INITIALIZATION SUCCESS!');
    console.log(`✅ Chrome bookmark API accessible`);
    console.log(`✅ ${mappingResult.mappedCount}/${mappingResult.totalFolders} bookmark mappings restored`);
    console.log(`🔒 ${mappingResult.protectedCount} protected folders identified`);
    console.log(`✅ ${folderSetup.draggable} draggable folders, ${folderSetup.protected} protected`);
    console.log(`✅ ${insertionSetup} insertion points with error handling`);
    console.log(`✅ All API functions with error recovery`);
    console.log('');
    console.log('🦁 DIAGNOSTIC FUNCTIONS:');
    console.log('  - testFixedSystem() - Test all components');
    console.log('  - showSystemDiagnostics() - Show detailed system state');
    console.log('  - recoverSystem() - Attempt system recovery');
    console.log('');
    console.log('🦁 FIXED API FUNCTIONS:');
    console.log('  - insertFolderAtPosition(fromIndex, toIndex) - With protection checks');
    console.log('  - reorderFolder(fromIndex, toIndex) - With error recovery');
    console.log('');
    console.log('🎯 DRAG-DROP FEATURES:');
    console.log('  ✅ Protected folder detection and exclusion');
    console.log('  ✅ Comprehensive error handling and recovery');
    console.log('  ✅ Null reference protection in UI handlers');
    console.log('  ✅ System state management and diagnostics');
    console.log('  ✅ Visual indicators for protected folders');
    console.log('');
    console.log('🚀 NOW TRY DRAGGING FOLDERS:');
    console.log('  1. Protected folders show 🔒 and cannot be dragged');
    console.log('  2. Draggable folders show ⋮⋮ handles on hover');
    console.log('  3. Errors are handled gracefully without breaking the system');
    console.log('  4. System automatically recovers from failures');
    console.log('  5. Changes persist permanently in Chrome bookmarks!');
    
    showNotification('Fixed drag-drop system initialized successfully!');
    
    return {
      success: true,
      apiAccess: true,
      mappedFolders: mappingResult.mappedCount,
      protectedFolders: mappingResult.protectedCount,
      totalFolders: mappingResult.totalFolders,
      draggableFolders: folderSetup.draggable,
      insertionPoints: insertionSetup
    };
    
  } catch (error) {
    console.error('❌ FIXED SYSTEM INITIALIZATION FAILED:', error);
    showNotification(`System initialization failed: ${error.message}`, 'error');
    
    return {
      success: false,
      error: error.message
    };
  }
}

// ========================================
// 10. AUTO-INITIALIZE
// ========================================

// Auto-initialize the fixed system
initializeFixedSystem();