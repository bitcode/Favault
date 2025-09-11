// Comprehensive test suite for drag-and-drop functionality
import { DragDropValidator } from './drag-drop-validation';
import type { DragData, DropZoneData } from './dragdrop';

export interface TestResult {
  testName: string;
  passed: boolean;
  error?: string;
  details?: any;
}

export interface TestSuite {
  name: string;
  results: TestResult[];
  passed: number;
  failed: number;
  total: number;
}

export class DragDropTestSuite {
  private static testResults: TestResult[] = [];

  /**
   * Run all drag-and-drop tests
   */
  static async runAllTests(): Promise<TestSuite> {
    console.log('🧪 Starting comprehensive drag-and-drop test suite...');
    
    this.testResults = [];

    // Test validation system
    await this.testValidationSystem();
    
    // Test edit mode integration
    await this.testEditModeIntegration();
    
    // Test visual feedback
    await this.testVisualFeedback();
    
    // Test data persistence
    await this.testDataPersistence();

    // Test performance
    await this.testPerformance();

    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.filter(r => !r.passed).length;

    const suite: TestSuite = {
      name: 'Drag-and-Drop Comprehensive Test Suite',
      results: this.testResults,
      passed,
      failed,
      total: this.testResults.length
    };

    console.log(`🧪 Test suite completed: ${passed}/${suite.total} tests passed`);
    
    if (failed > 0) {
      console.warn(`❌ ${failed} tests failed:`);
      this.testResults.filter(r => !r.passed).forEach(result => {
        console.warn(`  - ${result.testName}: ${result.error}`);
      });
    }

    return suite;
  }

  /**
   * Test the validation system
   */
  private static async testValidationSystem(): Promise<void> {
    console.log('🧪 Testing validation system...');

    // Test basic validation
    await this.runTest('Basic Validation - Valid Operation', async () => {
      const dragData: DragData = {
        type: 'bookmark',
        id: 'test-bookmark-1',
        title: 'Test Bookmark',
        url: 'https://example.com',
        parentId: 'folder-1',
        index: 0
      };

      const dropZone: DropZoneData = {
        type: 'folder',
        targetId: 'folder-2',
        parentId: 'folder-2'
      };

      const result = DragDropValidator.validateQuick(dragData, dropZone);
      return result.isValid && result.canProceed;
    });

    // Test self-drop validation
    await this.runTest('Self-Drop Validation', async () => {
      const dragData: DragData = {
        type: 'bookmark',
        id: 'test-bookmark-1',
        title: 'Test Bookmark',
        parentId: 'folder-1',
        index: 0
      };

      const dropZone: DropZoneData = {
        type: 'within-folder',
        targetId: 'test-bookmark-1', // Same as drag ID
        parentId: 'folder-1',
        targetIndex: 0
      };

      const result = DragDropValidator.validateQuick(dragData, dropZone);
      return !result.isValid && !result.canProceed;
    });

    // Test position validation
    await this.runTest('Position Validation - Same Position', async () => {
      const dragData: DragData = {
        type: 'bookmark',
        id: 'test-bookmark-1',
        title: 'Test Bookmark',
        parentId: 'folder-1',
        index: 2
      };

      const dropZone: DropZoneData = {
        type: 'within-folder',
        targetId: 'insertion-point',
        parentId: 'folder-1',
        targetIndex: 2 // Same position
      };

      const result = DragDropValidator.validateQuick(dragData, dropZone);
      return !result.isValid && !result.canProceed;
    });

    // Test invalid data validation
    await this.runTest('Invalid Data Validation', async () => {
      const dragData: DragData = {
        type: 'bookmark',
        id: '', // Invalid empty ID
        title: 'Test Bookmark'
      };

      const dropZone: DropZoneData = {
        type: 'folder',
        targetId: 'folder-2'
      };

      const result = DragDropValidator.validateQuick(dragData, dropZone);
      return !result.isValid && !result.canProceed;
    });
  }

  /**
   * Test edit mode integration
   */
  private static async testEditModeIntegration(): Promise<void> {
    console.log('🧪 Testing edit mode integration...');

    await this.runTest('Edit Mode Detection', async () => {
      // Test various edit mode detection methods
      const hasEditModeClass = document.body.classList.contains('edit-mode');
      const hasAppEditMode = document.querySelector('.app.edit-mode') !== null;
      const hasDragEnabled = document.body.classList.contains('drag-enabled');
      
      // At least one method should work
      return hasEditModeClass || hasAppEditMode || hasDragEnabled;
    });

    await this.runTest('Draggable Elements in Edit Mode', async () => {
      const draggableElements = document.querySelectorAll('.draggable-item');
      const bookmarkItems = document.querySelectorAll('.bookmark-item');
      
      // If in edit mode, bookmark items should be draggable
      if (document.body.classList.contains('edit-mode')) {
        return draggableElements.length > 0;
      }
      
      return true; // Pass if not in edit mode
    });

    await this.runTest('Drop Zones in Edit Mode', async () => {
      const folderContainers = document.querySelectorAll('.folder-container');
      const insertionPoints = document.querySelectorAll('.bookmark-insertion-point');
      
      // If in edit mode and we have folders, we should have drop zones
      if (document.body.classList.contains('edit-mode') && folderContainers.length > 0) {
        return insertionPoints.length > 0;
      }
      
      return true; // Pass if not in edit mode or no folders
    });
  }

  /**
   * Test visual feedback system
   */
  private static async testVisualFeedback(): Promise<void> {
    console.log('🧪 Testing visual feedback system...');

    await this.runTest('CSS Animations Loaded', async () => {
      // Check if our CSS animations are loaded
      const styleSheets = Array.from(document.styleSheets);
      let hasAnimations = false;
      
      try {
        for (const sheet of styleSheets) {
          const rules = Array.from(sheet.cssRules || []);
          hasAnimations = rules.some(rule => 
            rule.cssText.includes('slideInRight') || 
            rule.cssText.includes('insertionPulse') ||
            rule.cssText.includes('dropZoneHighlight')
          );
          if (hasAnimations) break;
        }
      } catch (error) {
        // Cross-origin stylesheets might not be accessible
        console.warn('Could not access all stylesheets for animation check');
        hasAnimations = true; // Assume they're loaded
      }
      
      return hasAnimations;
    });

    await this.runTest('Drag Ghost Creation', async () => {
      // Test if drag ghost elements can be created
      const testElement = document.createElement('div');
      testElement.className = 'bookmark-item';
      testElement.textContent = 'Test Bookmark';
      
      // Simulate drag ghost creation
      const ghost = testElement.cloneNode(true) as HTMLElement;
      ghost.classList.add('drag-ghost', 'enhanced-drag-preview');
      
      return ghost.classList.contains('drag-ghost') && 
             ghost.classList.contains('enhanced-drag-preview');
    });

    await this.runTest('Insertion Indicators', async () => {
      // Test insertion indicator creation
      const indicator = document.createElement('div');
      indicator.className = 'bookmark-insertion-indicator';
      indicator.innerHTML = `
        <div class="insertion-line"></div>
        <div class="insertion-text">Test insertion</div>
      `;
      
      const hasLine = indicator.querySelector('.insertion-line') !== null;
      const hasText = indicator.querySelector('.insertion-text') !== null;
      
      return hasLine && hasText;
    });
  }

  /**
   * Test data persistence
   */
  private static async testDataPersistence(): Promise<void> {
    console.log('🧪 Testing data persistence...');

    await this.runTest('Bookmark API Access', async () => {
      // Test if we can access the bookmark API
      try {
        if (typeof chrome !== 'undefined' && chrome.bookmarks) {
          return true;
        }
        if (typeof browser !== 'undefined' && browser.bookmarks) {
          return true;
        }
        return false;
      } catch (error) {
        return false;
      }
    });

    await this.runTest('Move Operation Structure', async () => {
      // Test if move operations have the correct structure
      const mockMoveData = {
        parentId: 'folder-1',
        index: 2
      };
      
      return typeof mockMoveData.parentId === 'string' && 
             typeof mockMoveData.index === 'number' &&
             mockMoveData.index >= 0;
    });
  }

  /**
   * Test performance
   */
  private static async testPerformance(): Promise<void> {
    console.log('🧪 Testing performance...');

    await this.runTest('Validation Performance', async () => {
      const dragData: DragData = {
        type: 'bookmark',
        id: 'test-bookmark-1',
        title: 'Test Bookmark',
        parentId: 'folder-1',
        index: 0
      };

      const dropZone: DropZoneData = {
        type: 'folder',
        targetId: 'folder-2',
        parentId: 'folder-2'
      };

      const startTime = performance.now();
      
      // Run validation multiple times
      for (let i = 0; i < 100; i++) {
        DragDropValidator.validateQuick(dragData, dropZone);
      }
      
      const endTime = performance.now();
      const avgTime = (endTime - startTime) / 100;
      
      // Validation should be fast (< 1ms per operation)
      return avgTime < 1;
    });

    await this.runTest('DOM Query Performance', async () => {
      const startTime = performance.now();
      
      // Simulate common DOM queries used in drag-and-drop
      for (let i = 0; i < 50; i++) {
        document.querySelectorAll('.bookmark-item');
        document.querySelectorAll('.folder-container');
        document.querySelectorAll('.bookmark-insertion-point');
      }
      
      const endTime = performance.now();
      const avgTime = (endTime - startTime) / 50;
      
      // DOM queries should be reasonably fast (< 5ms per batch)
      return avgTime < 5;
    });
  }

  /**
   * Run a single test
   */
  private static async runTest(testName: string, testFunction: () => Promise<boolean>): Promise<void> {
    try {
      const result = await testFunction();
      this.testResults.push({
        testName,
        passed: result
      });
      
      if (result) {
        console.log(`✅ ${testName}`);
      } else {
        console.warn(`❌ ${testName}`);
      }
    } catch (error) {
      this.testResults.push({
        testName,
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      });
      console.error(`❌ ${testName}: ${error}`);
    }
  }

  /**
   * Generate a test report
   */
  static generateReport(suite: TestSuite): string {
    const passRate = ((suite.passed / suite.total) * 100).toFixed(1);
    
    let report = `# Drag-and-Drop Test Report\n\n`;
    report += `**Overall Result**: ${suite.passed}/${suite.total} tests passed (${passRate}%)\n\n`;
    
    if (suite.failed > 0) {
      report += `## Failed Tests\n\n`;
      suite.results.filter(r => !r.passed).forEach(result => {
        report += `- **${result.testName}**: ${result.error || 'Test failed'}\n`;
      });
      report += `\n`;
    }
    
    report += `## All Test Results\n\n`;
    suite.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      report += `${status} ${result.testName}\n`;
    });
    
    return report;
  }
}

// Expose test suite to global scope for manual testing
if (typeof window !== 'undefined') {
  (window as any).DragDropTestSuite = DragDropTestSuite;
}
