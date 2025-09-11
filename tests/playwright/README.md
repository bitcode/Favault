# FaVault Drag-and-Drop Test Suite

This comprehensive Playwright test suite validates the bookmark drag-and-drop functionality in the FaVault browser extension.

## Overview

The test suite covers:

### **Intra-Folder Bookmark Reordering**
- Moving bookmarks within the same folder to different positions
- Verifying insertion points are visible and functional
- Testing specific scenarios like moving "Cisco Web Voicemail" bookmark
- Validating precise positioning between bookmarks

### **Inter-Folder Bookmark Movement**
- Moving bookmarks between different folders
- Dropping on folder headers (insert at beginning)
- Dropping on folder containers (append at end)
- Testing specific folder combinations (Cisco → Zing Platform)

### **Visual Feedback and Error Handling**
- Drag preview styling during operations
- Insertion point highlighting
- Success/error feedback messages
- Invalid drop operation prevention

### **Data Persistence**
- Verifying bookmark order changes persist
- Chrome bookmarks API integration
- UI state consistency after operations

## Running the Tests

### Prerequisites

1. **Build the extension:**
   ```bash
   npm run build:chrome
   ```

2. **Install Playwright browsers:**
   ```bash
   npx playwright install
   ```

### Test Execution

#### Run all drag-and-drop tests:
```bash
npm run test:dragdrop-comprehensive
```

#### Run with detailed reporting:
```bash
npm run test:dragdrop-runner
```

#### Run specific test categories:
```bash
# Setup and prerequisites only
npx playwright test --grep "Setup and Prerequisites"

# Intra-folder reordering only
npx playwright test --grep "Intra-Folder Bookmark Reordering"

# Inter-folder movement only
npx playwright test --grep "Inter-Folder Bookmark Movement"

# Visual feedback tests only
npx playwright test --grep "Visual Feedback"
```

#### Debug mode (with browser visible):
```bash
npx playwright test tests/playwright/bookmark-drag-drop.spec.ts --headed --debug
```

#### UI mode (interactive):
```bash
npx playwright test tests/playwright/bookmark-drag-drop.spec.ts --ui
```

## Test Structure

### Test Files
- `bookmark-drag-drop.spec.ts` - Main test suite
- `global-setup.ts` - Pre-test setup and verification
- `global-teardown.ts` - Post-test cleanup

### Test Categories

#### 1. Setup and Prerequisites
- Extension loading verification
- Edit mode activation
- Insertion point visibility
- Debug function availability

#### 2. Intra-Folder Bookmark Reordering
- Basic bookmark movement within folders
- Insertion point highlighting during drag
- Invalid drop prevention
- Specific "Cisco Web Voicemail" test case

#### 3. Inter-Folder Bookmark Movement
- Moving bookmarks between folders
- Folder header drop zones
- Folder container drop zones
- Specific Cisco → Zing Platform test case

#### 4. Visual Feedback and Error Handling
- Drag styling verification
- Success message display
- Error handling for invalid operations

## Expected Test Results

### ✅ Passing Tests Indicate:
- Insertion points are visible between bookmarks
- Drag-and-drop operations work correctly
- Visual feedback is functioning
- Data persistence is working
- Chrome bookmarks API integration is successful

### ❌ Failing Tests May Indicate:
- Insertion points not rendering properly
- Drop zone event handlers not working
- Edit mode not activating correctly
- CSS styling issues preventing visibility
- Chrome API integration problems

## Troubleshooting

### Common Issues

#### 1. "No insertion points found"
- Verify edit mode is working: Check for `.app.edit-mode` class
- Run debug function: `debugInsertionPoints()`
- Check CSS visibility of `.bookmark-insertion-point` elements

#### 2. "Extension not loading"
- Ensure extension is built: `npm run build:chrome`
- Check `dist/` directory exists with required files
- Verify manifest.json is valid

#### 3. "Drag operations not working"
- Check if bookmarks have `draggable="true"` attribute
- Verify `.draggable-item` class is applied
- Test drag event handlers manually

#### 4. "Tests timing out"
- Increase timeout in test configuration
- Check for slow network or system performance
- Verify extension loads within expected time

### Debug Commands

The extension provides several debug functions accessible in the browser console:

```javascript
// Check insertion point status
debugInsertionPoints()

// Test insertion point functionality
testInsertionPoints()

// Test overall drag-drop setup
testDragDropFunctionality()

// Debug general drag-drop state
debugDragDrop()
```

## Test Configuration

### Browser Support
- **Primary**: Chrome/Chromium (full extension support)
- **Secondary**: Edge (Chromium-based)
- **Limited**: Firefox (basic testing only)

### Test Environment
- **Headless**: Default for CI/CD
- **Headed**: Available for debugging
- **UI Mode**: Interactive test runner

### Reporting
- **HTML Report**: Visual test results
- **JSON Report**: Machine-readable results
- **JUnit Report**: CI/CD integration
- **Console Output**: Real-time feedback

## Contributing

When adding new drag-and-drop tests:

1. Follow the existing test structure
2. Use descriptive test names
3. Include both positive and negative test cases
4. Add appropriate assertions for visual feedback
5. Test data persistence where applicable
6. Include skip conditions for missing test data

## Test Data Requirements

The tests expect:
- At least 2 bookmark folders
- At least 1 folder with multiple bookmarks
- Bookmarks with recognizable titles for verification
- Edit mode functionality working

If your bookmark data doesn't match these requirements, some tests will be skipped with appropriate messages.
