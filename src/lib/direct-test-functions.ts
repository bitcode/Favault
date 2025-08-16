/**
 * Direct Test Functions - Simple, immediate exposure to global scope
 * This bypasses complex module loading and directly exposes working functions
 */

// Simple test automation that works immediately
class DirectTestAutomation {
  private folderBookmarkIds = new Map<number, string>();
  private testResults: any[] = [];

  async initialize(): Promise<boolean> {
    try {
      console.log('🔧 Direct test automation initializing...');
      
      // Map folders to bookmark IDs
      await this.mapFolders();
      
      console.log('✅ Direct test automation ready');
      return true;
    } catch (error) {
      console.error('❌ Direct test automation failed:', error);
      return false;
    }
  }

  private async mapFolders(): Promise<void> {
    const tree = await chrome.bookmarks.getTree();
    const folders = document.querySelectorAll('.folder-container');
    
    this.folderBookmarkIds.clear();
    
    folders.forEach((folder, index) => {
      const title = folder.querySelector('.folder-title, h3, .folder-name')?.textContent?.trim();
      if (title) {
        const bookmarkFolder = this.findFolder(tree, title);
        if (bookmarkFolder) {
          this.folderBookmarkIds.set(index, bookmarkFolder.id);
        }
      }
    });
    
    console.log(`📁 Mapped ${this.folderBookmarkIds.size} folders to Chrome bookmarks`);
  }

  private findFolder(tree: chrome.bookmarks.BookmarkTreeNode[], title: string): chrome.bookmarks.BookmarkTreeNode | null {
    const search = (node: chrome.bookmarks.BookmarkTreeNode): chrome.bookmarks.BookmarkTreeNode | null => {
      if (node.title === title && node.children && !node.url) return node;
      if (node.children) {
        for (const child of node.children) {
          const result = search(child);
          if (result) return result;
        }
      }
      return null;
    };
    
    for (const root of tree) {
      const result = search(root);
      if (result) return result;
    }
    return null;
  }

  async getCurrentPositions(): Promise<{ positions: Record<string, any>, folders: chrome.bookmarks.BookmarkTreeNode[] } | null> {
    try {
      const children = await chrome.bookmarks.getChildren('1'); // Bookmarks folder
      const folders = children.filter(child => !child.url); // Folders don't have URLs
      
      const positions: Record<string, any> = {};
      folders.forEach((folder, index) => {
        positions[folder.id] = {
          index,
          title: folder.title,
          id: folder.id
        };
      });
      
      return { positions, folders };
    } catch (error) {
      console.error('❌ Failed to get current positions:', error);
      return null;
    }
  }

  async testMove(fromIndex: number, toIndex: number): Promise<any> {
    const bookmarkId = this.folderBookmarkIds.get(fromIndex);
    if (!bookmarkId) {
      const error = `No bookmark ID for folder ${fromIndex}`;
      console.error('❌', error);
      return { success: false, error };
    }

    try {
      // Get before positions
      const beforePositions = await this.getCurrentPositions();
      if (!beforePositions) {
        throw new Error('Failed to get before positions');
      }

      // Get folder info
      const [folder] = await chrome.bookmarks.get(bookmarkId);
      
      // Perform move
      const result = await chrome.bookmarks.move(bookmarkId, {
        parentId: '1', // Bookmarks folder
        index: toIndex
      });

      // Wait for Chrome to update
      await new Promise(resolve => setTimeout(resolve, 200));

      // Get after positions
      const afterPositions = await this.getCurrentPositions();
      if (!afterPositions) {
        throw new Error('Failed to get after positions');
      }

      const beforePos = beforePositions.positions[bookmarkId]?.index;
      const afterPos = afterPositions.positions[bookmarkId]?.index;
      const success = Math.abs(afterPos - toIndex) <= 1;

      const testResult = {
        success,
        folder: folder.title,
        fromIndex,
        toIndex,
        beforePos,
        afterPos,
        timestamp: new Date().toISOString()
      };

      this.testResults.push(testResult);

      // Concise logging
      console.log(`${success ? '✅' : '❌'} "${folder.title}": ${fromIndex}→${toIndex} (Chrome: ${beforePos}→${afterPos})`);

      return testResult;
    } catch (error) {
      const testResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        fromIndex,
        toIndex,
        timestamp: new Date().toISOString()
      };

      this.testResults.push(testResult);
      console.error('❌ Move failed:', error);
      return testResult;
    }
  }

  async showState(): Promise<any> {
    const positions = await this.getCurrentPositions();
    if (!positions) {
      console.error('❌ Failed to get current state');
      return null;
    }

    console.log(`📊 ${positions.folders.length} folders in Chrome bookmarks`);
    
    // Show first 10 folders for verification
    positions.folders.slice(0, 10).forEach((folder, index) => {
      const domIndex = Array.from(this.folderBookmarkIds.entries())
        .find(([, id]) => id === folder.id)?.[0] ?? -1;
      console.log(`  ${index}: "${folder.title}" (DOM[${domIndex}])`);
    });

    if (positions.folders.length > 10) {
      console.log(`  ... and ${positions.folders.length - 10} more folders`);
    }

    return positions;
  }

  async runAllTests(): Promise<any[]> {
    console.log('🚀 Starting comprehensive test suite...');
    
    const tests = [
      { name: 'System Initialization', test: () => this.testSystemInit() },
      { name: 'Folder Mapping', test: () => this.testFolderMapping() },
      { name: 'Position Verification', test: () => this.testPositionVerification() },
      { name: 'Move Operations', test: () => this.testMoveOperations() },
      { name: 'Edge Cases', test: () => this.testEdgeCases() }
    ];

    const results = [];
    
    for (const test of tests) {
      const startTime = Date.now();
      try {
        console.log(`🧪 Running: ${test.name}...`);
        const result = await test.test();
        const duration = Date.now() - startTime;
        
        const testResult = {
          name: test.name,
          success: true,
          duration,
          details: result,
          timestamp: new Date().toISOString()
        };
        
        results.push(testResult);
        console.log(`✅ ${test.name} passed (${duration}ms)`);
        
      } catch (error) {
        const duration = Date.now() - startTime;
        const testResult = {
          name: test.name,
          success: false,
          duration,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        };
        
        results.push(testResult);
        console.error(`❌ ${test.name} failed (${duration}ms):`, error);
      }
      
      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const passed = results.filter(r => r.success).length;
    const total = results.length;
    
    console.log(`🎉 Test suite complete: ${passed}/${total} tests passed`);
    console.log('📊 TEST RESULTS SUMMARY:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${total - passed}`);
    console.log(`⏱️ Total Duration: ${results.reduce((sum, r) => sum + r.duration, 0)}ms`);
    
    if (total - passed > 0) {
      console.log('❌ Failed Tests:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
    }

    // Copy to clipboard
    const summary = { passed, failed: total - passed, total, results };
    try {
      await navigator.clipboard.writeText(JSON.stringify(summary, null, 2));
      console.log('📋 Test results copied to clipboard');
    } catch {
      console.log('📋 Test results available in console');
    }

    return results;
  }

  private async testSystemInit(): Promise<any> {
    await this.initialize();
    return { initialized: true };
  }

  private async testFolderMapping(): Promise<any> {
    const folders = document.querySelectorAll('.folder-container');
    const tree = await chrome.bookmarks.getTree();
    
    if (folders.length === 0) {
      throw new Error('No folder containers found in DOM');
    }
    
    if (!tree || tree.length === 0) {
      throw new Error('Failed to get bookmark tree');
    }
    
    return { domFolders: folders.length, bookmarkTree: tree.length };
  }

  private async testPositionVerification(): Promise<any> {
    const children = await chrome.bookmarks.getChildren('1');
    const folders = children.filter(child => !child.url);
    
    if (folders.length === 0) {
      throw new Error('No folders found in Chrome bookmarks');
    }
    
    return { totalChildren: children.length, folders: folders.length };
  }

  private async testMoveOperations(): Promise<any> {
    const result = await this.testMove(4, 2);
    
    if (!result.success) {
      throw new Error(`Move operation failed: ${result.error}`);
    }
    
    return result;
  }

  private async testEdgeCases(): Promise<any> {
    const invalidResult = await this.testMove(999, 0);
    
    if (invalidResult.success) {
      throw new Error('Expected invalid move to fail');
    }
    
    return { invalidMoveHandled: true };
  }

  getTestResults(): any[] {
    return this.testResults;
  }

  clearTestResults(): void {
    this.testResults = [];
    console.log('🗑️ Test results cleared');
  }
}

// Create global instance and expose functions immediately
const directTestAutomation = new DirectTestAutomation();

// Expose functions to global scope immediately
export function exposeDirectTestFunctions(): void {
  if (typeof window !== 'undefined') {
    console.log('🔧 Exposing direct test functions to global scope...');
    
    // Expose main functions
    (window as any).runAllTests = () => directTestAutomation.runAllTests();
    (window as any).testMove = (from: number, to: number) => directTestAutomation.testMove(from, to);
    (window as any).showState = () => directTestAutomation.showState();
    (window as any).getTestResults = () => directTestAutomation.getTestResults();
    (window as any).clearTestResults = () => directTestAutomation.clearTestResults();
    
    // Expose the automation object itself
    (window as any).directTestAutomation = directTestAutomation;
    
    console.log('✅ Direct test functions exposed:');
    console.log('  - runAllTests() - Comprehensive test suite');
    console.log('  - testMove(from, to) - Test individual move');
    console.log('  - showState() - Show current bookmark state');
    console.log('  - getTestResults() - View test results');
    console.log('  - clearTestResults() - Clear test results');
    
    // Auto-initialize
    setTimeout(() => {
      directTestAutomation.initialize().then(() => {
        console.log('🎉 Direct test automation ready! Try: runAllTests()');
      });
    }, 1000);
  }
}
