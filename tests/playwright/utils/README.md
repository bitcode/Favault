# FaVault Test Data Setup Utility

A comprehensive test data setup utility for the FaVault browser extension that leverages the Chrome bookmarks API to automatically generate test bookmarks for automated testing workflows.

## Overview

The test data utility provides:

- **Automated Test Data Generation**: Creates diverse bookmark structures with folders, nested hierarchies, and edge cases
- **Drag-and-Drop Test Foundation**: Specialized data structures optimized for drag-and-drop functionality testing
- **Cross-Browser Compatibility**: Adapts to different browser capabilities and limitations
- **Automated Cleanup**: Maintains test isolation by cleaning up test data after completion
- **Playwright Integration**: Seamless integration with existing Playwright testing framework

## Quick Start

### Basic Usage

```typescript
import { DragDropTestDataSetup } from './dragdrop-test-data';
import { TestDataCleanup } from './test-data-cleanup';

// In your test
const testSetup = new DragDropTestDataSetup(page, context);

// Initialize with configuration
await testSetup.initialize({
  folderCount: 5,
  bookmarksPerFolder: 3,
  includeDragTestFolders: true
});

// Generate test data
await testSetup.generateTestData();
await testSetup.waitForBookmarkSync();

// Use for testing...

// Cleanup
const cleanup = new TestDataCleanup(page, context);
await cleanup.cleanup(testSetup.getTestDataState());
```

### Using Test Fixtures

```typescript
import { testWithData } from './test-data-integration';

testWithData('my test', async ({ testDataSetup, bookmarkUtils, testDataState }) => {
  // Test data is automatically generated and cleaned up
  const folders = await bookmarkUtils.getBookmarkFolders();
  expect(folders.length).toBeGreaterThan(0);
});
```

## Core Components

### 1. TestDataSetup

Base class for generating test bookmark data.

```typescript
const setup = new TestDataSetup(page, context);
await setup.initialize(config);
await setup.generateTestData();
```

**Key Methods:**
- `initialize(config)` - Configure test data generation
- `generateTestData()` - Create bookmark structure
- `clearTestData()` - Remove all test data
- `validateTestData()` - Verify data integrity

### 2. DragDropTestDataSetup

Specialized setup for drag-and-drop testing scenarios.

```typescript
const dragSetup = new DragDropTestDataSetup(page, context);
await dragSetup.generateDragDropTestData();
const result = await dragSetup.executeScenario('Basic Reordering');
```

**Features:**
- Reordering scenarios
- Moving scenarios
- Invalid drop scenarios
- Boundary conditions
- Nested folder structures

### 3. CrossBrowserTestDataSetup

Handles browser-specific adaptations and limitations.

```typescript
const crossSetup = new CrossBrowserTestDataSetup(page, context, 'firefox');
await crossSetup.initialize(config); // Automatically adapts for Firefox
```

**Browser Support:**
- Chrome/Chromium: Full API support
- Firefox: Adapted for WebExtensions API
- Safari: Limited support with fallbacks
- Edge: Full API support

### 4. TestDataCleanup

Comprehensive cleanup and test isolation.

```typescript
const cleanup = new TestDataCleanup(page, context);
cleanup.configure({
  preserveUserBookmarks: true,
  backupBeforeCleanup: true
});
await cleanup.cleanup(testDataState);
```

## Configuration Options

### TestDataConfig

```typescript
interface TestDataConfig {
  // Basic structure
  folderCount?: number;              // Number of folders to create
  bookmarksPerFolder?: number;       // Bookmarks per folder
  maxNestingLevel?: number;          // Maximum folder nesting depth
  
  // Special scenarios
  includeEmptyFolders?: boolean;     // Create empty folders
  includeSpecialCharacters?: boolean; // Unicode and special chars
  includeLongTitles?: boolean;       // Test long title handling
  includeSpecialUrls?: boolean;      // Chrome extensions, data URLs, etc.
  
  // Drag-and-drop specific
  includeDragTestFolders?: boolean;  // Folders optimized for drag testing
  includeReorderableItems?: boolean; // Items for reordering tests
  
  // Browser compatibility
  browserType?: 'chrome' | 'firefox' | 'safari' | 'edge';
}
```

### CleanupConfig

```typescript
interface CleanupConfig {
  removeTestBookmarks?: boolean;     // Clean up test bookmarks
  removeTestFolders?: boolean;       // Clean up test folders
  preserveUserBookmarks?: boolean;   // Protect user data
  backupBeforeCleanup?: boolean;     // Create safety backup
  dryRun?: boolean;                  // Preview cleanup without executing
}
```

## Test Scenarios

### Drag-and-Drop Scenarios

The utility generates several predefined scenarios:

1. **Basic Reordering**: Test reordering bookmarks within folders
2. **Single Item Move**: Move individual bookmarks between folders
3. **Multiple Item Move**: Move multiple bookmarks to same target
4. **Self Drop Prevention**: Verify invalid operations are prevented
5. **Nested Folder Movement**: Test moving items between nested levels
6. **Boundary Conditions**: Single items, many items, empty folders

### Example Scenario Execution

```typescript
// Generate test data with scenarios
await dragSetup.generateDragDropTestData();

// Execute specific scenario
const result = await dragSetup.executeScenario('Basic Reordering');

console.log('Scenario result:', {
  success: result.success,
  operations: result.results.length,
  duration: result.performance.duration,
  errors: result.errors
});
```

## Best Practices

### 1. Test Isolation

Always use cleanup to maintain test isolation:

```typescript
test.afterEach(async ({ page, context }) => {
  const cleanup = new TestDataCleanup(page, context);
  await cleanup.cleanup(testDataState);
});
```

### 2. Error Handling

Handle browser compatibility gracefully:

```typescript
const crossSetup = new CrossBrowserTestDataSetup(page, context, browserType);
const compatibility = await crossSetup.validateBrowserCompatibility();

if (!compatibility.isCompatible) {
  test.skip(`Browser ${browserType} not compatible: ${compatibility.warnings}`);
}
```

### 3. Performance Considerations

For large datasets, use appropriate timeouts:

```typescript
await setup.initialize({
  folderCount: 20,
  bookmarksPerFolder: 10
});

// Increase timeout for large datasets
await setup.generateTestData();
await setup.waitForBookmarkSync(5000); // 5 second timeout
```

### 4. Validation

Always validate test data integrity:

```typescript
const validation = await setup.validateTestData();
expect(validation.isValid).toBeTruthy();

if (!validation.isValid) {
  console.error('Test data validation failed:', validation.errors);
}
```

## Troubleshooting

### Common Issues

1. **Bookmark API Not Available**
   - Ensure extension has bookmark permissions
   - Check browser compatibility
   - Use fallback mode for unsupported browsers

2. **Cleanup Failures**
   - Use emergency reset: `await cleanup.emergencyReset()`
   - Check for protected folders
   - Verify test data patterns

3. **Cross-Browser Issues**
   - Check browser capabilities
   - Use appropriate API namespace (chrome vs browser)
   - Adapt configuration for browser limitations

### Debug Mode

Enable detailed logging:

```typescript
// Set debug mode in browser console
window.favaultTestDebug = true;

// Or use console utilities
const consoleUtils = new ConsoleTestUtils(page);
await consoleUtils.startMonitoring();
```

## Integration Examples

### With Existing Tests

```typescript
// Enhance existing drag-drop tests
test('enhanced bookmark reordering', async ({ newTabPage, context }) => {
  const setup = new DragDropTestDataSetup(newTabPage, context);
  await setup.initialize({ includeDragTestFolders: true });
  await setup.generateTestData();
  
  // Your existing test logic here
  // Now with predictable, comprehensive test data
});
```

### Custom Scenarios

```typescript
// Create custom test scenarios
const customSetup = new TestDataSetup(page, context);
await customSetup.initialize();

// Add custom folders
const customFolder = await customSetup.createFolder('Custom Test Folder');
await customSetup.createBookmark('Custom Bookmark', 'https://custom.com', customFolder.id);
```

## API Reference

See individual utility files for complete API documentation:

- `test-data-setup.ts` - Core test data generation
- `dragdrop-test-data.ts` - Drag-and-drop specific scenarios
- `cross-browser-test-data.ts` - Cross-browser compatibility
- `test-data-cleanup.ts` - Cleanup and isolation
- `test-data-integration.ts` - Playwright integration

## Contributing

When adding new test scenarios or utilities:

1. Follow the existing patterns for configuration and cleanup
2. Add comprehensive error handling and validation
3. Include cross-browser compatibility considerations
4. Document new features and configuration options
5. Add example usage in tests
