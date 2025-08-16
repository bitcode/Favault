/**
 * Enhanced Drag-Drop Development Testing Module
 * Automatically injects testing functionality into the extension
 * Eliminates manual copy-paste workflow
 */

export class EnhancedDragDropDev {
  private static instance: EnhancedDragDropDev;
  private folderBookmarkIds = new Map<number, string>();
  private parentId = '1'; // Bookmarks folder
  private isInitialized = false;
  private testResults: any[] = [];

  static getInstance(): EnhancedDragDropDev {
    if (!EnhancedDragDropDev.instance) {
      EnhancedDragDropDev.instance = new EnhancedDragDropDev();
    }
    return EnhancedDragDropDev.instance;
  }

  /**
   * Initialize the development testing system
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🔧 Initializing Enhanced Drag-Drop Development System...');
      
      // Map DOM folders to Chrome bookmark IDs
      await this.mapFolders();
      
      // Expose global testing functions
      this.exposeGlobalFunctions();
      
      this.isInitialized = true;
      console.log('✅ Enhanced Drag-Drop Development System Ready!');
      console.log('📋 Available functions: testMove(), showState(), runTests()');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize development system:', error);
      return false;
    }
  }

  /**
   * Map DOM folders to Chrome bookmark IDs
   */
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

  /**
   * Find bookmark folder by title in the tree
   */
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

  /**
   * Get current Chrome bookmark positions
   */
  async getCurrentPositions(): Promise<{ positions: Record<string, any>, folders: chrome.bookmarks.BookmarkTreeNode[] } | null> {
    try {
      const children = await chrome.bookmarks.getChildren(this.parentId);
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

  /**
   * Test move operation with verification
   */
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
        parentId: this.parentId,
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

  /**
   * Show current state (concise version)
   */
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

  /**
   * Run automated test suite
   */
  async runTests(): Promise<any[]> {
    console.log('🧪 Running automated test suite...');
    
    const tests = [
      { from: 4, to: 2, name: 'Move folder 4 to position 2' },
      { from: 8, to: 5, name: 'Move folder 8 to position 5' },
      { from: 12, to: 1, name: 'Move folder 12 to position 1' }
    ];

    const results = [];
    
    for (const test of tests) {
      console.log(`🔄 ${test.name}...`);
      const result = await this.testMove(test.from, test.to);
      results.push(result);
      
      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('🎉 Test suite complete!');
    console.log(`✅ ${results.filter(r => r.success).length}/${results.length} tests passed`);

    return results;
  }

  /**
   * Get test results summary
   */
  getTestResults(): any[] {
    return this.testResults;
  }

  /**
   * Clear test results
   */
  clearTestResults(): void {
    this.testResults = [];
    console.log('🗑️ Test results cleared');
  }

  /**
   * Expose global functions for console access
   */
  private exposeGlobalFunctions(): void {
    if (typeof window !== 'undefined') {
      // Only expose if not already exposed by test-automation
      if (typeof (window as any).testMove === 'undefined') {
        (window as any).testMove = (from: number, to: number) => this.testMove(from, to);
      }
      if (typeof (window as any).showState === 'undefined') {
        (window as any).showState = () => this.showState();
      }

      // Expose dev-specific functions
      (window as any).runTests = () => this.runTests();
      (window as any).devDragDrop = this;

      console.log('🔧 Enhanced Drag-Drop Dev functions available:');
      console.log('  - testMove(from, to) - Test individual move');
      console.log('  - showState() - Show current bookmark state');
      console.log('  - runTests() - Run quick test suite');
    }
  }
}
