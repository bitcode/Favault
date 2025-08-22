<script lang="ts">
  import { onMount } from 'svelte';
  import SearchBar from './lib/SearchBar.svelte';
  import BookmarkFolderEnhanced from './lib/BookmarkFolderEnhanced.svelte';
  import FolderInsertionPoint from './lib/FolderInsertionPoint.svelte';
  import SettingsPanel from './lib/SettingsPanel.svelte';
  import EditModeToggle from './lib/EditModeToggle.svelte';
  import KeyboardShortcuts from './lib/KeyboardShortcuts.svelte';
  import ErrorReportButton from './lib/ErrorReportButton.svelte';
  import { BraveDebugger } from './lib/brave-debug';
  import { BookmarkManager } from './lib/bookmarks';
  import { EnhancedDragDropManager } from './lib/dragdrop-enhanced';
  import { EnhancedDragDropTester } from './lib/test-enhanced-dragdrop';
  import { errorReporter, reportLoadingError, reportInitializationError } from './lib/error-reporter';
  import { ExtensionLoadingDiagnostics } from './lib/extension-loading-diagnostics';
  import { bookmarkFolders, filteredBookmarks, isLoading, error, settingsManager, editMode } from './lib/stores';
  import { ExtensionAPI, BookmarkEditAPI } from './lib/api';

  let searchBarComponent: SearchBar;

  // DIRECT FUNCTION EXPOSURE - No complex modules, just working functions
  console.log('🔧 Initializing DIRECT automated testing system...');
  if (typeof window !== 'undefined') {
    // Create simple, direct test functions that work immediately
    console.log('🔧 Exposing functions directly to global scope...');

    // Simple test move function
    (window as any).testMove = async (fromIndex: number, toIndex: number) => {
      try {
        console.log(`🧪 Testing move: ${fromIndex} → ${toIndex}`);

        // Get folder info
        const folders = document.querySelectorAll('.folder-container');
        const folderElement = folders[fromIndex];
        if (!folderElement) {
          throw new Error(`No folder found at index ${fromIndex}`);
        }

        const title = folderElement.querySelector('.folder-title, h3, .folder-name')?.textContent?.trim();

        // Get Chrome bookmark tree
        const tree = await (chrome as any).bookmarks.getTree();
        const findFolder = (nodes: any[], title: string): any | null => {
          for (const node of nodes) {
            if (node.title === title && node.children && !node.url) return node;
            if (node.children) {
              const result = findFolder(node.children, title);
              if (result) return result;
            }
          }
          return null;
        };

        const bookmarkFolder = findFolder(tree, title || '');
        if (!bookmarkFolder) {
          throw new Error(`No bookmark found for folder "${title}"`);
        }

        // Perform the move
        const result = await (chrome as any).bookmarks.move(bookmarkFolder.id, {
          parentId: '1', // Bookmarks folder
          index: toIndex
        });

        console.log(`✅ "${title}": ${fromIndex}→${toIndex} (Chrome: moved to index ${result.index})`);

        // Automatically refresh the UI after successful move
        console.log('🔄 Auto-refreshing UI after successful move...');
        BookmarkManager.clearCache();
        await refreshBookmarks();

        return { success: true, folder: title, fromIndex, toIndex, result };

      } catch (error) {
        console.error(`❌ Move failed:`, error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    };

    // Simple show state function
    (window as any).showState = async () => {
      try {
        console.log('📊 Current bookmark state:');

        const children = await (chrome as any).bookmarks.getChildren('1'); // Bookmarks folder
        const folders = children.filter((child: any) => !child.url);

        console.log(`📊 ${folders.length} folders in Chrome bookmarks`);

        folders.slice(0, 10).forEach((folder: any, index: number) => {
          console.log(`  ${index}: "${folder.title}"`);
        });

        if (folders.length > 10) {
          console.log(`  ... and ${folders.length - 10} more folders`);
        }

        return { folders: folders.length, list: folders };

      } catch (error) {
        console.error('❌ Failed to get state:', error);
        return null;
      }
    };

    // Simple run all tests function
    (window as any).runAllTests = async () => {
      try {
        console.log('🚀 Starting comprehensive test suite...');

        const tests = [
          {
            name: 'Chrome API Check',
            test: async () => {
              if (typeof chrome === 'undefined' || !(chrome as any).bookmarks) {
                throw new Error('Chrome bookmark API not available');
              }
              const tree = await (chrome as any).bookmarks.getTree();
              return { treeNodes: tree.length };
            }
          },
          {
            name: 'DOM Elements Check',
            test: async () => {
              const folders = document.querySelectorAll('.folder-container');
              if (folders.length === 0) {
                throw new Error('No folder containers found in DOM');
              }
              return { domFolders: folders.length };
            }
          },
          {
            name: 'Bookmark Folders Check',
            test: async () => {
              const children = await (chrome as any).bookmarks.getChildren('1');
              const folders = children.filter((child: any) => !child.url);
              if (folders.length === 0) {
                throw new Error('No bookmark folders found');
              }
              return { bookmarkFolders: folders.length };
            }
          },
          {
            name: 'Move Operation Test',
            test: async () => {
              const result = await (window as any).testMove(4, 2);
              if (!result.success) {
                throw new Error(`Move test failed: ${result.error}`);
              }
              return result;
            }
          }
        ];

        const results = [];
        let passed = 0;

        for (const test of tests) {
          const startTime = Date.now();
          try {
            console.log(`🧪 Running: ${test.name}...`);
            const result = await test.test();
            const duration = Date.now() - startTime;

            console.log(`✅ ${test.name} passed (${duration}ms)`);
            results.push({ name: test.name, success: true, duration, result });
            passed++;

          } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ ${test.name} failed (${duration}ms):`, error);
            results.push({
              name: test.name,
              success: false,
              duration,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }

          // Wait between tests
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        console.log(`🎉 Test suite complete: ${passed}/${tests.length} tests passed`);
        console.log('📊 TEST RESULTS SUMMARY:');
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${tests.length - passed}`);

        if (tests.length - passed > 0) {
          console.log('❌ Failed Tests:');
          results.filter(r => !r.success).forEach(r => {
            console.log(`  - ${r.name}: ${r.error}`);
          });
        }

        // Copy to clipboard
        try {
          await navigator.clipboard.writeText(JSON.stringify(results, null, 2));
          console.log('📋 Test results copied to clipboard');
        } catch {
          console.log('📋 Test results available in console');
        }

        return results;

      } catch (error) {
        console.error('❌ Test suite failed:', error);
        return [];
      }
    };

    // Simple get test results function
    (window as any).getTestResults = () => {
      console.log('📊 Test results are returned by runAllTests()');
      return 'Run runAllTests() to get test results';
    };

    // Expose refreshBookmarks function globally
    (window as any).refreshBookmarks = refreshBookmarks;

    console.log('✅ DIRECT automated testing system ready!');
    console.log('📋 Available commands (exposed directly):');
    console.log('  - runAllTests() - Run comprehensive test suite');
    console.log('  - testMove(from, to) - Test individual move');
    console.log('  - showState() - Show current bookmark state');
    console.log('  - refreshBookmarks() - Force refresh UI and clear cache');
    console.log('  - getTestResults() - Info about test results');

    // Verify functions are exposed
    setTimeout(() => {
      console.log('🔍 Verification check:');
      console.log('runAllTests available:', typeof (window as any).runAllTests === 'function');
      console.log('testMove available:', typeof (window as any).testMove === 'function');
      console.log('showState available:', typeof (window as any).showState === 'function');

      if (typeof (window as any).runAllTests === 'function') {
        console.log('🎉 SUCCESS: All functions are available! Try: runAllTests()');
      } else {
        console.error('❌ FAILED: Functions not available after exposure');
      }
    }, 1000);
  }
  
  // Load bookmarks on component mount
  onMount(() => {
    // Expose enhanced drag-drop to global scope FIRST
    console.log('🦁 onMount: Exposing enhanced drag-drop immediately...');
    exposeEnhancedDragDropGlobally();

    // Hide the HTML loading fallback now that Svelte is mounting
    const fallback = document.querySelector('.loading-fallback');
    if (fallback) {
      fallback.classList.add('hidden');
    }

    // Load settings first
    settingsManager.loadSettings();

    // Set up keyboard shortcut listener
    document.addEventListener('keydown', handleKeydown);

    // Initialize browser debugging (only expose when needed)
    if (typeof window !== 'undefined') {
      // Only expose debugging functions in development or when explicitly requested
      const isDevelopment = window.location.hostname === 'localhost' || window.location.protocol === 'file:';

      if (isDevelopment) {
        console.log('🔧 Development mode: Exposing browser debugging functions...');
        (window as any).BraveDebugger = BraveDebugger;

        // Add browser detection test function
        (window as any).testBrowserDetection = () => {
          console.log('🔧 Testing browser detection...');
          const detection = BraveDebugger.detectBrave();
          console.log('🔧 Browser Detection Result:', detection);

          if (detection.isBrave) {
            console.log('🦁 Brave browser detected');
          } else {
            console.log('🌐 Standard browser (Chrome/Edge/etc.)');
          }

          return detection;
        };

        (window as any).showBraveDebug = () => {
          return BraveDebugger.createDebugOverlay();
        };

        (window as any).runBraveDiagnostic = () => {
          return BraveDebugger.runDiagnostic();
        };

        console.log('🔧 Browser debugging functions exposed (development mode)');
      } else {
        console.log('🌐 Production mode: Browser debugging disabled');
      }
    }

    // Expose enhanced drag-drop to global scope immediately
    exposeEnhancedDragDropGlobally();

    // Expose loadBookmarks globally for UI refresh after reordering
    exposeLoadBookmarksGlobally();

    // Set up bookmark refresh event listener
    const removeRefreshListener = setupBookmarkRefreshListener();

    // Load bookmarks asynchronously
    loadBookmarks();

    // Initialize enhanced drag-drop system
    initializeEnhancedDragDrop();

    // Set up bookmark event listeners for automatic cache invalidation
    setupBookmarkEventListeners();

    // Listen for messages from service worker
    ExtensionAPI.onMessage((message, _sender, _sendResponse) => {
      if (message.type === 'FOCUS_SEARCH') {
        if (searchBarComponent) {
          searchBarComponent.focusSearch();
        }
      } else if (message.type === 'TOGGLE_EDIT_MODE') {
        settingsManager.updateEditMode({ enabled: !$editMode });
      }
    });

    return () => {
      document.removeEventListener('keydown', handleKeydown);
      removeRefreshListener();
    };
  });

  // Separate async function for loading bookmarks
  async function loadBookmarks() {
    try {
      isLoading.set(true);
      error.set(null);

      console.log('🔄 Loading bookmarks...');
      const folders = await BookmarkManager.getOrganizedBookmarks();
      bookmarkFolders.set(folders);
      console.log(`✅ Loaded ${folders.length} bookmark folders`);
    } catch (err) {
      console.error('Failed to load bookmarks:', err);
      error.set('Failed to load bookmarks. Please check extension permissions.');

      // Report the error to our error tracking system
      reportLoadingError('Failed to load bookmarks', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      });
    } finally {
      isLoading.set(false);
    }
  }

  // Expose loadBookmarks globally for enhanced drag-drop manager
  function exposeLoadBookmarksGlobally() {
    (window as any).loadBookmarks = loadBookmarks;
    (window as any).BookmarkManager = BookmarkManager;
    console.log('🌐 loadBookmarks function and BookmarkManager exposed globally');
  }

  // Listen for bookmark refresh events
  function setupBookmarkRefreshListener() {
    const handleRefreshEvent = (event: CustomEvent) => {
      console.log('🔄 Received bookmark refresh event:', event.detail);

      // Clear cache if requested
      if (event.detail?.clearCache) {
        console.log('🔄 Clearing bookmark cache before refresh...');
        BookmarkManager.clearCache();
      }

      // Browser-specific handling
      const browser = event.detail?.browser;
      const forceRefresh = event.detail?.forceRefresh;

      if (browser === 'chrome' && forceRefresh) {
        console.log('🌐 Chrome-specific refresh: Force clearing all caches...');
        // Force clear all caches for Chrome
        BookmarkManager.clearCache();

        // Add delay before reloading for Chrome
        setTimeout(() => {
          console.log('🌐 Chrome: Reloading bookmarks after delay...');
          loadBookmarks();
        }, 100);
      } else {
        // Standard refresh for other browsers
        loadBookmarks();
      }
    };

    // Also listen for Chrome verification events
    const handleChromeVerifyEvent = (event: CustomEvent) => {
      console.log('🌐 Chrome verification event received:', event.detail);
      // Force another refresh if needed
      setTimeout(() => {
        console.log('🌐 Chrome: Secondary verification refresh...');
        BookmarkManager.clearCache();
        loadBookmarks();
      }, 100);
    };

    document.addEventListener('favault-refresh-bookmarks', handleRefreshEvent as EventListener);
    document.addEventListener('favault-chrome-refresh-verify', handleChromeVerifyEvent as EventListener);
    console.log('👂 Bookmark refresh event listeners set up (including Chrome-specific)');

    return () => {
      document.removeEventListener('favault-refresh-bookmarks', handleRefreshEvent as EventListener);
      document.removeEventListener('favault-chrome-refresh-verify', handleChromeVerifyEvent as EventListener);
    };
  }

  // Expose enhanced drag-drop to global scope immediately
  function exposeEnhancedDragDropGlobally() {
    console.log('🦁 Exposing enhanced drag-drop to global scope...');

    if (typeof window !== 'undefined') {
      // Expose main classes
      (window as any).EnhancedDragDropManager = EnhancedDragDropManager;
      (window as any).EnhancedDragDropTester = EnhancedDragDropTester;

      // Expose testing functions with error handling
      (window as any).testEnhancedDragDrop = async () => {
        try {
          console.log('🧪 Running full enhanced drag-drop test...');
          await EnhancedDragDropTester.testSystem();
        } catch (error) {
          console.error('❌ Test failed:', error);
        }
      };

      (window as any).quickTestDragDrop = async () => {
        try {
          console.log('🧪 Running quick enhanced drag-drop test...');
          await EnhancedDragDropTester.quickTest();
        } catch (error) {
          console.error('❌ Quick test failed:', error);
        }
      };

      (window as any).showDragDropDiagnostics = () => {
        try {
          console.log('🧪 Showing enhanced drag-drop diagnostics...');
          EnhancedDragDropTester.showDiagnostics();
        } catch (error) {
          console.error('❌ Diagnostics failed:', error);
        }
      };

      (window as any).initEnhancedDragDrop = async () => {
        try {
          console.log('🧪 Manual enhanced drag-drop initialization...');
          const result = await EnhancedDragDropManager.initialize();
          console.log('🧪 Manual initialization result:', result);
          return result;
        } catch (error) {
          console.error('❌ Manual initialization failed:', error);
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      };

      // Expose error reporting and diagnostics functions
      (window as any).errorReporter = errorReporter;
      (window as any).runLoadingDiagnostics = async () => {
        try {
          console.log('🔍 Running extension loading diagnostics...');
          const report = await ExtensionLoadingDiagnostics.runLoadingDiagnostics();
          console.log('📊 Diagnostics report:', report);
          return report;
        } catch (error) {
          console.error('❌ Diagnostics failed:', error);
          return { error: error instanceof Error ? error.message : String(error) };
        }
      };

      (window as any).exportDiagnosticsReport = async () => {
        try {
          console.log('📄 Exporting diagnostics report...');
          const report = await ExtensionLoadingDiagnostics.exportDiagnosticsReport();
          console.log('📄 Diagnostics report exported to console');
          console.log(report);
          return report;
        } catch (error) {
          console.error('❌ Export failed:', error);
          return `Export failed: ${error instanceof Error ? error.message : String(error)}`;
        }
      };

      (window as any).getErrorReport = () => {
        try {
          console.log('📊 Getting error report...');
          const report = errorReporter.exportAsText();
          console.log('📊 Error report exported to console');
          console.log(report);
          return report;
        } catch (error) {
          console.error('❌ Error report failed:', error);
          return `Error report failed: ${error instanceof Error ? error.message : String(error)}`;
        }
      };

      (window as any).enableEnhancedEditMode = async () => {
        try {
          console.log('🧪 Enabling enhanced edit mode...');
          await EnhancedDragDropManager.enableEditMode();
          console.log('✅ Enhanced edit mode enabled');
        } catch (error) {
          console.error('❌ Failed to enable enhanced edit mode:', error);
        }
      };

      (window as any).disableEnhancedEditMode = () => {
        try {
          console.log('🧪 Disabling enhanced edit mode...');
          EnhancedDragDropManager.disableEditMode();
          console.log('✅ Enhanced edit mode disabled');
        } catch (error) {
          console.error('❌ Failed to disable enhanced edit mode:', error);
        }
      };

      // Expose settings manager for testing
      (window as any).settingsManager = settingsManager;

      console.log('✅ Enhanced drag-drop functions exposed to global scope:');
      console.log('  - testEnhancedDragDrop() - Full system test');
      console.log('  - quickTestDragDrop() - Quick functionality test');
      console.log('  - showDragDropDiagnostics() - System diagnostics');
      console.log('  - initEnhancedDragDrop() - Manual initialization');
      console.log('  - enableEnhancedEditMode() - Enable edit mode');
      console.log('  - disableEnhancedEditMode() - Disable edit mode');
      console.log('  - settingsManager - Settings management for testing');
      console.log('  - EnhancedDragDropManager - Main manager class');
      console.log('  - EnhancedDragDropTester - Testing utilities');
    }
  }

  // Initialize enhanced drag-drop system
  async function initializeEnhancedDragDrop() {
    try {
      console.log('🦁 Starting enhanced drag-drop initialization...');

      // Wait for DOM to be ready
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('🦁 Calling EnhancedDragDropManager.initialize()...');
      const result = await EnhancedDragDropManager.initialize();

      if (result.success) {
        console.log('✅ Enhanced drag-drop system initialized successfully');
      } else {
        console.error('❌ Failed to initialize enhanced drag-drop:', result.error);
        reportInitializationError('Enhanced drag-drop initialization failed', {
          error: result.error
        });
      }
    } catch (error) {
      console.error('❌ Error initializing enhanced drag-drop:', error);
      reportInitializationError('Enhanced drag-drop initialization error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }
  
  // Handle keyboard shortcuts
  function handleKeydown(event: KeyboardEvent) {
    // Check if we're in an input field
    const isInInputField = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;

    // Allow certain shortcuts even when in input fields (like edit mode toggle)
    const isEditModeShortcut = (event.ctrlKey || event.metaKey) && (event.key === 'e' || event.key === 'E');
    const isEscapeKey = event.key === 'Escape';

    // Don't handle shortcuts if user is typing in an input, except for edit mode and escape
    if (isInInputField && !isEditModeShortcut && !isEscapeKey) {
      return;
    }

    // Ctrl/Cmd + F to focus search (handle both uppercase and lowercase)
    if ((event.ctrlKey || event.metaKey) && (event.key === 'f' || event.key === 'F')) {
      event.preventDefault();
      if (searchBarComponent) {
        searchBarComponent.focusSearch();
      }
    }

    // Ctrl/Cmd + Shift + F to focus search (Chrome-specific to avoid browser conflict)
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'f' || event.key === 'F')) {
      event.preventDefault();
      if (searchBarComponent) {
        searchBarComponent.focusSearch();
      }
    }

    // Ctrl/Cmd + E to toggle edit mode (handle both uppercase and lowercase)
    if ((event.ctrlKey || event.metaKey) && (event.key === 'e' || event.key === 'E')) {
      event.preventDefault();
      toggleEditMode();
    }

    // Escape to exit edit mode
    if (event.key === 'Escape' && $editMode) {
      event.preventDefault();
      settingsManager.updateEditMode({ enabled: false });
    }

    // Ctrl/Cmd + S to save all changes (in edit mode)
    if ((event.ctrlKey || event.metaKey) && (event.key === 's' || event.key === 'S') && $editMode) {
      event.preventDefault();
      // Trigger save event for any active editors
      document.dispatchEvent(new CustomEvent('save-all-edits'));
    }

    // Ctrl/Cmd + R to refresh bookmarks
    if ((event.ctrlKey || event.metaKey) && (event.key === 'r' || event.key === 'R')) {
      event.preventDefault();
      refreshBookmarks();
    }

    // Ctrl/Cmd + D to show debug overlay (for Brave testing)
    if ((event.ctrlKey || event.metaKey) && (event.key === 'd' || event.key === 'D')) {
      event.preventDefault();
      BraveDebugger.createDebugOverlay();
    }
  }

  // Toggle edit mode
  async function toggleEditMode() {
    const newEditMode = !$editMode;
    await settingsManager.updateEditMode({ enabled: newEditMode });
  }

  // Reactive statement to handle edit mode changes
  $: {
    if ($editMode) {
      console.log('🦁 Edit mode enabled - activating enhanced drag-drop...');
      try {
        // Use multiple delays to ensure DOM readiness for Svelte components
        setTimeout(async () => {
          console.log('🦁 Phase 1: Initial setup after DOM update...');
          await EnhancedDragDropManager.enableEditMode();

          // Additional delay specifically for folder container setup
          setTimeout(async () => {
            console.log('🦁 Phase 2: Re-initializing to catch any late-loading folder containers...');
            await EnhancedDragDropManager.initialize();

            // Final verification with extended delay
            setTimeout(() => {
              const draggableElements = document.querySelectorAll('[draggable="true"]');
              const folderContainers = document.querySelectorAll('.folder-container');
              const draggableFolders = document.querySelectorAll('.folder-container[draggable="true"]');

              console.log(`🦁 FINAL SETUP COMPLETE:`);
              console.log(`  - Total draggable elements: ${draggableElements.length}`);
              console.log(`  - Total folder containers: ${folderContainers.length}`);
              console.log(`  - Draggable folders: ${draggableFolders.length}`);

              // If folders exist but aren't draggable, force setup
              if (folderContainers.length > 0 && draggableFolders.length === 0) {
                console.log('🦁 Forcing folder drag-drop setup...');
                EnhancedDragDropManager.setupFolderDragDrop();
              }
            }, 200);
          }, 300);
        }, 150);
      } catch (error) {
        console.error('❌ Failed to enable enhanced edit mode:', error);
      }
    } else {
      console.log('🦁 Edit mode disabled - deactivating enhanced drag-drop...');
      try {
        EnhancedDragDropManager.disableEditMode();
      } catch (error) {
        console.error('❌ Failed to disable enhanced edit mode:', error);
      }
    }
  }
  
  // Set up bookmark event listeners for automatic cache invalidation
  function setupBookmarkEventListeners() {
    console.log('🔄 Setting up bookmark event listeners for automatic cache invalidation...');

    // Set up the Chrome bookmark API event listeners
    BookmarkEditAPI.setupEventListeners();

    // Add our cache invalidation listeners
    BookmarkEditAPI.addEventListener('moved', (data: any) => {
      console.log('📍 Bookmark moved detected, clearing cache:', data);
      BookmarkManager.clearCache();
      // Automatically refresh the UI
      refreshBookmarks();
    });

    BookmarkEditAPI.addEventListener('created', (data: any) => {
      console.log('➕ Bookmark created detected, clearing cache:', data);
      BookmarkManager.clearCache();
      refreshBookmarks();
    });

    BookmarkEditAPI.addEventListener('changed', (data: any) => {
      console.log('✏️ Bookmark changed detected, clearing cache:', data);
      BookmarkManager.clearCache();
      refreshBookmarks();
    });

    BookmarkEditAPI.addEventListener('removed', (data: any) => {
      console.log('🗑️ Bookmark removed detected, clearing cache:', data);
      BookmarkManager.clearCache();
      refreshBookmarks();
    });

    BookmarkEditAPI.addEventListener('reordered', (data: any) => {
      console.log('🔄 Bookmark reordered detected, clearing cache:', data);
      BookmarkManager.clearCache();
      refreshBookmarks();
    });

    console.log('✅ Bookmark event listeners set up successfully');
  }

  // Refresh bookmarks
  async function refreshBookmarks() {
    try {
      isLoading.set(true);
      error.set(null);
      BookmarkManager.clearCache();

      const folders = await BookmarkManager.getOrganizedBookmarks();
      bookmarkFolders.set(folders);
    } catch (err) {
      console.error('Failed to refresh bookmarks:', err);
      error.set('Failed to refresh bookmarks.');
    } finally {
      isLoading.set(false);
    }
  }
</script>

<main class="app" class:edit-mode={$editMode}>
  <!-- Edit Mode Controls -->
  <EditModeToggle />

  <!-- Settings Panel -->
  <SettingsPanel />

  <!-- Keyboard Shortcuts Help -->
  <KeyboardShortcuts />

  <!-- Error Report Button (only show in development or when errors exist) -->
  <div class="error-report-container">
    <ErrorReportButton />
  </div>

  <div class="container">
    <header class="header">
      <h1 class="title">FaVault</h1>
      <p class="subtitle">Your personalized bookmark hub</p>
    </header>
    
    <SearchBar bind:this={searchBarComponent} />
    
    {#if $isLoading}
      <div class="loading">
        <div class="loading-spinner"></div>
        <p>Loading your bookmarks...</p>
      </div>
    {:else if $error}
      <div class="error">
        <div class="error-icon">⚠️</div>
        <p>{$error}</p>
        <button class="retry-button" on:click={refreshBookmarks}>
          Try Again
        </button>
      </div>
    {:else if $filteredBookmarks.length === 0}
      <div class="empty-state">
        <div class="empty-icon">📚</div>
        <h3>No bookmarks found</h3>
        <p>Start bookmarking your favorite sites to see them here!</p>
      </div>
    {:else}
      <div class="bookmarks-container">
        {#each $filteredBookmarks as folder, index (folder.id)}
          <!-- Insertion point before first folder -->
          {#if index === 0}
            <FolderInsertionPoint insertionIndex={0} isFirst={true} />
          {/if}

          <!-- The folder itself -->
          <BookmarkFolderEnhanced {folder} />

          <!-- Insertion point after each folder -->
          <FolderInsertionPoint
            insertionIndex={index + 1}
            isLast={index === $filteredBookmarks.length - 1}
          />
        {/each}
      </div>
    {/if}
  </div>
</main>

<style>
  :global(html, body) {
    margin: 0;
    padding: 0;
    height: 100%;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    overflow-x: hidden;
  }
  
  :global(*) {
    box-sizing: border-box;
  }
  
  .app {
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 2rem 1rem;
    position: relative;
    transition: all 0.3s ease;
  }

  .app.edit-mode {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    position: relative;
  }

  .app.edit-mode::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(102, 126, 234, 0.1);
    pointer-events: none;
    z-index: 1;
  }
  
  .app::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
      radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
      radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%),
      radial-gradient(circle at 40% 40%, rgba(120, 219, 255, 0.2) 0%, transparent 50%);
    pointer-events: none;
    z-index: -1;
  }
  
  .container {
    max-width: 1200px;
    margin: 0 auto;
    position: relative;
    z-index: 1;
  }
  
  .header {
    text-align: center;
    margin-bottom: 3rem;
  }
  
  .title {
    font-size: 3rem;
    font-weight: 700;
    color: white;
    margin: 0 0 0.5rem 0;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    letter-spacing: -0.02em;
  }
  
  .subtitle {
    font-size: 1.2rem;
    color: rgba(255, 255, 255, 0.8);
    margin: 0;
    font-weight: 300;
  }
  
  .loading {
    text-align: center;
    padding: 4rem 2rem;
    color: rgba(255, 255, 255, 0.9);
  }
  
  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top: 3px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .error-report-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
  }
  
  .error {
    text-align: center;
    padding: 4rem 2rem;
    color: rgba(255, 255, 255, 0.9);
  }
  
  .error-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }
  
  .retry-button {
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: white;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1rem;
    margin-top: 1rem;
    transition: all 0.2s ease;
  }
  
  .retry-button:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: translateY(-2px);
  }
  
  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    color: rgba(255, 255, 255, 0.9);
  }
  
  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }
  
  .empty-state h3 {
    font-size: 1.5rem;
    margin: 0 0 1rem 0;
    font-weight: 600;
  }
  
  .empty-state p {
    font-size: 1.1rem;
    opacity: 0.8;
    margin: 0;
  }
  
  .bookmarks-container {
    animation: fadeIn 0.5s ease-out;
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @media (max-width: 768px) {
    .app {
      padding: 1rem 0.5rem;
    }
    
    .title {
      font-size: 2.5rem;
    }
    
    .subtitle {
      font-size: 1rem;
    }
    
    .header {
      margin-bottom: 2rem;
    }
  }
  
  @media (prefers-color-scheme: dark) {
    .app {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    }
  }

  /* Prevent auto-scrolling during drag operations */
  .app.drag-active {
    /* Disable smooth scrolling during drag operations */
    scroll-behavior: auto !important;
    /* Prevent scroll position changes */
    overflow-anchor: none;
    /* Stabilize layout during drag operations */
    contain: layout style;
  }

  /* Prevent auto-scrolling on the body during drag operations */
  :global(body.drag-active) {
    /* Disable smooth scrolling */
    scroll-behavior: auto !important;
    /* Prevent automatic scroll adjustments */
    overflow-anchor: none;
    /* Lock scroll position during drag operations */
    scroll-snap-type: none;
  }

  /* Prevent layout shifts that could trigger auto-scroll */
  :global(.drag-active) {
    /* Use GPU acceleration to prevent layout recalculations */
    transform: translateZ(0);
    /* Hint to browser about upcoming changes */
    will-change: transform;
  }
</style>
