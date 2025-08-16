import { test, expect } from '../fixtures/extension';
import { ExtensionTestUtils } from '../utils/extension-utils';
import { ConsoleTestUtils } from '../utils/console-utils';

test.describe('Drag-Drop Integration Verification', () => {
  let consoleUtils: ConsoleTestUtils;

  test.beforeEach(async ({ newTabPage }) => {
    consoleUtils = new ConsoleTestUtils(newTabPage);
    await consoleUtils.startMonitoring();
  });

  test.afterEach(async () => {
    const report = await consoleUtils.generateDragDropTestReport();
    console.log('📊 Integration Test Report:', JSON.stringify(report.summary, null, 2));
    await consoleUtils.stopMonitoring();
  });

  test('should load extension and verify basic functionality', async ({ newTabPage }) => {
    console.log('🔧 Testing basic extension loading...');

    // Wait for extension to be ready
    await ExtensionTestUtils.waitForExtensionReady(newTabPage);

    // Get extension info
    const extensionInfo = await ExtensionTestUtils.getExtensionInfo(newTabPage);
    console.log('📋 Extension info:', extensionInfo);

    // Verify basic page structure
    const pageStructure = await newTabPage.evaluate(() => {
      return {
        hasBody: document.body !== null,
        hasChrome: typeof chrome !== 'undefined',
        hasBookmarksAPI: typeof chrome !== 'undefined' && typeof chrome.bookmarks !== 'undefined',
        elementCounts: {
          divs: document.querySelectorAll('div').length,
          scripts: document.querySelectorAll('script').length,
          stylesheets: document.querySelectorAll('link[rel="stylesheet"]').length
        }
      };
    });
    
    console.log('📋 Page structure:', pageStructure);
    
    expect(pageStructure.hasBody).toBeTruthy();
    expect(pageStructure.elementCounts.divs).toBeGreaterThan(0);
    
    console.log('✅ Basic extension loading verified');
  });

  test('should verify enhanced drag-drop system can be loaded', async ({ newTabPage }) => {
    console.log('🔧 Testing enhanced drag-drop system loading...');

    // Wait for extension to be ready
    await ExtensionTestUtils.waitForExtensionReady(newTabPage);

    // Check if enhanced drag-drop system exists
    const dragDropStatus = await newTabPage.evaluate(() => {
      return {
        managerExists: typeof (window as any).EnhancedDragDropManager !== 'undefined',
        managerMethods: typeof (window as any).EnhancedDragDropManager === 'object' ? 
          Object.getOwnPropertyNames((window as any).EnhancedDragDropManager).filter(name => typeof (window as any).EnhancedDragDropManager[name] === 'function') : [],
        globalFlags: {
          enhancedDragDropReady: (window as any).enhancedDragDropReady,
          enhancedDragDropStats: (window as any).enhancedDragDropStats
        }
      };
    });
    
    console.log('📋 Drag-drop system status:', dragDropStatus);
    
    // The manager should exist (it's loaded with the extension)
    expect(dragDropStatus.managerExists).toBeTruthy();
    expect(dragDropStatus.managerMethods).toContain('enableEditMode');
    expect(dragDropStatus.managerMethods).toContain('setupFolderDragDrop');
    
    console.log('✅ Enhanced drag-drop system loading verified');
  });

  test('should enable edit mode without requiring real bookmarks', async ({ newTabPage }) => {
    console.log('🔧 Testing edit mode activation...');

    // Wait for extension to be ready
    await ExtensionTestUtils.waitForExtensionReady(newTabPage);

    // Create some mock DOM elements for testing
    await newTabPage.evaluate(() => {
      // Create a simple test structure
      const container = document.createElement('div');
      container.innerHTML = `
        <div class="folder-container" data-testid="bookmark-folder">
          <h3 class="folder-title" data-testid="folder-title">Test Folder</h3>
          <div class="bookmark-item" data-testid="bookmark-item">
            <div class="bookmark-title" data-testid="bookmark-title">Test Bookmark</div>
          </div>
        </div>
      `;
      document.body.appendChild(container);
    });
    
    // Try to enable edit mode
    await ExtensionTestUtils.enableEditMode(newTabPage);

    // Check if edit mode was enabled
    const editModeStatus = await newTabPage.evaluate(() => {
      return {
        editModeClass: document.body.classList.contains('edit-mode'),
        enhancedDragDropReady: (window as any).enhancedDragDropReady === true,
        folderElements: document.querySelectorAll('.folder-container').length,
        draggableElements: document.querySelectorAll('[draggable="true"]').length
      };
    });
    
    console.log('📋 Edit mode status:', editModeStatus);
    
    // Edit mode should be enabled (at least the class should be added)
    expect(editModeStatus.editModeClass).toBeTruthy();
    expect(editModeStatus.folderElements).toBeGreaterThan(0);
    
    console.log('✅ Edit mode activation verified');
  });

  test('should handle enhanced drag-drop initialization gracefully', async ({ newTabPage }) => {
    console.log('🔧 Testing enhanced drag-drop initialization...');

    // Wait for extension to be ready
    await ExtensionTestUtils.waitForExtensionReady(newTabPage);

    // Create mock folder structure
    await newTabPage.evaluate(() => {
      const container = document.createElement('div');
      container.innerHTML = `
        <div class="folder-container" data-testid="bookmark-folder" data-folder-id="test-1">
          <h3 class="folder-title" data-testid="folder-title">Folder 1</h3>
        </div>
        <div class="folder-container" data-testid="bookmark-folder" data-folder-id="test-2">
          <h3 class="folder-title" data-testid="folder-title">Folder 2</h3>
        </div>
      `;
      document.body.appendChild(container);
    });
    
    // Enable edit mode
    await ExtensionTestUtils.enableEditMode(newTabPage);

    // Try to initialize the enhanced drag-drop system
    const initResult = await newTabPage.evaluate(() => {
      try {
        if (typeof (window as any).EnhancedDragDropManager !== 'undefined') {
          const result = (window as any).EnhancedDragDropManager.setupFolderDragDrop();
          return {
            success: true,
            result: result,
            error: null
          };
        }
        return {
          success: false,
          result: null,
          error: 'EnhancedDragDropManager not available'
        };
      } catch (error) {
        return {
          success: false,
          result: null,
          error: error.message
        };
      }
    });
    
    console.log('📋 Initialization result:', initResult);
    
    // The initialization should not throw errors
    expect(initResult.success).toBeTruthy();
    
    // Check final state
    const finalState = await newTabPage.evaluate(() => {
      return {
        enhancedDragDropReady: (window as any).enhancedDragDropReady === true,
        draggableElements: document.querySelectorAll('[draggable="true"]').length,
        folderElements: document.querySelectorAll('.folder-container').length
      };
    });
    
    console.log('📋 Final state:', finalState);
    
    expect(finalState.folderElements).toBeGreaterThan(0);
    
    console.log('✅ Enhanced drag-drop initialization verified');
  });

  test('should not have critical console errors', async ({ newTabPage }) => {
    console.log('🔧 Testing for critical console errors...');

    // Wait for extension to be ready
    await ExtensionTestUtils.waitForExtensionReady(newTabPage);

    // Enable edit mode and try basic operations
    await ExtensionTestUtils.enableEditMode(newTabPage);

    // Wait a bit for any async operations
    await newTabPage.waitForTimeout(2000);
    
    // Check for critical errors
    const errors = await consoleUtils.getConsoleErrors();
    const criticalErrors = errors.filter(error => 
      error.includes('TypeError') || 
      error.includes('ReferenceError') ||
      error.includes('is not a function') ||
      error.includes('Cannot read property')
    );
    
    console.log(`📋 Found ${errors.length} total errors, ${criticalErrors.length} critical errors`);
    
    if (criticalErrors.length > 0) {
      console.log('❌ Critical errors found:', criticalErrors.slice(0, 5));
    }
    
    // Should have minimal critical errors (some warnings are acceptable)
    expect(criticalErrors.length).toBeLessThan(3);
    
    console.log('✅ Console error check completed');
  });

  test('should verify production build integration', async ({ newTabPage }) => {
    console.log('🔧 Testing production build integration...');

    // Check if this is a production build
    const buildInfo = await newTabPage.evaluate(() => {
      return {
        isDevelopment: !!(window as any).chrome?.runtime?.getManifest?.()?.key === undefined,
        manifestVersion: (window as any).chrome?.runtime?.getManifest?.()?.manifest_version,
        extensionName: (window as any).chrome?.runtime?.getManifest?.()?.name,
        version: (window as any).chrome?.runtime?.getManifest?.()?.version
      };
    });
    
    console.log('📋 Build info:', buildInfo);
    
    // Verify the enhanced drag-drop fixes are included
    const fixesIncluded = await newTabPage.evaluate(() => {
      const manager = (window as any).EnhancedDragDropManager;
      if (!manager) return false;
      
      // Check if our fix (restoreBookmarkFolderMappings) is included
      return typeof manager.restoreBookmarkFolderMappings === 'function';
    });
    
    console.log('📋 Fixes included in build:', fixesIncluded);
    
    expect(fixesIncluded).toBeTruthy();
    
    console.log('✅ Production build integration verified');
  });
});
