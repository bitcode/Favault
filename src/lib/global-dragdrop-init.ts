// Global initialization for enhanced drag-drop system
// This ensures the testing functions are available immediately

import { EnhancedDragDropManager } from './dragdrop-enhanced';
import { EnhancedDragDropTester } from './test-enhanced-dragdrop';

// Immediately expose to global scope
if (typeof window !== 'undefined') {
  console.log('🦁 Exposing enhanced drag-drop to global scope...');
  
  // Expose main classes
  (window as any).EnhancedDragDropManager = EnhancedDragDropManager;
  (window as any).EnhancedDragDropTester = EnhancedDragDropTester;
  
  // Expose convenient testing functions
  (window as any).testEnhancedDragDrop = async () => {
    try {
      await EnhancedDragDropTester.testSystem();
    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  };
  
  (window as any).quickTestDragDrop = async () => {
    try {
      await EnhancedDragDropTester.quickTest();
    } catch (error) {
      console.error('❌ Quick test failed:', error);
    }
  };
  
  (window as any).showDragDropDiagnostics = () => {
    try {
      EnhancedDragDropTester.showDiagnostics();
    } catch (error) {
      console.error('❌ Diagnostics failed:', error);
    }
  };
  
  // Additional debugging functions
  (window as any).initEnhancedDragDrop = async () => {
    try {
      console.log('🦁 Manual initialization requested...');
      const result = await EnhancedDragDropManager.initialize();
      if (result.success) {
        console.log('✅ Manual initialization successful');
      } else {
        console.error('❌ Manual initialization failed:', result.error);
      }
      return result;
    } catch (error) {
      console.error('❌ Manual initialization error:', error);
      return { success: false, error: error.message };
    }
  };
  
  (window as any).enableEnhancedEditMode = async () => {
    try {
      await EnhancedDragDropManager.enableEditMode();
      console.log('✅ Enhanced edit mode enabled');
    } catch (error) {
      console.error('❌ Failed to enable enhanced edit mode:', error);
    }
  };
  
  (window as any).disableEnhancedEditMode = () => {
    try {
      EnhancedDragDropManager.disableEditMode();
      console.log('✅ Enhanced edit mode disabled');
    } catch (error) {
      console.error('❌ Failed to disable enhanced edit mode:', error);
    }
  };
  
  console.log('🧪 Enhanced Drag-Drop Testing Functions Available:');
  console.log('  - testEnhancedDragDrop() - Full system test');
  console.log('  - quickTestDragDrop() - Quick functionality test');
  console.log('  - showDragDropDiagnostics() - System diagnostics');
  console.log('  - initEnhancedDragDrop() - Manual initialization');
  console.log('  - enableEnhancedEditMode() - Enable edit mode');
  console.log('  - disableEnhancedEditMode() - Disable edit mode');
  console.log('');
  console.log('🦁 Enhanced Drag-Drop Classes Available:');
  console.log('  - EnhancedDragDropManager - Main manager class');
  console.log('  - EnhancedDragDropTester - Testing utilities');
}

// Auto-initialize when DOM is ready (but only basic initialization, not edit mode)
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      console.log('🦁 DOM loaded, performing basic enhanced drag-drop initialization...');
      try {
        // Only do basic initialization - edit mode will handle folder setup
        setTimeout(async () => {
          const result = await EnhancedDragDropManager.initialize();
          if (result.success) {
            console.log('✅ Basic auto-initialization successful - edit mode will handle folder setup');
          } else {
            console.log('⚠️ Basic auto-initialization failed, manual init may be needed:', result.error);
          }
        }, 800); // Reduced delay to avoid conflicts
      } catch (error) {
        console.log('⚠️ Basic auto-initialization error, manual init may be needed:', error);
      }
    });
  } else {
    // DOM already loaded
    console.log('🦁 DOM already loaded, performing basic enhanced drag-drop initialization...');
    setTimeout(async () => {
      try {
        const result = await EnhancedDragDropManager.initialize();
        if (result.success) {
          console.log('✅ Basic delayed auto-initialization successful - edit mode will handle folder setup');
        } else {
          console.log('⚠️ Basic delayed auto-initialization failed, manual init may be needed:', result.error);
        }
      } catch (error) {
        console.log('⚠️ Basic delayed auto-initialization error, manual init may be needed:', error);
      }
    }, 1000); // Reduced delay to avoid conflicts
  }
}

export { EnhancedDragDropManager, EnhancedDragDropTester };
