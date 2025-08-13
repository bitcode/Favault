# **FaVault Extension - Edit Mode Implementation Plan**
Based on the FaVault browser extension codebase, I'll now provide a comprehensive technical implementation plan for the edit/settings mode. Let me break this down into detailed phases:

## **Technical Architecture Analysis**

### **Current Architecture Strengths:**
- **Svelte Framework**: Already using Svelte with TypeScript, perfect for reactive UI components
- **Cross-Browser Compatibility**: Robust API abstraction layer (`src/lib/api.ts`) supporting Chrome, Firefox, Safari, Edge
- **State Management**: Centralized Svelte stores in `src/lib/stores.ts`
- **Modular Component Structure**: Well-organized components (SearchBar, BookmarkFolder, BookmarkItem)
- **Existing Theme Support**: Basic dark/light mode detection and CSS custom properties
- **Performance Optimizations**: Bookmark caching, debounced search, intersection observer ready

### **Current Limitations for Edit Mode:**
- No persistent storage for user preferences (only uses browser's `prefers-color-scheme`)
- No bookmark modification APIs implemented
- No drag-and-drop functionality
- Limited theme customization (only system dark/light mode)
- No settings UI infrastructure

## **Detailed Implementation Roadmap**

Let me add the subtasks properly:

Let me check the current task structure:

Let me reorganize the task list with the proper structure:

Let me continue with the technical analysis and provide the implementation plan without the task management system for now.

## **Detailed Technical Implementation Plan**

### **Phase 1: Settings Infrastructure & Storage**

**1.1 Settings Storage System**
- **Implementation**: Extend `src/lib/api.ts` with storage API wrapper
- **Storage Strategy**: Use `chrome.storage.sync` for cross-device sync, fallback to `localStorage`
- **Data Structure**:
```typescript
interface UserSettings {
  theme: {
    selectedTheme: string;
    customColors: Record<string, string>;
    backgroundGradient: string[];
  };
  layout: {
    viewMode: 'compact' | 'grid' | 'tags';
    itemsPerRow: number;
    showFavicons: boolean;
  };
  editMode: {
    enabled: boolean;
    autoSave: boolean;
  };
}
```

**1.2 Settings Store Architecture**
- **Location**: Extend `src/lib/stores.ts`
- **Implementation**: Create reactive settings store with validation
- **Features**: Auto-save, change detection, rollback capability

````typescript path=src/lib/stores.ts mode=EXCERPT
// Store for UI state
export const uiState = writable({
  searchFocused: false,
  darkMode: false
});
````

**1.3 Edit Mode Toggle System**
- **Trigger**: Keyboard shortcut (Ctrl/Cmd + E) + settings button
- **Visual Indicators**: Edit overlay, component borders, action buttons
- **State Management**: Global edit mode store with component-level reactions

### **Phase 2: Custom Themes System**

**2.1 Theme Engine Foundation**
- **CSS Architecture**: CSS custom properties for dynamic theming
- **Theme Structure**:
```css
:root {
  --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --folder-bg: rgba(255, 255, 255, 0.1);
  --bookmark-bg: rgba(255, 255, 255, 0.8);
  --text-primary: #333;
  --text-secondary: #666;
}
```

**2.2 Predefined Theme Library**
- **Themes**: Ocean Blue, Sunset Orange, Forest Green, Purple Galaxy, Monochrome, etc.
- **Implementation**: Theme objects with complete color palettes
- **Preview**: Live theme preview in settings panel

**2.3 Custom Color Picker**
- **Component**: Svelte color picker with HSL/RGB support
- **Features**: Folder-specific colors, gradient builder
- **Integration**: Real-time preview with existing bookmarks

### **Phase 3: Drag-and-Drop Bookmark Reordering**

**3.1 Drag-and-Drop Core Logic**
- **API Integration**: Extend `src/lib/api.ts` with bookmark manipulation methods
- **Implementation**:

````typescript path=src/lib/api.ts mode=EXCERPT
export class ExtensionAPI {
  static async getBookmarkTree(): Promise<BookmarkItem[]> {
    try {
      return await browserAPI.bookmarks.getTree();
    } catch (error) {
      console.error('Failed to get bookmark tree:', error);
      throw error;
    }
  }
````

**3.2 Visual Drag Feedback**
- **Components**: Drag ghost, drop zones, insertion indicators
- **Animations**: Smooth transitions, hover effects
- **Touch Support**: Mobile-friendly drag interactions

**3.3 Bookmark API Integration**
- **Methods**: `moveBookmark()`, `reorderFolder()`, `validateMove()`
- **Error Handling**: Rollback on API failures
- **Optimistic Updates**: Immediate UI updates with API confirmation

### **Phase 4: Comprehensive Bookmark Management**

**4.1 Bookmark Creation Interface**
- **UI**: Floating action button + modal dialog
- **Features**: URL validation, favicon fetching, folder selection
- **Integration**: Add to existing folder structure

**4.2 Bookmark Editing Modal**
- **Trigger**: Right-click context menu or edit button in edit mode
- **Features**: Title/URL editing, folder reassignment
- **Validation**: URL format checking, duplicate detection

**4.3 Bookmark Deletion System**
- **UI**: Delete button with confirmation dialog
- **Features**: Bulk deletion, undo functionality (5-second window)
- **Safety**: Confirmation for folder deletion with children

### **Phase 5: Customizable Layout Options**

**5.1 Layout View Modes**
- **Compact List**: Dense vertical layout, minimal spacing
- **Grid View**: Card-based layout with large favicons
- **Tag-Based**: Organize by custom tags/categories

**5.2 Responsive Design System**
- **Breakpoints**: Mobile (< 768px), Tablet (768-1024px), Desktop (> 1024px)
- **Adaptation**: Dynamic column counts, touch-friendly controls
- **Performance**: Virtualization for large bookmark collections

### **Phase 6: Settings UI & Integration**

**6.1 Settings Panel UI**
- **Design**: Slide-out panel from right side
- **Tabs**: Themes, Layout, Bookmarks, Advanced
- **Components**: Toggle switches, sliders, color pickers, dropdowns

**6.2 Feature Integration**
- **State Synchronization**: All features respect edit mode state
- **Performance**: Lazy loading of settings components
- **Accessibility**: Keyboard navigation, screen reader support

## **Cross-Browser Compatibility Strategy**

### **API Differences Handling**
- **Manifest V2/V3**: Conditional builds for Firefox (MV2) vs Chrome/Edge (MV3)
- **Storage API**: Unified wrapper handling browser differences
- **Drag-and-Drop**: Feature detection for touch devices

### **Testing Matrix**
- **Chrome**: Latest + 2 previous versions
- **Firefox**: Latest + ESR version  
- **Safari**: Latest (if Web Extensions support available)
- **Edge**: Latest Chromium-based version

## **Data Persistence Strategy**

### **Storage Hierarchy**
1. **chrome.storage.sync**: User preferences, themes, layout settings
2. **chrome.storage.local**: Cached bookmark data, temporary edit state
3. **localStorage**: Fallback for unsupported browsers

### **Data Migration**
- **Version Detection**: Settings schema versioning
- **Migration Scripts**: Automatic upgrade of old settings format
- **Backup/Restore**: Export/import settings functionality

## **Performance Considerations**

### **Optimization Strategies**
- **Virtual Scrolling**: For large bookmark collections (>1000 items)
- **Debounced Updates**: Prevent excessive API calls during drag operations
- **Lazy Loading**: Load settings components only when needed
- **Caching**: Intelligent bookmark cache invalidation

### **Bundle Size Management**
- **Code Splitting**: Separate edit mode components from main bundle
- **Tree Shaking**: Remove unused theme/layout components
- **Asset Optimization**: Compress theme assets and icons

## **UI/UX Design Patterns**

### **Edit Mode Visual Language**
- **Edit Indicators**: Subtle borders, edit icons, drag handles
- **Feedback Systems**: Toast notifications, loading states, error messages
- **Transitions**: Smooth animations between view modes and themes

### **Settings Interface Design**
- **Progressive Disclosure**: Basic → Advanced settings
- **Live Preview**: Real-time updates as user changes settings
- **Reset Options**: Individual setting reset + global reset

This comprehensive plan provides a solid foundation for implementing the edit/settings mode while maintaining the extension's current performance characteristics and cross-browser compatibility. Each phase builds upon the previous one, allowing for incremental development and testing.

Would you like me to start implementing any specific phase, or would you prefer to see detailed code examples for particular components?
