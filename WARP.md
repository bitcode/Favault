# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

FaVault is a cross-browser new tab extension built with Svelte that provides an organized bookmark interface with search functionality and drag-and-drop capabilities. The extension is designed with Chrome as the primary target and includes cross-browser compatibility for Edge, Firefox, and Safari.

## Key Commands

### Development
```bash
# Install dependencies
npm install

# Start development server with hot reload
npm run dev

# Build for specific browsers
npm run build:chrome    # Primary browser
npm run build:firefox   # Secondary support
npm run build:safari    # Secondary support
npm run build:edge      # Uses Chrome build
npm run build:all       # Build for all browsers

# Create extension icons
npm run create-icons
```

### Testing
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:dragdrop              # Drag and drop functionality tests
npm run test:bookmarks             # Bookmark management tests
npm run test:cross-browser         # Cross-browser compatibility tests
npm run test:ui-visual             # UI component visual tests

# Test with UI
npm run test:ui

# Test in headed mode
npm run test:headed

# Debug tests
npm run test:debug

# Run automated test runner with logging
npm run test:logged
npm run test:analyze               # Analyze test results

# Test build and validation
npm run test:build-and-test       # Build Chrome extension and run tests
```

### Extension Loading
```bash
# After building, the extension will be in:
dist/chrome/     # Chrome extension
dist/firefox/    # Firefox extension
dist/safari/     # Safari extension
dist/edge/       # Edge extension (typically uses Chrome build)
```

## Architecture

### Core Technologies
- **Svelte 4**: Component framework for UI
- **TypeScript**: Type-safe development
- **Vite**: Build tool and dev server
- **Playwright**: E2E testing framework
- **WebExtension API**: Cross-browser extension APIs via webextension-polyfill

### Project Structure
```
src/
├── App.svelte                     # Main application component with drag-drop state management
├── main.ts                        # Application entry point, initializes stores and drag-drop
├── newtab.html                    # New tab page HTML template
├── service-worker.ts              # Background service worker for extension messaging
└── lib/
    ├── api.ts                     # Cross-browser API abstraction layer
    ├── bookmarks.ts               # Bookmark management utilities
    ├── stores.ts                  # Svelte stores for global state
    ├── dragdrop-enhanced.ts       # Enhanced drag-drop implementation
    ├── global-dragdrop-init.ts    # Global drag-drop initialization
    ├── BookmarkFolder.svelte      # Folder component with drag-drop support
    ├── BookmarkItem.svelte        # Individual bookmark with drag-drop
    └── SearchBar.svelte           # Search functionality component
```

### Key Components

**App.svelte**: Central component managing:
- Bookmark tree rendering
- Drag-and-drop state coordination
- Search functionality
- Edit mode toggling
- Auto-save capabilities

**Drag-Drop System** (`dragdrop-enhanced.ts`):
- Custom implementation due to browser extension limitations
- Handles inter-folder and intra-folder movements
- Visual feedback with insertion points
- Cross-browser compatibility layer

**Service Worker** (`service-worker.ts`):
- Handles background operations
- Message passing between components
- Bookmark API interactions
- Auto-save functionality

### Browser-Specific Considerations

The codebase uses manifest v3 for Chrome/Edge and provides v2 compatibility for Firefox/Safari:
- Chrome/Edge: Full Manifest V3 support
- Firefox: Manifest V2/V3 hybrid approach
- Safari: Manifest V2 with specific adaptations
- Brave: Uses Chrome build with potential specific workarounds

### Testing Infrastructure

**Playwright Configuration**:
- Extension-specific test setup in `playwright.config.js`
- Custom test helpers in `tests/extension-helper.js`
- Comprehensive test suites for drag-drop, bookmarks, and UI

**Test Categories**:
- Drag-drop functionality (most complex)
- Bookmark CRUD operations
- Cross-browser compatibility
- UI component visual regression
- Network and console monitoring

### Critical Implementation Details

**Drag-Drop Complexity**:
The drag-drop system is the most complex part due to:
- Browser extension CSP restrictions preventing inline event handlers
- Need for custom event handling without native HTML5 drag-drop
- Complex state management across nested folder structures
- Visual feedback requirements for insertion points

**Auto-Save System**:
- Debounced save operations to prevent excessive API calls
- Visual status indicators
- Error recovery mechanisms

**Cross-Browser API Abstraction**:
- `api.ts` provides unified interface across browser APIs
- Uses webextension-polyfill for compatibility
- Handles browser-specific quirks and limitations

## Common Development Tasks

### Adding New Features
1. Create Svelte components in `src/lib/`
2. Update stores in `stores.ts` if state management needed
3. Add corresponding tests in `tests/playwright/specs/`
4. Test across browsers using `npm run test:cross-browser`

### Debugging Drag-Drop Issues
1. Check console for drag-drop event logs
2. Use `test-dragdrop-manual.html` for isolated testing
3. Run `npm run test:dragdrop` for automated validation
4. Review `dragdrop-enhanced.ts` for core logic

### Building for Production
1. Run `npm run build:chrome` for primary build
2. Test extension by loading unpacked from `dist/chrome/`
3. Verify manifest.json is correctly copied
4. Check that icons are present in `dist/chrome/icons/`

## Browser Extension Specifics

### Manifest Files
- Each browser has its own manifest in `manifests/`
- Vite build process automatically selects correct manifest
- Key permissions: bookmarks, storage, tabs

### Content Security Policy
- Extension environment has strict CSP
- No inline scripts or styles allowed
- Event handlers must be added via addEventListener
- All resources must be bundled or explicitly allowed

### Hot Reload in Development
- Development server provides hot module replacement
- Extension needs manual reload for service worker changes
- Use Chrome Extensions page "Update" button for quick reload