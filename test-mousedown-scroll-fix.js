// Test script for mousedown scroll prevention fix in FaVault extension
// Copy and paste this into the browser console when the extension is loaded

console.log('🧪 Testing FaVault Mousedown Scroll Prevention Fix...');

// Test function to verify mousedown scroll prevention works
async function testMousedownScrollPrevention() {
  console.log('🧪 Starting mousedown scroll prevention test...');
  
  try {
    // Check if enhanced drag-drop system is available
    if (typeof EnhancedDragDropManager === 'undefined') {
      console.error('❌ EnhancedDragDropManager not found');
      return false;
    }
    
    console.log('✅ Enhanced drag-drop system found');
    
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
    
    // Enable enhanced edit mode
    await EnhancedDragDropManager.enableEditMode();
    console.log('✅ Enhanced edit mode enabled');
    
    // Check for draggable items
    const bookmarkItems = document.querySelectorAll('.bookmark-item');
    const folderContainers = document.querySelectorAll('.folder-container');
    
    console.log(`📋 Found ${bookmarkItems.length} bookmark items`);
    console.log(`📁 Found ${folderContainers.length} folder containers`);
    
    if (bookmarkItems.length === 0 && folderContainers.length === 0) {
      console.error('❌ No draggable items found');
      return false;
    }
    
    // Test with bookmark items
    if (bookmarkItems.length > 0) {
      await testItemScrollPrevention(bookmarkItems[0], 'bookmark');
    }
    
    // Test with folder containers
    if (folderContainers.length > 0) {
      await testItemScrollPrevention(folderContainers[0], 'folder');
    }
    
    console.log('✅ Mousedown scroll prevention test completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Mousedown scroll prevention test failed:', error);
    return false;
  }
}

// Test scroll prevention for a specific item
async function testItemScrollPrevention(item, itemType) {
  console.log(`🧪 Testing ${itemType} scroll prevention...`);
  
  // Record initial scroll position
  const initialScrollX = window.scrollX;
  const initialScrollY = window.scrollY;
  console.log(`📍 Initial scroll position: (${initialScrollX}, ${initialScrollY})`);
  
  // Scroll to a different position to make the test more obvious
  window.scrollTo(0, 100);
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const testScrollX = window.scrollX;
  const testScrollY = window.scrollY;
  console.log(`📍 Test scroll position: (${testScrollX}, ${testScrollY})`);
  
  // Get item position and title
  const itemRect = item.getBoundingClientRect();
  const itemTitle = item.querySelector('.bookmark-title, .folder-title, h3')?.textContent || 'Unknown';
  
  console.log(`📋 Testing ${itemType}: "${itemTitle}"`);
  console.log(`📍 Item position: (${itemRect.left}, ${itemRect.top})`);
  
  // Simulate mousedown on the item
  const mousedownEvent = new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    clientX: itemRect.left + itemRect.width / 2,
    clientY: itemRect.top + itemRect.height / 2,
    button: 0
  });
  
  console.log('🖱️ Simulating mousedown event...');
  item.dispatchEvent(mousedownEvent);
  
  // Wait for any potential scrolling to occur
  await new Promise(resolve => setTimeout(resolve, 50));
  
  // Check if scroll position changed
  const afterMousedownScrollX = window.scrollX;
  const afterMousedownScrollY = window.scrollY;
  
  console.log(`📍 Scroll position after mousedown: (${afterMousedownScrollX}, ${afterMousedownScrollY})`);
  
  const scrollChanged = (afterMousedownScrollX !== testScrollX) || (afterMousedownScrollY !== testScrollY);
  
  if (scrollChanged) {
    console.warn(`⚠️ Scroll position changed on mousedown for ${itemType}: (${testScrollX}, ${testScrollY}) → (${afterMousedownScrollX}, ${afterMousedownScrollY})`);
    
    // Check if it was corrected back
    await new Promise(resolve => setTimeout(resolve, 50));
    const correctedScrollX = window.scrollX;
    const correctedScrollY = window.scrollY;
    
    if (correctedScrollX === testScrollX && correctedScrollY === testScrollY) {
      console.log(`✅ Scroll position was automatically corrected for ${itemType}`);
    } else {
      console.error(`❌ Scroll position was not corrected for ${itemType}: (${correctedScrollX}, ${correctedScrollY})`);
    }
  } else {
    console.log(`✅ No unwanted scrolling detected for ${itemType}`);
  }
  
  // Simulate mouseup to clean up
  const mouseupEvent = new MouseEvent('mouseup', {
    bubbles: true,
    cancelable: true,
    clientX: itemRect.left + itemRect.width / 2,
    clientY: itemRect.top + itemRect.height / 2,
    button: 0
  });
  
  item.dispatchEvent(mouseupEvent);
  
  // Restore original scroll position
  window.scrollTo(initialScrollX, initialScrollY);
  await new Promise(resolve => setTimeout(resolve, 100));
}

// Test that normal scrolling still works
async function testNormalScrollingStillWorks() {
  console.log('🧪 Testing that normal scrolling still works...');
  
  const initialScrollY = window.scrollY;
  
  // Test programmatic scrolling
  window.scrollTo(0, 200);
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const afterProgrammaticScrollY = window.scrollY;
  
  if (afterProgrammaticScrollY === 200) {
    console.log('✅ Programmatic scrolling works correctly');
  } else {
    console.warn(`⚠️ Programmatic scrolling may be affected: expected 200, got ${afterProgrammaticScrollY}`);
  }
  
  // Test wheel scrolling simulation
  const wheelEvent = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    deltaY: 100
  });
  
  document.dispatchEvent(wheelEvent);
  await new Promise(resolve => setTimeout(resolve, 100));
  
  console.log('✅ Wheel event dispatched (manual verification needed)');
  
  // Restore original position
  window.scrollTo(0, initialScrollY);
}

// Export test functions to global scope
window.testMousedownScrollPrevention = testMousedownScrollPrevention;
window.testNormalScrollingStillWorks = testNormalScrollingStillWorks;

console.log('🧪 Mousedown scroll prevention test functions loaded:');
console.log('  - testMousedownScrollPrevention() - Test mousedown scroll prevention');
console.log('  - testNormalScrollingStillWorks() - Test that normal scrolling still works');
console.log('');
console.log('🧪 Run testMousedownScrollPrevention() to start testing');

// Auto-run test if in extension context
if (window.location.href.includes('chrome-extension://') || window.location.href.includes('moz-extension://')) {
  setTimeout(() => {
    console.log('🧪 Auto-running mousedown scroll prevention test...');
    testMousedownScrollPrevention();
  }, 2000);
}
