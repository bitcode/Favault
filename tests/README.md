# FaVault Extension Automated Testing

This directory contains a comprehensive automated testing suite for the FaVault browser extension, built with Playwright. The testing framework replaces manual copy-paste console testing with a robust, automated workflow that validates extension functionality across different browsers.

## 🎯 Overview

The automated testing system provides:

- **Browser Extension Testing**: Load and interact with the FaVault extension in test environments
- **Bookmark Management Testing**: Validate bookmark loading, folder organization, and search functionality
- **Drag-and-Drop Testing**: Test folder reordering, bookmark moving, and protected folder validation
- **Cross-Browser Compatibility**: Ensure consistent behavior across Chrome, Firefox, Safari, and Edge
- **Visual Regression Testing**: Detect UI changes and maintain visual consistency
- **Console & Network Monitoring**: Capture console messages, monitor network requests, and inject test scripts
- **Performance Testing**: Validate extension performance and resource usage

## 📁 Directory Structure

```
tests/
├── playwright/
│   ├── fixtures/
│   │   └── extension.ts          # Extension loading and test fixtures
│   ├── utils/
│   │   ├── bookmark-utils.ts     # Bookmark testing utilities
│   │   ├── dragdrop-utils.ts     # Drag-and-drop testing utilities
│   │   └── console-utils.ts      # Console and network utilities
│   └── specs/
│       ├── bookmark-management.test.ts
│       ├── dragdrop-functionality.test.ts
│       ├── ui-components-visual.test.ts
│       ├── console-network-testing.test.ts
│       └── cross-browser-compatibility.test.ts
├── global-setup.ts               # Global test setup
├── global-teardown.ts            # Global test cleanup
└── README.md                     # This file
```

## 🚀 Quick Start

### Prerequisites

1. Node.js 20+ installed
2. FaVault extension built (`npm run build:chrome`)
3. Playwright installed (`npm run test:install`)

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm run test:bookmarks
npm run test:dragdrop
npm run test:ui-visual
npm run test:console
npm run test:cross-browser

# Run tests in headed mode (visible browser)
npm run test:headed

# Run tests with UI mode (interactive)
npm run test:ui

# Run tests in debug mode
npm run test:debug

# Show test report
npm run test:report
```

### Using the Test Runner Script

```bash
# Run all tests with custom options
node scripts/run-tests.js --suite all --browser chrome --headed

# Run specific suite in debug mode
node scripts/run-tests.js --suite dragdrop --debug

# Run tests and show report
node scripts/run-tests.js --suite bookmarks --report

# Show help
node scripts/run-tests.js --help
```

## 🧪 Test Suites

### 1. Bookmark Management (`bookmark-management.test.ts`)

Tests core bookmark functionality:
- Extension loading and initialization
- Bookmark folder display and organization
- Search functionality and keyboard shortcuts
- Bookmark URL validation and navigation
- Empty state handling
- Performance with large bookmark collections

### 2. Drag-and-Drop Functionality (`dragdrop-functionality.test.ts`)

Tests drag-and-drop features:
- Edit mode activation and visual feedback
- Folder reordering via drag-and-drop
- Protected folder validation (cannot be moved)
- Bookmark moving between folders
- Chrome bookmarks API integration
- Error handling and edge cases

### 3. UI Components & Visual (`ui-components-visual.test.ts`)

Tests user interface and visual elements:
- Svelte component rendering
- Visual regression testing with screenshots
- Responsive design across different viewport sizes
- Theme switching (dark/light mode)
- Settings panel functionality
- Loading and error states

### 4. Console & Network Testing (`console-network-testing.test.ts`)

Tests debugging and monitoring capabilities:
- Console message capture during extension loading
- Chrome extension API call monitoring
- Network request and response tracking
- Test script injection and execution
- Performance metrics collection
- JavaScript error detection

### 5. Cross-Browser Compatibility (`cross-browser-compatibility.test.ts`)

Tests extension behavior across browsers:
- Chrome/Chromium extension loading
- Edge extension compatibility
- Firefox extension support (limited)
- Browser-specific API availability
- Keyboard shortcut consistency
- Performance comparison across browsers

## 🔧 Configuration

### Playwright Configuration (`playwright.config.ts`)

The configuration includes:
- Multiple browser projects (Chrome, Edge, Firefox)
- Extension loading with proper arguments
- Test timeouts and retry settings
- Reporter configuration (HTML, JSON, JUnit)
- Screenshot and video capture on failures

### Test Fixtures (`fixtures/extension.ts`)

Provides reusable test fixtures:
- `context`: Browser context with extension loaded
- `extensionId`: Extracted extension ID
- `extensionPage`: Extension popup page
- `newTabPage`: New tab page with extension

### Utility Classes

- **BookmarkTestUtils**: Methods for interacting with bookmarks and folders
- **DragDropTestUtils**: Drag-and-drop simulation and validation
- **ConsoleTestUtils**: Console monitoring and script injection
- **ExtensionTestUtils**: General extension utilities

## 📊 Test Reports

Tests generate comprehensive reports including:
- HTML reports with screenshots and videos
- JSON results for programmatic analysis
- JUnit XML for CI/CD integration
- Console logs and network activity
- Performance metrics and timing data

## 🔄 CI/CD Integration

### GitHub Actions Workflow (`.github/workflows/test-automation.yml`)

Automated testing pipeline includes:
- Extension building for all browsers
- Parallel test execution across test suites
- Cross-browser compatibility testing
- Visual regression testing
- Performance monitoring
- Test result aggregation and reporting

### Workflow Triggers

- **Push**: Runs on main/master/develop branches
- **Pull Request**: Validates changes before merge
- **Schedule**: Daily automated testing at 2 AM UTC
- **Manual**: On-demand testing with custom parameters

## 🛠️ Development Workflow

### Adding New Tests

1. Create test file in `tests/playwright/specs/`
2. Import required fixtures and utilities
3. Write test cases using Playwright API
4. Add test script to `package.json`
5. Update CI/CD workflow if needed

### Debugging Tests

```bash
# Run single test in debug mode
npx playwright test tests/playwright/specs/bookmark-management.test.ts --debug

# Run with headed browser
npx playwright test --headed

# Use UI mode for interactive debugging
npx playwright test --ui
```

### Updating Visual Baselines

```bash
# Update all screenshots
npx playwright test --update-snapshots

# Update specific test screenshots
npx playwright test ui-components-visual.test.ts --update-snapshots
```

## 📈 Performance Monitoring

The testing suite monitors:
- Extension loading time
- Bookmark rendering performance
- Memory usage during operations
- Network request timing
- Drag-and-drop operation speed

Performance thresholds are configured to fail tests if the extension becomes too slow.

## 🔍 Troubleshooting

### Common Issues

1. **Extension not loading**: Ensure extension is built (`npm run build:chrome`)
2. **Playwright not installed**: Run `npm run test:install`
3. **Tests timing out**: Increase timeout in `playwright.config.ts`
4. **Visual regression failures**: Update snapshots with `--update-snapshots`
5. **Browser not found**: Install browsers with `npx playwright install`

### Debug Information

Tests capture extensive debug information:
- Console messages and errors
- Network requests and responses
- Screenshots on failures
- Video recordings of test runs
- Extension API call logs

## 🎯 Best Practices

1. **Test Isolation**: Each test should be independent and not rely on others
2. **Realistic Data**: Use actual bookmark data when possible
3. **Error Handling**: Test both success and failure scenarios
4. **Performance**: Monitor test execution time and optimize slow tests
5. **Maintenance**: Regularly update test dependencies and browser versions

## 📚 Resources

- [Playwright Documentation](https://playwright.dev/)
- [Chrome Extension Testing Guide](https://playwright.dev/docs/chrome-extensions)
- [FaVault Extension Documentation](../README.md)
- [GitHub Actions Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
