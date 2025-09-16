// Ensure global drag-drop fallback handlers are registered AS EARLY AS POSSIBLE
import './lib/global-dragdrop-init';
import { BookmarkEditAPI } from './lib/api';
import { BookmarkManager } from './lib/bookmarks';
import App from './App.svelte';

// Module-scope, early installation to guarantee presence before tests interact
(() => {
  if (typeof document === 'undefined') return;
  if ((window as any).__fav_globalDnDBridgeInstalled) return;
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
          try { document.dispatchEvent(new CustomEvent('favault-bookmark-moved', { detail: { type: 'inter-folder', fromId, fromParentId, toParentId, toIndex } })); } catch {}
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

    document.addEventListener('mousedown', onDocMouseDown, true);
    document.addEventListener('pointerdown', onDocMouseDown as any, true);
    document.addEventListener('mouseup', onDocMouseUp, true);
    document.addEventListener('pointerup', onDocMouseUp as any, true);

    console.log('[Global DnD] Bridge installed (early) with 4 listeners');
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

// Expose debug function immediately
(window as any).debugGlobalScope = () => {
  console.log('🔍 Debugging Global Scope for Enhanced Drag-Drop...');

  const checkObjects = [
    'EnhancedDragDropManager',
    'EnhancedDragDropTester',
    'testEnhancedDragDrop',
    'quickTestDragDrop',
    'showDragDropDiagnostics',
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
