import { test as base, Page, BrowserContext } from '@playwright/test';
import { TestDataSetup, TestDataConfig, TestDataState } from './test-data-setup';
import { BookmarkTestUtils } from './bookmark-utils';

/**
 * Playwright test integration for FaVault test data setup
 * Provides seamless integration with automated testing workflows
 */

export interface TestDataFixtures {
  testDataSetup: TestDataSetup;
  bookmarkUtils: BookmarkTestUtils;
  testDataState: TestDataState;
}

/**
 * Extended Playwright test with test data setup fixtures
 */
export const testWithData = base.extend<TestDataFixtures>({
  /**
   * Test data setup fixture - automatically initializes and cleans up
   */
  testDataSetup: async ({ page, context }, use) => {
    const setup = new TestDataSetup(page, context);
    
    // Initialize with default config
    await setup.initialize({
      folderCount: 5,
      bookmarksPerFolder: 3,
      includeDragTestFolders: true,
      includeEdgeCases: true
    });

    await use(setup);

    // Cleanup after test
    try {
      await setup.clearTestData();
    } catch (error) {
      console.warn('⚠️ Cleanup warning:', error.message);
    }
  },

  /**
   * Bookmark utilities fixture
   */
  bookmarkUtils: async ({ page }, use) => {
    const utils = new BookmarkTestUtils(page);
    await use(utils);
  },

  /**
   * Test data state fixture - provides access to generated test data
   */
  testDataState: async ({ testDataSetup }, use) => {
    // Generate test data
    const state = await testDataSetup.generateTestData();
    
    // Wait for data to sync
    await testDataSetup.waitForBookmarkSync();
    
    await use(state);
  }
});

/**
 * Test data setup manager for complex test scenarios
 */
export class TestDataManager {
  private setups: Map<string, TestDataSetup> = new Map();
  private activeSetup: TestDataSetup | null = null;

  /**
   * Create a new test data setup for a specific scenario
   */
  async createSetup(
    scenarioName: string, 
    page: Page, 
    context: BrowserContext, 
    config?: TestDataConfig
  ): Promise<TestDataSetup> {
    const setup = new TestDataSetup(page, context);
    await setup.initialize(config);
    
    this.setups.set(scenarioName, setup);
    this.activeSetup = setup;
    
    return setup;
  }

  /**
   * Switch to a different test data setup
   */
  switchToSetup(scenarioName: string): TestDataSetup | null {
    const setup = this.setups.get(scenarioName);
    if (setup) {
      this.activeSetup = setup;
      return setup;
    }
    return null;
  }

  /**
   * Get current active setup
   */
  getActiveSetup(): TestDataSetup | null {
    return this.activeSetup;
  }

  /**
   * Clean up all setups
   */
  async cleanupAll(): Promise<void> {
    const cleanupPromises = Array.from(this.setups.values()).map(setup => 
      setup.clearTestData().catch(error => 
        console.warn('Cleanup warning for setup:', error.message)
      )
    );
    
    await Promise.all(cleanupPromises);
    this.setups.clear();
    this.activeSetup = null;
  }

  /**
   * Generate test data for multiple scenarios
   */
  async generateMultiScenarioData(scenarios: {
    name: string;
    config: TestDataConfig;
  }[]): Promise<Map<string, TestDataState>> {
    const results = new Map<string, TestDataState>();
    
    for (const scenario of scenarios) {
      const setup = this.setups.get(scenario.name);
      if (setup) {
        await setup.initialize(scenario.config);
        const state = await setup.generateTestData();
        results.set(scenario.name, state);
      }
    }
    
    return results;
  }
}

/**
 * Predefined test data configurations for common scenarios
 */
export const TestDataConfigs = {
  /**
   * Basic testing configuration
   */
  basic: {
    folderCount: 3,
    bookmarksPerFolder: 2,
    maxNestingLevel: 1,
    includeEmptyFolders: false,
    includeSpecialCharacters: false,
    includeDragTestFolders: false
  } as TestDataConfig,

  /**
   * Drag and drop testing configuration
   */
  dragDrop: {
    folderCount: 4,
    bookmarksPerFolder: 3,
    maxNestingLevel: 2,
    includeEmptyFolders: true,
    includeDragTestFolders: true,
    includeReorderableItems: true,
    includeProtectedFolders: false
  } as TestDataConfig,

  /**
   * Edge cases testing configuration
   */
  edgeCases: {
    folderCount: 6,
    bookmarksPerFolder: 4,
    maxNestingLevel: 3,
    includeEmptyFolders: true,
    includeSpecialCharacters: true,
    includeLongTitles: true,
    includeSpecialUrls: true
  } as TestDataConfig,

  /**
   * Performance testing configuration
   */
  performance: {
    folderCount: 10,
    bookmarksPerFolder: 10,
    maxNestingLevel: 2,
    includeEmptyFolders: false,
    includeSpecialCharacters: false,
    includeDragTestFolders: true
  } as TestDataConfig,

  /**
   * Cross-browser compatibility testing
   */
  crossBrowser: {
    folderCount: 5,
    bookmarksPerFolder: 3,
    maxNestingLevel: 2,
    includeEmptyFolders: true,
    includeSpecialCharacters: true,
    includeDragTestFolders: true,
    includeSpecialUrls: false // Some special URLs might not work across all browsers
  } as TestDataConfig,

  /**
   * Minimal testing configuration
   */
  minimal: {
    folderCount: 2,
    bookmarksPerFolder: 1,
    maxNestingLevel: 1,
    includeEmptyFolders: false,
    includeSpecialCharacters: false,
    includeDragTestFolders: false
  } as TestDataConfig
};

/**
 * Test data setup helpers for common operations
 */
export class TestDataHelpers {
  /**
   * Setup test data for drag-and-drop testing
   */
  static async setupDragDropTest(
    page: Page, 
    context: BrowserContext
  ): Promise<{
    setup: TestDataSetup;
    scenarios: any;
    utils: BookmarkTestUtils;
  }> {
    const setup = new TestDataSetup(page, context);
    await setup.initialize(TestDataConfigs.dragDrop);
    
    const state = await setup.generateTestData();
    const scenarios = await setup.generateDragDropScenarios();
    await setup.waitForBookmarkSync();
    
    const utils = new BookmarkTestUtils(page);
    await utils.waitForBookmarksToLoad();
    
    return { setup, scenarios, utils };
  }

  /**
   * Setup test data for edge case testing
   */
  static async setupEdgeCaseTest(
    page: Page, 
    context: BrowserContext
  ): Promise<{
    setup: TestDataSetup;
    utils: BookmarkTestUtils;
    validation: any;
  }> {
    const setup = new TestDataSetup(page, context);
    await setup.initialize(TestDataConfigs.edgeCases);
    
    await setup.generateTestData();
    await setup.generateBoundaryConditions();
    await setup.waitForBookmarkSync();
    
    const utils = new BookmarkTestUtils(page);
    await utils.waitForBookmarksToLoad();
    
    const validation = await setup.validateTestData();
    
    return { setup, utils, validation };
  }

  /**
   * Setup minimal test data for quick tests
   */
  static async setupMinimalTest(
    page: Page, 
    context: BrowserContext
  ): Promise<{
    setup: TestDataSetup;
    utils: BookmarkTestUtils;
  }> {
    const setup = new TestDataSetup(page, context);
    await setup.initialize(TestDataConfigs.minimal);
    
    await setup.generateTestData();
    await setup.waitForBookmarkSync(1000); // Shorter wait for minimal data
    
    const utils = new BookmarkTestUtils(page);
    await utils.waitForBookmarksToLoad();
    
    return { setup, utils };
  }

  /**
   * Verify test data integrity across browser refresh
   */
  static async verifyDataPersistence(
    page: Page,
    setup: TestDataSetup
  ): Promise<boolean> {
    const beforeRefresh = setup.getTestDataState();
    
    // Refresh the page
    await page.reload();
    await page.waitForTimeout(2000);
    
    // Validate data still exists
    const validation = await setup.validateTestData();
    
    return validation.isValid && 
           validation.summary.totalFolders === beforeRefresh.createdFolders.length &&
           validation.summary.totalBookmarks === beforeRefresh.createdBookmarks.length;
  }

  /**
   * Generate test report for data setup
   */
  static generateTestReport(setup: TestDataSetup): {
    timestamp: string;
    summary: any;
    config: any;
    recommendations: string[];
  } {
    const summary = setup.getTestDataSummary();
    const timestamp = new Date().toISOString();
    
    const recommendations: string[] = [];
    
    // Generate recommendations based on test data
    if (summary.state.createdFolders.length < 3) {
      recommendations.push('Consider adding more folders for comprehensive testing');
    }
    
    if (summary.state.createdBookmarks.length < 5) {
      recommendations.push('Consider adding more bookmarks for thorough validation');
    }
    
    if (!summary.foldersByType.dragTest) {
      recommendations.push('Add drag-and-drop specific test folders');
    }
    
    if (!summary.foldersByType.empty) {
      recommendations.push('Include empty folders for edge case testing');
    }
    
    return {
      timestamp,
      summary,
      config: summary.config,
      recommendations
    };
  }
}

/**
 * Export commonly used test patterns
 */
export { TestDataSetup, TestDataConfig, TestDataState };
