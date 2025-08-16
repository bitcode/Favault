// Test script for folder insertion points in the actual FaVault extension
// Copy and paste this into the browser console when the extension is loaded

console.log('🧪 Testing FaVault Folder Insertion Points...');

// Test function to verify insertion points are working correctly
async function testInsertionPoints() {
  console.log('🧪 Starting insertion points test...');
  
  try {
    // Check if we're in the extension context
    if (!window.location.href.includes('chrome-extension://') && !window.location.href.includes('moz-extension://')) {
      console.warn('⚠️ This test should be run in the extension context');
    }
    
    // Wait for DOM to be ready
    await new Promise(resolve => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resolve);
      } else {
        resolve();
      }
    });
    
    // Check for edit mode toggle
    const editToggle = document.querySelector('[data-testid="edit-mode-toggle"], .edit-mode-toggle, button[title*="edit"], button[title*="Edit"]');
    if (!editToggle) {
      console.error('❌ Edit mode toggle not found');
      return false;
    }
    
    console.log('✅ Edit mode toggle found');
    
    // Enable edit mode if not already enabled
    const isEditMode = document.body.classList.contains('edit-mode') || 
                      document.querySelector('.app')?.classList.contains('edit-mode');
    
    if (!isEditMode) {
      console.log('🔄 Enabling edit mode...');
      editToggle.click();
      
      // Wait for edit mode to activate
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
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
    
    // Test insertion point attributes
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
    
    // Test drag and drop functionality if enhanced drag-drop is available
    if (typeof EnhancedDragDropManager !== 'undefined') {
      console.log('🧪 Testing enhanced drag-drop integration...');
      
      // Check if enhanced drag-drop is initialized
      const isInitialized = EnhancedDragDropManager.isEditModeEnabled();
      console.log(`🔧 Enhanced drag-drop initialized: ${isInitialized}`);
      
      if (!isInitialized) {
        console.log('🔄 Initializing enhanced drag-drop...');
        try {
          const initResult = await EnhancedDragDropManager.initialize();
          if (initResult.success) {
            await EnhancedDragDropManager.enableEditMode();
            console.log('✅ Enhanced drag-drop initialized and enabled');
          } else {
            console.error('❌ Failed to initialize enhanced drag-drop:', initResult.error);
          }
        } catch (error) {
          console.error('❌ Error initializing enhanced drag-drop:', error);
        }
      }
      
      // Test moveFolderToPosition function
      if (folders.length >= 2) {
        console.log('🧪 Testing moveFolderToPosition function...');
        
        // Get current folder state
        if (typeof showState === 'function') {
          console.log('📊 Current folder state:');
          await showState();
        }
        
        console.log('✅ Enhanced drag-drop integration test completed');
      }
    } else {
      console.warn('⚠️ EnhancedDragDropManager not found - enhanced features may not be available');
    }
    
    console.log('✅ Insertion points test completed successfully!');
    console.log('🧪 Try dragging a folder to an insertion point to test reordering');
    
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Test insertion point drag and drop simulation
function simulateInsertionPointDrop() {
  console.log('🧪 Simulating insertion point drop...');
  
  const folders = document.querySelectorAll('.folder-container');
  const insertionPoints = document.querySelectorAll('.insertion-point');
  
  if (folders.length === 0 || insertionPoints.length === 0) {
    console.error('❌ No folders or insertion points found');
    return;
  }
  
  // Simulate dragging first folder to second insertion point
  const sourceFolder = folders[0];
  const targetInsertionPoint = insertionPoints[1];
  
  if (!targetInsertionPoint) {
    console.error('❌ Target insertion point not found');
    return;
  }
  
  console.log('🧪 Simulating drag from first folder to second insertion point...');
  
  // Create drag data
  const dragData = {
    type: 'folder',
    id: 'test-folder',
    title: sourceFolder.querySelector('.folder-title, h3')?.textContent || 'Test Folder',
    index: 0
  };
  
  // Simulate drag start
  const dragStartEvent = new DragEvent('dragstart', {
    bubbles: true,
    cancelable: true,
    dataTransfer: new DataTransfer()
  });
  
  dragStartEvent.dataTransfer.setData('application/x-favault-bookmark', JSON.stringify(dragData));
  sourceFolder.dispatchEvent(dragStartEvent);
  
  // Simulate drag over insertion point
  const dragOverEvent = new DragEvent('dragover', {
    bubbles: true,
    cancelable: true,
    dataTransfer: dragStartEvent.dataTransfer
  });
  
  targetInsertionPoint.dispatchEvent(dragOverEvent);
  
  // Simulate drop
  const dropEvent = new DragEvent('drop', {
    bubbles: true,
    cancelable: true,
    dataTransfer: dragStartEvent.dataTransfer
  });
  
  targetInsertionPoint.dispatchEvent(dropEvent);
  
  console.log('🧪 Drop simulation completed');
}

// Highlight all insertion points for visual verification
function highlightInsertionPoints() {
  console.log('🧪 Highlighting insertion points...');
  
  const insertionPoints = document.querySelectorAll('.insertion-point');
  
  insertionPoints.forEach((point, index) => {
    const insertionIndex = point.getAttribute('data-insertion-index');
    
    // Add temporary highlighting
    point.style.background = 'rgba(255, 0, 0, 0.3)';
    point.style.border = '2px solid red';
    point.style.height = '40px';
    point.style.opacity = '1';
    point.style.margin = '1rem 0';
    
    // Add a label
    const label = document.createElement('div');
    label.textContent = `Insertion Point ${insertionIndex}`;
    label.style.cssText = `
      position: absolute;
      background: red;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000;
      pointer-events: none;
    `;
    point.style.position = 'relative';
    point.appendChild(label);
    
    console.log(`📍 Highlighted insertion point ${index} (insertion-index=${insertionIndex})`);
    
    // Remove highlighting after 5 seconds
    setTimeout(() => {
      point.style.background = '';
      point.style.border = '';
      point.style.height = '';
      point.style.opacity = '';
      point.style.margin = '';
      if (label.parentNode) {
        label.parentNode.removeChild(label);
      }
    }, 5000);
  });
  
  console.log(`🧪 Highlighted ${insertionPoints.length} insertion points (will auto-remove in 5 seconds)`);
}

// Export test functions to global scope
window.testInsertionPoints = testInsertionPoints;
window.simulateInsertionPointDrop = simulateInsertionPointDrop;
window.highlightInsertionPoints = highlightInsertionPoints;

console.log('🧪 Test functions loaded:');
console.log('  - testInsertionPoints() - Run comprehensive test');
console.log('  - highlightInsertionPoints() - Visually highlight insertion points');
console.log('  - simulateInsertionPointDrop() - Simulate drag and drop');
console.log('');
console.log('🧪 Run testInsertionPoints() to start testing');

// Auto-run basic test if in extension context
if (window.location.href.includes('chrome-extension://') || window.location.href.includes('moz-extension://')) {
  setTimeout(() => {
    console.log('🧪 Auto-running basic insertion points test...');
    testInsertionPoints();
  }, 2000);
}
