/**
 * Manual Positioning Accuracy Test Script
 * 
 * This script can be run in the browser console to manually test
 * the positioning accuracy fixes we implemented.
 */

console.log('🎯 MANUAL POSITIONING ACCURACY TEST');
console.log('===================================');

// Test the positioning accuracy fix
async function testPositioningAccuracy() {
  console.log('📋 Starting positioning accuracy test...');
  
  // Step 1: Check if we're in edit mode
  const editToggle = document.querySelector('.edit-toggle');
  if (!editToggle) {
    console.error('❌ Edit toggle not found');
    return;
  }
  
  const isEditMode = document.body.classList.contains('edit-mode') || 
                    document.querySelector('.app')?.classList.contains('edit-mode');
  
  if (!isEditMode) {
    console.log('🔄 Enabling edit mode...');
    editToggle.click();
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Step 2: Check insertion points
  const insertionPoints = document.querySelectorAll('.insertion-point');
  const folders = document.querySelectorAll('.folder-container');
  
  console.log(`📍 Found ${insertionPoints.length} insertion points`);
  console.log(`📁 Found ${folders.length} folders`);
  
  if (insertionPoints.length === 0) {
    console.error('❌ No insertion points found');
    return;
  }
  
  if (folders.length < 3) {
    console.error('❌ Need at least 3 folders for testing');
    return;
  }
  
  // Step 3: Test the positioning logic
  console.log('📋 Testing positioning logic...');
  
  const testScenarios = [
    { from: 0, to: 2, description: 'Move first folder to position 2' },
    { from: 2, to: 0, description: 'Move folder back to position 0' }
  ];
  
  for (const scenario of testScenarios) {
    const { from, to, description } = scenario;
    
    console.log(`🎯 Testing: ${description}`);
    
    // Get current folder order
    const beforeFolders = Array.from(document.querySelectorAll('.folder-container'));
    const beforeTitles = beforeFolders.map(f => f.querySelector('.folder-title')?.textContent || 'Unknown');
    
    console.log(`  Before: ${beforeTitles.join(', ')}`);
    
    // Test the move using EnhancedDragDropManager
    if (typeof window.EnhancedDragDropManager?.moveFolderToPosition === 'function') {
      try {
        const result = await window.EnhancedDragDropManager.moveFolderToPosition(from, to);
        
        if (result.success) {
          // Wait for UI to update
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Get new folder order
          const afterFolders = Array.from(document.querySelectorAll('.folder-container'));
          const afterTitles = afterFolders.map(f => f.querySelector('.folder-title')?.textContent || 'Unknown');
          
          console.log(`  After:  ${afterTitles.join(', ')}`);
          
          // Check if the folder is at the expected position
          const movedFolderTitle = beforeTitles[from];
          const actualPosition = afterTitles.indexOf(movedFolderTitle);
          const expectedPosition = to;
          
          console.log(`  Expected position: ${expectedPosition + 1} (${movedFolderTitle})`);
          console.log(`  Actual position: ${actualPosition + 1} (${movedFolderTitle})`);
          
          if (actualPosition === expectedPosition) {
            console.log(`  ✅ SUCCESS: Perfect positioning accuracy!`);
          } else {
            console.log(`  ❌ ISSUE: Position mismatch (expected ${expectedPosition}, got ${actualPosition})`);
          }
        } else {
          console.log(`  ❌ Move failed: ${result.error}`);
        }
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
      }
    } else {
      console.log('  ❌ EnhancedDragDropManager.moveFolderToPosition not available');
    }
    
    console.log('');
  }
  
  console.log('🎉 POSITIONING ACCURACY TEST COMPLETE!');
}

// Run the test
testPositioningAccuracy().catch(console.error);

// Also provide a simple function to test specific moves
window.testMove = async function(from, to) {
  console.log(`🎯 Testing move from ${from} to ${to}...`);
  
  if (typeof window.EnhancedDragDropManager?.moveFolderToPosition === 'function') {
    const result = await window.EnhancedDragDropManager.moveFolderToPosition(from, to);
    console.log('Result:', result);
    return result;
  } else {
    console.log('❌ EnhancedDragDropManager not available');
    return { success: false, error: 'Manager not available' };
  }
};

// Provide a function to run the position accuracy test
window.runPositionTest = testPositioningAccuracy;

console.log('💡 Manual test functions available:');
console.log('  - testMove(from, to) - Test a specific move');
console.log('  - runPositionTest() - Run full positioning test');
console.log('  - testPositionAccuracy() - Run positioning accuracy test');
