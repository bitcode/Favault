/**
 * Automated Test Runner for Enhanced Drag-Drop
 * Runs comprehensive tests and exports results
 */

export interface TestResult {
  id: string;
  name: string;
  success: boolean;
  duration: number;
  details: any;
  timestamp: string;
  error?: string;
}

export class TestAutomation {
  private static instance: TestAutomation;
  private testResults: TestResult[] = [];
  private isRunning = false;

  static getInstance(): TestAutomation {
    if (!TestAutomation.instance) {
      TestAutomation.instance = new TestAutomation();
    }
    return TestAutomation.instance;
  }

  /**
   * Run comprehensive test suite
   */
  async runComprehensiveTests(): Promise<TestResult[]> {
    if (this.isRunning) {
      console.warn('⚠️ Tests already running');
      return this.testResults;
    }

    this.isRunning = true;
    this.testResults = [];
    
    console.log('🚀 Starting comprehensive test suite...');
    
    const testSuite = [
      {
        id: 'init-test',
        name: 'System Initialization',
        test: () => this.testSystemInitialization()
      },
      {
        id: 'folder-mapping',
        name: 'Folder Mapping',
        test: () => this.testFolderMapping()
      },
      {
        id: 'position-verification',
        name: 'Position Verification',
        test: () => this.testPositionVerification()
      },
      {
        id: 'move-operations',
        name: 'Move Operations',
        test: () => this.testMoveOperations()
      },
      {
        id: 'edge-cases',
        name: 'Edge Cases',
        test: () => this.testEdgeCases()
      }
    ];

    for (const testCase of testSuite) {
      await this.runSingleTest(testCase);
      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.isRunning = false;
    
    const passed = this.testResults.filter(r => r.success).length;
    const total = this.testResults.length;
    
    console.log(`🎉 Test suite complete: ${passed}/${total} tests passed`);
    
    // Auto-export results
    this.exportResults();
    
    return this.testResults;
  }

  /**
   * Run a single test case
   */
  private async runSingleTest(testCase: { id: string, name: string, test: () => Promise<any> }): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`🧪 Running: ${testCase.name}...`);
      
      const result = await testCase.test();
      const duration = Date.now() - startTime;
      
      const testResult: TestResult = {
        id: testCase.id,
        name: testCase.name,
        success: true,
        duration,
        details: result,
        timestamp: new Date().toISOString()
      };
      
      this.testResults.push(testResult);
      console.log(`✅ ${testCase.name} passed (${duration}ms)`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      const testResult: TestResult = {
        id: testCase.id,
        name: testCase.name,
        success: false,
        duration,
        details: null,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      this.testResults.push(testResult);
      console.error(`❌ ${testCase.name} failed (${duration}ms):`, error);
    }
  }

  /**
   * Test system initialization
   */
  private async testSystemInitialization(): Promise<any> {
    const { EnhancedDragDropDev } = await import('./enhanced-dragdrop-dev');
    const devSystem = EnhancedDragDropDev.getInstance();
    
    const initialized = await devSystem.initialize();
    if (!initialized) {
      throw new Error('Failed to initialize development system');
    }
    
    return { initialized: true };
  }

  /**
   * Test folder mapping
   */
  private async testFolderMapping(): Promise<any> {
    const folders = document.querySelectorAll('.folder-container');
    const tree = await chrome.bookmarks.getTree();
    
    if (folders.length === 0) {
      throw new Error('No folder containers found in DOM');
    }
    
    if (!tree || tree.length === 0) {
      throw new Error('Failed to get bookmark tree');
    }
    
    return {
      domFolders: folders.length,
      bookmarkTree: tree.length
    };
  }

  /**
   * Test position verification
   */
  private async testPositionVerification(): Promise<any> {
    const children = await chrome.bookmarks.getChildren('1');
    const folders = children.filter(child => !child.url);
    
    if (folders.length === 0) {
      throw new Error('No folders found in Chrome bookmarks');
    }
    
    return {
      totalChildren: children.length,
      folders: folders.length
    };
  }

  /**
   * Test move operations
   */
  private async testMoveOperations(): Promise<any> {
    const { EnhancedDragDropDev } = await import('./enhanced-dragdrop-dev');
    const devSystem = EnhancedDragDropDev.getInstance();
    
    // Test a simple move operation
    const result = await devSystem.testMove(4, 2);
    
    if (!result.success) {
      throw new Error(`Move operation failed: ${result.error}`);
    }
    
    return result;
  }

  /**
   * Test edge cases
   */
  private async testEdgeCases(): Promise<any> {
    const { EnhancedDragDropDev } = await import('./enhanced-dragdrop-dev');
    const devSystem = EnhancedDragDropDev.getInstance();
    
    // Test invalid indices
    const invalidResult = await devSystem.testMove(999, 0);
    
    if (invalidResult.success) {
      throw new Error('Expected invalid move to fail');
    }
    
    return { invalidMoveHandled: true };
  }

  /**
   * Export test results to console and clipboard
   */
  exportResults(): void {
    const summary = {
      timestamp: new Date().toISOString(),
      total: this.testResults.length,
      passed: this.testResults.filter(r => r.success).length,
      failed: this.testResults.filter(r => !r.success).length,
      totalDuration: this.testResults.reduce((sum, r) => sum + r.duration, 0),
      results: this.testResults
    };

    // Compact console output
    console.log('📊 TEST RESULTS SUMMARY:');
    console.log(`✅ Passed: ${summary.passed}`);
    console.log(`❌ Failed: ${summary.failed}`);
    console.log(`⏱️ Total Duration: ${summary.totalDuration}ms`);
    
    if (summary.failed > 0) {
      console.log('❌ Failed Tests:');
      this.testResults.filter(r => !r.success).forEach(r => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
    }

    // Copy to clipboard for easy sharing
    const resultsJson = JSON.stringify(summary, null, 2);
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(resultsJson).then(() => {
        console.log('📋 Test results copied to clipboard');
      }).catch(() => {
        console.log('📋 Test results available in console');
      });
    }

    // Store in global for easy access
    (window as any).lastTestResults = summary;
  }

  /**
   * Get latest test results
   */
  getResults(): TestResult[] {
    return this.testResults;
  }

  /**
   * Clear test results
   */
  clearResults(): void {
    this.testResults = [];
    console.log('🗑️ Test results cleared');
  }
}

/**
 * Expose global test automation functions
 */
export function exposeTestAutomation(): void {
  if (typeof window !== 'undefined') {
    const automation = TestAutomation.getInstance();

    (window as any).runAllTests = () => automation.runComprehensiveTests();
    (window as any).getTestResults = () => automation.getResults();
    (window as any).clearTestResults = () => automation.clearResults();
    (window as any).testAutomation = automation;

    // Also expose individual testing functions that will be available after initialization
    (window as any).testMove = async (from: number, to: number) => {
      try {
        const { EnhancedDragDropDev } = await import('./enhanced-dragdrop-dev');
        const devSystem = EnhancedDragDropDev.getInstance();
        return await devSystem.testMove(from, to);
      } catch (error) {
        console.error('❌ testMove failed:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    };

    (window as any).showState = async () => {
      try {
        const { EnhancedDragDropDev } = await import('./enhanced-dragdrop-dev');
        const devSystem = EnhancedDragDropDev.getInstance();
        return await devSystem.showState();
      } catch (error) {
        console.error('❌ showState failed:', error);
        return null;
      }
    };

    console.log('🔧 Global test functions exposed:');
    console.log('  - runAllTests() - Comprehensive test suite');
    console.log('  - testMove(from, to) - Test individual move');
    console.log('  - showState() - Show current bookmark state');
    console.log('  - getTestResults() - View test results');
    console.log('  - clearTestResults() - Clear test results');
  }
}
