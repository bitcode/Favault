// Test script for drop zone functionality in FaVault extension
// Copy and paste this into the browser console when the extension is loaded

console.log('🧪 Testing FaVault Drop Zone Functionality...');

// Test function to verify drop zones are working correctly
async function testDropZoneFunctionality() {
  console.log('🧪 Starting drop zone functionality test...');
  
  try {
    // Check if we're in the extension context
    if (!window.location.href.includes('chrome-extension://') && !window.location.href.includes('moz-extension://')) {
      console.error('❌ This test should be run in the extension context');
      return false;
    }
    
    console.log('✅ Extension context confirmed');
    
    // Wait for DOM to be ready
    await new Promise(resolve => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resolve);
      } else {
        resolve();
      }
    });
    
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
    
    // Enable enhanced drag-drop
    await EnhancedDragDropManager.enableEditMode();
    console.log('✅ Enhanced edit mode enabled');
    
    // Check for insertion points
    const insertionPoints = document.querySelectorAll('.insertion-point');
    console.log(`📍 Found ${insertionPoints.length} insertion points`);
    
    if (insertionPoints.length === 0) {
      console.error('❌ No insertion points found');
      return false;
    }
    
    // Check for folder containers
    const folders = document.querySelectorAll('.folder-container');
    console.log(`📁 Found ${folders.length} folder containers`);
    
    if (folders.length === 0) {
      console.error('❌ No folder containers found');
      return false;
    }
    
    // Test insertion point attributes
    insertionPoints.forEach((point, index) => {
      const insertionIndex = point.getAttribute('data-insertion-index');
      const dropZone = point.getAttribute('data-drop-zone');
      
      console.log(`📍 Insertion point ${index}: insertion-index=${insertionIndex}, drop-zone=${dropZone}`);
      
      // Check if event listeners are attached
      const hasListeners = point.hasAttribute('data-drop-zone');
      if (hasListeners) {
        console.log(`✅ Insertion point ${index} has drop zone attributes`);
      } else {
        console.warn(`⚠️ Insertion point ${index} missing drop zone attributes`);
      }
    });
    
    // Test drag data format
    console.log('🧪 Testing drag data format...');
    const firstFolder = folders[0];
    if (firstFolder) {
      const folderTitle = firstFolder.querySelector('.folder-title, h3, .folder-name')?.textContent;
      console.log(`📁 Testing drag data for folder: "${folderTitle}"`);
      
      // Simulate drag start to check data format
      const dragStartEvent = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer()
      });
      
      firstFolder.dispatchEvent(dragStartEvent);
      
      // Check if drag data was set
      setTimeout(() => {
        console.log('✅ Drag start event dispatched');
      }, 100);
    }
    
    console.log('✅ Drop zone functionality test completed');
    return true;
    
  } catch (error) {
    console.error('❌ Drop zone test failed:', error);
    return false;
  }
}

// Test drag and drop simulation with proper data formats
function testDragDropSimulation() {
  console.log('🧪 Testing drag and drop simulation...');
  
  const folders = document.querySelectorAll('.folder-container');
  const insertionPoints = document.querySelectorAll('.insertion-point');
  
  if (folders.length === 0 || insertionPoints.length === 0) {
    console.error('❌ No folders or insertion points found');
    return;
  }
  
  const firstFolder = folders[0];
  const firstInsertionPoint = insertionPoints[1]; // Use second insertion point
  
  const folderTitle = firstFolder.querySelector('.folder-title, h3, .folder-name')?.textContent;
  const insertionIndex = firstInsertionPoint.getAttribute('data-insertion-index');
  
  console.log(`🧪 Simulating drag from "${folderTitle}" to insertion point ${insertionIndex}`);
  
  // Create proper drag data
  const dragData = {
    type: 'folder',
    id: 'test-folder-id',
    title: folderTitle,
    index: 0
  };
  
  // Simulate drag start
  const dragStartEvent = new DragEvent('dragstart', {
    bubbles: true,
    cancelable: true,
    dataTransfer: new DataTransfer()
  });
  
  // Set both data formats
  const dragDataStr = JSON.stringify(dragData);
  dragStartEvent.dataTransfer.setData('text/plain', dragDataStr);
  dragStartEvent.dataTransfer.setData('application/x-favault-bookmark', dragDataStr);
  dragStartEvent.dataTransfer.effectAllowed = 'move';
  
  firstFolder.dispatchEvent(dragStartEvent);
  console.log('✅ Drag start simulated with proper data formats');
  
  // Simulate drag over insertion point
  setTimeout(() => {
    const dragOverEvent = new DragEvent('dragover', {
      bubbles: true,
      cancelable: true,
      dataTransfer: dragStartEvent.dataTransfer
    });
    
    firstInsertionPoint.dispatchEvent(dragOverEvent);
    console.log('✅ Drag over insertion point simulated');
    
    // Check if drop effect is set correctly
    if (dragOverEvent.dataTransfer.dropEffect === 'move') {
      console.log('✅ Drop effect set to "move" - drop should be allowed');
    } else {
      console.error('❌ Drop effect not set correctly:', dragOverEvent.dataTransfer.dropEffect);
    }
    
    // Simulate drop
    setTimeout(() => {
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dragStartEvent.dataTransfer
      });
      
      firstInsertionPoint.dispatchEvent(dropEvent);
      console.log('✅ Drop event simulated');
      
      // Simulate drag end
      setTimeout(() => {
        const dragEndEvent = new DragEvent('dragend', {
          bubbles: true,
          cancelable: true
        });
        
        firstFolder.dispatchEvent(dragEndEvent);
        console.log('✅ Drag end simulated');
        console.log('🧪 Complete drag and drop simulation finished');
      }, 100);
    }, 500);
  }, 500);
}

// Test insertion point event listeners
function testInsertionPointListeners() {
  console.log('🧪 Testing insertion point event listeners...');
  
  const insertionPoints = document.querySelectorAll('.insertion-point');
  
  if (insertionPoints.length === 0) {
    console.error('❌ No insertion points found');
    return;
  }
  
  insertionPoints.forEach((point, index) => {
    const insertionIndex = point.getAttribute('data-insertion-index');
    
    console.log(`📍 Testing insertion point ${index} (insertion-index: ${insertionIndex})`);
    
    // Test dragover event
    const dragOverEvent = new DragEvent('dragover', {
      bubbles: true,
      cancelable: true,
      dataTransfer: new DataTransfer()
    });
    
    // Set test data
    dragOverEvent.dataTransfer.setData('application/x-favault-bookmark', JSON.stringify({
      type: 'folder',
      title: 'Test Folder',
      index: 0
    }));
    
    let dragOverHandled = false;
    const originalPreventDefault = dragOverEvent.preventDefault;
    dragOverEvent.preventDefault = function() {
      dragOverHandled = true;
      originalPreventDefault.call(this);
    };
    
    point.dispatchEvent(dragOverEvent);
    
    if (dragOverHandled) {
      console.log(`✅ Insertion point ${index} handled dragover event`);
    } else {
      console.error(`❌ Insertion point ${index} did not handle dragover event`);
    }
    
    // Check drop effect
    if (dragOverEvent.dataTransfer.dropEffect === 'move') {
      console.log(`✅ Insertion point ${index} set correct drop effect`);
    } else {
      console.warn(`⚠️ Insertion point ${index} drop effect:`, dragOverEvent.dataTransfer.dropEffect);
    }
  });
  
  console.log('✅ Insertion point listeners test completed');
}

// Export test functions to global scope
window.testDropZoneFunctionality = testDropZoneFunctionality;
window.testDragDropSimulation = testDragDropSimulation;
window.testInsertionPointListeners = testInsertionPointListeners;

console.log('🧪 Drop zone test functions loaded:');
console.log('  - testDropZoneFunctionality() - Comprehensive drop zone test');
console.log('  - testDragDropSimulation() - Simulate complete drag and drop');
console.log('  - testInsertionPointListeners() - Test event listener setup');
console.log('');
console.log('🧪 Run testDropZoneFunctionality() to start testing');

// Auto-run drop zone test if in extension context
if (window.location.href.includes('chrome-extension://') || window.location.href.includes('moz-extension://')) {
  setTimeout(() => {
    console.log('🧪 Auto-running drop zone functionality test...');
    testDropZoneFunctionality();
    
    setTimeout(() => {
      console.log('🧪 Auto-running insertion point listeners test...');
      testInsertionPointListeners();
    }, 2000);
  }, 2000);
}
