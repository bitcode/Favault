/**
 * Positioning Fix Verification Script
 * 
 * This script tests the specific positioning accuracy issues:
 * - Position 5 -> Position 2 should end up at Position 2 (not 3)
 * - Position 5 -> Position 10 should end up at Position 10 (not 11)
 */

console.log('🎯 POSITIONING FIX VERIFICATION TEST');
console.log('====================================');

async function testPositioningFix() {
  console.log('📋 Testing positioning accuracy fix...');
  
  // Ensure we're in edit mode
  const editToggle = document.querySelector('.edit-toggle');
  if (editToggle && !document.body.classList.contains('edit-mode')) {
    console.log('🔄 Enabling edit mode...');
    editToggle.click();
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Get current folder state
  const folders = Array.from(document.querySelectorAll('.folder-container'));
  const folderTitles = folders.map(f => f.querySelector('.folder-title')?.textContent || 'Unknown');
  
  console.log(`📁 Found ${folders.length} folders:`);
  folderTitles.forEach((title, index) => {
    console.log(`  ${index}: ${title}`);
  });
  
  if (folders.length < 6) {
    console.log('❌ Need at least 6 folders to test the reported issues');
    return;
  }
  
  // Test the specific reported issues
  const testCases = [
    {
      from: 5,
      to: 2,
      description: 'Move folder from position 5 to position 2',
      expectedIssue: 'Should end up at position 2, not 3'
    },
    {
      from: 2,
      to: 5,
      description: 'Move folder back from position 2 to position 5',
      expectedIssue: 'Should end up at position 5'
    }
  ];
  
  // Add a test for position 10 if we have enough folders
  if (folders.length >= 11) {
    testCases.push({
      from: 5,
      to: 10,
      description: 'Move folder from position 5 to position 10',
      expectedIssue: 'Should end up at position 10, not 11'
    });
  }
  
  let passedTests = 0;
  let totalTests = 0;
  
  for (const testCase of testCases) {
    const { from, to, description, expectedIssue } = testCase;
    
    // Skip if we don't have enough folders
    if (from >= folders.length || to >= folders.length) {
      console.log(`⏭️ Skipping: ${description} (not enough folders)`);
      continue;
    }
    
    totalTests++;
    console.log('');
    console.log(`🎯 Test ${totalTests}: ${description}`);
    console.log(`   Expected: ${expectedIssue}`);
    
    // Get current state
    const beforeFolders = Array.from(document.querySelectorAll('.folder-container'));
    const beforeTitles = beforeFolders.map(f => f.querySelector('.folder-title')?.textContent || 'Unknown');
    const movingFolderTitle = beforeTitles[from];
    
    console.log(`   Moving: "${movingFolderTitle}" from position ${from} to position ${to}`);
    console.log(`   Before: [${beforeTitles.join(', ')}]`);
    
    // Perform the move
    if (typeof window.EnhancedDragDropManager?.moveFolderToPosition === 'function') {
      try {
        const result = await window.EnhancedDragDropManager.moveFolderToPosition(from, to);
        
        if (result.success) {
          // Wait for UI to update
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Check the result
          const afterFolders = Array.from(document.querySelectorAll('.folder-container'));
          const afterTitles = afterFolders.map(f => f.querySelector('.folder-title')?.textContent || 'Unknown');
          const actualPosition = afterTitles.indexOf(movingFolderTitle);
          
          console.log(`   After:  [${afterTitles.join(', ')}]`);
          console.log(`   Result: "${movingFolderTitle}" is now at position ${actualPosition}`);
          
          if (actualPosition === to) {
            console.log(`   ✅ SUCCESS: Perfect positioning! Folder is at expected position ${to}`);
            passedTests++;
          } else {
            console.log(`   ❌ FAILED: Positioning error! Expected position ${to}, got position ${actualPosition}`);
            console.log(`   🔍 This indicates the off-by-one error is ${actualPosition > to ? 'still present' : 'overcorrected'}`);
          }
        } else {
          console.log(`   ❌ FAILED: Move operation failed - ${result.error}`);
        }
      } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
      }
    } else {
      console.log('   ❌ FAILED: EnhancedDragDropManager.moveFolderToPosition not available');
    }
  }
  
  console.log('');
  console.log('🎉 POSITIONING FIX TEST COMPLETE!');
  console.log('==================================');
  console.log(`📊 Results: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests && totalTests > 0) {
    console.log('✅ SUCCESS: All positioning tests passed! The off-by-one error is fixed.');
  } else if (totalTests === 0) {
    console.log('⚠️  WARNING: No tests could be run (not enough folders)');
  } else {
    console.log('❌ ISSUES: Some positioning tests failed. The fix may need adjustment.');
  }
  
  return {
    passed: passedTests,
    total: totalTests,
    success: passedTests === totalTests && totalTests > 0
  };
}

// Make the test function available globally
window.testPositioningFix = testPositioningFix;

// Auto-run the test
testPositioningFix().catch(console.error);

console.log('');
console.log('💡 Test function available: testPositioningFix()');
console.log('🔄 Test will run automatically, or call testPositioningFix() to run again');
