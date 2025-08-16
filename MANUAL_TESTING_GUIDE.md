# FaVault Extension - Manual Testing Guide

## Production Integration Verification

This guide helps verify that the drag-and-drop timing fixes are working correctly in the production extension.

## Prerequisites

1. **Build the Extension**
   ```bash
   npm run build:chrome
   ```

2. **Load Extension in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist/chrome` folder
   - Note the extension ID for reference

## Core Functionality Tests

### Test 1: Extension Loading and Initialization

**Objective**: Verify the extension loads without timing errors

**Steps**:
1. Open a new tab (should load FaVault extension)
2. Open Chrome DevTools (F12)
3. Check the Console tab for errors
4. Look for these success indicators:
   - No "restoreBookmarkFolderMappings is not a function" errors
   - No "Cannot read property" errors related to drag-drop
   - Extension UI loads completely

**Expected Result**: ✅ Clean console with no critical errors

### Test 2: Enhanced Drag-Drop System Initialization

**Objective**: Verify the enhanced drag-drop system loads correctly

**Steps**:
1. In DevTools Console, run:
   ```javascript
   console.log('Enhanced Drag-Drop Manager:', typeof window.EnhancedDragDropManager);
   console.log('Has restoreBookmarkFolderMappings:', typeof window.EnhancedDragDropManager?.restoreBookmarkFolderMappings);
   console.log('Enhanced system ready:', window.enhancedDragDropReady);
   ```

**Expected Result**: 
- ✅ `EnhancedDragDropManager` should be "object"
- ✅ `restoreBookmarkFolderMappings` should be "function"
- ✅ `enhancedDragDropReady` should be `true` (may take a few seconds)

### Test 3: Edit Mode Activation

**Objective**: Verify edit mode can be enabled without errors

**Steps**:
1. Try enabling edit mode using keyboard shortcut: `Ctrl+E` (or `Cmd+E` on Mac)
2. OR look for an "Edit" button in the UI and click it
3. Check DevTools Console for any errors
4. Verify visual changes indicating edit mode is active

**Expected Result**: 
- ✅ Edit mode activates without console errors
- ✅ UI shows edit mode indicators (drag handles, edit buttons, etc.)
- ✅ No "Enhanced drag-drop system failed to initialize" errors

### Test 4: Drag-and-Drop Operations

**Objective**: Verify drag-and-drop works without timing issues

**Prerequisites**: You need some bookmark folders to test with. If you don't have any:
1. Create a few test bookmark folders in Chrome
2. Add some bookmarks to them
3. Refresh the new tab page

**Steps**:
1. Enable edit mode (Test 3)
2. Try dragging a bookmark folder to a different position
3. Try dragging a bookmark from one folder to another
4. Check DevTools Console during drag operations
5. Verify changes persist after page refresh

**Expected Result**:
- ✅ Drag operations work smoothly
- ✅ No console errors during drag-drop
- ✅ Changes are saved and persist
- ✅ No race condition errors

## Advanced Testing

### Test 5: Rapid Edit Mode Toggling

**Objective**: Test the timing fixes under stress

**Steps**:
1. Rapidly toggle edit mode on/off using `Ctrl+E` multiple times
2. Watch DevTools Console for any timing-related errors
3. Try drag operations immediately after enabling edit mode

**Expected Result**: ✅ No timing errors even with rapid toggling

### Test 6: Page Refresh During Edit Mode

**Objective**: Verify initialization works correctly on page reload

**Steps**:
1. Enable edit mode
2. Refresh the page (F5)
3. Immediately try to enable edit mode again
4. Check for any initialization errors

**Expected Result**: ✅ Clean initialization after refresh

## Cross-Browser Testing

### Chrome
- Follow all tests above
- Test in both regular and incognito mode

### Firefox (if Firefox version exists)
- Load the Firefox version of the extension
- Repeat core functionality tests
- Note any browser-specific differences

### Edge
- Load the Chrome extension in Edge (Chromium-based)
- Verify core functionality works

## Troubleshooting

### Common Issues and Solutions

**Issue**: "restoreBookmarkFolderMappings is not a function"
- ✅ **Fixed**: This should no longer occur with our timing fixes

**Issue**: "Enhanced drag-drop system failed to initialize"
- **Check**: Wait a few seconds after page load before testing
- **Check**: Ensure edit mode is properly enabled

**Issue**: Drag-drop not working
- **Check**: Verify edit mode is enabled (look for visual indicators)
- **Check**: Ensure you have bookmark folders to test with
- **Check**: Try refreshing the page and re-enabling edit mode

## Success Criteria

The integration is successful if:

1. ✅ Extension loads without critical console errors
2. ✅ Enhanced drag-drop system initializes correctly
3. ✅ Edit mode can be enabled reliably
4. ✅ Drag-and-drop operations work smoothly
5. ✅ No race condition timing errors occur
6. ✅ Changes persist after page refresh

## Reporting Issues

If you encounter any issues during manual testing:

1. **Capture Console Logs**: Screenshot or copy any error messages
2. **Note Browser Version**: Include Chrome/Firefox/Edge version
3. **Describe Steps**: What were you doing when the issue occurred?
4. **Check Network Tab**: Any failed resource loads?

## Next Steps After Manual Verification

Once manual testing confirms the fixes work:

1. **User Acceptance**: The core timing issues are resolved
2. **Automated Tests**: Can be refined later for CI/CD
3. **Documentation**: Update user documentation if needed
4. **Release**: The extension is ready for users

---

**Note**: This manual testing approach ensures the actual user experience works correctly, which is more important than automated test coverage at this stage.
