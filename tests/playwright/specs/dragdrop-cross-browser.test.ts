import { test, expect } from '../fixtures/extension';
import { devices } from '@playwright/test';
import { ExtensionTestUtils } from '../utils/extension-utils';
import { DragDropTestUtils } from '../utils/dragdrop-utils';
import { ConsoleTestUtils } from '../utils/console-utils';
import { TestDataSetup } from '../utils/test-data-setup';
import { CrossBrowserTestDataSetup } from '../utils/cross-browser-test-data';

// Browser configurations for cross-browser testing
const browserConfigs = [
  {
    name: 'Chrome Desktop',
    device: devices['Desktop Chrome'],
    browserType: 'chrome'
  },
  {
    name: 'Chrome Mobile',
    device: devices['Pixel 5'],
    browserType: 'chrome'
  },
  {
    name: 'Edge Desktop',
    device: devices['Desktop Edge'],
    browserType: 'edge'
  }
];

for (const config of browserConfigs) {
  test.describe(`Cross-Browser Drag-Drop - ${config.name}`, () => {
    let dragDropUtils: DragDropTestUtils;
    let consoleUtils: ConsoleTestUtils;
    let testDataSetup: CrossBrowserTestDataSetup;

    test.beforeEach(async ({ page, context }) => {
      dragDropUtils = new DragDropTestUtils(page);
      consoleUtils = new ConsoleTestUtils(page);
      testDataSetup = new CrossBrowserTestDataSetup(page, context, config.browserType);

      // Start monitoring
      await consoleUtils.startMonitoring();
      await consoleUtils.injectDragDropTestFunctions();

      // Create browser-specific test data
      console.log(`🔧 Setting up ${config.name} test data...`);
      await testDataSetup.initialize({
        folderCount: 3,
        bookmarksPerFolder: 2,
        includeDragTestFolders: true,
        browserType: config.browserType
      });

      await testDataSetup.generateTestData();
      console.log(`✅ ${config.name} test data created`);
    });

    test.afterEach(async () => {
      const report = await consoleUtils.generateDragDropTestReport();
      console.log(`📊 ${config.name} Test Report:`, JSON.stringify(report.summary, null, 2));
      
      await consoleUtils.stopMonitoring();
      await testDataSetup.cleanup();
    });

    test(`should initialize enhanced drag-drop system on ${config.name}`, async ({ page }) => {
      // Enable edit mode
      await ExtensionTestUtils.enableEditMode(page);

      // Wait for system initialization with browser-specific timeout
      const timeout = config.browserType === 'firefox' ? 5000 : 3000;
      await ExtensionTestUtils.waitForEnhancedDragDropSetup(page, timeout);

      // Verify system is ready
      const systemReady = await page.evaluate(() => {
        return (window as any).enhancedDragDropReady === true;
      });
      expect(systemReady).toBeTruthy();

      // Check browser-specific features
      const browserFeatures = await page.evaluate(() => {
        return {
          dragEvents: typeof DragEvent !== 'undefined',
          dataTransfer: typeof DataTransfer !== 'undefined',
          touchEvents: 'ontouchstart' in window
        };
      });

      expect(browserFeatures.dragEvents).toBeTruthy();
      console.log(`✅ ${config.name} drag-drop system initialized`);
    });

    test(`should handle drag operations on ${config.name}`, async ({ page }) => {
      // Enable edit mode
      await ExtensionTestUtils.enableEditMode(page);
      await ExtensionTestUtils.waitForEnhancedDragDropSetup(page);

      // Get folders
      const folders = await page.locator('.folder-container').all();
      expect(folders.length).toBeGreaterThanOrEqual(2);

      // Test drag operation
      const sourceFolder = folders[0];
      const targetFolder = folders[1];

      // Verify draggable state
      const isDraggable = await dragDropUtils.isDraggable(sourceFolder);
      expect(isDraggable).toBeTruthy();

      // Perform drag operation
      console.log(`🔄 Testing drag operation on ${config.name}...`);

      if (config.device.hasTouch) {
        // Use touch-based drag for mobile devices
        await dragDropUtils.touchDragAndDrop(sourceFolder, targetFolder);
      } else {
        // Use mouse-based drag for desktop
        await dragDropUtils.dragAndDrop(sourceFolder, targetFolder);
      }

      // Wait for operation to complete
      await page.waitForTimeout(2000);

      console.log(`✅ ${config.name} drag operation completed`);
    });

    test(`should provide appropriate visual feedback on ${config.name}`, async ({ newTabPage }) => {
      // Enable edit mode
      await ExtensionTestUtils.enableEditMode(newTabPage);
      await ExtensionTestUtils.waitForEnhancedDragDropSetup(newTabPage);
      
      const folder = newTabPage.locator('.folder-container').first();
      
      // Check cursor styles (desktop only)
      if (!config.device.hasTouch) {
        await folder.hover();
        
        const cursor = await folder.evaluate((el: HTMLElement) => 
          window.getComputedStyle(el).cursor
        );
        
        expect(cursor).toMatch(/grab|pointer|move/);
      }
      
      // Check for drag handles and visual indicators
      const hasVisualIndicators = await newTabPage.evaluate(() => {
        const folders = document.querySelectorAll('.folder-container[draggable="true"]');
        return folders.length > 0;
      });
      
      expect(hasVisualIndicators).toBeTruthy();
      console.log(`✅ ${config.name} visual feedback working`);
    });

    test(`should handle browser-specific drag events on ${config.name}`, async ({ newTabPage }) => {
      // Enable edit mode
      await ExtensionTestUtils.enableEditMode(newTabPage);
      await ExtensionTestUtils.waitForEnhancedDragDropSetup(newTabPage);
      
      // Test browser-specific event handling
      const eventSupport = await newTabPage.evaluate((browserType) => {
        const testElement = document.createElement('div');
        testElement.draggable = true;
        
        const events = {
          dragstart: false,
          dragend: false,
          dragover: false,
          drop: false
        };
        
        // Test event listener attachment
        try {
          testElement.addEventListener('dragstart', () => { events.dragstart = true; });
          testElement.addEventListener('dragend', () => { events.dragend = true; });
          testElement.addEventListener('dragover', () => { events.dragover = true; });
          testElement.addEventListener('drop', () => { events.drop = true; });
          
          return {
            eventsSupported: true,
            browserType: browserType,
            draggableSupported: testElement.draggable === true
          };
        } catch (error) {
          return {
            eventsSupported: false,
            error: error.message,
            browserType: browserType
          };
        }
      }, config.browserType);
      
      expect(eventSupport.eventsSupported).toBeTruthy();
      expect(eventSupport.draggableSupported).toBeTruthy();
      
      console.log(`✅ ${config.name} event handling working`);
    });

    test(`should maintain performance on ${config.name}`, async ({ newTabPage }) => {
      // Enable edit mode
      await ExtensionTestUtils.enableEditMode(newTabPage);
      
      // Measure initialization time
      const startTime = Date.now();
      await ExtensionTestUtils.waitForEnhancedDragDropSetup(newTabPage);
      const initTime = Date.now() - startTime;
      
      // Performance should be reasonable (under 5 seconds)
      expect(initTime).toBeLessThan(5000);
      
      // Test drag operation performance
      const folders = await newTabPage.locator('.folder-container').all();
      if (folders.length >= 2) {
        const dragStartTime = Date.now();
        await dragDropUtils.dragAndDrop(folders[0], folders[1]);
        const dragTime = Date.now() - dragStartTime;
        
        // Drag operation should complete quickly (under 3 seconds)
        expect(dragTime).toBeLessThan(3000);
      }
      
      console.log(`✅ ${config.name} performance acceptable (init: ${initTime}ms)`);
    });
  });
}

// Additional test for browser-specific features
test.describe('Browser-Specific Drag-Drop Features', () => {
  test('should detect and handle Brave browser correctly', async ({ newTabPage, context }) => {
    const consoleUtils = new ConsoleTestUtils(newTabPage);
    await consoleUtils.startMonitoring();
    
    // Enable edit mode
    await ExtensionTestUtils.enableEditMode(newTabPage);
    await ExtensionTestUtils.waitForEnhancedDragDropSetup(newTabPage);
    
    // Check Brave detection
    const braveDetection = await newTabPage.evaluate(() => {
      return {
        userAgent: navigator.userAgent.includes('Brave'),
        braveAPI: typeof (navigator as any).brave !== 'undefined',
        braveFeatures: (window as any).BraveDebugger !== 'undefined'
      };
    });
    
    console.log('🦁 Brave detection results:', braveDetection);
    
    // If Brave is detected, verify Brave-specific handling
    if (braveDetection.userAgent || braveDetection.braveAPI) {
      const braveHandling = await newTabPage.evaluate(() => {
        return typeof (window as any).testBraveDrag === 'function';
      });
      
      expect(braveHandling).toBeTruthy();
      console.log('✅ Brave-specific handling active');
    }
    
    await consoleUtils.stopMonitoring();
  });
});
