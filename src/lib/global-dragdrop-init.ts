// Global initialization for enhanced drag-drop system
// This ensures the testing functions are available immediately

import { EnhancedDragDropManager } from './dragdrop-enhanced';
import { EnhancedDragDropTester } from './test-enhanced-dragdrop';

import { BookmarkEditAPI } from './api';
import { BookmarkManager } from './bookmarks';
import { bookmarkFolders } from './stores';

// Helper to refresh bookmarks after a move
async function refreshBookmarksSafe() {
  try {
    const folders = await BookmarkManager.getOrganizedBookmarks();
    bookmarkFolders.set(folders);
  } catch (err) {
    console.error('Failed to refresh bookmarks (global fallback):', err);
  }
}

// Re-enable global drag-drop system with enhanced logging for debugging
if (typeof document !== 'undefined') {
  // Skip if primary bridge already installed
  if ((window as any).__fav_globalDnDBridgeInstalled) {
    console.log('[Global DnD] Primary bridge already installed; skipping global fallback');
  } else if (!(window as any).__fav_globalMouseBridgeInstalled) {
    console.log('[Global DnD] Installing document-level mouse bridge (module-scope)');
    try {
      const body = document.body;
      if (body) {
        body.setAttribute('data-dnd-bridge', 'installed');
        if (!body.getAttribute('data-dnd-events')) body.setAttribute('data-dnd-events', '0');
      }
    } catch {}

    // Track last hovered folder while mouse is down
    let isMouseDown = false;
    const updateLastHoveredFolder = (evt: MouseEvent) => {
      // Prefer geometry-based detection to avoid overlays/pointer-events traps
      const x = evt.clientX, y = evt.clientY;
      let container: HTMLElement | null = null;
      const atPoint = document.elementFromPoint(x, y) as HTMLElement | null;
      container = (atPoint?.closest('[data-testid="bookmark-folder"][data-folder-id], .folder-header[data-folder-id], .bookmarks-grid[data-folder-id], .folder-container[data-folder-id]') as HTMLElement | null) || null;
      if (!container && document.elementsFromPoint) {
        const stack = document.elementsFromPoint(x, y) as HTMLElement[];
        for (const el of stack) {
          const candidate = el.closest('[data-testid="bookmark-folder"][data-folder-id], .folder-header[data-folder-id], .bookmarks-grid[data-folder-id], .folder-container[data-folder-id]') as HTMLElement | null;
          if (candidate) { container = candidate; break; }
        }
      }
      if (container) {
        (window as any).__fav_lastHoveredFolderId = container.getAttribute('data-folder-id');
      }
    };

    // Mouseup handler: determine drop target and perform move
    const onDocMouseUp = async (e: MouseEvent) => {
      try {
        let gc = (window as any).__fav_dragCandidate;

        // If no recorded candidate, try to infer from DOM (dragging class)
        if (!gc) {
          const draggingEl = document.querySelector('.bookmark-item.dragging, .bookmark-item[data-dragging="true"]') as HTMLElement | null;
          if (draggingEl) {
            gc = {
              id: draggingEl.getAttribute('data-bookmark-id') || draggingEl.getAttribute('data-id'),
              parentId: (draggingEl.closest('[data-folder-id]') as HTMLElement | null)?.getAttribute('data-folder-id') || undefined,
              title: draggingEl.getAttribute('data-title') || ''
            };
            console.log('[Global DnD] Inferred drag candidate from DOM:', gc);
          }
        }

        // If still no candidate, try geometry at stored mousedown position
        if (!gc) {
          const pos = (window as any).__fav_lastMouseDown as { x: number; y: number } | undefined;
          if (pos) {
            const candidates = Array.from(document.querySelectorAll('.bookmark-item, [data-testid="bookmark-item"]')) as HTMLElement[];
            const item = candidates.find(el => {
              const r = el.getBoundingClientRect();
              return pos.x >= r.left && pos.x <= r.right && pos.y >= r.top && pos.y <= r.bottom;
            }) || null;
            if (item) {
              gc = {
                id: item.getAttribute('data-bookmark-id') || item.getAttribute('data-id'),
                parentId: (item.closest('[data-folder-id]') as HTMLElement | null)?.getAttribute('data-folder-id') || undefined,
                title: item.getAttribute('data-title') || item.querySelector('.bookmark-title')?.textContent?.trim() || ''
              };
              console.log('[Global DnD] Candidate resolved on mouseup from stored position:', gc);
            }
          }
        }

        if (!gc || !gc.id) return;

        const t = e.target as HTMLElement | null;
        // Prefer closest() chain first, then elementFromPoint fallback
        let dropEl = (t?.closest('[data-testid="bookmark-folder"][data-folder-id], .folder-header[data-folder-id], .bookmarks-grid[data-folder-id], .folder-container[data-folder-id]') as HTMLElement | null);
        if (!dropEl) {
          const atPoint = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
          dropEl = (atPoint?.closest('[data-testid="bookmark-folder"][data-folder-id], .folder-header[data-folder-id], .bookmarks-grid[data-folder-id], .folder-container[data-folder-id]') as HTMLElement | null) || null;
          if (!dropEl && document.elementsFromPoint) {
            const stack = document.elementsFromPoint(e.clientX, e.clientY) as HTMLElement[];
            for (const el of stack) {
              const candidate = el.closest('[data-testid="bookmark-folder"][data-folder-id], .folder-header[data-folder-id], .bookmarks-grid[data-folder-id], .folder-container[data-folder-id]') as HTMLElement | null;
              if (candidate) { dropEl = candidate; break; }
            }
          }
        }
        let destFolderId = dropEl?.getAttribute('data-folder-id') || undefined;
        console.log('[DnD Fallback] Drop target analysis:', {
          dropElement: dropEl?.className || 'none',
          dataFolderId: dropEl?.getAttribute('data-folder-id') || 'empty',
          destFolderId: destFolderId || 'EMPTY', // This is the critical issue
          lastHoveredFolderId: (window as any).__fav_lastHoveredFolderId || 'none'
        });
        
        if (!destFolderId) {
          destFolderId = (window as any).__fav_lastHoveredFolderId;
          if (destFolderId) {
            console.log('[DnD Fallback] Using last hovered folder as drop target:', destFolderId);
          } else {
            console.error('[DnD Fallback] CRITICAL: destFolderId is empty - no drop target found!');
          }
        }
        if (destFolderId && destFolderId !== gc.parentId) {
          const isHeader = !!dropEl?.classList.contains('folder-header');
          const index = isHeader ? 0 : undefined;
          try {
            const body = document.body;
            if (body) {
              const n = parseInt(body.getAttribute('data-dnd-events') || '0', 10) + 1;
              body.setAttribute('data-dnd-events', String(n));
              body.removeAttribute('data-dnd-candidate');
            }
          } catch {}
          console.log('[DnD Fallback] mouseup at Object');
          console.log('bookmarkId:', gc.id || '');
          console.log('bookmarkTitle:', gc.title || 'Unknown');
          console.log('currentParent:', gc.parentId || '');
          console.log('destFolderId:', destFolderId || ''); // This matches the user's console log format
          console.log('dropHandled:', true);
          console.log('overContainer:', !!dropEl);
          console.log('overHeader:', !!dropEl?.classList.contains('folder-header'));
          
          console.log('[Global DnD] mouseup detected drop', { fromId: gc.id, fromParentId: gc.parentId, toParentId: destFolderId, index });
          const result = await BookmarkEditAPI.moveBookmark(gc.id, { parentId: destFolderId, index });
          if (result.success) {
            console.log('[Global DnD] moveBookmark success', { id: gc.id, destFolderId, index });
            try {
              // CRITICAL FIX: Add null checking for dispatchEvent to prevent null reference errors
              if (document && typeof document.dispatchEvent === 'function') {
                document.dispatchEvent(new CustomEvent('favault-bookmark-moved', { detail: { type: 'inter-folder', id: gc.id, fromParentId: gc.parentId, toParentId: destFolderId, index } }));
              }
            } catch (err) {
              console.error('[DnD Global] dispatchEvent error:', err);
            }
            BookmarkManager.clearCache();
            await refreshBookmarksSafe();
          } else {
            console.error('[Global DnD] moveBookmark failed', result.error);
          }
        } else {
          console.log('[Global DnD] No valid drop target detected or same folder');
        }
      } catch (err) {
        console.error('[Global DnD] Fallback error:', err);
      } finally {
        isMouseDown = false;
        try {
          const dragged = (window as any).__fav_draggedEl as HTMLElement | null;
          if (dragged) {
            dragged.classList.remove('dragging');
            dragged.removeAttribute('data-dragging');
          }
        } catch {}
        (window as any).__fav_dragCandidate = null;
        (window as any).__fav_draggedEl = null;
        (window as any).__fav_lastHoveredFolderId = null;
        try { document.body?.removeAttribute('data-dnd-candidate'); } catch {}
      }
    };

    // Mousedown handler: capture source candidate early
    const onDocMouseDown = (e: MouseEvent) => {
      try {
        isMouseDown = true;
        (window as any).__fav_lastMouseDown = { x: e.clientX, y: e.clientY };
        const target = e.target as HTMLElement | null;
        let item = target?.closest('.bookmark-item, [data-testid="bookmark-item"]') as HTMLElement | null;

        // If pointer-events disabled prevented target from being inside the item, detect by geometry
        if (!item) {
          const x = e.clientX, y = e.clientY;
          const candidates = Array.from(document.querySelectorAll('.bookmark-item, [data-testid="bookmark-item"]')) as HTMLElement[];
          item = candidates.find(el => {
            const r = el.getBoundingClientRect();
            return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
          }) || null;
          if (item) {
            console.log('[Global DnD] Geometry-detected bookmark item under cursor');
          }
        }

        if (!item) {
          // Mark pending candidate resolution
          (window as any).__fav_pendingCandidate = true;
          return;
        }

        const id = item.getAttribute('data-bookmark-id') || item.getAttribute('data-id');
        if (!id) return;
        const parentId = (item.closest('[data-folder-id]') as HTMLElement | null)?.getAttribute('data-folder-id') || undefined;
        const title = item.getAttribute('data-title') || item.querySelector('.bookmark-title')?.textContent?.trim() || '';
        (window as any).__fav_dragCandidate = { id, parentId, title, startedAt: Date.now() };
        (window as any).__fav_draggedEl = item;
        item.classList.add('dragging');
        item.setAttribute('data-dragging', 'true');
        try {
          const body = document.body;
          if (body) {
            body.setAttribute('data-dnd-candidate', id!);
            const n = parseInt(body.getAttribute('data-dnd-events') || '0', 10) + 1;
            body.setAttribute('data-dnd-events', String(n));
          }
        } catch {}
        console.log('[Global DnD] Candidate marked on mousedown:', { id, parentId, title });
      } catch {}
    };

    const onDocMouseMove = (e: MouseEvent) => {
      if (!isMouseDown) return;
      updateLastHoveredFolder(e);
      // If we haven't resolved a candidate yet, try by last mousedown position
      const hasCandidate = !!(window as any).__fav_dragCandidate;
      const pending = !!(window as any).__fav_pendingCandidate;
      if (!hasCandidate && pending) {
        const pos = (window as any).__fav_lastMouseDown as { x: number; y: number } | undefined;
        if (pos) {
          const candidates = Array.from(document.querySelectorAll('.bookmark-item, [data-testid="bookmark-item"]')) as HTMLElement[];
          const item = candidates.find(el => {
            const r = el.getBoundingClientRect();
            return pos.x >= r.left && pos.x <= r.right && pos.y >= r.top && pos.y <= r.bottom;
          }) || null;
          if (item) {
            const id = item.getAttribute('data-bookmark-id') || item.getAttribute('data-id');
            if (id) {
              const parentId = (item.closest('[data-folder-id]') as HTMLElement | null)?.getAttribute('data-folder-id') || undefined;
              const title = item.getAttribute('data-title') || item.querySelector('.bookmark-title')?.textContent?.trim() || '';
              (window as any).__fav_dragCandidate = { id, parentId, title, startedAt: Date.now() };
              (window as any).__fav_draggedEl = item;
              item.classList.add('dragging');
              item.setAttribute('data-dragging', 'true');
              (window as any).__fav_pendingCandidate = false;
              console.log('[Global DnD] Candidate resolved on mousemove from stored position:', { id, parentId, title });
            }
          }
        }
      }
    };

    document.addEventListener('mousedown', onDocMouseDown, true);
    document.addEventListener('pointerdown', onDocMouseDown as any, true);
    document.addEventListener('mousemove', onDocMouseMove, true);
    document.addEventListener('pointermove', onDocMouseMove as any, true);
    document.addEventListener('mouseup', onDocMouseUp, true);
    document.addEventListener('pointerup', onDocMouseUp as any, true);
    // Also attach to window to be extra safe in MV3 contexts
    window.addEventListener('mouseup', onDocMouseUp, true);
    window.addEventListener('pointerup', onDocMouseUp as any, true);

    // Native HTML5 DnD hooks as an additional safety net
    document.addEventListener('dragstart', (e: DragEvent) => {
      const t = e.target as HTMLElement | null;
      const item = t?.closest('.bookmark-item, [data-testid="bookmark-item"]') as HTMLElement | null;
      if (!item) return;
      const id = item.getAttribute('data-bookmark-id') || item.getAttribute('data-id');
      const parentId = (item.closest('[data-folder-id]') as HTMLElement | null)?.getAttribute('data-folder-id') || undefined;
      (window as any).__fav_dragCandidate = { id, parentId, title: item.getAttribute('data-title') || '' };
      (window as any).__fav_draggedEl = item;
      item.classList.add('dragging');
      item.setAttribute('data-dragging', 'true');
      try {
        const body = document.body;
        if (body) {
          body.setAttribute('data-dnd-candidate', id!);
          const n = parseInt(body.getAttribute('data-dnd-events') || '0', 10) + 1;
          body.setAttribute('data-dnd-events', String(n));
        }
      } catch {}
      console.log('[Global DnD] dragstart captured candidate:', (window as any).__fav_dragCandidate);
    }, true);

    document.addEventListener('drop', async (e: DragEvent) => {
      try {
        const t = e.target as HTMLElement | null;
        const container = (t?.closest('[data-testid="bookmark-folder"][data-folder-id], .folder-header[data-folder-id], .bookmarks-grid[data-folder-id], .folder-container[data-folder-id]') as HTMLElement | null);
        if (!container) return;
        const gc = (window as any).__fav_dragCandidate;
        const toParentId = container.getAttribute('data-folder-id') || undefined;
        if (!gc?.id || !toParentId || gc.parentId === toParentId) return;
        const isHeader = !!container.classList.contains('folder-header');
        const index = isHeader ? 0 : undefined;
        try {
          const body = document.body;
          if (body) {
            const n = parseInt(body.getAttribute('data-dnd-events') || '0', 10) + 1;
            body.setAttribute('data-dnd-events', String(n));
            body.removeAttribute('data-dnd-candidate');
          }
        } catch {}
        console.log('[Global DnD] drop detected', { fromId: gc.id, fromParentId: gc.parentId, toParentId, index });
        const result = await BookmarkEditAPI.moveBookmark(gc.id, { parentId: toParentId, index });
        if (result.success) {
          console.log('[Global DnD] moveBookmark success (drop)', { id: gc.id, toParentId, index });
          try {
            // CRITICAL FIX: Add null checking for dispatchEvent to prevent null reference errors
            if (document && typeof document.dispatchEvent === 'function') {
              document.dispatchEvent(new CustomEvent('favault-bookmark-moved', { detail: { type: 'inter-folder', id: gc.id, fromParentId: gc.parentId, toParentId, index } }));
            }
          } catch (err) {
            console.error('[DnD Global] dispatchEvent error:', err);
          }
          BookmarkManager.clearCache();
          await refreshBookmarksSafe();
        }
      } catch (err) {
        console.error('[Global DnD] Drop handler error', err);
      } finally {
        (window as any).__fav_dragCandidate = null;
        const dragged = (window as any).__fav_draggedEl as HTMLElement | null;
        if (dragged) {
          dragged.classList.remove('dragging');
          dragged.removeAttribute('data-dragging');
        }
        (window as any).__fav_draggedEl = null;
      }
    }, true);

    console.log('[Global DnD] Bridge installed with 10+ event listeners (doc+win: mousedown/up/move + HTML5 DnD)');
    ;(window as any).__fav_globalMouseBridgeInstalled = true;
  }
}

// Immediately expose to global scope
if (typeof window !== 'undefined') {
  console.log('🦁 Exposing enhanced drag-drop to global scope...');

  // Expose main classes
  (window as any).EnhancedDragDropManager = EnhancedDragDropManager;
  (window as any).EnhancedDragDropTester = EnhancedDragDropTester;

  // Expose convenient testing functions
  (window as any).testEnhancedDragDrop = async () => {
    try {
      await EnhancedDragDropTester.testSystem();
    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  };

  (window as any).quickTestDragDrop = async () => {
    try {
      await EnhancedDragDropTester.quickTest();
    } catch (error) {
      console.error('❌ Quick test failed:', error);
    }
  };

  (window as any).showDragDropDiagnostics = () => {
    try {
      EnhancedDragDropTester.showDiagnostics();
    } catch (error) {
      console.error('❌ Diagnostics failed:', error);
    }
  };

  // Additional debugging functions
  (window as any).initEnhancedDragDrop = async () => {
    try {
      console.log('🦁 Manual initialization requested...');
      const result = await EnhancedDragDropManager.initialize();
      if (result.success) {
        console.log('✅ Manual initialization successful');
      } else {
        console.error('❌ Manual initialization failed:', result.error);
      }
      return result;
    } catch (error) {
      console.error('❌ Manual initialization error:', error);
      return { success: false, error: error.message };
    }
  };

  (window as any).enableEnhancedEditMode = async () => {
    try {
      await EnhancedDragDropManager.enableEditMode();
      console.log('✅ Enhanced edit mode enabled');
    } catch (error) {
      console.error('❌ Failed to enable enhanced edit mode:', error);
    }
  };

  (window as any).disableEnhancedEditMode = () => {
    try {
      EnhancedDragDropManager.disableEditMode();
      console.log('✅ Enhanced edit mode disabled');
    } catch (error) {
      console.error('❌ Failed to disable enhanced edit mode:', error);
    }
  };

  (window as any).setDragDropDebugLogging = (enabled: boolean) => {
    try {
      EnhancedDragDropManager.setDebugLogging(enabled);
    } catch (error) {
      console.error('❌ Failed to set debug logging:', error);
    }
  };

  (window as any).getDragDropDebugLogging = () => {
    try {
      return EnhancedDragDropManager.isDebugLoggingEnabled();
    } catch (error) {
      console.error('❌ Failed to get debug logging state:', error);
      return false;
    }
  };

  console.log('🧪 Enhanced Drag-Drop Testing Functions Available:');
  console.log('  - testEnhancedDragDrop() - Full system test');
  console.log('  - quickTestDragDrop() - Quick functionality test');
  console.log('  - showDragDropDiagnostics() - System diagnostics');
  console.log('  - initEnhancedDragDrop() - Manual initialization');
  console.log('  - enableEnhancedEditMode() - Enable edit mode');
  console.log('  - disableEnhancedEditMode() - Disable edit mode');
  console.log('  - setDragDropDebugLogging(enabled) - Control debug logging');
  console.log('  - getDragDropDebugLogging() - Get debug logging state');
  console.log('');
  console.log('🦁 Enhanced Drag-Drop Classes Available:');
  console.log('  - EnhancedDragDropManager - Main manager class');
  console.log('  - EnhancedDragDropTester - Testing utilities');
}

// Auto-initialize when DOM is ready (but only basic initialization, not edit mode)
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      console.log('🦁 DOM loaded, performing basic enhanced drag-drop initialization...');
      try {
        // Only do basic initialization - edit mode will handle folder setup
        setTimeout(async () => {
          const result = await EnhancedDragDropManager.initialize();
          if (result.success) {
            console.log('✅ Basic auto-initialization successful - edit mode will handle folder setup');
          } else {
            console.log('⚠️ Basic auto-initialization failed, manual init may be needed:', result.error);
          }
        }, 800); // Reduced delay to avoid conflicts
      } catch (error) {
        console.log('⚠️ Basic auto-initialization error, manual init may be needed:', error);
      }
    });
  } else {
    // DOM already loaded
    console.log('🦁 DOM already loaded, performing basic enhanced drag-drop initialization...');
    setTimeout(async () => {
      try {
        const result = await EnhancedDragDropManager.initialize();
        if (result.success) {
          console.log('✅ Basic delayed auto-initialization successful - edit mode will handle folder setup');
        } else {
          console.log('⚠️ Basic delayed auto-initialization failed, manual init may be needed:', result.error);
        }
      } catch (error) {
        console.log('⚠️ Basic delayed auto-initialization error, manual init may be needed:', error);
      }
    }, 1000); // Reduced delay to avoid conflicts
  }
}

export { EnhancedDragDropManager, EnhancedDragDropTester };
