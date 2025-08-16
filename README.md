# FaVault - Cross-Browser New Tab Extension

A custom, visually appealing new tab page browser extension built with Svelte that organizes your bookmarks with search functionality and modern design.

## Features

- 🔖 **Organized Bookmarks**: Automatically organizes bookmarks by folders with dynamic color coding
- 🔍 **Fast Search**: Debounced search functionality with keyboard shortcuts (Ctrl/Cmd+F)
- 🎨 **Modern Design**: Beautiful gradient backgrounds with light/dark mode support
- 📱 **Responsive**: Works seamlessly across different screen sizes
- 🌐 **Cross-Browser**: Compatible with Chrome, Firefox, Safari, and Edge
- ⚡ **Performance**: Built with Svelte for minimal bundle size and fast loading

## Browser Compatibility

| Browser | Manifest Version | Status |
|---------|------------------|--------|
| Chrome  | V3              | ✅ Primary target (fully supported) |
| Edge    | V3              | ✅ Supported (Chromium-compatible) |
| Firefox | V2/V3           | ⚠️ Secondary (best effort) |
| Safari  | V2              | ⚠️ Secondary (best effort) |
| Brave   | V3              | ⚠️ Not prioritized (use Chrome build) |

## Prerequisites

- Node.js 18+ and npm
- Modern browser for development and testing

## Installation & Development

### Option 1: With Node.js/npm (Recommended)

1. **Prerequisites**: Ensure Node.js 18+ and npm are installed
2. **Clone and setup**:
   ```bash
   git clone <repository-url>
   cd favault-extension
   npm install
   ```

3. **Create extension icons**:
   ```bash
   npm run create-icons
   ```

4. **Development**:
   ```bash
   npm run dev
   ```

5. **Build for specific browsers**:
   ```bash
   # Build for Chrome
   npm run build:chrome

   # Build for Firefox
   npm run build:firefox

   # Build for Safari
   npm run build:safari

   # Build for Edge
   npm run build:edge

   # Build for Brave
   npm run build:brave

   # Build for all browsers
   npm run build:all
   ```

### Option 2: Manual Setup (If npm issues occur)

If you encounter npm installation issues, you can set up the extension manually:

1. **Create basic icons**:
   ```bash
   node scripts/create-icons.js
   ```

2. **Copy manifest for your target browser**:
   ```bash
   # For Chrome
   copy manifests\manifest-chrome.json dist\chrome\manifest.json

   # For Firefox
   copy manifests\manifest-firefox.json dist\firefox\manifest.json
   ```

3. **Copy source files**:
   - Copy `src/newtab.html` to `dist/[browser]/newtab.html`
   - Copy `src/` directory contents to `dist/[browser]/`
   - Copy `icons/` directory to `dist/[browser]/icons/`

4. **Load extension directly**: Follow browser-specific loading instructions below

## Project Structure

```
favault-extension/
├── src/
│   ├── lib/
│   │   ├── api.ts              # Cross-browser API abstraction
│   │   ├── bookmarks.ts        # Bookmark management logic
│   │   ├── stores.ts           # Svelte stores for state management
│   │   ├── SearchBar.svelte    # Search component
│   │   ├── BookmarkFolder.svelte # Folder component
│   │   └── BookmarkItem.svelte # Individual bookmark component
│   ├── App.svelte              # Main application component
│   ├── main.ts                 # Application entry point
│   ├── newtab.html            # New tab page HTML
│   └── service-worker.ts       # Background service worker
├── manifests/                  # Browser-specific manifests
│   ├── manifest-chrome.json
│   ├── manifest-firefox.json
│   ├── manifest-safari.json
│   └── manifest-edge.json
├── icons/                      # Extension icons
├── scripts/                    # Build and utility scripts
└── dist/                       # Build output (generated)
    ├── chrome/
    ├── firefox/
    ├── safari/
    └── edge/
```

## Loading the Extension

### Chrome (Recommended)
1. Run `npm run build:chrome`
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist/chrome/` folder

### Edge
1. Run `npm run build:chrome` (Edge uses the Chrome build)
2. Open `edge://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist/edge/` or `dist/chrome/` folder

### Firefox
1. Open `about:debugging`
2. Click "This Firefox"
3. Click "Load Temporary Add-on"
4. Select the `manifest.json` file from `dist/firefox/`

### Safari
1. Open Safari > Preferences > Advanced
2. Enable "Show Develop menu"
3. Develop > Allow Unsigned Extensions
4. Load the extension from `dist/safari/`

### Brave
Brave is Chromium-based and typically works with the Chrome build. However, this project prioritizes Chrome. If you use Brave and encounter issues, load the Chrome build as follows:
1. Run `npm run build:chrome`
2. Open `brave://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist/chrome/` folder

Note: Brave-specific workarounds may exist in the codebase but are not actively maintained. For the most reliable experience, use Chrome.

## Architecture

### Cross-Browser Compatibility
- Uses `webextension-polyfill` for unified API access
- Separate manifest files for each browser
- Conditional build pipeline for browser-specific features

### Performance Optimizations
- Svelte's compile-time optimization for minimal bundle size
- Lazy loading for large bookmark collections
- Debounced search to prevent excessive re-renders
- Intersection Observer for efficient rendering

### State Management
- Svelte stores for reactive state management
- Bookmark caching to reduce API calls
- Error handling and loading states

## Development Notes

### Key Technologies
- **Svelte**: Frontend framework for optimal performance
- **TypeScript**: Type safety and better development experience
- **Vite**: Fast build tool and development server
- **WebExtensions API**: Cross-browser extension functionality

### Browser API Usage
- `chrome.bookmarks`: Access user bookmarks
- `chrome.commands`: Keyboard shortcuts
- `chrome.runtime`: Message passing
- `chrome_url_overrides`: Replace new tab page

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test across browsers
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Troubleshooting

### Common Issues

**Extension not loading bookmarks:**
- Check that the "bookmarks" permission is granted
- Verify the extension has access to bookmark data

**Search not working:**
- Ensure the service worker is running
- Check browser console for JavaScript errors

**Icons not displaying:**
- Run `npm run create-icons` to generate placeholder icons
- Replace with custom icons in the `icons/` directory

**Build failures:**
- Ensure Node.js 18+ is installed
- Clear `node_modules` and run `npm install`
- Check that all dependencies are installed

For more help, please open an issue on the repository.
