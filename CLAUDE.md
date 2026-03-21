# FaVault — Claude Code Context

## Project Overview

**FaVault** is a browser extension that replaces the new tab page with a visual bookmark manager. Users can organize bookmarks into sections (folders), drag-and-drop to reorder, search, and customize themes. It targets **Chrome, Firefox, Edge, and Brave**.

- **Stack**: Svelte 4, TypeScript, Vite 5, Playwright (tests)
- **Manifest**: MV3 for Chrome/Edge/Brave, MV2 for Firefox
- **Permissions**: `bookmarks`, `storage`

---

## Directory Structure

```
src/
  main.ts                      # Entry point: initializes logger, mounts Svelte app
  App.svelte                   # Root component: layout, drag-drop orchestration
  newtab.html                  # New tab HTML template
  service-worker.ts            # Background script (MV3 service worker / MV2 script)
  lib/
    api.ts                     # Cross-browser API abstraction (chrome/browser)
    bookmarks.ts               # BookmarkManager: fetches, caches, organizes bookmarks
    stores.ts                  # All Svelte writable/derived stores (single source of truth)
    themes.ts                  # 6 color themes (ayu-dark/light, gruvbox-dark/light, jm-dark/light)
    dragdrop.ts                # DragDropManager: HTML5 drag events, bookmark moves
    dragdrop-enhanced.ts       # EnhancedDragDropManager: folder reordering, DOM observer
    dragdrop-brave.ts          # Brave-specific drag-drop handling
    global-dragdrop-init.ts    # Mouse-based drag fallback for headless/testing
    favicon-utils.ts           # FaviconManager: Google/DuckDuckGo/local favicon fetch+cache
    autosave.ts                # AutoSaveManager: debounced save on bookmark changes
    validation.ts              # BookmarkValidator: title/URL validation
    error-reporter.ts          # Error diagnostics and reporting
    service-worker-manager.ts  # SW health monitoring and lifecycle status
    utils.ts                   # General utilities
    logging/                   # Comprehensive logging system (singleton, storage adapter)
      index.ts                 # Main Logger class
      config.ts                # Logger configuration
      types.ts                 # Log entry types
      storage.ts               # Storage adapter interface
      storage.browser.ts       # Browser storage implementation
      storage.node.ts          # Node.js storage (for tests)
      drag-drop-logger.ts      # Drag-drop event analytics
      log-query-utils.ts       # Log query/search utilities
    # Svelte Components:
    BookmarkItem.svelte         # Single bookmark link
    BookmarkFolder.svelte       # Folder/section container
    BookmarkFolderEnhanced.svelte  # Folder with enhanced drag-drop
    BookmarkInsertionPoint.svelte  # Drop zone between bookmarks
    FolderInsertionPoint.svelte    # Drop zone between folders
    SearchBar.svelte
    SettingsPanel.svelte
    EditModeToggle.svelte
    KeyboardShortcuts.svelte
    AutoSaveStatus.svelte
    ValidationStatus.svelte
    ErrorReportButton.svelte
    ErrorReportPanel.svelte
    LogViewer.svelte
    ServiceWorkerDiagnostics.svelte
    drag-drop-animations.css    # Animations for drag states and ghost elements
    grid-dnd.css                # Grid layout styles for drop zones

manifests/
  manifest-chrome.json         # MV3
  manifest-firefox.json        # MV2
  manifest-edge.json           # MV3
  manifest-brave.json          # MV3
  manifest-safari.json
  manifest-base.json           # Reference base

tests/playwright/
  specs/                       # 50+ test files
  utils/                       # Test helper utilities
  fixtures/extension.ts        # Playwright extension fixture

scripts/                       # Build and dev helper scripts
dist/                          # Build output — chrome/, firefox/, edge/, brave/
```

---

## Build Commands

```bash
npm run build:chrome      # Build for Chrome (dist/chrome/)
npm run build:firefox     # Build for Firefox (dist/firefox/)
npm run build:edge        # Build for Edge (dist/edge/)
npm run build:brave       # Build for Brave (dist/brave/)
npm run build:all         # Build for all browsers
npm run build:watch       # Watch mode (default: chrome)
npm run check             # svelte-check TypeScript check
```

The Vite build uses `--mode <browser>` to select the correct manifest from `manifests/` and outputs to `dist/<browser>/`. The `vite.config.js` copies the manifest, icons, and `browser-polyfill.min.js` into the output dir.

---

## Test Commands

```bash
npm run test                  # All Playwright tests
npm run test:chrome           # Chrome extension tests
npm run test:firefox          # Firefox extension tests
npm run test:edge             # Edge extension tests
npm run test:headed           # Run with visible browser
npm run test:ui               # Interactive Playwright UI
npm run test:dragdrop         # Drag-drop functionality tests
npm run test:bookmarks        # Bookmark management tests
npm run test:sections         # Section drag-drop tests
npm run test:cross-browser    # Cross-browser compatibility tests
npm run test:coverage         # HTML + JSON + JUnit reporters
```

---

## Architecture Notes

### Cross-Browser API
`src/lib/api.ts` abstracts the browser API:
```typescript
export const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;
```
Always use `browserAPI` (not `chrome` directly) when writing new code that touches bookmarks or storage.

### State Management
All state lives in Svelte stores in `src/lib/stores.ts`:
- `bookmarkFolders` — organized bookmark tree
- `searchQuery` — current search input
- `editMode` — grid/edit mode toggle
- `userSettings` — persisted user preferences
- `filteredBookmarks` (derived) — bookmarks matching search

Settings are persisted via: `chrome.storage.sync` → `chrome.storage.local` → `localStorage` (fallback chain).

### Drag and Drop
Drag-drop is the most complex subsystem:
- `dragdrop.ts` — base HTML5 drag events, bookmark moves between folders
- `dragdrop-enhanced.ts` — folder/section reordering with DOM observer
- `dragdrop-brave.ts` — Brave-specific overrides
- `global-dragdrop-init.ts` — mouse event fallback (headless/testing)
- Insertion point components (`BookmarkInsertionPoint`, `FolderInsertionPoint`) render visible drop zones

When modifying drag-drop logic, run `npm run test:dragdrop` and `npm run test:sections` after changes.

### Service Worker Keep-Alive
`src/service-worker.ts` includes a keep-alive ping every 25 seconds to prevent the MV3 30-second idle timeout. Firefox uses MV2 background scripts instead.

### Themes
6 themes defined in `src/lib/themes.ts`: `ayu-dark`, `ayu-light`, `gruvbox-dark`, `gruvbox-light`, `jm-dark`, `jm-light`. Each has a full color palette. Theme is applied via CSS variables on the root element.

### Logging
A comprehensive logging system lives in `src/lib/logging/`. In the browser console, you can access:
```javascript
FavaultLogger.getStatus()       // Logger status
FavaultLogger.retrieveLogs()    // All stored logs
FavaultLogger.downloadLogs()    // Download log file
DragDropLogger                  // Drag-drop analytics
DnDDiagnostics                  // Folder attribute diagnostics
serviceWorkerManager            // SW health/status
```

---

## Browser Compatibility

| Browser  | Manifest | Background     | Notes                        |
|----------|----------|----------------|------------------------------|
| Chrome   | MV3      | service_worker | Primary target               |
| Edge     | MV3      | service_worker | Equivalent to Chrome         |
| Brave    | MV3      | service_worker | Special drag-drop handling   |
| Firefox  | MV2      | scripts[]      | `persistent: false`          |
| Safari   | —        | —              | Manifest provided, untested  |

Firefox gecko ID: `favault@extension.local`

---

## Key Keyboard Shortcuts

| Shortcut              | Action              |
|-----------------------|---------------------|
| `Ctrl+Shift+F` / `⌘⇧F` | Focus search      |
| `Ctrl+E` / `⌘E`       | Toggle edit/grid mode |

---

## Development Workflow

1. **Make changes** in `src/`
2. **Build** with `npm run build:chrome` (or target browser)
3. **Load extension** in browser from `dist/chrome/` (unpacked)
4. **Test** with `npm run test` or specific test scripts
5. **Type-check** with `npm run check`

For rapid iteration use `npm run build:watch` then reload the extension in the browser.

---

## Common Gotchas

- `modulePreload: false` in `vite.config.js` — required because module preload polyfill uses `window`, which breaks service workers.
- Service worker dependencies are intentionally not chunked — they inline into `service-worker.js` to avoid dynamic import issues in SW context.
- The HTML output is moved from `dist/<browser>/src/newtab.html` to `dist/<browser>/newtab.html` by the Vite plugin, with path corrections for `./newtab.js` and `./newtab.css`.
- Use `@/` path alias for imports from `src/` (e.g., `import { browserAPI } from '@/lib/api'`).
- When adding new features that persist data, follow the storage fallback chain in `api.ts`.
