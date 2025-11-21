// Initialize logging first
import Logger from './lib/logging';
import * as LogQueryUtils from './lib/logging/log-query-utils';

// Ensure global drag-drop fallback handlers are registered AS EARLY AS POSSIBLE
import './lib/global-dragdrop-init';
import { BookmarkEditAPI } from './lib/api';
import { BookmarkManager } from './lib/bookmarks';
import { serviceWorkerManager } from './lib/service-worker-manager';
import App from './App.svelte';

// Initialize logger for the newtab page
const logger = Logger.getInstance();
logger.init().catch(err => console.error('[Logging] Failed to initialize logger:', err));

// PERFORMANCE FIX: Disable early drag-drop installation
(() => {
  if (typeof document === 'undefined') return;
  if ((window as any).__fav_globalDnDBridgeInstalled) return;
  if (true) return; // PERFORMANCE FIX: Skip this entirely
  try {
    console.log('[Global DnD] Installing document-level mouse bridge (early in main.ts)');

    const refreshAfterMove = async () => {
      try {
        BookmarkManager.clearCache();
        const folders = await BookmarkManager.getOrganizedBookmarks();
        (window as any).bookmarkFolders?.set?.(folders);
      } catch (err) {
        console.error('[Global DnD] Refresh after move failed', err);
      }
    };

    const onDocMouseDown = (e: MouseEvent | PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const itemEl = t.closest?.('.bookmark-item[data-bookmark-id], [data-testid="bookmark-item"][data-bookmark-id]') as HTMLElement | null;
      const fallbackEl = itemEl || ((): HTMLElement | null => {
        // Geometry fallback in case of overlays/pointer-events
        const x = (e as MouseEvent).clientX, y = (e as MouseEvent).clientY;
        const candidates = Array.from(document.querySelectorAll('.bookmark-item, [data-testid="bookmark-item"]')) as HTMLElement[];
        return candidates.find(el => {
          const r = el.getBoundingClientRect();
          return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
        }) || null;
      })();
      if (!fallbackEl) return;
      const id = fallbackEl.getAttribute('data-bookmark-id') || fallbackEl.getAttribute('data-id') || '';
      const parentId = fallbackEl.getAttribute('data-parent-id') || (fallbackEl.closest('[data-folder-id]') as HTMLElement | null)?.getAttribute('data-folder-id') || '';
      if (id) {
        (window as any).__fav_dragCandidate = { id, parentId };
        fallbackEl.setAttribute('data-dragging', 'true');
        fallbackEl.classList.add('dragging');
        // DOM status attributes
        const body = document.body;
        if (body) {
          body.setAttribute('data-dnd-candidate', id);
          const n = parseInt(body.getAttribute('data-dnd-events') || '0', 10) + 1;
          body.setAttribute('data-dnd-events', String(n));
        }
        console.log('[Global DnD] mousedown captured bookmark:', { id, parentId });
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

    const onDocMouseUp = async (e: MouseEvent | PointerEvent) => {
      try {
        const gc = (window as any).__fav_dragCandidate || {};
        const fromId = gc.id;
        const fromParentId = gc.parentId || null;
        const container = resolveDropContainer(e);
        if (!fromId || !container) return;
        const toParentId = container.getAttribute('data-folder-id') || '';
        if (!toParentId || fromParentId === toParentId) return;
        const droppedOnHeader = !!(e.target as HTMLElement | null)?.closest?.('.folder-header');
        const toIndex = droppedOnHeader ? 0 : undefined;
        // Increment event counter and clear candidate on successful resolution
        const body = document.body;
        if (body) {
          const n = parseInt(body.getAttribute('data-dnd-events') || '0', 10) + 1;
          body.setAttribute('data-dnd-events', String(n));
          body.removeAttribute('data-dnd-candidate');
        }
        console.log('[Global DnD] mouseup detected drop', { fromId, fromParentId, toParentId, toIndex });
        const result = await BookmarkEditAPI.moveBookmark(fromId, { parentId: toParentId, index: toIndex });
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
        try { document.body?.removeAttribute('data-dnd-candidate'); } catch {}
      }
    };

    document.addEventListener('pointerdown', onDocMouseDown as any, true);
    document.addEventListener('pointerup', onDocMouseUp as any, true);

    console.log('[Global DnD] Bridge installed (early) with 2 listeners');
    try {
      const body = document.body;
      if (body) {
        body.setAttribute('data-dnd-bridge', 'installed');
        if (!body.getAttribute('data-dnd-events')) body.setAttribute('data-dnd-events', '0');
      }
    } catch {}
    (window as any).__fav_globalDnDBridgeInstalled = true;
  } catch (err) {
    console.error('[Global DnD] Failed to install early bridge', err);
  }
})();

console.log('🦁 FaVault extension starting with enhanced drag-drop...');

const app = new App({
  target: document.getElementById('app')!,
});

// Import drag-drop logger
import DragDropLogger from './lib/logging/drag-drop-logger';

// Drag-Drop Diagnostic Utilities
const DnDDiagnostics = {
  /**
   * Check all folder elements for data-folder-id attributes
   */
  checkFolderAttributes: () => {
    const folders = document.querySelectorAll('.folder-container, [data-testid="bookmark-folder"]');
    console.log(`📊 Found ${folders.length} folder elements`);

    const results: any[] = [];
    folders.forEach((folder, index) => {
      const folderId = folder.getAttribute('data-folder-id');
      const folderTitle = folder.querySelector('.folder-title, h3')?.textContent?.trim();
      const hasAttribute = folder.hasAttribute('data-folder-id');

      const result = {
        index,
        title: folderTitle || 'Unknown',
        folderId: folderId || '❌ MISSING',
        hasAttribute,
        className: folder.className,
        testId: folder.getAttribute('data-testid')
      };

      results.push(result);

      if (!folderId) {
        console.error(`❌ Folder ${index} (${folderTitle}) is MISSING data-folder-id!`);
      } else {
        console.log(`✅ Folder ${index} (${folderTitle}): ${folderId}`);
      }
    });

    return results;
  },

  /**
   * Test drop target detection at specific coordinates
   */
  testDropDetection: (x: number, y: number) => {
    console.log(`🎯 Testing drop detection at (${x}, ${y})`);

    const atPoint = document.elementFromPoint(x, y);
    console.log('Element at point:', atPoint?.className, atPoint?.tagName);

    // Try different selector strategies
    const strategies = [
      {
        name: 'Combined selector',
        element: atPoint?.closest('[data-testid="bookmark-folder"][data-folder-id], .folder-header[data-folder-id], .bookmarks-grid[data-folder-id], .folder-container[data-folder-id]')
      },
      {
        name: 'Folder container only',
        element: atPoint?.closest('.folder-container, [data-testid="bookmark-folder"]')
      },
      {
        name: 'Folder header',
        element: atPoint?.closest('.folder-header')
      },
      {
        name: 'Bookmarks grid',
        element: atPoint?.closest('.bookmarks-grid')
      }
    ];

    strategies.forEach(({ name, element }) => {
      if (element) {
        const folderId = element.getAttribute('data-folder-id');
        console.log(`  ${name}:`, {
          found: true,
          className: element.className,
          folderId: folderId || '❌ MISSING',
          hasAttribute: element.hasAttribute('data-folder-id')
        });
      } else {
        console.log(`  ${name}: ❌ Not found`);
      }
    });

    // Try elementsFromPoint
    if (document.elementsFromPoint) {
      const stack = document.elementsFromPoint(x, y);
      console.log(`📚 Elements stack (${stack.length} elements):`);
      stack.slice(0, 10).forEach((el, i) => {
        const folderId = el.getAttribute('data-folder-id');
        console.log(`  ${i}: ${el.tagName}.${el.className}`, folderId ? `[folder-id: ${folderId}]` : '');
      });
    }

    return {
      elementAtPoint: atPoint,
      strategies: strategies.map(s => ({ name: s.name, found: !!s.element }))
    };
  }
};

// Expose logger and utilities to global scope for easy access from console
(window as any).FavaultLogger = Logger;
(window as any).LogQuery = LogQueryUtils;
(window as any).DragDropLogger = DragDropLogger;
(window as any).DnDDiagnostics = DnDDiagnostics;
(window as any).serviceWorkerManager = serviceWorkerManager;
console.log('📝 Logger available globally as: FavaultLogger');
console.log('   - FavaultLogger.getStatus() - Check logger status');
console.log('   - FavaultLogger.retrieveLogs() - Get all logs');
console.log('   - FavaultLogger.downloadLogs() - Download logs as JSON');
console.log('   - FavaultLogger.setLogLevel("DEBUG"|"INFO"|"WARN"|"ERROR") - Change log level');
console.log('   - FavaultLogger.setContext("drag-drop"|"bookmark"|"folder"|null) - Set logging context');
console.log('');
console.log('🔍 Log query utilities available as: LogQuery');
console.log('   - await LogQuery.searchLogs("drag") - Search logs');
console.log('   - await LogQuery.filterByLevel("ERROR") - Filter by level');
console.log('   - await LogQuery.getRecentLogs(5) - Get logs from last 5 minutes');
console.log('   - LogQuery.displayLogs(logs) - Pretty print logs');
console.log('   - await LogQuery.getLogStats() - Get log statistics');
console.log('');
console.log('🎯 Drag & Drop Logger available as: DragDropLogger');
console.log('   - await DragDropLogger.getDragDropLogs() - Get all drag-drop logs');
console.log('   - await DragDropLogger.exportDragDropLogs() - Export drag-drop logs to file');
console.log('   - await DragDropLogger.getDragDropStats() - Get drag-drop statistics');
console.log('   - DragDropLogger.getActiveDragSession() - Get current drag session info');
console.log('');
console.log('🔧 Service Worker Manager available as: serviceWorkerManager');
console.log('   - serviceWorkerManager.getStatus() - Check service worker status');
console.log('   - serviceWorkerManager.stopMonitoring() - Stop monitoring (emergency fix)');
console.log('');
console.log('🔍 Drag-Drop Diagnostics available as: DnDDiagnostics');
console.log('   - DnDDiagnostics.checkFolderAttributes() - Check all folder data-folder-id attributes');
console.log('   - DnDDiagnostics.testDropDetection(x, y) - Test drop target detection at coordinates');
console.log('   - serviceWorkerManager.restartMonitoring(300000) - Restart with 5min interval');

// Expose debug function immediately
(window as any).debugGlobalScope = () => {
  console.log('🔍 Debugging Global Scope for Enhanced Drag-Drop...');

  const checkObjects = [
    'EnhancedDragDropManager',
    'initEnhancedDragDrop',
    'enableEnhancedEditMode',
    'disableEnhancedEditMode'
  ];

  console.log('📊 Checking Global Objects:');
  checkObjects.forEach(objName => {
    const obj = (window as any)[objName];
    const type = typeof obj;
    const available = type !== 'undefined';

    console.log(`${available ? '✅' : '❌'} ${objName}: ${type}`);
  });

  const appElement = document.querySelector('.app');
  const folderContainers = document.querySelectorAll('.folder-container');

  console.log(`App element: ${appElement ? '✅ Found' : '❌ Not found'}`);
  console.log(`Folder containers: ${folderContainers.length} found`);
};

console.log('🔧 Debug function available: debugGlobalScope()');

export default app;
