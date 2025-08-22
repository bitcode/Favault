import { Page, Locator } from '@playwright/test';

/**
 * Utility class for extension-specific operations
 */
export class ExtensionTestUtils {
  /**
   * Navigate to the extension page
   */
  static async navigateToExtension(page: Page): Promise<void> {
    console.log('🔗 Navigating to extension...');

    try {
      // Try chrome://newtab/ first (most common case)
      await page.goto('chrome://newtab/');
      await page.waitForLoadState('networkidle');

      // Wait for extension to load
      await page.waitForTimeout(3000);

      const currentUrl = page.url();
      console.log(`🔗 Current URL: ${currentUrl}`);

      // Check if we're on the extension page
      if (currentUrl.startsWith('chrome-extension://')) {
        console.log('✅ Extension loaded via chrome://newtab/');
        return;
      }

      // If not, try to get extension ID and navigate directly
      const extensionId = await page.evaluate(() => {
        // Try to get extension ID from any existing chrome-extension URLs
        const scripts = Array.from(document.querySelectorAll('script[src*="chrome-extension://"]'));
        if (scripts.length > 0) {
          const src = scripts[0].getAttribute('src') || '';
          const match = src.match(/chrome-extension:\/\/([a-z]+)/);
          return match ? match[1] : null;
        }
        return null;
      });

      if (extensionId) {
        const extensionUrl = `chrome-extension://${extensionId}/newtab.html`;
        console.log(`🔗 Navigating directly to: ${extensionUrl}`);
        await page.goto(extensionUrl);
        await page.waitForLoadState('networkidle');
      } else {
        console.log('⚠️ Could not determine extension ID, staying on current page');
      }

    } catch (error) {
      console.log('⚠️ Navigation error:', error);
      // Continue with current page
    }

    // Wait for extension to be ready
    await this.waitForExtensionReady(page);
  }

  /**
   * Enable edit mode in the extension
   */
  static async enableEditMode(page: Page): Promise<void> {
    console.log('🔧 Enabling edit mode...');

    // First, check what's available in the page
    const pageStatus = await page.evaluate(() => {
      return {
        settingsManager: typeof (window as any).settingsManager !== 'undefined',
        enhancedDragDrop: typeof (window as any).EnhancedDragDropManager !== 'undefined',
        enableFunction: typeof (window as any).enableEnhancedEditMode === 'function',
        editToggleExists: document.querySelector('.edit-toggle, [data-testid="edit-toggle"]') !== null,
        bodyHasEditMode: document.body.classList.contains('edit-mode'),
        availableGlobals: Object.keys(window).filter(key => key.includes('edit') || key.includes('drag') || key.includes('settings')).slice(0, 10)
      };
    });

    console.log('🔍 Page status for edit mode:', pageStatus);

    // Try multiple methods to enable edit mode
    const enabled = await page.evaluate(() => {
      let success = false;

      // Method 1: Use settings manager
      if (typeof (window as any).settingsManager !== 'undefined') {
        try {
          (window as any).settingsManager.set('editMode', true);
          console.log('✅ Edit mode enabled via settings manager');
          success = true;
        } catch (error) {
          console.warn('⚠️ Settings manager failed:', error);
        }
      }

      // Method 2: Use enhanced drag-drop manager directly
      if (typeof (window as any).EnhancedDragDropManager !== 'undefined') {
        try {
          (window as any).EnhancedDragDropManager.enableEditMode();
          console.log('✅ Edit mode enabled via EnhancedDragDropManager');
          success = true;
        } catch (error) {
          console.warn('⚠️ EnhancedDragDropManager.enableEditMode failed:', error);
        }
      }

      // Method 3: Use global enable function
      if (typeof (window as any).enableEnhancedEditMode === 'function') {
        try {
          (window as any).enableEnhancedEditMode();
          console.log('✅ Edit mode enabled via global function');
          success = true;
        } catch (error) {
          console.warn('⚠️ Global enableEnhancedEditMode failed:', error);
        }
      }

      // Method 4: Manually set edit mode class and trigger initialization
      if (!success) {
        try {
          document.body.classList.add('edit-mode');
          console.log('✅ Edit mode class added manually');

          // Try to trigger enhanced drag-drop initialization
          if (typeof (window as any).EnhancedDragDropManager !== 'undefined') {
            (window as any).EnhancedDragDropManager.setupFolderDragDrop();
            console.log('✅ Enhanced drag-drop setup triggered');
          }
          success = true;
        } catch (error) {
          console.warn('⚠️ Manual edit mode setup failed:', error);
        }
      }

      return success;
    });

    // If programmatic methods failed, try clicking the edit button
    if (!enabled) {
      try {
        const editButton = page.locator('.edit-toggle, [data-testid="edit-toggle"], button:has-text("Edit")').first();
        if (await editButton.isVisible({ timeout: 2000 })) {
          await editButton.click();
          console.log('✅ Edit mode enabled via button click');
        }
      } catch (error) {
        console.warn('⚠️ Could not find or click edit toggle button:', error);
      }
    }

    // Wait for edit mode to be enabled
    await page.waitForTimeout(1500);

    // Verify edit mode is enabled
    const finalStatus = await page.evaluate(() => {
      return {
        editModeClass: document.body.classList.contains('edit-mode'),
        enhancedDragDropReady: (window as any).enhancedDragDropReady === true,
        draggableElements: document.querySelectorAll('[draggable="true"]').length,
        folderElements: document.querySelectorAll('.folder-container').length
      };
    });

    console.log('🔍 Final edit mode status:', finalStatus);

    if (finalStatus.editModeClass) {
      console.log('✅ Edit mode enabled successfully');
    } else {
      console.warn('⚠️ Edit mode may not be fully enabled');
    }
  }

  /**
   * Wait for enhanced drag-drop system to be ready
   */
  static async waitForEnhancedDragDropSetup(page: Page, timeout = 10000): Promise<void> {
    console.log('⏳ Waiting for enhanced drag-drop system to complete setup...');
    
    let setupComplete = false;
    let attempts = 0;
    const maxAttempts = timeout / 500;

    while (!setupComplete && attempts < maxAttempts) {
      try {
        // Check the global flag set by the enhanced drag-drop system
        const systemReady = await page.evaluate(() => {
          return {
            ready: (window as any).enhancedDragDropReady === true,
            stats: (window as any).enhancedDragDropStats,
            draggableCount: document.querySelectorAll('.folder-container[draggable="true"]').length,
            managerExists: typeof (window as any).EnhancedDragDropManager !== 'undefined',
            editModeActive: document.body.classList.contains('edit-mode')
          };
        });

        if (systemReady.ready && systemReady.draggableCount > 0 && systemReady.managerExists) {
          setupComplete = true;
          console.log(`✅ Enhanced drag-drop setup complete: ${systemReady.draggableCount} draggable folders, ${systemReady.stats?.protected || 0} protected`);
        } else {
          await page.waitForTimeout(500);
          attempts++;
        }
      } catch (error) {
        console.log(`⚠️ Waiting for enhanced drag-drop setup (attempt ${attempts + 1}/${maxAttempts})`);
        await page.waitForTimeout(500);
        attempts++;
      }
    }

    if (!setupComplete) {
      throw new Error(`Enhanced drag-drop system failed to initialize within ${timeout}ms`);
    }
  }

  /**
   * Disable edit mode
   */
  static async disableEditMode(page: Page): Promise<void> {
    console.log('🔧 Disabling edit mode...');
    
    // Try multiple methods to disable edit mode
    const disabled = await page.evaluate(() => {
      // Method 1: Use settings manager
      if (typeof (window as any).settingsManager !== 'undefined') {
        (window as any).settingsManager.set('editMode', false);
        return true;
      }
      
      // Method 2: Use enhanced drag-drop manager
      if (typeof (window as any).disableEnhancedEditMode === 'function') {
        (window as any).disableEnhancedEditMode();
        return true;
      }
      
      // Method 3: Click edit toggle if visible
      const editToggle = document.querySelector('.edit-toggle, [data-testid="edit-toggle"]') as HTMLElement;
      if (editToggle && document.body.classList.contains('edit-mode')) {
        editToggle.click();
        return true;
      }
      
      return false;
    });
    
    if (!disabled) {
      // Fallback: try clicking the edit button
      try {
        const editButton = page.locator('.edit-toggle, [data-testid="edit-toggle"]').first();
        if (await editButton.isVisible()) {
          await editButton.click();
        }
      } catch (error) {
        console.warn('Could not find edit toggle button');
      }
    }
    
    // Wait for edit mode to be disabled
    await page.waitForTimeout(1000);
    
    // Verify edit mode is disabled
    const editModeDisabled = await page.evaluate(() => {
      return !document.body.classList.contains('edit-mode');
    });
    
    if (editModeDisabled) {
      console.log('✅ Edit mode disabled');
    } else {
      console.warn('⚠️ Edit mode may not be fully disabled');
    }
  }

  /**
   * Get current edit mode state
   */
  static async getEditModeState(page: Page): Promise<boolean> {
    return await page.evaluate(() => {
      return document.body.classList.contains('edit-mode');
    });
  }

  /**
   * Wait for extension to be fully loaded and ready
   */
  static async waitForExtensionReady(page: Page, timeout = 15000): Promise<void> {
    console.log('⏳ Waiting for extension to be fully ready...');

    try {
      // Wait for basic page readiness
      await page.waitForFunction(() => {
        return document.readyState === 'complete';
      }, { timeout: 5000 });

      // Wait a bit for scripts to load
      await page.waitForTimeout(1000);

      // Check what's actually available
      const pageStatus = await page.evaluate(() => {
        return {
          readyState: document.readyState,
          hasChrome: typeof chrome !== 'undefined',
          hasEnhancedDragDrop: typeof (window as any).EnhancedDragDropManager !== 'undefined',
          elementCount: document.querySelectorAll('*').length,
          scripts: document.querySelectorAll('script').length,
          stylesheets: document.querySelectorAll('link[rel="stylesheet"]').length
        };
      });

      console.log('📋 Page status:', pageStatus);

      // The page is ready if it has basic structure
      if (pageStatus.readyState === 'complete' && pageStatus.elementCount > 10) {
        console.log('✅ Extension is ready (basic structure loaded)');
        return;
      }

      // If we have enhanced drag-drop, wait for it to be ready
      if (pageStatus.hasEnhancedDragDrop) {
        await page.waitForFunction(() => {
          return typeof (window as any).EnhancedDragDropManager !== 'undefined';
        }, { timeout: 3000 });
        console.log('✅ Extension is ready (enhanced drag-drop loaded)');
        return;
      }

      console.log('✅ Extension is ready (fallback)');

    } catch (error) {
      console.warn('⚠️ Extension readiness check timed out, proceeding anyway:', error.message);

      // Get final status for debugging
      const finalStatus = await page.evaluate(() => {
        return {
          readyState: document.readyState,
          elementCount: document.querySelectorAll('*').length,
          hasBody: document.body !== null,
          bodyChildren: document.body?.children.length || 0
        };
      });

      console.log('📋 Final status:', finalStatus);
    }
  }

  /**
   * Get extension version and build info
   */
  static async getExtensionInfo(page: Page): Promise<any> {
    return await page.evaluate(() => {
      return {
        version: (window as any).chrome?.runtime?.getManifest?.()?.version || 'unknown',
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
        enhancedDragDropVersion: (window as any).EnhancedDragDropManager?.version || 'unknown'
      };
    });
  }

  /**
   * Check if extension is in development mode
   */
  static async isDevelopmentMode(page: Page): Promise<boolean> {
    return await page.evaluate(() => {
      return !!(window as any).chrome?.runtime?.getManifest?.()?.key === undefined;
    });
  }

  /**
   * Get current bookmark count and folder count
   */
  static async getBookmarkStats(page: Page): Promise<any> {
    return await page.evaluate(() => {
      const folders = document.querySelectorAll('.folder-container');
      const bookmarks = document.querySelectorAll('.bookmark-item');
      
      return {
        folderCount: folders.length,
        bookmarkCount: bookmarks.length,
        draggableFolders: document.querySelectorAll('.folder-container[draggable="true"]').length,
        draggableBookmarks: document.querySelectorAll('.bookmark-item[draggable="true"]').length,
        editModeActive: document.body.classList.contains('edit-mode')
      };
    });
  }

  /**
   * Simulate extension reload
   */
  static async reloadExtension(page: Page): Promise<void> {
    console.log('🔄 Simulating extension reload...');
    
    await page.evaluate(() => {
      // Clear enhanced drag-drop state
      (window as any).enhancedDragDropReady = false;
      delete (window as any).EnhancedDragDropManager;
      delete (window as any).enhancedDragDropStats;
      
      // Remove edit mode
      document.body.classList.remove('edit-mode');
      
      // Clear draggable attributes
      document.querySelectorAll('[draggable="true"]').forEach(el => {
        el.removeAttribute('draggable');
      });
    });
    
    // Reload the page
    await page.reload();
    await this.waitForExtensionReady(page);
    
    console.log('✅ Extension reloaded');
  }
}
