# FaVault Extension - Development Guide

## Architecture Overview

### Core Technologies
- **Svelte 4**: Frontend framework with compile-time optimization
- **TypeScript**: Type safety and enhanced development experience
- **Vite**: Fast build tool and development server
- **WebExtensions API**: Cross-browser extension functionality
- **webextension-polyfill**: Unified API interface for browser compatibility

### Project Structure

```
src/
├── lib/
│   ├── api.ts              # Cross-browser API abstraction
│   ├── bookmarks.ts        # Bookmark management and organization
│   ├── stores.ts           # Svelte reactive stores
│   ├── types.ts            # TypeScript type definitions
│   ├── utils.ts            # Utility functions
│   ├── SearchBar.svelte    # Search input component
│   ├── BookmarkFolder.svelte # Folder display component
│   └── BookmarkItem.svelte # Individual bookmark component
├── App.svelte              # Main application component
├── main.ts                 # Application entry point
├── newtab.html            # New tab page HTML template
└── service-worker.ts       # Background service worker
```

## Key Components

### 1. API Abstraction Layer (`src/lib/api.ts`)
- Provides unified interface for browser APIs
- Handles differences between `chrome.*` and `browser.*` namespaces
- Includes error handling and type safety

### 2. Bookmark Management (`src/lib/bookmarks.ts`)
- Recursive bookmark tree traversal
- Folder organization and color generation
- Search functionality with caching
- Performance optimization for large datasets

### 3. State Management (`src/lib/stores.ts`)
- Reactive Svelte stores for application state
- Derived stores for computed values
- Centralized state management

### 4. UI Components
- **SearchBar**: Debounced search with keyboard shortcuts
- **BookmarkFolder**: Collapsible folder with dynamic colors
- **BookmarkItem**: Individual bookmark with favicon and metadata

## Development Workflow

### 1. Setup Development Environment
```bash
npm install
npm run create-icons
npm run dev
```

### 2. Build for Testing
```bash
# Build for specific browser
npm run build:chrome
npm run build:firefox

# Build for all browsers
npm run build:all
```

### 3. Load Extension for Testing

#### Chrome/Edge
1. Navigate to `chrome://extensions/` or `edge://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `dist/chrome/` or `dist/edge/` directory

#### Firefox
1. Navigate to `about:debugging`
2. Click "This Firefox"
3. Click "Load Temporary Add-on"
4. Select `manifest.json` from `dist/firefox/`

### 4. Development Testing
- Open new tab to see the extension
- Test bookmark loading and organization
- Verify search functionality (Ctrl/Cmd+F)
- Check responsive design
- Test dark mode support

## Cross-Browser Compatibility

### Manifest Differences
- **Chrome/Edge**: Manifest V3 with service workers
- **Firefox**: Manifest V2/V3 with background scripts
- **Safari**: Manifest V2 with WebExtensions support

### API Compatibility
- Uses `webextension-polyfill` for unified API access
- Conditional logic for browser-specific features
- Graceful degradation for unsupported features

### Build Pipeline
- Separate manifest files for each browser
- Browser-specific build configurations
- Automated asset copying and optimization

## Performance Considerations

### Bundle Optimization
- Svelte's compile-time optimization
- Tree shaking for minimal bundle size
- Code splitting for large components

### Runtime Performance
- Lazy loading for large bookmark collections
- Intersection Observer for efficient rendering
- Debounced search to prevent excessive updates
- Bookmark caching to reduce API calls

### Memory Management
- Efficient DOM updates with Svelte
- Cleanup of event listeners and observers
- Minimal memory footprint

## Testing Strategy

### Automated Testing
```bash
node scripts/validate.js    # Project structure validation
node tests/extension.test.js # Basic functionality tests
```

### Manual Testing Checklist
- [ ] Extension loads without errors
- [ ] New tab page displays correctly
- [ ] Bookmarks load and organize properly
- [ ] Search functionality works
- [ ] Keyboard shortcuts respond
- [ ] Responsive design adapts to screen sizes
- [ ] Dark mode toggles correctly
- [ ] Performance is acceptable with large bookmark sets

### Cross-Browser Testing
- [ ] Chrome: Full functionality
- [ ] Firefox: API compatibility
- [ ] Safari: WebExtensions support
- [ ] Edge: Chromium compatibility

## Common Issues and Solutions

### Extension Not Loading
- Check manifest.json syntax
- Verify all required files are present
- Check browser console for errors

### Bookmarks Not Displaying
- Ensure "bookmarks" permission is granted
- Check service worker is running
- Verify API calls are successful

### Search Not Working
- Check keyboard shortcut registration
- Verify message passing between components
- Test debounce functionality

### Performance Issues
- Enable lazy loading for large datasets
- Check for memory leaks
- Optimize search algorithms

## Contributing Guidelines

### Code Style
- Use TypeScript for type safety
- Follow Svelte best practices
- Maintain consistent formatting
- Add comments for complex logic

### Testing Requirements
- Test across all target browsers
- Verify performance with large datasets
- Check accessibility compliance
- Validate responsive design

### Pull Request Process
1. Fork the repository
2. Create feature branch
3. Implement changes with tests
4. Verify cross-browser compatibility
5. Submit pull request with description

## Deployment

### Store Preparation
- Update version numbers
- Create store assets (screenshots, descriptions)
- Prepare privacy policy
- Test final builds

### Browser Store Requirements
- **Chrome Web Store**: Manifest V3, detailed permissions
- **Firefox Add-ons**: AMO review process
- **Safari App Store**: Code signing, App Store guidelines
- **Edge Add-ons**: Microsoft store requirements

## Future Enhancements

### Planned Features
- Custom themes and color schemes
- Drag-and-drop bookmark reordering
- Bookmark management (add/edit/delete)
- Cloud sync and backup
- Advanced search filters
- Bookmark tagging system

### Performance Improvements
- Virtual scrolling for very large lists
- Web Workers for heavy computations
- IndexedDB for local storage
- Service Worker caching strategies

### Accessibility Enhancements
- Screen reader support
- High contrast mode
- Keyboard navigation improvements
- ARIA label optimization
