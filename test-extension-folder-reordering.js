// Test script for folder reordering in the actual FaVault extension
// Copy and paste this into the browser console when the extension is loaded

console.log('🧪 Testing FaVault Extension Folder Reordering...');

// Test function to verify the improved insertion points are working
async function testExtensionFolderReordering() {
  console.log('🧪 Starting extension folder reordering test...');
  
  try {
    // Check if we're in the extension context
    if (!window.location.href.includes('chrome-extension://') && !window.location.href.includes('moz-extension://')) {
      console.error('❌ This test should be run in the extension context');
      return false;
    }
    
    // Wait for DOM to be ready
    await new Promise(resolve => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resolve);
      } else {
        resolve();
      }
    });
    
    console.log('✅ Extension context confirmed');
    
    // Check for enhanced drag-drop manager
    if (typeof EnhancedDragDropManager === 'undefined') {
      console.error('❌ EnhancedDragDropManager not found');
      return false;
    }
    
    console.log('✅ EnhancedDragDropManager found');
    
    // Initialize the enhanced drag-drop system
    const initResult = await EnhancedDragDropManager.initialize();
    if (!initResult.success) {
      console.error('❌ Failed to initialize enhanced drag-drop:', initResult.error);
      return false;
    }
    
    console.log('✅ Enhanced drag-drop system initialized');
    
    // Check for edit mode toggle
    const editToggle = document.querySelector('[data-testid="edit-mode-toggle"], .edit-mode-toggle, button[title*="edit"], button[title*="Edit"]');
    if (!editToggle) {
      console.error('❌ Edit mode toggle not found');
      return false;
    }
    
    console.log('✅ Edit mode toggle found');
    
    // Enable edit mode
    const isEditMode = document.body.classList.contains('edit-mode') || 
                      document.querySelector('.app')?.classList.contains('edit-mode');
    
    if (!isEditMode) {
      console.log('🔄 Enabling edit mode...');
      editToggle.click();
      
      // Wait for edit mode to activate
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Enable enhanced drag-drop
    await EnhancedDragDropManager.enableEditMode();
    console.log('✅ Enhanced edit mode enabled');
    
    // Check for insertion points
    const insertionPoints = document.querySelectorAll('.insertion-point');
    console.log(`📍 Found ${insertionPoints.length} insertion points`);
    
    if (insertionPoints.length === 0) {
      console.error('❌ No insertion points found - check if FolderInsertionPoint component is working');
      return false;
    }
    
    // Check for folder containers
    const folders = document.querySelectorAll('.folder-container');
    console.log(`📁 Found ${folders.length} folder containers`);
    
    if (folders.length === 0) {
      console.error('❌ No folder containers found');
      return false;
    }
    
    // Verify insertion points are positioned correctly
    let expectedInsertionPoints = folders.length + 1; // One before first, one after each folder
    if (insertionPoints.length !== expectedInsertionPoints) {
      console.warn(`⚠️ Expected ${expectedInsertionPoints} insertion points, found ${insertionPoints.length}`);
    }
    
    // Test insertion point attributes and positioning
    insertionPoints.forEach((point, index) => {
      const insertionIndex = point.getAttribute('data-insertion-index');
      const isFirst = point.classList.contains('first');
      const isLast = point.classList.contains('last');
      
      console.log(`📍 Insertion point ${index}: insertion-index=${insertionIndex}, first=${isFirst}, last=${isLast}`);
      
      // Verify insertion index is correct
      if (parseInt(insertionIndex) !== index) {
        console.warn(`⚠️ Insertion point ${index} has incorrect insertion-index: ${insertionIndex}`);
      }
    });
    
    // Test visual feedback on hover
    console.log('🧪 Testing visual feedback...');
    const firstInsertionPoint = insertionPoints[0];
    
    // Simulate hover
    const hoverEvent = new MouseEvent('mouseenter', { bubbles: true });
    firstInsertionPoint.dispatchEvent(hoverEvent);
    
    // Check if visual feedback is applied
    setTimeout(() => {
      const computedStyle = window.getComputedStyle(firstInsertionPoint);
      const height = computedStyle.height;
      console.log(`📍 Insertion point height on hover: ${height}`);
      
      // Remove hover
      const leaveEvent = new MouseEvent('mouseleave', { bubbles: true });
      firstInsertionPoint.dispatchEvent(leaveEvent);
    }, 100);
    
    // Test moveFolderToPosition function if available
    if (folders.length >= 2) {
      console.log('🧪 Testing moveFolderToPosition function...');
      
      // Get current folder state
      console.log('📊 Current folder state:');
      folders.forEach((folder, index) => {
        const title = folder.querySelector('.folder-title, h3, .folder-name')?.textContent;
        console.log(`  📁 ${index}: "${title}"`);
      });
      
      // Test moving first folder to position 2 with UI refresh verification
      console.log('🧪 Testing folder move with UI refresh: position 0 → insertion point 2');

      // Record initial state
      const initialFolders = Array.from(folders).map(folder => {
        const title = folder.querySelector('.folder-title, h3, .folder-name')?.textContent;
        return { title, element: folder };
      });

      console.log('📊 Initial folder order:');
      initialFolders.forEach((folder, index) => {
        console.log(`  📁 ${index}: "${folder.title}"`);
      });

      try {
        const moveResult = await EnhancedDragDropManager.moveFolderToPosition(0, 2);
        if (moveResult.success) {
          console.log('✅ moveFolderToPosition API call successful:', moveResult);

          // Wait for UI update and verify changes
          setTimeout(() => {
            console.log('📊 Verifying UI update after move...');
            const updatedFolders = document.querySelectorAll('.folder-container');
            const newFolderOrder = Array.from(updatedFolders).map(folder => {
              const title = folder.querySelector('.folder-title, h3, .folder-name')?.textContent;
              return title;
            });

            console.log('📊 New folder order:');
            newFolderOrder.forEach((title, index) => {
              console.log(`  📁 ${index}: "${title}"`);
            });

            // Check if the order actually changed
            const initialOrder = initialFolders.map(f => f.title);
            const orderChanged = JSON.stringify(initialOrder) !== JSON.stringify(newFolderOrder);

            if (orderChanged) {
              console.log('✅ UI successfully updated - folder order changed!');

              // Check if the moved folder is in the expected position
              const movedFolderTitle = initialOrder[0];
              const newPosition = newFolderOrder.indexOf(movedFolderTitle);
              console.log(`📍 Moved folder "${movedFolderTitle}" is now at position ${newPosition}`);

              // Look for visual feedback (green highlighting)
              const movedFolderElement = Array.from(updatedFolders).find(folder => {
                const title = folder.querySelector('.folder-title, h3, .folder-name')?.textContent;
                return title === movedFolderTitle;
              });

              if (movedFolderElement) {
                const style = window.getComputedStyle(movedFolderElement);
                const hasGreenBackground = style.backgroundColor.includes('0, 255, 0') ||
                                         style.background.includes('rgba(0, 255, 0');

                if (hasGreenBackground) {
                  console.log('✅ Visual feedback detected - folder has green highlighting!');
                } else {
                  console.log('⚠️ No visual feedback detected on moved folder');
                }
              }
            } else {
              console.error('❌ UI did not update - folder order unchanged!');
              console.error('This indicates the UI refresh mechanism is not working');
            }
          }, 1500);
        } else {
          console.error('❌ moveFolderToPosition test failed:', moveResult.error);
        }
      } catch (error) {
        console.error('❌ Error testing moveFolderToPosition:', error);
      }
    }
    
    console.log('✅ Extension folder reordering test completed successfully!');
    console.log('🧪 Try dragging folders to insertion points to test the full functionality');
    
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Test global drag state functionality
function testGlobalDragState() {
  console.log('🧪 Testing global drag state functionality...');
  
  const folders = document.querySelectorAll('.folder-container');
  const insertionPoints = document.querySelectorAll('.insertion-point');
  
  if (folders.length === 0 || insertionPoints.length === 0) {
    console.error('❌ No folders or insertion points found');
    return;
  }
  
  // Simulate drag start on first folder
  const firstFolder = folders[0];
  const folderTitle = firstFolder.querySelector('.folder-title, h3, .folder-name')?.textContent;
  
  console.log(`🧪 Simulating drag start on "${folderTitle}"`);
  
  // Create drag event
  const dragStartEvent = new DragEvent('dragstart', {
    bubbles: true,
    cancelable: true,
    dataTransfer: new DataTransfer()
  });
  
  // Set drag data
  const dragData = {
    type: 'folder',
    id: 'test-folder',
    title: folderTitle,
    index: 0
  };
  
  dragStartEvent.dataTransfer.setData('application/x-favault-bookmark', JSON.stringify(dragData));
  
  // Dispatch drag start event
  firstFolder.dispatchEvent(dragStartEvent);
  
  // Check if global drag state is activated
  setTimeout(() => {
    const hasGlobalDragState = document.body.classList.contains('drag-active') ||
                              document.querySelector('.app.drag-active') !== null;
    
    if (hasGlobalDragState) {
      console.log('✅ Global drag state activated correctly');
      
      // Check if insertion points are visible
      const visibleInsertionPoints = Array.from(insertionPoints).filter(point => {
        const style = window.getComputedStyle(point);
        return parseFloat(style.height) > 20; // Should be expanded during drag
      });
      
      console.log(`📍 ${visibleInsertionPoints.length}/${insertionPoints.length} insertion points are visible during drag`);
      
      if (visibleInsertionPoints.length === insertionPoints.length) {
        console.log('✅ All insertion points visible during drag state');
      } else {
        console.warn(`⚠️ Only ${visibleInsertionPoints.length}/${insertionPoints.length} insertion points visible`);
      }
    } else {
      console.error('❌ Global drag state not activated');
    }
    
    // Simulate drag end
    const dragEndEvent = new DragEvent('dragend', {
      bubbles: true,
      cancelable: true
    });
    
    firstFolder.dispatchEvent(dragEndEvent);
    
    // Check if global drag state is deactivated
    setTimeout(() => {
      const stillHasDragState = document.body.classList.contains('drag-active') ||
                               document.querySelector('.app.drag-active') !== null;
      
      if (!stillHasDragState) {
        console.log('✅ Global drag state deactivated correctly');
      } else {
        console.error('❌ Global drag state not properly cleaned up');
      }
      
      console.log('🧪 Global drag state test completed');
    }, 100);
  }, 100);
}

// Test UI refresh mechanism specifically
function testUIRefreshMechanism() {
  console.log('🧪 Testing UI refresh mechanism...');

  // Check if loadBookmarks is exposed globally
  if (typeof window.loadBookmarks === 'function') {
    console.log('✅ Global loadBookmarks function found');

    // Test calling it directly
    console.log('🔄 Testing direct loadBookmarks call...');
    window.loadBookmarks().then(() => {
      console.log('✅ Direct loadBookmarks call successful');
    }).catch(error => {
      console.error('❌ Direct loadBookmarks call failed:', error);
    });
  } else {
    console.error('❌ Global loadBookmarks function not found');
  }

  // Test custom event mechanism
  console.log('🔄 Testing custom event refresh mechanism...');
  const refreshEvent = new CustomEvent('favault-refresh-bookmarks', {
    detail: { source: 'test', timestamp: Date.now() }
  });

  document.dispatchEvent(refreshEvent);
  console.log('✅ Custom refresh event dispatched');

  // Test EnhancedDragDropManager.refreshUI method
  if (typeof EnhancedDragDropManager !== 'undefined' &&
      typeof EnhancedDragDropManager.refreshUI === 'function') {
    console.log('🔄 Testing EnhancedDragDropManager.refreshUI...');

    EnhancedDragDropManager.refreshUI().then(result => {
      if (result) {
        console.log('✅ EnhancedDragDropManager.refreshUI successful');
      } else {
        console.error('❌ EnhancedDragDropManager.refreshUI returned false');
      }
    }).catch(error => {
      console.error('❌ EnhancedDragDropManager.refreshUI failed:', error);
    });
  } else {
    console.error('❌ EnhancedDragDropManager.refreshUI method not found');
  }
}

// Test the complete folder reordering flow with UI verification
async function testCompleteReorderingFlow() {
  console.log('🧪 Testing complete folder reordering flow...');

  try {
    // Ensure we're in edit mode
    const editToggle = document.querySelector('[data-testid="edit-mode-toggle"], .edit-mode-toggle, button[title*="edit"], button[title*="Edit"]');
    if (editToggle && !document.querySelector('.app.edit-mode')) {
      editToggle.click();
      await new Promise(resolve => setTimeout(resolve, 500));
    }

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

    console.log('📊 Initial order:', initialOrder);

    // Perform the move
    console.log('🔄 Moving first folder to last position...');
    const moveResult = await EnhancedDragDropManager.moveFolderToPosition(0, initialFolders.length);

    if (!moveResult.success) {
      console.error('❌ Move operation failed:', moveResult.error);
      return false;
    }

    console.log('✅ Move operation completed');

    // Wait for UI update
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify UI update
    const updatedFolders = Array.from(document.querySelectorAll('.folder-container'));
    const newOrder = updatedFolders.map(folder => {
      const title = folder.querySelector('.folder-title, h3, .folder-name')?.textContent;
      return title;
    });

    console.log('📊 New order:', newOrder);

    // Check if order changed
    const orderChanged = JSON.stringify(initialOrder) !== JSON.stringify(newOrder);

    if (orderChanged) {
      console.log('✅ COMPLETE SUCCESS: Folder reordering with UI update working!');

      // Verify the specific change
      const movedFolder = initialOrder[0];
      const newPosition = newOrder.indexOf(movedFolder);
      console.log(`📍 "${movedFolder}" moved from position 0 to position ${newPosition}`);

      return true;
    } else {
      console.error('❌ FAILURE: UI did not update after folder move');
      console.error('The Chrome bookmark API operation succeeded but Svelte UI is not refreshing');
      return false;
    }

  } catch (error) {
    console.error('❌ Complete reordering flow test failed:', error);
    return false;
  }
}

// Export test functions to global scope
window.testExtensionFolderReordering = testExtensionFolderReordering;
window.testGlobalDragState = testGlobalDragState;
window.testUIRefreshMechanism = testUIRefreshMechanism;
window.testCompleteReorderingFlow = testCompleteReorderingFlow;

console.log('🧪 Extension test functions loaded:');
console.log('  - testExtensionFolderReordering() - Comprehensive functionality test');
console.log('  - testGlobalDragState() - Test global drag state management');
console.log('  - testUIRefreshMechanism() - Test UI refresh mechanisms');
console.log('  - testCompleteReorderingFlow() - End-to-end reordering with UI verification');
console.log('');
console.log('🧪 Run testCompleteReorderingFlow() to test the complete UI refresh functionality');

// Auto-run UI refresh test if in extension context
if (window.location.href.includes('chrome-extension://') || window.location.href.includes('moz-extension://')) {
  setTimeout(() => {
    console.log('🧪 Auto-running UI refresh mechanism test...');
    testUIRefreshMechanism();

    setTimeout(() => {
      console.log('🧪 Auto-running complete reordering flow test...');
      testCompleteReorderingFlow();
    }, 3000);
  }, 2000);
}
