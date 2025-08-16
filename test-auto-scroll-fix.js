// Test script for auto-scroll prevention in FaVault extension
// Copy and paste this into the browser console when the extension is loaded

console.log('🧪 Testing FaVault Auto-Scroll Prevention...');

// Test function to verify auto-scroll is prevented during drag operations
async function testAutoScrollPrevention() {
  console.log('🧪 Starting auto-scroll prevention test...');
  
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
    
    // Check for folders
    const folders = document.querySelectorAll('.folder-container');
    console.log(`📁 Found ${folders.length} folder containers`);
    
    if (folders.length === 0) {
      console.error('❌ No folder containers found');
      return false;
    }
    
    // Record initial scroll position
    const initialScrollX = window.scrollX;
    const initialScrollY = window.scrollY;
    console.log(`📍 Initial scroll position: (${initialScrollX}, ${initialScrollY})`);
    
    // Test auto-scroll prevention
    console.log('🧪 Testing auto-scroll prevention during drag...');
    
    const firstFolder = folders[0];
    const folderTitle = firstFolder.querySelector('.folder-title, h3, .folder-name')?.textContent;
    
    console.log(`📁 Testing with folder: "${folderTitle}"`);
    
    // Simulate drag start
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
    
    const dragDataStr = JSON.stringify(dragData);
    dragStartEvent.dataTransfer.setData('text/plain', dragDataStr);
    dragStartEvent.dataTransfer.setData('application/x-favault-bookmark', dragDataStr);
    
    firstFolder.dispatchEvent(dragStartEvent);
    console.log('✅ Drag start event dispatched');
    
    // Wait for drag state to be applied
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check if drag-active classes are applied
    const bodyHasDragActive = document.body.classList.contains('drag-active');
    const appHasDragActive = document.querySelector('.app')?.classList.contains('drag-active');
    
    console.log(`🎯 Body has drag-active: ${bodyHasDragActive}`);
    console.log(`🎯 App has drag-active: ${appHasDragActive}`);
    
    if (!bodyHasDragActive || !appHasDragActive) {
      console.warn('⚠️ Drag-active classes not properly applied');
    }
    
    // Check scroll behavior CSS
    const bodyScrollBehavior = window.getComputedStyle(document.body).scrollBehavior;
    const htmlScrollBehavior = window.getComputedStyle(document.documentElement).scrollBehavior;
    
    console.log(`📜 Body scroll-behavior: ${bodyScrollBehavior}`);
    console.log(`📜 HTML scroll-behavior: ${htmlScrollBehavior}`);
    
    // Check if scroll position changed unexpectedly
    const currentScrollX = window.scrollX;
    const currentScrollY = window.scrollY;
    
    console.log(`📍 Current scroll position: (${currentScrollX}, ${currentScrollY})`);
    
    const scrollChanged = (currentScrollX !== initialScrollX) || (currentScrollY !== initialScrollY);
    
    if (scrollChanged) {
      console.warn(`⚠️ Scroll position changed during drag start: (${initialScrollX}, ${initialScrollY}) → (${currentScrollX}, ${currentScrollY})`);
    } else {
      console.log('✅ Scroll position remained stable during drag start');
    }
    
    // Test programmatic scroll prevention
    console.log('🧪 Testing programmatic scroll prevention...');
    
    const scrollBeforeTest = { x: window.scrollX, y: window.scrollY };
    
    // Try to programmatically scroll (this should be prevented)
    window.scrollTo(0, 100);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const scrollAfterTest = { x: window.scrollX, y: window.scrollY };
    
    if (scrollAfterTest.x === scrollBeforeTest.x && scrollAfterTest.y === scrollBeforeTest.y) {
      console.log('✅ Programmatic scrolling successfully prevented');
    } else {
      console.warn(`⚠️ Programmatic scrolling not prevented: (${scrollBeforeTest.x}, ${scrollBeforeTest.y}) → (${scrollAfterTest.x}, ${scrollAfterTest.y})`);
    }
    
    // Simulate drag end
    const dragEndEvent = new DragEvent('dragend', {
      bubbles: true,
      cancelable: true
    });
    
    firstFolder.dispatchEvent(dragEndEvent);
    console.log('✅ Drag end event dispatched');
    
    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check if drag-active classes are removed
    const bodyStillHasDragActive = document.body.classList.contains('drag-active');
    const appStillHasDragActive = document.querySelector('.app')?.classList.contains('drag-active');
    
    console.log(`🎯 Body still has drag-active: ${bodyStillHasDragActive}`);
    console.log(`🎯 App still has drag-active: ${appStillHasDragActive}`);
    
    if (bodyStillHasDragActive || appStillHasDragActive) {
      console.warn('⚠️ Drag-active classes not properly cleaned up');
    } else {
      console.log('✅ Drag-active classes properly cleaned up');
    }
    
    // Test that normal scrolling is restored
    console.log('🧪 Testing that normal scrolling is restored...');
    
    const scrollBeforeRestore = { x: window.scrollX, y: window.scrollY };
    
    // Try to programmatically scroll (this should now work)
    window.scrollTo(0, 50);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const scrollAfterRestore = { x: window.scrollX, y: window.scrollY };
    
    if (scrollAfterRestore.y === 50) {
      console.log('✅ Normal scrolling restored after drag end');
      // Restore original position
      window.scrollTo(initialScrollX, initialScrollY);
    } else {
      console.warn(`⚠️ Normal scrolling not properly restored: expected y=50, got y=${scrollAfterRestore.y}`);
    }
    
    console.log('✅ Auto-scroll prevention test completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Auto-scroll prevention test failed:', error);
    return false;
  }
}

// Test insertion point visibility without auto-scroll
function testInsertionPointVisibilityWithoutScroll() {
  console.log('🧪 Testing insertion point visibility without auto-scroll...');
  
  const folders = document.querySelectorAll('.folder-container');
  const insertionPoints = document.querySelectorAll('.insertion-point');
  
  if (folders.length === 0 || insertionPoints.length === 0) {
    console.error('❌ No folders or insertion points found');
    return;
  }
  
  const initialScrollPosition = { x: window.scrollX, y: window.scrollY };
  console.log(`📍 Initial scroll position: (${initialScrollPosition.x}, ${initialScrollPosition.y})`);
  
  // Simulate drag start to make insertion points visible
  const firstFolder = folders[0];
  const dragStartEvent = new DragEvent('dragstart', {
    bubbles: true,
    cancelable: true,
    dataTransfer: new DataTransfer()
  });
  
  const dragData = {
    type: 'folder',
    title: 'Test Folder',
    index: 0
  };
  
  const dragDataStr = JSON.stringify(dragData);
  dragStartEvent.dataTransfer.setData('application/x-favault-bookmark', dragDataStr);
  
  firstFolder.dispatchEvent(dragStartEvent);
  
  setTimeout(() => {
    // Check if insertion points became visible
    let visibleInsertionPoints = 0;
    insertionPoints.forEach((point, index) => {
      const style = window.getComputedStyle(point);
      const height = parseFloat(style.height);
      const opacity = parseFloat(style.opacity);
      
      if (height > 20 && opacity > 0.5) {
        visibleInsertionPoints++;
        console.log(`📍 Insertion point ${index} is visible: height=${height}px, opacity=${opacity}`);
      }
    });
    
    console.log(`📍 ${visibleInsertionPoints}/${insertionPoints.length} insertion points are visible`);
    
    // Check if scroll position changed
    const currentScrollPosition = { x: window.scrollX, y: window.scrollY };
    const scrollChanged = (currentScrollPosition.x !== initialScrollPosition.x) || 
                         (currentScrollPosition.y !== initialScrollPosition.y);
    
    if (scrollChanged) {
      console.warn(`⚠️ Scroll position changed when insertion points became visible: (${initialScrollPosition.x}, ${initialScrollPosition.y}) → (${currentScrollPosition.x}, ${currentScrollPosition.y})`);
    } else {
      console.log('✅ Scroll position remained stable when insertion points became visible');
    }
    
    // Clean up
    const dragEndEvent = new DragEvent('dragend', { bubbles: true });
    firstFolder.dispatchEvent(dragEndEvent);
    
    console.log('✅ Insertion point visibility test completed');
  }, 500);
}

// Export test functions to global scope
window.testAutoScrollPrevention = testAutoScrollPrevention;
window.testInsertionPointVisibilityWithoutScroll = testInsertionPointVisibilityWithoutScroll;

console.log('🧪 Auto-scroll prevention test functions loaded:');
console.log('  - testAutoScrollPrevention() - Comprehensive auto-scroll prevention test');
console.log('  - testInsertionPointVisibilityWithoutScroll() - Test insertion points without scroll');
console.log('');
console.log('🧪 Run testAutoScrollPrevention() to start testing');

// Auto-run test if in extension context
if (window.location.href.includes('chrome-extension://') || window.location.href.includes('moz-extension://')) {
  setTimeout(() => {
    console.log('🧪 Auto-running auto-scroll prevention test...');
    testAutoScrollPrevention();
  }, 2000);
}
