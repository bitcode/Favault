// Test script for folder reordering with insertion points
// Run this in the browser console after loading the extension

console.log('🧪 Testing folder reordering with insertion points...');

// Test function to verify insertion points are working
async function testFolderReordering() {
  console.log('🧪 Starting folder reordering test...');
  
  try {
    // Check if enhanced drag-drop is available
    if (typeof EnhancedDragDropManager === 'undefined') {
      console.error('❌ EnhancedDragDropManager not found');
      return false;
    }
    
    // Initialize the system
    const initResult = await EnhancedDragDropManager.initialize();
    if (!initResult.success) {
      console.error('❌ Failed to initialize enhanced drag-drop:', initResult.error);
      return false;
    }
    
    console.log('✅ Enhanced drag-drop system initialized');
    
    // Enable edit mode
    await EnhancedDragDropManager.enableEditMode();
    console.log('✅ Edit mode enabled');
    
    // Check for insertion points in the DOM
    const insertionPoints = document.querySelectorAll('.insertion-point');
    console.log(`📍 Found ${insertionPoints.length} insertion points`);
    
    if (insertionPoints.length === 0) {
      console.warn('⚠️ No insertion points found - make sure edit mode is active');
      return false;
    }
    
    // Check for folder containers
    const folders = document.querySelectorAll('.folder-container');
    console.log(`📁 Found ${folders.length} folder containers`);
    
    if (folders.length === 0) {
      console.warn('⚠️ No folders found');
      return false;
    }
    
    // Verify insertion points are positioned correctly
    insertionPoints.forEach((point, index) => {
      const insertionIndex = point.getAttribute('data-insertion-index');
      console.log(`📍 Insertion point ${index}: insertion-index=${insertionIndex}`);
    });
    
    // Test the moveFolderToPosition function
    if (folders.length >= 2) {
      console.log('🧪 Testing moveFolderToPosition function...');
      
      // Get current folder state
      await showState();
      
      console.log('🧪 Test completed - check insertion points are visible and functional');
      console.log('🧪 Try dragging a folder to an insertion point to test reordering');
      
      return true;
    } else {
      console.warn('⚠️ Need at least 2 folders to test reordering');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Test insertion point visibility
function testInsertionPointVisibility() {
  console.log('🧪 Testing insertion point visibility...');
  
  const insertionPoints = document.querySelectorAll('.insertion-point');
  
  insertionPoints.forEach((point, index) => {
    const rect = point.getBoundingClientRect();
    const isVisible = rect.height > 0 && rect.width > 0;
    const insertionIndex = point.getAttribute('data-insertion-index');
    
    console.log(`📍 Insertion point ${index} (index=${insertionIndex}): ${isVisible ? 'VISIBLE' : 'HIDDEN'} (${rect.height}px height)`);
    
    // Temporarily highlight the insertion point
    if (isVisible) {
      point.style.background = 'rgba(255, 0, 0, 0.3)';
      point.style.border = '2px solid red';
      setTimeout(() => {
        point.style.background = '';
        point.style.border = '';
      }, 2000);
    }
  });
}

// Test drag simulation
function simulateFolderDrag() {
  console.log('🧪 Simulating folder drag to test insertion points...');
  
  const folders = document.querySelectorAll('.folder-container');
  const insertionPoints = document.querySelectorAll('.insertion-point');
  
  if (folders.length === 0 || insertionPoints.length === 0) {
    console.error('❌ No folders or insertion points found');
    return;
  }
  
  // Simulate drag start on first folder
  const firstFolder = folders[0];
  const dragEvent = new DragEvent('dragstart', {
    bubbles: true,
    cancelable: true,
    dataTransfer: new DataTransfer()
  });
  
  // Set drag data
  const dragData = {
    type: 'folder',
    id: 'test-folder',
    title: 'Test Folder',
    index: 0
  };
  
  dragEvent.dataTransfer?.setData('application/x-favault-bookmark', JSON.stringify(dragData));
  
  firstFolder.dispatchEvent(dragEvent);
  console.log('🧪 Simulated drag start on first folder');
  
  // Highlight insertion points during drag
  insertionPoints.forEach(point => {
    point.classList.add('drag-over');
  });
  
  setTimeout(() => {
    insertionPoints.forEach(point => {
      point.classList.remove('drag-over');
    });
    console.log('🧪 Drag simulation completed');
  }, 3000);
}

// Export test functions to global scope
window.testFolderReordering = testFolderReordering;
window.testInsertionPointVisibility = testInsertionPointVisibility;
window.simulateFolderDrag = simulateFolderDrag;

console.log('🧪 Test functions loaded:');
console.log('  - testFolderReordering()');
console.log('  - testInsertionPointVisibility()');
console.log('  - simulateFolderDrag()');
console.log('');
console.log('🧪 Run testFolderReordering() to start testing');
