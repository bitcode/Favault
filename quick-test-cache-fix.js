/**
 * Quick test to verify the automatic cache invalidation fix
 * 
 * This script will:
 * 1. Show current state
 * 2. Perform a test move
 * 3. Wait for automatic UI refresh
 * 4. Verify the UI updated correctly
 * 
 * Copy and paste this into the browser console
 */

console.log('🧪 Quick Cache Invalidation Fix Test');

async function quickTest() {
  try {
    console.log('\n📊 Step 1: Show initial state');
    await showState();
    
    console.log('\n🔄 Step 2: Perform test move (4 → 2)');
    const moveResult = await testMove(4, 2);
    console.log('Move result:', moveResult);
    
    console.log('\n⏳ Step 3: Wait 3 seconds for automatic UI refresh...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n📊 Step 4: Check if UI updated automatically');
    
    // Get Chrome state
    const chromeChildren = await chrome.bookmarks.getChildren('1');
    const chromeFolders = chromeChildren.filter(child => !child.url);
    
    // Get UI state
    const uiElements = document.querySelectorAll('.folder-container');
    const uiFolders = Array.from(uiElements).map(el => {
      const titleEl = el.querySelector('.folder-title, h3, .folder-name');
      return titleEl ? titleEl.textContent.trim() : 'Unknown';
    });
    
    console.log('Chrome order:', chromeFolders.map(f => f.title));
    console.log('UI order:', uiFolders);
    
    // Check if they match
    const match = chromeFolders.length === uiFolders.length && 
                  chromeFolders.every((folder, index) => folder.title === uiFolders[index]);
    
    if (match) {
      console.log('✅ SUCCESS: UI automatically updated to match Chrome bookmarks!');
      console.log('🎉 The automatic cache invalidation fix is working!');
    } else {
      console.log('❌ ISSUE: UI did not automatically update');
      console.log('💡 Try manually refreshing with: refreshBookmarks()');
    }
    
    return { success: match, chromeOrder: chromeFolders.map(f => f.title), uiOrder: uiFolders };
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return { success: false, error: error.message };
  }
}

// Run the test
console.log('🚀 Running quick test...');
quickTest().then(result => {
  console.log('\n📋 Test completed:', result);
});

// Also expose for manual use
window.quickCacheTest = quickTest;
