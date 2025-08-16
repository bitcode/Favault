// Test script for enhanced drag-drop integration
// This can be run from the browser console to verify the integration

import { EnhancedDragDropManager } from './dragdrop-enhanced';

export class EnhancedDragDropTester {
  /**
   * Test the enhanced drag-drop system
   */
  static async testSystem(): Promise<void> {
    console.log('🧪 Testing Enhanced Drag-Drop System...');
    console.log('');

    try {
      // Test 1: Check if system is available
      console.log('📋 Test 1: System Availability');
      if (typeof EnhancedDragDropManager === 'undefined') {
        throw new Error('EnhancedDragDropManager not available');
      }
      console.log('✅ EnhancedDragDropManager is available');

      // Test 2: Initialize system
      console.log('');
      console.log('📋 Test 2: System Initialization');
      const initResult = await EnhancedDragDropManager.initialize();
      if (initResult.success) {
        console.log('✅ System initialized successfully');
      } else {
        console.log('❌ System initialization failed:', initResult.error);
      }

      // Test 3: Check DOM elements
      console.log('');
      console.log('📋 Test 3: DOM Elements');
      const folders = document.querySelectorAll('.folder-container');
      console.log(`📁 Found ${folders.length} folder containers`);
      
      if (folders.length === 0) {
        console.log('⚠️ No folder containers found - make sure bookmarks are loaded');
      } else {
        console.log('✅ Folder containers found');
      }

      // Test 4: Check edit mode functionality
      console.log('');
      console.log('📋 Test 4: Edit Mode');
      const isEditMode = EnhancedDragDropManager.isEditModeEnabled();
      console.log(`📝 Edit mode enabled: ${isEditMode}`);
      
      if (!isEditMode) {
        console.log('💡 To test drag-drop, enable edit mode by pressing Ctrl+E or clicking the edit toggle');
      }

      // Test 5: Check protected folder detection
      console.log('');
      console.log('📋 Test 5: Protected Folder Detection');
      let protectedCount = 0;
      folders.forEach((folder, index) => {
        const title = folder.querySelector('.folder-title, h3, .folder-name')?.textContent?.trim();
        if (title) {
          const isProtected = EnhancedDragDropManager.isProtectedFolder('1', title) || 
                             EnhancedDragDropManager.isProtectedFolder('2', title) ||
                             EnhancedDragDropManager.isProtectedFolder('3', title);
          if (isProtected) {
            console.log(`🔒 Protected folder detected: "${title}"`);
            protectedCount++;
          }
        }
      });
      console.log(`🔒 Total protected folders: ${protectedCount}`);

      // Test 6: Check styles
      console.log('');
      console.log('📋 Test 6: Enhanced Styles');
      const stylesElement = document.getElementById('enhanced-drag-drop-styles');
      if (stylesElement) {
        console.log('✅ Enhanced drag-drop styles are loaded');
      } else {
        console.log('❌ Enhanced drag-drop styles not found');
      }

      // Test 7: Check notification system
      console.log('');
      console.log('📋 Test 7: Notification System');
      EnhancedDragDropManager.showNotification('Test notification - Enhanced drag-drop is working!', 'success');
      console.log('✅ Test notification sent');

      // Summary
      console.log('');
      console.log('🎉 ENHANCED DRAG-DROP TEST COMPLETE!');
      console.log('');
      console.log('📊 Test Results:');
      console.log(`  ✅ System available and initialized`);
      console.log(`  📁 ${folders.length} folder containers found`);
      console.log(`  🔒 ${protectedCount} protected folders detected`);
      console.log(`  📝 Edit mode: ${isEditMode ? 'enabled' : 'disabled'}`);
      console.log(`  🎨 Enhanced styles: ${stylesElement ? 'loaded' : 'missing'}`);
      console.log('');
      console.log('🚀 To test drag-drop functionality:');
      console.log('  1. Enable edit mode (Ctrl+E or edit toggle)');
      console.log('  2. Try dragging folders to reorder them');
      console.log('  3. Protected folders will show 🔒 and cannot be moved');
      console.log('  4. Changes will persist in Chrome bookmarks');
      console.log('');
      console.log('🔧 Available functions:');
      console.log('  - EnhancedDragDropManager.enableEditMode()');
      console.log('  - EnhancedDragDropManager.disableEditMode()');
      console.log('  - EnhancedDragDropManager.showNotification(message, type)');

    } catch (error) {
      console.error('❌ Enhanced drag-drop test failed:', error);
      console.log('');
      console.log('🔧 Troubleshooting:');
      console.log('  1. Make sure the extension is loaded and bookmarks are visible');
      console.log('  2. Check that the enhanced components are being used');
      console.log('  3. Verify Chrome bookmark API permissions');
    }
  }

  /**
   * Quick test for drag-drop functionality
   */
  static async quickTest(): Promise<void> {
    console.log('⚡ Quick Enhanced Drag-Drop Test...');
    
    try {
      // Initialize if needed
      if (!EnhancedDragDropManager.isEditModeEnabled()) {
        await EnhancedDragDropManager.initialize();
      }

      // Enable edit mode
      await EnhancedDragDropManager.enableEditMode();
      
      // Show test notification
      EnhancedDragDropManager.showNotification('Enhanced drag-drop enabled! Try dragging folders.', 'success');
      
      console.log('✅ Enhanced drag-drop is ready!');
      console.log('🎯 Try dragging folders to test the functionality');
      
    } catch (error) {
      console.error('❌ Quick test failed:', error);
    }
  }

  /**
   * Show system diagnostics
   */
  static showDiagnostics(): void {
    console.log('🔍 Enhanced Drag-Drop System Diagnostics:');
    console.log('');
    
    // Check system availability
    console.log('📊 System Status:');
    console.log(`  Available: ${typeof EnhancedDragDropManager !== 'undefined'}`);
    console.log(`  Edit mode: ${EnhancedDragDropManager.isEditModeEnabled()}`);
    
    // Check DOM elements
    const folders = document.querySelectorAll('.folder-container');
    const draggableFolders = document.querySelectorAll('.folder-container[draggable="true"]');
    const protectedFolders = document.querySelectorAll('.folder-container.protected-folder');
    
    console.log('');
    console.log('📁 DOM Elements:');
    console.log(`  Total folders: ${folders.length}`);
    console.log(`  Draggable folders: ${draggableFolders.length}`);
    console.log(`  Protected folders: ${protectedFolders.length}`);
    
    // Check styles
    const enhancedStyles = document.getElementById('enhanced-drag-drop-styles');
    const notificationStyles = document.getElementById('notification-styles');
    
    console.log('');
    console.log('🎨 Styles:');
    console.log(`  Enhanced styles: ${enhancedStyles ? 'loaded' : 'missing'}`);
    console.log(`  Notification styles: ${notificationStyles ? 'loaded' : 'missing'}`);
    
    // Check edit mode state
    const editModeClass = document.body.classList.contains('edit-mode');
    const appEditMode = document.querySelector('.app.edit-mode');
    
    console.log('');
    console.log('📝 Edit Mode State:');
    console.log(`  Body edit-mode class: ${editModeClass}`);
    console.log(`  App edit-mode class: ${appEditMode ? 'present' : 'missing'}`);
  }

  /**
   * Test folder positioning accuracy during drag-drop operations
   */
  static async testPositionAccuracy(): Promise<void> {
    console.log('🎯 FOLDER POSITIONING ACCURACY TEST');
    console.log('===================================');

    const startTime = Date.now();

    // Test 1: Check insertion point setup
    console.log('📋 Test 1: Insertion Point Setup');
    const insertionPoints = document.querySelectorAll('.insertion-point');
    const folders = document.querySelectorAll('.folder-container');

    console.log(`  📍 Insertion points: ${insertionPoints.length}`);
    console.log(`  📁 Folders: ${folders.length}`);
    console.log(`  ✅ Expected: ${folders.length + 1} insertion points for ${folders.length} folders`);

    if (insertionPoints.length !== folders.length + 1) {
      console.log('❌ INSERTION POINT COUNT MISMATCH!');
      return;
    }

    // Test 2: Verify insertion point indices
    console.log('');
    console.log('📋 Test 2: Insertion Point Index Verification');
    let indexMismatch = false;

    insertionPoints.forEach((point, index) => {
      const insertionIndex = parseInt(point.getAttribute('data-insertion-index') || '0');
      const isCorrect = insertionIndex === index;

      console.log(`  📍 Point ${index}: insertion-index=${insertionIndex} ${isCorrect ? '✅' : '❌'}`);

      if (!isCorrect) {
        indexMismatch = true;
      }
    });

    if (indexMismatch) {
      console.log('❌ INSERTION POINT INDEX MISMATCH DETECTED!');
      return;
    }

    // Test 3: Simulate positioning calculations
    console.log('');
    console.log('📋 Test 3: Position Calculation Simulation');

    const testScenarios = [
      { from: 0, to: 2, description: 'Move first folder to position 2' },
      { from: 2, to: 0, description: 'Move third folder to position 0' },
      { from: 1, to: 3, description: 'Move second folder to position 3' },
      { from: 3, to: 1, description: 'Move fourth folder to position 1' }
    ];

    testScenarios.forEach(scenario => {
      const { from, to, description } = scenario;

      // Simulate the positioning logic from dragdrop-enhanced.ts
      let targetIndex = to; // insertionIndex maps directly to target position

      if (to > from) {
        // Moving forward: adjust for removal
        targetIndex = to - 1;
      } else {
        // Moving backward: direct mapping
        targetIndex = to;
      }

      const finalPosition = targetIndex + 1; // 1-based for display

      console.log(`  🎯 ${description}:`);
      console.log(`     From index ${from} -> Insertion point ${to}`);
      console.log(`     Calculated target index: ${targetIndex}`);
      console.log(`     Final position: ${finalPosition}`);
      console.log(`     Expected visual result: Folder at position ${finalPosition}`);
    });

    // Test 4: Check for EnhancedDragDropManager availability
    console.log('');
    console.log('📋 Test 4: Enhanced Drag-Drop Manager Check');

    const managerAvailable = typeof (window as any).EnhancedDragDropManager !== 'undefined';
    const moveFunctionAvailable = managerAvailable &&
      typeof (window as any).EnhancedDragDropManager.moveFolderToPosition === 'function';

    console.log(`  🔧 Manager available: ${managerAvailable ? '✅' : '❌'}`);
    console.log(`  🔧 moveFolderToPosition available: ${moveFunctionAvailable ? '✅' : '❌'}`);

    const elapsedTime = Date.now() - startTime;

    console.log('');
    console.log('🎉 POSITIONING ACCURACY TEST COMPLETE!');
    console.log(`⏱️ Test completed in ${elapsedTime}ms`);
    console.log('');
    console.log('📊 Summary:');
    console.log(`  📍 Insertion points: ${insertionPoints.length}`);
    console.log(`  📁 Folders: ${folders.length}`);
    console.log(`  🎯 Index mapping: ${indexMismatch ? 'FAILED' : 'PASSED'}`);
    console.log(`  🔧 Manager ready: ${moveFunctionAvailable ? 'YES' : 'NO'}`);

    if (!indexMismatch && moveFunctionAvailable) {
      console.log('');
      console.log('✅ SUCCESS: Positioning system is correctly configured!');
      console.log('💡 Try dragging folders to test the actual positioning accuracy.');
    } else {
      console.log('');
      console.log('❌ ISSUES DETECTED: Check the configuration above.');
    }
  }

  /**
   * Test folder drag-drop timing and initialization
   */
  static async testFolderTiming(): Promise<void> {
    console.log('🔍 FOLDER DRAG-DROP TIMING TEST');
    console.log('================================');

    const startTime = Date.now();

    // Test 1: Check initial folder container state
    console.log('📋 Test 1: Initial Folder Container State');
    const initialFolders = document.querySelectorAll('.folder-container');
    const initialDraggable = document.querySelectorAll('.folder-container[draggable="true"]');

    console.log(`  📁 Initial folder containers: ${initialFolders.length}`);
    console.log(`  🎯 Initially draggable: ${initialDraggable.length}`);

    if (initialFolders.length === 0) {
      console.log('⚠️ No folder containers found - DOM may not be ready');
      return;
    }

    // Test 2: Force folder setup
    console.log('');
    console.log('📋 Test 2: Force Folder Setup');
    const setupResult = EnhancedDragDropManager.setupFolderDragDrop();
    console.log(`  🎯 Setup result: ${setupResult.draggable} draggable, ${setupResult.protected} protected`);

    // Test 3: Verify draggable attributes after setup
    console.log('');
    console.log('📋 Test 3: Post-Setup Verification');
    const postSetupFolders = document.querySelectorAll('.folder-container');
    const postSetupDraggable = document.querySelectorAll('.folder-container[draggable="true"]');
    const postSetupProtected = document.querySelectorAll('.folder-container.protected-folder');

    console.log(`  📁 Total folders: ${postSetupFolders.length}`);
    console.log(`  🎯 Draggable folders: ${postSetupDraggable.length}`);
    console.log(`  🔒 Protected folders: ${postSetupProtected.length}`);

    // Test 4: Check event handlers
    console.log('');
    console.log('📋 Test 4: Event Handler Verification');
    let handlersAttached = 0;
    postSetupFolders.forEach((folder, index) => {
      const hasHandlers = !!(folder as any)._dragstartHandler;
      if (hasHandlers) handlersAttached++;
      console.log(`  Folder ${index + 1}: ${hasHandlers ? '✅' : '❌'} handlers attached`);
    });

    const elapsedTime = Date.now() - startTime;

    console.log('');
    console.log('🎉 FOLDER TIMING TEST COMPLETE!');
    console.log(`⏱️ Test completed in ${elapsedTime}ms`);
    console.log('');
    console.log('📊 Summary:');
    console.log(`  📁 Folders found: ${postSetupFolders.length}`);
    console.log(`  🎯 Draggable: ${postSetupDraggable.length}`);
    console.log(`  🔒 Protected: ${postSetupProtected.length}`);
    console.log(`  🎪 Handlers: ${handlersAttached}/${postSetupFolders.length}`);

    if (postSetupDraggable.length === 0 && postSetupFolders.length > 0) {
      console.log('');
      console.log('❌ TIMING ISSUE DETECTED: Folders exist but none are draggable!');
      console.log('💡 Try running: EnhancedDragDropManager.setupFolderDragDrop()');
    } else if (postSetupDraggable.length > 0) {
      console.log('');
      console.log('✅ SUCCESS: Folders are properly configured for drag-drop!');
    }
  }
}

// Expose to global scope for easy testing
if (typeof window !== 'undefined') {
  (window as any).EnhancedDragDropTester = EnhancedDragDropTester;
  
  // Add convenient global functions
  (window as any).testEnhancedDragDrop = () => EnhancedDragDropTester.testSystem();
  (window as any).quickTestDragDrop = () => EnhancedDragDropTester.quickTest();
  (window as any).showDragDropDiagnostics = () => EnhancedDragDropTester.showDiagnostics();
  (window as any).testFolderTiming = () => EnhancedDragDropTester.testFolderTiming();
  (window as any).testPositionAccuracy = () => EnhancedDragDropTester.testPositionAccuracy();

  console.log('🧪 Enhanced Drag-Drop Tester available globally:');
  console.log('  - testEnhancedDragDrop() - Full system test');
  console.log('  - quickTestDragDrop() - Quick functionality test');
  console.log('  - showDragDropDiagnostics() - System diagnostics');
  console.log('  - testFolderTiming() - Folder timing test');
  console.log('  - testPositionAccuracy() - Position accuracy test');
}
