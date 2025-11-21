// Global initialization for enhanced drag-drop system
// This ensures the testing functions are available immediately

import { EnhancedDragDropManager } from './dragdrop-enhanced';

import { BookmarkEditAPI } from './api';
import { BookmarkManager } from './bookmarks';
import { bookmarkFolders } from './stores';
import DragDropLogger from './logging/drag-drop-logger';
import Logger from './logging';


function logDragDropIntegrationStatus(): void {
  try {
    const pageUrl = typeof window !== 'undefined' && window.location ? window.location.href : '';
    const availableFunctions: string[] = [];
    const missingFunctions: string[] = [];

    const check = (name: string, present: boolean) => {
      if (present) {
        availableFunctions.push(name);
      } else {
        missingFunctions.push(name);
      }
    };

    check('EnhancedDragDropManager.initialize', !!EnhancedDragDropManager && typeof (EnhancedDragDropManager as any).initialize === 'function');
    check('BookmarkEditAPI.moveBookmark', !!BookmarkEditAPI && typeof (BookmarkEditAPI as any).moveBookmark === 'function');
    check('document.addEventListener', typeof document !== 'undefined' && typeof document.addEventListener === 'function');
    check('window.addEventListener', typeof window !== 'undefined' && typeof window.addEventListener === 'function');

    let integrationMode: 'full-control' | 'native-observe-only' | 'degraded' = 'degraded';
    const lowerUrl = pageUrl.toLowerCase();

    if (lowerUrl.startsWith('chrome://bookmarks') || lowerUrl.startsWith('brave://bookmarks') || lowerUrl.startsWith('edge://favorites')) {
      integrationMode = 'native-observe-only';
    } else if (
      availableFunctions.includes('EnhancedDragDropManager.initialize') &&
      availableFunctions.includes('BookmarkEditAPI.moveBookmark')
    ) {
      integrationMode = 'full-control';
    }

    Logger.info('🔌 Drag-drop integration status', 'drag-drop', {
      integrationMode,
      availableFunctions,
      missingFunctions,
      pageUrl,
    });
  } catch (err) {
    console.error('[Global DnD] Failed to log drag-drop integration status', err);
  }
}

// Helper to refresh bookmarks after a move
async function refreshBookmarksSafe() {
  try {
    const folders = await BookmarkManager.getOrganizedBookmarks();
    bookmarkFolders.set(folders);
  } catch (err) {
    console.error('Failed to refresh bookmarks (global fallback):', err);
  }
}

/**
 * Compute a bookmark insertion index within a folder based on the drop coordinates.
 * This is used by the global fallback handlers (mouseup + native drop) so that
 * they can behave similarly to the standard insertion-point-based system.
 *
 * The algorithm:
 * - Resolve the bookmarks container for the target folder.
 * - Collect all visible bookmark items in DOM order.
 * - Use the event's clientY to determine the closest bookmark:
 *   - If the cursor is in the top half of an item → insert before it.
 *   - If in the bottom half → insert after it.
 *   - If clearly below the last item → append to the end.
 */
function computeFallbackInsertionIndex(
  event: MouseEvent | DragEvent,
  destFolderId: string,
  containerHint?: HTMLElement | null
): number | undefined {
  try {
    if (!destFolderId) return undefined;

    const y = (event as MouseEvent).clientY ?? (event as DragEvent).clientY;
    if (typeof y !== 'number') return undefined;

    let container: HTMLElement | null =
      (document.querySelector(`.bookmarks-grid[data-folder-id="${destFolderId}"]`) as HTMLElement | null) || null;

    // Prefer an explicit container hint if provided (e.g. header, grid, or folder container)
    if (!container && containerHint) {
      const gridFromHint = containerHint.closest('.bookmarks-grid[data-folder-id]') as HTMLElement | null;
      if (gridFromHint) {
        container = gridFromHint;
      }
    }

    // Fallback: resolve via folder container
    if (!container) {
      const folderContainer = document.querySelector(
        `.folder-container[data-folder-id="${destFolderId}"], ` +
        `[data-testid="bookmark-folder"][data-folder-id="${destFolderId}"]`
      ) as HTMLElement | null;

      if (folderContainer) {
        container =
          (folderContainer.querySelector('.bookmarks-grid[data-folder-id]') as HTMLElement | null) ||
          (folderContainer.querySelector('.bookmarks-grid') as HTMLElement | null);
      }
    }

    if (!container) {
      console.warn('[DnD Fallback] Unable to locate bookmarks container for folder', destFolderId);
      return undefined;
    }

    const items = Array.from(
      container.querySelectorAll('.bookmark-item, [data-testid="bookmark-item"]')
    ) as HTMLElement[];

    if (items.length === 0) {
      // Empty folder → insert at beginning
      console.log('[DnD Fallback] Computed insertion index for empty folder:', {
        destFolderId,
        targetIndex: 0
      });
      return 0;
    }

    let targetIndex = items.length;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const rect = item.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;

      // If cursor is clearly above this item, insert before it
      if (y < rect.top) {
        targetIndex = i;
        break;
      }

      // If cursor is within this item's vertical bounds, decide before/after
      if (y >= rect.top && y <= rect.bottom) {
        targetIndex = y < midY ? i : i + 1;
        break;
      }
    }

    if (targetIndex < 0) targetIndex = 0;
    if (targetIndex > items.length) targetIndex = items.length;

    console.log('[DnD Fallback] Computed insertion index', {
      destFolderId,
      mouseY: y,
      itemCount: items.length,
      targetIndex
    });

    return targetIndex;
  } catch (err) {
    console.error('[DnD Fallback] Error computing insertion index', err);
    return undefined;
  }
}

// Re-enable global drag-drop system with enhanced logging for debugging
if (typeof document !== 'undefined') {
  // Log integration status once when the module initializes
  logDragDropIntegrationStatus();

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

      // Try multiple selector strategies to find folder container
      // Strategy 1: Look for elements with both testid/class AND data-folder-id
      container = (atPoint?.closest('[data-testid="bookmark-folder"][data-folder-id], .folder-header[data-folder-id], .bookmarks-grid[data-folder-id], .folder-container[data-folder-id]') as HTMLElement | null) || null;

      // Strategy 2: If not found, look for folder container first, then check for data-folder-id
      if (!container) {
        const folderContainer = atPoint?.closest('.folder-container, [data-testid="bookmark-folder"]') as HTMLElement | null;
        if (folderContainer && folderContainer.hasAttribute('data-folder-id')) {
          container = folderContainer;
        }
      }

      // Strategy 3: Try elementsFromPoint for overlapping elements
      if (!container && document.elementsFromPoint) {
        const stack = document.elementsFromPoint(x, y) as HTMLElement[];
        for (const el of stack) {
          const candidate = el.closest('[data-testid="bookmark-folder"][data-folder-id], .folder-header[data-folder-id], .bookmarks-grid[data-folder-id], .folder-container[data-folder-id]') as HTMLElement | null;
          if (candidate) { container = candidate; break; }

          // Also try the two-step approach
          const folderCandidate = el.closest('.folder-container, [data-testid="bookmark-folder"]') as HTMLElement | null;
          if (folderCandidate && folderCandidate.hasAttribute('data-folder-id')) {
            container = folderCandidate;
            break;
          }
        }
      }

      if (container) {
        const folderId = container.getAttribute('data-folder-id');
        if (folderId) {
          (window as any).__fav_lastHoveredFolderId = folderId;
          console.log('[DnD Hover] Tracking folder:', folderId, container.className);
        }
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
        let dropEl: HTMLElement | null = null;

        // Multi-strategy approach to find drop target
        // Strategy 1: Try closest() on event target with combined selector
        dropEl = (t?.closest('[data-testid="bookmark-folder"][data-folder-id], .folder-header[data-folder-id], .bookmarks-grid[data-folder-id], .folder-container[data-folder-id]') as HTMLElement | null);

        // Strategy 2: Try two-step approach on event target
        if (!dropEl) {
          const folderContainer = t?.closest('.folder-container, [data-testid="bookmark-folder"], .folder-header, .bookmarks-grid') as HTMLElement | null;
          if (folderContainer && folderContainer.hasAttribute('data-folder-id')) {
            dropEl = folderContainer;
          }
        }

        // Strategy 3: Try elementFromPoint
        if (!dropEl) {
          const atPoint = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
          dropEl = (atPoint?.closest('[data-testid="bookmark-folder"][data-folder-id], .folder-header[data-folder-id], .bookmarks-grid[data-folder-id], .folder-container[data-folder-id]') as HTMLElement | null) || null;

          // Strategy 4: Two-step on elementFromPoint
          if (!dropEl) {
            const folderContainer = atPoint?.closest('.folder-container, [data-testid="bookmark-folder"], .folder-header, .bookmarks-grid') as HTMLElement | null;
            if (folderContainer && folderContainer.hasAttribute('data-folder-id')) {
              dropEl = folderContainer;
            }
          }
        }

        // Strategy 5: Try elementsFromPoint for overlapping elements
        if (!dropEl && document.elementsFromPoint) {
          const stack = document.elementsFromPoint(e.clientX, e.clientY) as HTMLElement[];
          for (const el of stack) {
            const candidate = el.closest('[data-testid="bookmark-folder"][data-folder-id], .folder-header[data-folder-id], .bookmarks-grid[data-folder-id], .folder-container[data-folder-id]') as HTMLElement | null;
            if (candidate) {
              dropEl = candidate;
              break;
            }

            // Also try two-step approach
            const folderCandidate = el.closest('.folder-container, [data-testid="bookmark-folder"], .folder-header, .bookmarks-grid') as HTMLElement | null;
            if (folderCandidate && folderCandidate.hasAttribute('data-folder-id')) {
              dropEl = folderCandidate;
              break;
            }
          }
        }

        let destFolderId = dropEl?.getAttribute('data-folder-id') || undefined;

        // Enhanced diagnostic logging
        console.log('[DnD Fallback] Drop target analysis:', {
          dropElement: dropEl?.className || 'none',
          dropElementTag: dropEl?.tagName || 'none',
          dataFolderId: dropEl?.getAttribute('data-folder-id') || 'empty',
          hasDataFolderId: dropEl?.hasAttribute('data-folder-id') || false,
          destFolderId: destFolderId || 'EMPTY',
          lastHoveredFolderId: (window as any).__fav_lastHoveredFolderId || 'none',
          mousePosition: { x: e.clientX, y: e.clientY },
          elementAtPoint: document.elementFromPoint(e.clientX, e.clientY)?.className || 'none'
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
          let index: number | undefined;
 
          if (isHeader) {
            index = 0;
          } else {
            index = computeFallbackInsertionIndex(e, destFolderId, dropEl);
          }
 
          if (index === undefined) {
            console.warn('[DnD Fallback] Unable to compute insertion index from mouseup - falling back to append/end', {
              destFolderId,
              dropElementClass: dropEl?.className || 'none',
            });
          }
 
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
          console.log('computedIndex:', index);
 
          console.log('[Global DnD] mouseup detected drop', {
            fromId: gc.id,
            fromParentId: gc.parentId,
            toParentId: destFolderId,
            index
          });
 
          // Structured drag-drop logging for global fallback path
          const fallbackDragData = {
            type: 'bookmark',
            id: gc.id,
            title: gc.title || 'Unknown',
            parentId: gc.parentId,
          };
          const fallbackDropZone = {
            type: 'folder',
            targetId: destFolderId,
            parentId: destFolderId,
            targetIndex: index,
          };
 
          const dragId = DragDropLogger.startDragSession(fallbackDragData, 'fallback');
          console.log('[Global DnD] Fallback drag session started', {
            dragId,
            ...fallbackDragData,
            destFolderId,
            index
          });
          DragDropLogger.logDragEnter(fallbackDropZone);
          await DragDropLogger.logDrop(fallbackDropZone, index);
 
          const result = await BookmarkEditAPI.moveBookmark(gc.id, { parentId: destFolderId, index });
          if (result.success) {
            console.log('[Global DnD] moveBookmark success', { id: gc.id, destFolderId, index });
            try {
              // CRITICAL FIX: Add null checking for dispatchEvent to prevent null reference errors
              if (document && typeof document.dispatchEvent === 'function') {
                document.dispatchEvent(
                  new CustomEvent('favault-bookmark-moved', {
                    detail: {
                      type: 'inter-folder',
                      id: gc.id,
                      fromParentId: gc.parentId,
                      toParentId: destFolderId,
                      index,
                    },
                  }),
                );
              }
            } catch (err) {
              console.error('[DnD Global] dispatchEvent error:', err);
            }
            BookmarkManager.clearCache();
            await refreshBookmarksSafe();
            DragDropLogger.endDragSession(false);
          } else {
            console.error('[Global DnD] moveBookmark failed', result.error);
            await DragDropLogger.logDropError(result.error || 'Global fallback moveBookmark failed', fallbackDropZone);
            DragDropLogger.endDragSession(false);
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
       const container = (t?.closest(
         '[data-testid="bookmark-folder"][data-folder-id], .folder-header[data-folder-id], .bookmarks-grid[data-folder-id], .folder-container[data-folder-id]'
       ) as HTMLElement | null);
       if (!container) return;
       const gc = (window as any).__fav_dragCandidate;
       const toParentId = container.getAttribute('data-folder-id') || undefined;
       if (!gc?.id || !toParentId || gc.parentId === toParentId) return;

       const isHeader = !!container.classList.contains('folder-header');
       let index: number | undefined;

       if (isHeader) {
         index = 0;
       } else {
         index = computeFallbackInsertionIndex(e, toParentId, container);
       }

       if (index === undefined) {
         console.warn('[DnD Fallback] Unable to compute insertion index from native drop - falling back to append/end', {
           toParentId,
           containerClass: container.className || 'none',
         });
       }

       try {
         const body = document.body;
         if (body) {
           const n = parseInt(body.getAttribute('data-dnd-events') || '0', 10) + 1;
           body.setAttribute('data-dnd-events', String(n));
           body.removeAttribute('data-dnd-candidate');
         }
       } catch {}
       console.log('[Global DnD] drop detected', {
         fromId: gc.id,
         fromParentId: gc.parentId,
         toParentId,
         index
       });

       // Structured drag-drop logging for global fallback (native drop) path
       const fallbackDragData = {
         type: 'bookmark',
         id: gc.id,
         title: gc.title || 'Unknown',
         parentId: gc.parentId,
       };
       const fallbackDropZone = {
         type: 'folder',
         targetId: toParentId,
         parentId: toParentId,
         targetIndex: index,
       };

       const dragId = DragDropLogger.startDragSession(fallbackDragData, 'fallback');
       console.log('[Global DnD] Fallback drag session started (drop)', {
         dragId,
         ...fallbackDragData,
         toParentId,
         index
       });
       DragDropLogger.logDragEnter(fallbackDropZone);
       await DragDropLogger.logDrop(fallbackDropZone, index);

       const result = await BookmarkEditAPI.moveBookmark(gc.id, { parentId: toParentId, index });
       if (result.success) {
         console.log('[Global DnD] moveBookmark success (drop)', { id: gc.id, toParentId, index });
         try {
           // CRITICAL FIX: Add null checking for dispatchEvent to prevent null reference errors
           if (document && typeof document.dispatchEvent === 'function') {
             document.dispatchEvent(
               new CustomEvent('favault-bookmark-moved', {
                 detail: {
                   type: 'inter-folder',
                   id: gc.id,
                   fromParentId: gc.parentId,
                   toParentId,
                   index,
                 },
               }),
             );
           }
         } catch (err) {
           console.error('[DnD Global] dispatchEvent error:', err);
         }
         BookmarkManager.clearCache();
         await refreshBookmarksSafe();
         DragDropLogger.endDragSession(false);
       } else {
         console.error('[Global DnD] moveBookmark failed (drop)', result.error);
         await DragDropLogger.logDropError(
           result.error || 'Global fallback moveBookmark failed (drop)',
           fallbackDropZone
         );
         DragDropLogger.endDragSession(false);
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
     } catch (error: any) {
       console.error('❌ Manual initialization error:', error);
       const message = error && typeof error === 'object' && 'message' in error
         ? (error as any).message
         : String(error);
       return { success: false, error: message };
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

  console.log('✅ Enhanced drag-drop functions exposed to global scope:');
  console.log('  - initEnhancedDragDrop() - Manual initialization');
  console.log('  - enableEnhancedEditMode() - Enable edit mode');
  console.log('  - disableEnhancedEditMode() - Disable edit mode');
  console.log('  - setDragDropDebugLogging(enabled) - Control debug logging');
  console.log('  - getDragDropDebugLogging() - Get debug logging state');
  console.log('');
  console.log('🦁 Enhanced Drag-Drop Classes Available:');
  console.log('  - EnhancedDragDropManager - Main manager class');
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

export { EnhancedDragDropManager };
