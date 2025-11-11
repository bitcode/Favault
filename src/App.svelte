<script context="module" lang="ts">
  import { BookmarkEditAPI as BookmarkEditAPIModule } from './lib/api';
  import { BookmarkManager as BookmarkManagerModule } from './lib/bookmarks';
  // Early, module-scope installation so the bridge is present before any interactions (incl. Playwright)
  if (typeof document !== 'undefined' && !(window as any).__fav_globalDnDBridgeInstalled) {
    try {
      console.log('[Global DnD] Installing document-level mouse bridge (module-scope in App.svelte)');

      const refreshAfterMove = async () => {
        try {
          // Clear cache and prefer direct refresh if available.
          BookmarkManagerModule.clearCache();
          if (typeof (window as any).loadBookmarks === 'function') {
            (window as any).loadBookmarks();
          }
        } catch (err) {
          console.error('[Global DnD] Refresh after move failed', err);
        }
      };

      const resolveDropContainer = (e: MouseEvent | PointerEvent): HTMLElement | null => {
        const t = e.target as HTMLElement | null;
        const sel = '[data-testid="bookmark-folder"][data-folder-id], .folder-header[data-folder-id], .bookmarks-grid[data-folder-id], .folder-container[data-folder-id]';
        let container = (t?.closest?.(sel) as HTMLElement | null) || null;
        if (!container) {
          const atPoint = document.elementFromPoint((e as MouseEvent).clientX, (e as MouseEvent).clientY) as HTMLElement | null;
          container = (atPoint?.closest?.(sel) as HTMLElement | null) || null;
        }
        if (!container && document.elementsFromPoint) {
          const stack = document.elementsFromPoint((e as MouseEvent).clientX, (e as MouseEvent).clientY) as HTMLElement[];
          for (const el of stack) {
            const cand = el.closest(sel) as HTMLElement | null;
            if (cand) { container = cand; break; }
          }
        }
        return container;
      };

      const onDocMouseDown = (e: MouseEvent | PointerEvent) => {
        // Only process bookmark items for the global DnD bridge
        const t = e.target as HTMLElement | null;
        if (!t) return;

        // Check if this is actually a bookmark item (not a folder)
        const itemEl = t.closest?.('.bookmark-item[data-bookmark-id], [data-testid="bookmark-item"][data-bookmark-id]') as HTMLElement | null;
        if (!itemEl) return; // Exit early if not a bookmark item


        // Record last down position for potential salvage during mouseup
        (window as any).__fav_lastDownAt = { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };

        // SCROLL PREVENTION: Store scroll position before any potential scroll changes
        const scrollBeforeX = window.scrollX;
        const scrollBeforeY = window.scrollY;

        // Add helper class to mitigate scroll behaviors during drag
        document.querySelector('.app')?.classList.add('drag-active');

        // Process the bookmark item
        const id = itemEl.getAttribute('data-bookmark-id') || itemEl.getAttribute('data-id') || '';
        const parentId = itemEl.getAttribute('data-parent-id') || (itemEl.closest('[data-folder-id]') as HTMLElement | null)?.getAttribute('data-folder-id') || '';
        if (id) {
          (window as any).__fav_dragCandidate = { id, parentId };
          itemEl.setAttribute('data-dragging', 'true');
          itemEl.classList.add('dragging');
          // Update DOM status attributes
          const body = document.body;
          if (body) {
            body.setAttribute('data-dnd-candidate', id);
            const n = parseInt(body.getAttribute('data-dnd-events') || '0', 10) + 1;
            body.setAttribute('data-dnd-events', String(n));
          }
          console.log('[Global DnD] mousedown captured bookmark:', { id, parentId });
        }

        // SCROLL PREVENTION: Restore scroll position if it changed after mousedown
        requestAnimationFrame(() => {
          const scrollAfterX = window.scrollX;
          const scrollAfterY = window.scrollY;
          if (scrollAfterX !== scrollBeforeX || scrollAfterY !== scrollBeforeY) {
            console.log('[Global DnD] Detected unwanted scroll on mousedown, restoring position:', { from: [scrollAfterX, scrollAfterY], to: [scrollBeforeX, scrollBeforeY] });
            window.scrollTo(scrollBeforeX, scrollBeforeY);
          }
        });
      };

      const onDocMouseUp = async (e: MouseEvent | PointerEvent) => {
        try {
          // Remove helper class regardless of success
          document.querySelector('.app')?.classList.remove('drag-active');

          let gc = (window as any).__fav_dragCandidate || {};
          let fromId: string | undefined = gc.id;
          let fromParentId: string | null = gc.parentId || null;

          // Salvage: if no candidate was captured on mousedown, infer from last down position
          if (!fromId) {
            const pos = (window as any).__fav_lastDownAt as { x: number, y: number } | undefined;
            if (pos) {
              const candidates = Array.from(document.querySelectorAll('.bookmark-item, [data-testid="bookmark-item"]')) as HTMLElement[];
              const el = candidates.find(el => {
                const r = el.getBoundingClientRect();
                return pos.x >= r.left && pos.x <= r.right && pos.y >= r.top && pos.y <= r.bottom;
              }) || null;
              if (el) {
                fromId = el.getAttribute('data-bookmark-id') || el.getAttribute('data-id') || undefined;
                fromParentId = el.getAttribute('data-parent-id') || (el.closest('[data-folder-id]') as HTMLElement | null)?.getAttribute('data-folder-id') || null;
                gc = { id: fromId, parentId: fromParentId };
                (window as any).__fav_dragCandidate = gc;
                console.log('[Global DnD] Salvaged source from lastDownAt:', { fromId, fromParentId });
              }
            }
          }

          const container = resolveDropContainer(e);
          if (!fromId || !container) return;
          const toParentId = container.getAttribute('data-folder-id') || '';
          if (!toParentId || fromParentId === toParentId) return;
          const droppedOnHeader = !!(e.target as HTMLElement | null)?.closest?.('.folder-header');
          const toIndex = droppedOnHeader ? 0 : undefined;
          // Increment event counter and clear candidate on successful resolution
          try {
            const body = document.body;
            if (body) {
              const n = parseInt(body.getAttribute('data-dnd-events') || '0', 10) + 1;
              body.setAttribute('data-dnd-events', String(n));
              body.removeAttribute('data-dnd-candidate');
            }
          } catch {}
          console.log('[Global DnD] mouseup detected drop', { fromId, fromParentId, toParentId, toIndex });
          const result = await BookmarkEditAPIModule.moveBookmark(fromId, { parentId: toParentId, index: toIndex });
          if (result?.success) {
            console.log('[Global DnD] moveBookmark success', { fromId, toParentId, toIndex });
            try { document?.dispatchEvent(new CustomEvent('favault-bookmark-moved', { detail: { type: 'inter-folder', fromId, fromParentId, toParentId, toIndex } })); } catch {}
            await refreshAfterMove();
          } else {
            console.error('[Global DnD] moveBookmark failed', result?.error);
          }
        } catch (err) {
          console.error('[Global DnD] Error handling mouseup drop', err);
        } finally {
          (window as any).__fav_dragCandidate = null;
        }
      };

      // Use bubble phase (false) instead of capture phase to not interfere with drag operations
      document.addEventListener('mousedown', onDocMouseDown, false);
      document.addEventListener('pointerdown', onDocMouseDown as any, false);
      document.addEventListener('mouseup', onDocMouseUp, false);
      document.addEventListener('pointerup', onDocMouseUp as any, false);
      // HTML5 drag-n-drop fallbacks to catch native drag sequences
      const onDocDragStart = (e: DragEvent) => {
        const t = e.target as HTMLElement | null;
        if (!t) return;
        const itemEl = t.closest?.('.bookmark-item[data-bookmark-id], [data-testid="bookmark-item"][data-bookmark-id]') as HTMLElement | null;
        if (!itemEl) return;
        const id = itemEl.getAttribute('data-bookmark-id') || itemEl.getAttribute('data-id') || '';
        const parentId = itemEl.getAttribute('data-parent-id') || (itemEl.closest('[data-folder-id]') as HTMLElement | null)?.getAttribute('data-folder-id') || '';
        if (id) {
          (window as any).__fav_dragCandidate = { id, parentId };
          // DOM status attributes
          const body = document.body;
          if (body) {
            body.setAttribute('data-dnd-candidate', id);
            const n = parseInt(body.getAttribute('data-dnd-events') || '0', 10) + 1;
            body.setAttribute('data-dnd-events', String(n));
          }
          console.log('[Global DnD] dragstart captured bookmark:', { id, parentId });
        }
      };
      const onDocDrop = async (e: DragEvent) => {
        try {
          document.querySelector('.app')?.classList.remove('drag-active');
          const container = resolveDropContainer(e as unknown as MouseEvent);
          const gc = (window as any).__fav_dragCandidate || {};
          const fromId = gc.id;
          const fromParentId = gc.parentId || null;
          if (!fromId || !container) return;
          const toParentId = container.getAttribute('data-folder-id') || '';
          if (!toParentId || fromParentId === toParentId) return;
          const droppedOnHeader = !!(e.target as HTMLElement | null)?.closest?.('.folder-header');
          const toIndex = droppedOnHeader ? 0 : undefined;
          // Increment event counter and clear candidate on successful resolution
          try {
            const body = document.body;
            if (body) {
              const n = parseInt(body.getAttribute('data-dnd-events') || '0', 10) + 1;
              body.setAttribute('data-dnd-events', String(n));
              body.removeAttribute('data-dnd-candidate');
            }
          } catch {}
          console.log('[Global DnD] drop detected', { fromId, fromParentId, toParentId, toIndex });
          const result = await BookmarkEditAPIModule.moveBookmark(fromId, { parentId: toParentId, index: toIndex });
          if (result?.success) {
            console.log('[Global DnD] moveBookmark success (drop)', { fromId, toParentId, toIndex });
            try { document?.dispatchEvent(new CustomEvent('favault-bookmark-moved', { detail: { type: 'inter-folder', fromId, fromParentId, toParentId, toIndex } })); } catch {}
            await refreshAfterMove();
          } else {
            console.error('[Global DnD] moveBookmark failed (drop)', result?.error);
          }
        } catch (err) {
          console.error('[Global DnD] Error handling drop', err);
        } finally {
          (window as any).__fav_dragCandidate = null;
        }
      };
      document.addEventListener('dragstart', onDocDragStart, true);
      document.addEventListener('drop', onDocDrop as any, true);

      // One-time heartbeat log to confirm installation after console monitor attaches
      setTimeout(() => console.log('[Global DnD] Heartbeat: bridge active (module-scope)'), 1500);
      // One-time global mousedown visibility ping to prove capture-phase reachability
      document.addEventListener('mousedown', () => console.log('[Global DnD] Capture-phase mousedown observed (any target)'), { capture: true, once: true } as any);
      // Expose bridge status for ad-hoc diagnostics
      (window as any).__fav_getBridgeStatus = () => ({ installed: !!(window as any).__fav_globalDnDBridgeInstalled, dragCandidate: (window as any).__fav_dragCandidate || null });

      console.log('[Global DnD] Bridge installed (module-scope) with 6 listeners');
      try {
        const body = document.body;
        if (body) {
          body.setAttribute('data-dnd-bridge', 'installed');
          if (!body.getAttribute('data-dnd-events')) body.setAttribute('data-dnd-events', '0');
        }
      } catch {}
      (window as any).__fav_globalDnDBridgeInstalled = true;
    } catch (err) {
      console.error('[Global DnD] Failed to install module-scope bridge', err);
    }
  }
</script>

<script lang="ts">

  import { onMount } from 'svelte';
  import SearchBar from './lib/SearchBar.svelte';
  import BookmarkFolderEnhanced from './lib/BookmarkFolderEnhanced.svelte';
  import FolderInsertionPoint from './lib/FolderInsertionPoint.svelte';
  import SettingsPanel from './lib/SettingsPanel.svelte';
  import EditModeToggle from './lib/EditModeToggle.svelte';
  import KeyboardShortcuts from './lib/KeyboardShortcuts.svelte';
  import ErrorReportButton from './lib/ErrorReportButton.svelte';
  import ServiceWorkerDiagnostics from './lib/ServiceWorkerDiagnostics.svelte';
  import { BraveDebugger } from './lib/brave-debug';
  import { BookmarkManager } from './lib/bookmarks';
  import { EnhancedDragDropManager } from './lib/dragdrop-enhanced';
  import { EnhancedDragDropTester } from './lib/test-enhanced-dragdrop';
  import { DragDropTestSuite } from './lib/drag-drop-test-suite';
  import { ServiceWorkerDragDropTester } from './lib/drag-drop-service-worker-test';
  import { serviceWorkerManager } from './lib/service-worker-manager';
  import { errorReporter, reportLoadingError, reportInitializationError } from './lib/error-reporter';
  import { ExtensionLoadingDiagnostics } from './lib/extension-loading-diagnostics';
  import { bookmarkFolders, filteredBookmarks, isLoading, error, settingsManager, editMode } from './lib/stores';
  import { ExtensionAPI, BookmarkEditAPI } from './lib/api';

  // Import drag-and-drop animations CSS
  import './lib/drag-drop-animations.css';

	// PERFORMANCE FIX: Temporarily disable redundant drag-drop bridge
	if (false && typeof window !== 'undefined' && !((window as any).__fav_appGlobalDnDBridgeInstalled)) {
	  try {
	    console.log('[Global DnD] Installing document-level mouse bridge (module-scope)');
	    const onDocMouseDown = (e: MouseEvent | PointerEvent) => {
	      const t = e.target as HTMLElement | null;
	      const itemEl = t && (t.closest?.('.bookmark-item[data-bookmark-id]') as HTMLElement | null);
	      if (!itemEl) return;
	      const id = itemEl.getAttribute('data-bookmark-id') || itemEl.getAttribute('data-id') || '';
	      const parentId = itemEl.getAttribute('data-parent-id') || (itemEl.closest('[data-folder-id]') as HTMLElement | null)?.getAttribute('data-folder-id') || '';
	      if (id) {
	        (window as any).__fav_dragCandidate = { id, parentId };
	        console.log('[Global DnD] mousedown captured bookmark:', { id, parentId });
	        // Optional visual marker to assist diagnosis
	        itemEl.setAttribute('data-dragging', 'true');
	        itemEl.classList.add('dragging');
	        setTimeout(() => itemEl.removeAttribute('data-dragging'), 2000);
	      }
	    };
	    const onDocMouseUp = async (e: MouseEvent | PointerEvent) => {
	      try {
	        const t = e.target as HTMLElement | null;
	        if (!t) return;
	        const container = (t.closest?.('.folder-header[data-folder-id], .bookmarks-grid[data-folder-id], .folder-container[data-folder-id], [data-testid="bookmark-folder"][data-folder-id]') as HTMLElement | null);
	        if (!container) return;
	        const toParentId = container.getAttribute('data-folder-id') || '';
	        const gc = (window as any).__fav_dragCandidate || {};
	        const fromId = gc.id;
	        const fromParentId = gc.parentId || null;
	        if (!fromId || !toParentId || fromParentId === toParentId) {
	          return;
	        }
	        const droppedOnHeader = !!t.closest?.('.folder-header');
	        const toIndex = droppedOnHeader ? 0 : undefined;
	        console.log('[Global DnD] mouseup detected drop', { fromId, fromParentId, toParentId, toIndex });
	        const result = await BookmarkEditAPI.moveBookmark(fromId, { parentId: toParentId, index: toIndex });
	        if (result?.success) {
	          console.log('[Global DnD] moveBookmark success', { fromId, toParentId, toIndex });
	          BookmarkManager.clearCache();
	          await refreshBookmarks();
	        } else {
	          console.error('[Global DnD] moveBookmark failed', { fromId, toParentId, error: result?.error });
	        }
	      } catch (err) {
	        console.error('[Global DnD] Error handling mouseup drop', err);
	      } finally {
	        (window as any).__fav_dragCandidate = null;
	      }
	    };

	    // Attach listeners (capture phase) - pointer events only to avoid duplicates
	    document.addEventListener('pointerdown', onDocMouseDown as any, true);
	    document.addEventListener('pointerup', onDocMouseUp as any, true);
	    console.log('[Global DnD] Bridge installed with 2 event listeners (pointerdown/up)');
	    // Set guards to avoid duplicate installs and expose DOM signal
	    (window as any).__fav_globalDnDBridgeInstalled = true;
	    (window as any).__fav_appGlobalDnDBridgeInstalled = true;
	    try {
	      const body = document.body;
	      if (body) {
	        body.setAttribute('data-dnd-bridge', 'installed');
	        if (!body.getAttribute('data-dnd-events')) body.setAttribute('data-dnd-events', '0');
	      }
	    } catch {}
	  } catch (e) {
	    console.error('[Global DnD] Failed to install module-scope bridge', e);
	  }
	}


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

    // Comprehensive drag-drop test suite
    (window as any).testDragDropSuite = async () => {
      console.log('🧪 Running comprehensive drag-drop test suite...');
      try {
        const suite = await DragDropTestSuite.runAllTests();
        console.log('🧪 Test suite results:', suite);

        // Generate and log report
        const report = DragDropTestSuite.generateReport(suite);
        console.log('📊 Test Report:\n' + report);

        return suite;
      } catch (error) {
        console.error('🧪 Test suite failed:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    };

    // Service worker management functions
    (window as any).getServiceWorkerStatus = () => {
      const status = serviceWorkerManager.getStatus();
      console.log('🔍 Service Worker Status:', status);
      return status;
    };

    (window as any).checkServiceWorker = async () => {
      console.log('🔍 Checking service worker status...');
      const status = await serviceWorkerManager.forceStatusCheck();
      console.log('📊 Service Worker Status:', status);
      return status;
    };

    (window as any).ensureServiceWorkerActive = async () => {
      console.log('🔄 Ensuring service worker is active...');
      const isActive = await serviceWorkerManager.ensureActive();
      console.log(`📊 Service Worker Active: ${isActive}`);
      return isActive;
    };

    // Debug drag-and-drop state
    (window as any).debugDragDrop = () => {
      console.log('🔍 Drag-and-Drop Debug Info:');
      console.log('Edit Mode Checks:');
      console.log('  - body.edit-mode:', document.body.classList.contains('edit-mode'));
      console.log('  - .app.edit-mode:', !!document.querySelector('.app.edit-mode'));
      console.log('  - body.drag-enabled:', document.body.classList.contains('drag-enabled'));

      console.log('Elements:');
      console.log('  - Bookmark items:', document.querySelectorAll('.bookmark-item').length);
      console.log('  - Draggable items:', document.querySelectorAll('.draggable-item').length);
      console.log('  - Insertion points:', document.querySelectorAll('.bookmark-insertion-point').length);
      console.log('  - Folder containers:', document.querySelectorAll('.folder-container').length);

      console.log('CSS Classes:');
      const bookmarkItems = document.querySelectorAll('.bookmark-item');
      bookmarkItems.forEach((item, index) => {
        if (index < 3) { // Only log first 3 to avoid spam
          console.log(`  - Bookmark ${index}:`, item.className);
        }
      });

      return {
        editMode: {
          bodyEditMode: document.body.classList.contains('edit-mode'),
          appEditMode: !!document.querySelector('.app.edit-mode'),
          bodyDragEnabled: document.body.classList.contains('drag-enabled')
        },
        elements: {
          bookmarkItems: document.querySelectorAll('.bookmark-item').length,
          draggableItems: document.querySelectorAll('.draggable-item').length,
          insertionPoints: document.querySelectorAll('.bookmark-insertion-point').length,
          folderContainers: document.querySelectorAll('.folder-container').length
        }
      };
    };

    // Test drag-and-drop functionality
    (window as any).testDragDropFunctionality = () => {
      console.log('🧪 Testing drag-and-drop functionality...');

      // Check edit mode
      const editModeActive = document.body.classList.contains('edit-mode') ||
                           document.querySelector('.app.edit-mode') !== null;

      if (!editModeActive) {
        console.warn('⚠️ Edit mode is not active. Please enable edit mode first.');
        return { success: false, error: 'Edit mode not active' };
      }

      // Check for draggable elements
      const draggableItems = document.querySelectorAll('.draggable-item');
      const bookmarkItems = document.querySelectorAll('.bookmark-item');
      const insertionPoints = document.querySelectorAll('.bookmark-insertion-point');

      console.log('📊 Element counts:');
      console.log(`  - Bookmark items: ${bookmarkItems.length}`);
      console.log(`  - Draggable items: ${draggableItems.length}`);
      console.log(`  - Insertion points: ${insertionPoints.length}`);

      // Test draggable attributes
      let draggableCount = 0;
      bookmarkItems.forEach((item, index) => {
        const isDraggable = item.getAttribute('draggable') === 'true';
        if (isDraggable) draggableCount++;

        if (index < 3) { // Log first 3 for debugging
          console.log(`  - Bookmark ${index} draggable: ${isDraggable}`);
        }
      });

      // Test insertion points visibility
      let visibleInsertionPoints = 0;
      insertionPoints.forEach(point => {
        const style = window.getComputedStyle(point);
        if (style.display !== 'none' && style.visibility !== 'hidden') {
          visibleInsertionPoints++;
        }
      });

      console.log(`📊 Draggable bookmarks: ${draggableCount}/${bookmarkItems.length}`);
      console.log(`📊 Visible insertion points: ${visibleInsertionPoints}/${insertionPoints.length}`);

      // Test results
      const results = {
        editModeActive,
        bookmarkCount: bookmarkItems.length,
        draggableCount,
        insertionPointCount: insertionPoints.length,
        visibleInsertionPoints,
        success: draggableCount > 0 && insertionPoints.length > 0
      };

      if (results.success) {
        console.log('✅ Drag-and-drop functionality appears to be working');
      } else {
        console.warn('❌ Drag-and-drop functionality may have issues');
      }

      return results;
    };

    // Debug insertion points specifically
    (window as any).debugInsertionPoints = () => {
      console.log('🔍 Debugging Insertion Points...');

      const insertionPoints = document.querySelectorAll('.bookmark-insertion-point');
      const editModeActive = document.body.classList.contains('edit-mode') ||
                           document.querySelector('.app.edit-mode') !== null;

      console.log(`📊 Found ${insertionPoints.length} insertion points`);
      console.log(`📊 Edit mode active: ${editModeActive}`);

      insertionPoints.forEach((point, index) => {
        const style = window.getComputedStyle(point);
        const rect = point.getBoundingClientRect();

        console.log(`Insertion Point ${index}:`, {
          element: point,
          parentId: point.getAttribute('data-parent-id'),
          insertIndex: point.getAttribute('data-insert-index'),
          classes: point.className,
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          height: style.height,
          width: style.width,
          position: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          isVisible: rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
        });
      });

      // Check if they're being created in the right places
      const bookmarkItems = document.querySelectorAll('.bookmark-item');
      console.log(`📊 Found ${bookmarkItems.length} bookmark items`);

      // Check folder structure
      const folders = document.querySelectorAll('.folder-container');
      folders.forEach((folder, folderIndex) => {
        const folderBookmarks = folder.querySelectorAll('.bookmark-item');
        const folderInsertionPoints = folder.querySelectorAll('.bookmark-insertion-point');

        console.log(`Folder ${folderIndex}:`, {
          bookmarks: folderBookmarks.length,
          insertionPoints: folderInsertionPoints.length,
          expectedInsertionPoints: folderBookmarks.length + 1 // Should be bookmarks + 1
        });
      });

      return {
        insertionPointCount: insertionPoints.length,
        editModeActive,
        bookmarkCount: bookmarkItems.length,
        folderCount: folders.length
      };
    };

    // Test insertion point functionality
    (window as any).testInsertionPoints = () => {
      console.log('🧪 Testing insertion point functionality...');

      const insertionPoints = document.querySelectorAll('.bookmark-insertion-point');
      console.log(`Found ${insertionPoints.length} insertion points`);

      if (insertionPoints.length === 0) {
        console.warn('❌ No insertion points found! Check if edit mode is active.');
        return { success: false, error: 'No insertion points found' };
      }

      // Test each insertion point
      let workingPoints = 0;
      insertionPoints.forEach((point, index) => {
        const rect = point.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0;

        console.log(`Insertion Point ${index}:`, {
          parentId: point.getAttribute('data-parent-id'),
          insertIndex: point.getAttribute('data-insert-index'),
          visible: isVisible,
          dimensions: { width: rect.width, height: rect.height },
          position: { x: rect.x, y: rect.y }
        });

        if (isVisible) workingPoints++;
      });

      console.log(`📊 ${workingPoints}/${insertionPoints.length} insertion points are visible`);

      // Try to trigger a drag enter event on the first insertion point
      if (insertionPoints.length > 0) {
        const firstPoint = insertionPoints[0];
        console.log('🎯 Testing drag enter on first insertion point...');

        // Create a mock drag event
        const dragEvent = new DragEvent('dragenter', {
          bubbles: true,
          cancelable: true,
          dataTransfer: new DataTransfer()
        });

        // Set some mock drag data
        dragEvent.dataTransfer?.setData('application/x-favault-bookmark', JSON.stringify({
          type: 'bookmark',
          id: 'test-bookmark',
          title: 'Test Bookmark',
          parentId: 'test-parent',
          index: 0
        }));

        firstPoint.dispatchEvent(dragEvent);
        console.log('✅ Drag enter event dispatched');
      }

      return {
        success: workingPoints > 0,
        totalPoints: insertionPoints.length,
        visiblePoints: workingPoints
      };
    };

    // Service worker drag-drop test suite
    (window as any).testServiceWorkerDragDrop = async () => {
      console.log('🧪 Running service worker drag-drop test suite...');
      try {
        const suite = await ServiceWorkerDragDropTester.runServiceWorkerDragDropTests();
        console.log('🧪 Service worker drag-drop test results:', suite);

        // Generate and log report
        const report = ServiceWorkerDragDropTester.generateReport(suite);
        console.log('📊 Service Worker Drag-Drop Test Report:\n' + report);

        return suite;
      } catch (error) {
        console.error('🧪 Service worker drag-drop tests failed:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    };

    // Setup service worker status monitoring
    serviceWorkerManager.addStatusListener((status) => {
      if (!status.isActive && status.consecutiveFailures > 2) {
        console.warn('⚠️ Service worker appears to be having issues:', status);

        // Show user notification if service worker is consistently failing
        if (status.consecutiveFailures > 5) {
          console.error('❌ Service worker is consistently failing. Some features may not work properly.');
        }
      } else if (status.isActive && status.consecutiveFailures === 0) {
        console.log('✅ Service worker is healthy and active');
      }
    });

    console.log('✅ DIRECT automated testing system ready!');
    console.log('📋 Available commands (exposed directly):');
    console.log('  - runAllTests() - Run comprehensive test suite');
    console.log('  - testMove(from, to) - Test individual move');
    console.log('  - showState() - Show current bookmark state');
    console.log('  - refreshBookmarks() - Force refresh UI and clear cache');
    console.log('  - testDragDropSuite() - Run comprehensive drag-drop tests');
    console.log('  - testServiceWorkerDragDrop() - Test drag-drop with SW cycling');
    console.log('  - testDragDropFunctionality() - Test current drag-drop setup');
    console.log('  - debugDragDrop() - Debug drag-and-drop state and elements');
    console.log('  - debugInsertionPoints() - Debug insertion point rendering and visibility');
    console.log('  - testInsertionPoints() - Test insertion point functionality');
    console.log('  - getServiceWorkerStatus() - Check service worker status');
    console.log('  - checkServiceWorker() - Force service worker status check');
    console.log('  - ensureServiceWorkerActive() - Ensure service worker is active');
    console.log('  - getTestResults() - Info about test results');

    // Verify functions are exposed
    setTimeout(() => {
      console.log('🔍 Verification check:');
      console.log('runAllTests available:', typeof (window as any).runAllTests === 'function');
      console.log('testMove available:', typeof (window as any).testMove === 'function');
      console.log('showState available:', typeof (window as any).showState === 'function');
      console.log('testDragDropSuite available:', typeof (window as any).testDragDropSuite === 'function');

      if (typeof (window as any).runAllTests === 'function' && typeof (window as any).testDragDropSuite === 'function') {
        console.log('🎉 SUCCESS: All functions are available! Try: runAllTests() or testDragDropSuite()');
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



	// Install document-level mouse DnD bridge early for Playwright compatibility
	if (typeof window !== 'undefined' && !(window as any).__fav_globalDnDBridgeInstalled) {
	  console.log('[Global DnD] Installing document-level mouse bridge');
	  const onDocMouseDown = (e: MouseEvent | PointerEvent) => {
	    const t = e.target as HTMLElement | null;
	    const itemEl = t && (t.closest?.('.bookmark-item[data-bookmark-id]') as HTMLElement | null);
	    if (!itemEl) return;

	    // SCROLL PREVENTION: Store scroll position before any potential scroll changes
	    const scrollBeforeX = window.scrollX;
	    const scrollBeforeY = window.scrollY;

	    const id = itemEl.getAttribute('data-bookmark-id') || itemEl.getAttribute('data-id') || '';
	    const parentId = itemEl.getAttribute('data-parent-id') || (itemEl.closest('[data-folder-id]') as HTMLElement | null)?.getAttribute('data-folder-id') || '';


	    if (id) {
	      (window as any).__fav_dragCandidate = { id, parentId };
	      console.log('[Global DnD] mousedown captured bookmark:', { id, parentId });
	      // Optional visual marker to assist diagnosis
	      itemEl.setAttribute('data-dragging', 'true');
	      itemEl.classList.add('dragging');
	      setTimeout(() => itemEl.removeAttribute('data-dragging'), 2000);
	    }

	    // SCROLL PREVENTION: Restore scroll position if it changed after mousedown
	    requestAnimationFrame(() => {
	      const scrollAfterX = window.scrollX;
	      const scrollAfterY = window.scrollY;
	      if (scrollAfterX !== scrollBeforeX || scrollAfterY !== scrollBeforeY) {
	        console.log('[Global DnD] Detected unwanted scroll on mousedown (fallback), restoring position:', { from: [scrollAfterX, scrollAfterY], to: [scrollBeforeX, scrollBeforeY] });
	        window.scrollTo(scrollBeforeX, scrollBeforeY);
	      }
	    });
	  };
	  const onDocMouseUp = async (e: MouseEvent | PointerEvent) => {
	    try {
	      const t = e.target as HTMLElement | null;
	      if (!t) return;
	      const container = (t.closest?.('.folder-header[data-folder-id], .bookmarks-grid[data-folder-id], .folder-container[data-folder-id]') as HTMLElement | null);
	      if (!container) return;
	      const toParentId = container.getAttribute('data-folder-id') || '';
	      const gc = (window as any).__fav_dragCandidate || {};
	      const fromId = gc.id;
	      const fromParentId = gc.parentId || null;
	      if (!fromId || !toParentId || fromParentId === toParentId) {
	        // Nothing to do or no change in parent
	        return;
	      }
	      const droppedOnHeader = !!t.closest?.('.folder-header');
	      const toIndex = droppedOnHeader ? 0 : undefined; // append when not header
	      console.log('[Global DnD] mouseup detected drop', { fromId, fromParentId, toParentId, toIndex });
	      const result = await BookmarkEditAPI.moveBookmark(fromId, { parentId: toParentId, index: toIndex });
	      if (result?.success) {
	        console.log('[Global DnD] moveBookmark success', { fromId, toParentId, toIndex });
	        BookmarkManager.clearCache();
	        await refreshBookmarks();
	      } else {
	        console.error('[Global DnD] moveBookmark failed', { fromId, toParentId, error: result?.error });
	      }
	    } catch (err) {
	      console.error('[Global DnD] Error handling mouseup drop', err);
	    } finally {
	      (window as any).__fav_dragCandidate = null;
	    }
	  };


	  // Install global DnD bridge only if not already installed (fallback)
	  if (!(window as any).__fav_globalDnDBridgeInstalled) {
	    // Pointer events only to avoid duplicate mouse/pointer firing
	    document.addEventListener('pointerdown', onDocMouseDown as any, true);
	    document.addEventListener('pointerup', onDocMouseUp as any, true);
	    console.log('[Global DnD] Bridge installed (fallback) with 2 event listeners (pointerdown/up)');
	    (window as any).__fav_globalDnDBridgeInstalled = true;
	    try {
	      const body = document.body;
	      if (body) {
	        body.setAttribute('data-dnd-bridge', 'installed');
	        if (!body.getAttribute('data-dnd-events')) body.setAttribute('data-dnd-events', '0');
	      }
	    } catch {}
	  } else {
	    console.log('[Global DnD] Bridge already installed (skipping fallback)');
	  }
	}


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

    // Listen for inter-folder bookmark move events
    const handleBookmarkMoveEvent = (event: CustomEvent) => {
      console.log('📍 Inter-folder bookmark move detected:', event.detail);

      // We now rely on Chrome's bookmarks.onMoved listener to drive refreshes.
      // Avoid triggering extra refreshes here to prevent redundant reloads/loops.
      if (event.detail?.type === 'inter-folder') {
        console.log('📍 Inter-folder move acknowledged (no extra refresh triggered)');
      }
    };

    document.addEventListener('favault-refresh-bookmarks', handleRefreshEvent as EventListener);
    document.addEventListener('favault-chrome-refresh-verify', handleChromeVerifyEvent as EventListener);
    document.addEventListener('favault-bookmark-moved', handleBookmarkMoveEvent as EventListener);
    console.log('👂 Bookmark refresh event listeners set up (including Chrome-specific and inter-folder moves)');

    return () => {
      document.removeEventListener('favault-refresh-bookmarks', handleRefreshEvent as EventListener);
      document.removeEventListener('favault-chrome-refresh-verify', handleChromeVerifyEvent as EventListener);
      document.removeEventListener('favault-bookmark-moved', handleBookmarkMoveEvent as EventListener);
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
      document?.dispatchEvent(new CustomEvent('save-all-edits'));
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
        // Force a single reconciliatory refresh after leaving edit mode
        BookmarkManager.clearCache();
        refreshBookmarks();
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
  <!-- Top Right Control Panel -->
  <div class="top-controls-panel">
    <!-- Service Worker Diagnostics -->
    <ServiceWorkerDiagnostics />

    <!-- Error Report Button -->
    <ErrorReportButton />

    <!-- Edit Mode Controls -->
    <EditModeToggle />
  </div>

  <!-- Settings Panel -->
  <SettingsPanel />

  <!-- Keyboard Shortcuts Help -->
  <KeyboardShortcuts />

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

  .top-controls-panel {
    position: fixed;
    top: 1rem;
    right: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    z-index: 1000;
    align-items: flex-end;
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

    .top-controls-panel {
      top: 0.5rem;
      right: 0.5rem;
      gap: 0.5rem;
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

  /* Prevent auto-scrolling in edit mode */
  .app.edit-mode {
    /* Disable smooth scrolling in edit mode */
    scroll-behavior: auto !important;
    /* Prevent automatic scroll adjustments */
    overflow-anchor: none;
    /* Prevent scroll chaining and browser-initiated rubber-banding */
    overscroll-behavior: contain;
  }

  /* Prevent focus-based scrolling on draggable items */
  :global(.edit-mode .bookmark-item),
  :global(.edit-mode .folder-container) {
    /* Prevent focus outline from causing scroll */
    outline-offset: -2px;
    /* Prevent focus from triggering scroll */
    scroll-margin: 0;
    scroll-padding: 0;
    /* Prevent touch/pointer panning that can cause scroll-on-down */
    touch-action: none;
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
