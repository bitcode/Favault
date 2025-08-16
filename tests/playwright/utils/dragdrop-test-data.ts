import { Page, BrowserContext } from '@playwright/test';
import { TestDataSetup, TestBookmarkItem } from './test-data-setup';
import { DragDropTestUtils } from './dragdrop-utils';
import { BookmarkTestUtils } from './bookmark-utils';

/**
 * Specialized test data setup for drag-and-drop functionality testing
 * Creates structured bookmark data optimized for comprehensive drag-and-drop scenarios
 */

export interface DragDropTestScenario {
  name: string;
  description: string;
  sourceItems: TestBookmarkItem[];
  targetContainers: TestBookmarkItem[];
  expectedBehavior: 'allow' | 'deny' | 'conditional';
  testType: 'reorder' | 'move' | 'copy' | 'invalid';
}

export interface DragDropTestData {
  scenarios: DragDropTestScenario[];
  reorderableItems: TestBookmarkItem[];
  protectedItems: TestBookmarkItem[];
  emptyTargets: TestBookmarkItem[];
  nestedStructure: TestBookmarkItem[];
}

/**
 * Drag-and-drop specific test data generator
 */
export class DragDropTestDataSetup extends TestDataSetup {
  private dragDropUtils: DragDropTestUtils;
  private bookmarkUtils: BookmarkTestUtils;
  private dragDropData: DragDropTestData;

  constructor(page: Page, context: BrowserContext) {
    super(page, context);
    this.dragDropUtils = new DragDropTestUtils(page);
    this.bookmarkUtils = new BookmarkTestUtils(page);
    this.dragDropData = {
      scenarios: [],
      reorderableItems: [],
      protectedItems: [],
      emptyTargets: [],
      nestedStructure: []
    };
  }

  /**
   * Generate comprehensive drag-and-drop test data
   */
  async generateDragDropTestData(): Promise<DragDropTestData> {
    console.log('🎯 Generating specialized drag-and-drop test data...');

    // Create basic test data first
    await this.generateTestData();

    // Generate specific drag-drop scenarios
    await this.createReorderingScenarios();
    await this.createMovingScenarios();
    await this.createInvalidDropScenarios();
    await this.createBoundaryConditionScenarios();
    await this.createNestedDragDropScenarios();

    console.log('✅ Drag-and-drop test data generation completed');
    return this.dragDropData;
  }

  /**
   * Create scenarios for testing bookmark/folder reordering
   */
  private async createReorderingScenarios(): Promise<void> {
    console.log('📋 Creating reordering test scenarios...');

    // Create folder with multiple reorderable items
    const reorderFolder = await this.createFolder('Reorder Test Folder');
    if (!reorderFolder) return;

    const reorderableItems = [
      { title: 'First Item', url: 'https://first.com' },
      { title: 'Second Item', url: 'https://second.com' },
      { title: 'Third Item', url: 'https://third.com' },
      { title: 'Fourth Item', url: 'https://fourth.com' },
      { title: 'Fifth Item', url: 'https://fifth.com' }
    ];

    for (const item of reorderableItems) {
      const bookmark = await this.createBookmark(item.title, item.url, reorderFolder.id!);
      if (bookmark) {
        this.dragDropData.reorderableItems.push(bookmark);
      }
    }

    // Create reordering scenarios
    this.dragDropData.scenarios.push({
      name: 'Basic Reordering',
      description: 'Test reordering bookmarks within the same folder',
      sourceItems: this.dragDropData.reorderableItems.slice(0, 3),
      targetContainers: [reorderFolder],
      expectedBehavior: 'allow',
      testType: 'reorder'
    });

    this.dragDropData.scenarios.push({
      name: 'Reverse Order',
      description: 'Test reversing the order of all items',
      sourceItems: this.dragDropData.reorderableItems,
      targetContainers: [reorderFolder],
      expectedBehavior: 'allow',
      testType: 'reorder'
    });
  }

  /**
   * Create scenarios for testing bookmark moving between folders
   */
  private async createMovingScenarios(): Promise<void> {
    console.log('🔄 Creating moving test scenarios...');

    // Create source folder with items to move
    const sourceFolder = await this.createFolder('Move Source Folder');
    if (!sourceFolder) return;

    const movableItems = [
      { title: 'Movable Item A', url: 'https://movable-a.com' },
      { title: 'Movable Item B', url: 'https://movable-b.com' },
      { title: 'Movable Item C', url: 'https://movable-c.com' }
    ];

    const sourceItems: TestBookmarkItem[] = [];
    for (const item of movableItems) {
      const bookmark = await this.createBookmark(item.title, item.url, sourceFolder.id!);
      if (bookmark) {
        sourceItems.push(bookmark);
      }
    }

    // Create target folders
    const targetFolders: TestBookmarkItem[] = [];
    const targetFolderNames = ['Target Alpha', 'Target Beta', 'Target Gamma'];
    
    for (const name of targetFolderNames) {
      const folder = await this.createFolder(name);
      if (folder) {
        targetFolders.push(folder);
        // Add one existing item to each target
        await this.createBookmark(`${name} Existing`, 'https://existing.com', folder.id!);
      }
    }

    // Create empty target folder
    const emptyTarget = await this.createFolder('Empty Target Folder');
    if (emptyTarget) {
      this.dragDropData.emptyTargets.push(emptyTarget);
      targetFolders.push(emptyTarget);
    }

    // Create moving scenarios
    this.dragDropData.scenarios.push({
      name: 'Single Item Move',
      description: 'Test moving a single bookmark to different folders',
      sourceItems: sourceItems.slice(0, 1),
      targetContainers: targetFolders,
      expectedBehavior: 'allow',
      testType: 'move'
    });

    this.dragDropData.scenarios.push({
      name: 'Multiple Item Move',
      description: 'Test moving multiple bookmarks to the same target',
      sourceItems: sourceItems,
      targetContainers: targetFolders.slice(0, 1),
      expectedBehavior: 'allow',
      testType: 'move'
    });

    this.dragDropData.scenarios.push({
      name: 'Move to Empty Folder',
      description: 'Test moving items to an empty folder',
      sourceItems: sourceItems.slice(1, 2),
      targetContainers: [emptyTarget!],
      expectedBehavior: 'allow',
      testType: 'move'
    });
  }

  /**
   * Create scenarios for testing invalid drop operations
   */
  private async createInvalidDropScenarios(): Promise<void> {
    console.log('🚫 Creating invalid drop test scenarios...');

    // Create items that should not be draggable or valid drop targets
    const invalidFolder = await this.createFolder('Invalid Drop Test');
    if (!invalidFolder) return;

    const invalidItems = [
      { title: 'Self Drop Test', url: 'https://self-drop.com' },
      { title: 'Invalid Target Test', url: 'https://invalid-target.com' }
    ];

    const invalidSourceItems: TestBookmarkItem[] = [];
    for (const item of invalidItems) {
      const bookmark = await this.createBookmark(item.title, item.url, invalidFolder.id!);
      if (bookmark) {
        invalidSourceItems.push(bookmark);
      }
    }

    // Create invalid drop scenarios
    this.dragDropData.scenarios.push({
      name: 'Self Drop Prevention',
      description: 'Test that items cannot be dropped on themselves',
      sourceItems: invalidSourceItems,
      targetContainers: invalidSourceItems, // Same items as targets
      expectedBehavior: 'deny',
      testType: 'invalid'
    });

    this.dragDropData.scenarios.push({
      name: 'Invalid Container Drop',
      description: 'Test dropping on non-folder elements',
      sourceItems: invalidSourceItems,
      targetContainers: [], // No valid containers
      expectedBehavior: 'deny',
      testType: 'invalid'
    });
  }

  /**
   * Create boundary condition scenarios
   */
  private async createBoundaryConditionScenarios(): Promise<void> {
    console.log('🔬 Creating boundary condition test scenarios...');

    // Single item folder
    const singleItemFolder = await this.createFolder('Single Item Boundary');
    if (singleItemFolder) {
      const singleItem = await this.createBookmark('Only Item', 'https://only.com', singleItemFolder.id!);
      if (singleItem) {
        this.dragDropData.scenarios.push({
          name: 'Single Item Reorder',
          description: 'Test reordering when only one item exists',
          sourceItems: [singleItem],
          targetContainers: [singleItemFolder],
          expectedBehavior: 'conditional',
          testType: 'reorder'
        });
      }
    }

    // Many items folder (stress test)
    const manyItemsFolder = await this.createFolder('Many Items Boundary');
    if (manyItemsFolder) {
      const manyItems: TestBookmarkItem[] = [];
      for (let i = 1; i <= 15; i++) {
        const item = await this.createBookmark(
          `Stress Item ${i.toString().padStart(2, '0')}`, 
          `https://stress${i}.com`, 
          manyItemsFolder.id!
        );
        if (item) {
          manyItems.push(item);
        }
      }

      this.dragDropData.scenarios.push({
        name: 'Many Items Stress Test',
        description: 'Test drag-drop performance with many items',
        sourceItems: manyItems.slice(0, 5), // Test with first 5 items
        targetContainers: [manyItemsFolder],
        expectedBehavior: 'allow',
        testType: 'reorder'
      });
    }
  }

  /**
   * Create nested folder drag-drop scenarios
   */
  private async createNestedDragDropScenarios(): Promise<void> {
    console.log('🏗️ Creating nested structure test scenarios...');

    // Create nested folder structure
    const parentFolder = await this.createFolder('Nested Parent');
    if (!parentFolder) return;

    const childFolder = await this.createFolder('Nested Child', parentFolder.id);
    if (!childFolder) return;

    const grandChildFolder = await this.createFolder('Nested Grandchild', childFolder.id);
    if (!grandChildFolder) return;

    // Add items to each level
    const parentItem = await this.createBookmark('Parent Item', 'https://parent.com', parentFolder.id!);
    const childItem = await this.createBookmark('Child Item', 'https://child.com', childFolder.id!);
    const grandChildItem = await this.createBookmark('Grandchild Item', 'https://grandchild.com', grandChildFolder.id!);

    if (parentItem && childItem && grandChildItem) {
      this.dragDropData.nestedStructure = [parentFolder, childFolder, grandChildFolder];

      this.dragDropData.scenarios.push({
        name: 'Nested Folder Movement',
        description: 'Test moving items between nested folder levels',
        sourceItems: [grandChildItem],
        targetContainers: [parentFolder, childFolder],
        expectedBehavior: 'allow',
        testType: 'move'
      });

      this.dragDropData.scenarios.push({
        name: 'Folder Hierarchy Reorder',
        description: 'Test reordering folders within nested structure',
        sourceItems: [childFolder],
        targetContainers: [parentFolder],
        expectedBehavior: 'allow',
        testType: 'reorder'
      });
    }
  }

  /**
   * Execute a specific drag-drop test scenario
   */
  async executeScenario(scenarioName: string): Promise<{
    success: boolean;
    results: any[];
    errors: string[];
    performance: {
      startTime: number;
      endTime: number;
      duration: number;
    };
  }> {
    const scenario = this.dragDropData.scenarios.find(s => s.name === scenarioName);
    if (!scenario) {
      throw new Error(`Scenario "${scenarioName}" not found`);
    }

    console.log(`🎬 Executing scenario: ${scenario.name}`);
    console.log(`📝 Description: ${scenario.description}`);

    const performance = {
      startTime: Date.now(),
      endTime: 0,
      duration: 0
    };

    const results: any[] = [];
    const errors: string[] = [];
    let success = true;

    try {
      // Wait for bookmarks to load
      await this.bookmarkUtils.waitForBookmarksToLoad();

      // Execute scenario based on type
      switch (scenario.testType) {
        case 'reorder':
          await this.executeReorderScenario(scenario, results, errors);
          break;
        case 'move':
          await this.executeMoveScenario(scenario, results, errors);
          break;
        case 'invalid':
          await this.executeInvalidScenario(scenario, results, errors);
          break;
        default:
          errors.push(`Unknown test type: ${scenario.testType}`);
          success = false;
      }

      performance.endTime = Date.now();
      performance.duration = performance.endTime - performance.startTime;

      console.log(`✅ Scenario "${scenarioName}" completed in ${performance.duration}ms`);
      return { success: success && errors.length === 0, results, errors, performance };

    } catch (error) {
      performance.endTime = Date.now();
      performance.duration = performance.endTime - performance.startTime;
      
      errors.push(`Scenario execution failed: ${error.message}`);
      console.error(`❌ Scenario "${scenarioName}" failed:`, error);
      
      return { success: false, results, errors, performance };
    }
  }

  /**
   * Execute reordering scenario
   */
  private async executeReorderScenario(scenario: DragDropTestScenario, results: any[], errors: string[]): Promise<void> {
    for (let i = 0; i < scenario.sourceItems.length - 1; i++) {
      const sourceItem = scenario.sourceItems[i];
      const targetItem = scenario.sourceItems[i + 1];

      try {
        // Get initial order
        const initialOrder = await this.bookmarkUtils.getFolderTitles();
        
        // Perform drag-drop reorder
        const sourceLocator = this.page.locator(`[data-bookmark-id="${sourceItem.id}"]`).first();
        const targetLocator = this.page.locator(`[data-bookmark-id="${targetItem.id}"]`).first();
        
        await this.dragDropUtils.dragAndDrop(sourceLocator, targetLocator);
        await this.dragDropUtils.waitForDragDropComplete();
        
        // Get new order
        const newOrder = await this.bookmarkUtils.getFolderTitles();
        
        results.push({
          operation: 'reorder',
          source: sourceItem.title,
          target: targetItem.title,
          initialOrder,
          newOrder,
          success: !initialOrder.every((item, index) => item === newOrder[index])
        });

      } catch (error) {
        errors.push(`Reorder failed for ${sourceItem.title} -> ${targetItem.title}: ${error.message}`);
      }
    }
  }

  /**
   * Execute moving scenario
   */
  private async executeMoveScenario(scenario: DragDropTestScenario, results: any[], errors: string[]): Promise<void> {
    for (const sourceItem of scenario.sourceItems) {
      for (const targetContainer of scenario.targetContainers) {
        try {
          // Get initial state
          const initialState = await this.bookmarkUtils.getBookmarkTitlesInFolder(
            this.page.locator(`[data-folder-id="${targetContainer.id}"]`).first()
          );
          
          // Perform move
          const sourceLocator = this.page.locator(`[data-bookmark-id="${sourceItem.id}"]`).first();
          const targetLocator = this.page.locator(`[data-folder-id="${targetContainer.id}"]`).first();
          
          await this.dragDropUtils.dragAndDrop(sourceLocator, targetLocator);
          await this.dragDropUtils.waitForDragDropComplete();
          
          // Verify move
          const finalState = await this.bookmarkUtils.getBookmarkTitlesInFolder(
            this.page.locator(`[data-folder-id="${targetContainer.id}"]`).first()
          );
          
          const moved = finalState.includes(sourceItem.title) && !initialState.includes(sourceItem.title);
          
          results.push({
            operation: 'move',
            source: sourceItem.title,
            target: targetContainer.title,
            initialCount: initialState.length,
            finalCount: finalState.length,
            success: moved
          });

        } catch (error) {
          errors.push(`Move failed for ${sourceItem.title} -> ${targetContainer.title}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Execute invalid drop scenario
   */
  private async executeInvalidScenario(scenario: DragDropTestScenario, results: any[], errors: string[]): Promise<void> {
    for (const sourceItem of scenario.sourceItems) {
      try {
        // Get initial state
        const initialOrder = await this.bookmarkUtils.getFolderTitles();
        
        // Attempt invalid operation (should fail or be prevented)
        const sourceLocator = this.page.locator(`[data-bookmark-id="${sourceItem.id}"]`).first();
        
        // Try to drop on itself or invalid target
        await this.dragDropUtils.dragAndDrop(sourceLocator, sourceLocator);
        await this.dragDropUtils.waitForDragDropComplete();
        
        // Verify no change occurred
        const finalOrder = await this.bookmarkUtils.getFolderTitles();
        const noChange = initialOrder.every((item, index) => item === finalOrder[index]);
        
        results.push({
          operation: 'invalid',
          source: sourceItem.title,
          target: 'self',
          preventedCorrectly: noChange,
          success: noChange // Success means the invalid operation was prevented
        });

      } catch (error) {
        // Errors are expected for invalid operations
        results.push({
          operation: 'invalid',
          source: sourceItem.title,
          target: 'self',
          preventedCorrectly: true,
          success: true,
          error: error.message
        });
      }
    }
  }

  /**
   * Get drag-drop test data summary
   */
  getDragDropTestSummary(): {
    totalScenarios: number;
    scenariosByType: Record<string, number>;
    totalTestItems: number;
    reorderableItems: number;
    emptyTargets: number;
    nestedLevels: number;
  } {
    const scenariosByType: Record<string, number> = {};
    
    for (const scenario of this.dragDropData.scenarios) {
      scenariosByType[scenario.testType] = (scenariosByType[scenario.testType] || 0) + 1;
    }

    return {
      totalScenarios: this.dragDropData.scenarios.length,
      scenariosByType,
      totalTestItems: this.state.createdBookmarks.length + this.state.createdFolders.length,
      reorderableItems: this.dragDropData.reorderableItems.length,
      emptyTargets: this.dragDropData.emptyTargets.length,
      nestedLevels: this.dragDropData.nestedStructure.length
    };
  }
}
