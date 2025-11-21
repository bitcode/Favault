<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { DragDropManager, type DragData, type DropZoneData } from './dragdrop';
  import { BraveDragDropManager } from './dragdrop-brave';
  import { editMode } from './stores';
  import { BookmarkEditAPI } from './api';
  import DragDropLogger from './logging/drag-drop-logger';

  export let parentId: string;
  export let insertIndex: number;
  export const folderTitle: string = ''; // For external reference only

  let insertionElement: HTMLElement;
  let isEditMode = false;
  let isActive = false;

  // Subscribe to edit mode changes
  const unsubscribeEditMode = editMode.subscribe(value => {
    isEditMode = value;
    setTimeout(() => {
      updateDropZoneState();
    }, 50);
  });

  // Update drop zone state based on edit mode
  function updateDropZoneState() {
    // PERFORMANCE FIX: Reduced logging to improve drag-drop performance
    console.log('🎯 Updating drop zone state for insertion point:', parentId, insertIndex, isEditMode);

    if (!insertionElement) {
      return;
    }

    // Clean up any existing drop zone functionality
    DragDropManager.cleanup(insertionElement);

    if (isEditMode) {
      initializeInsertionDropZone();
    }
  }

  // Initialize insertion point drop zone
  function initializeInsertionDropZone() {
    if (!insertionElement || !isEditMode) return;

    const DragManager = BraveDragDropManager.isBraveBrowser() ? BraveDragDropManager : DragDropManager;

    const dropZoneData: DropZoneData = {
      type: 'within-folder',
      targetId: `insertion-${parentId}-${insertIndex}`,
      parentId: parentId,
      targetIndex: insertIndex
    };

    DragManager.initializeDropZone(insertionElement, dropZoneData, {
      acceptTypes: ['bookmark'],
      onDragEnter: (dragData, dropZone) => {
        // PERFORMANCE FIX: Reduced logging during drag operations
        
        // Don't activate if dragging the same bookmark or adjacent bookmarks
        if (shouldIgnoreDrop(dragData, dropZone)) {
          return;
        }

        console.log('✅ Activating insertion point:', dragData.title, 'at index:', insertIndex);
        isActive = true;
        insertionElement.classList.add('insertion-point-active');
        showInsertionIndicator(dragData);
      },
      onDragLeave: (_dragData, _dropZone) => {
        // PERFORMANCE FIX: Reduced logging
        isActive = false;
        insertionElement.classList.remove('insertion-point-active');
        hideInsertionIndicator();
      },
      onDrop: async (dragData, dropZone) => {
        const isSameParent = dragData.parentId === dropZone.parentId;
 
        console.log('🎯 DROP EVENT at insertion point:', {
          bookmarkTitle: dragData.title,
          bookmarkId: dragData.id,
          currentIndex: dragData.index,
          currentParentId: dragData.parentId,
          targetIndex: dropZone.targetIndex,
          targetParentId: dropZone.parentId,
          isSameParent,
          insertionPointIndex: insertIndex
        });
 
        // Clean up visual indicators immediately to prevent race conditions
        isActive = false;
        if (insertionElement) {
          insertionElement.classList.remove('insertion-point-active');
        }
        hideInsertionIndicator();
 
        const targetIndex = dropZone.targetIndex;
 
        try {
          // Log the drop event through the structured drag-drop logger so that
          // standard/brave handler paths emit operation: "drop" with the
          // requested insertion index.
          try {
            await DragDropLogger.logDrop(dropZone, targetIndex);
          } catch (logErr) {
            console.warn('[InsertionPoint] Failed to log drop event', logErr);
          }
 
          // Perform the bookmark move operation
          const result = await BookmarkEditAPI.moveBookmark(dragData.id, {
            parentId: dropZone.parentId,
            index: targetIndex
          });
 
          if (result.success) {
            console.log('✅ MOVE SUCCESS at insertion point:', {
              bookmarkTitle: dragData.title,
              bookmarkId: dragData.id,
              from: { parentId: dragData.parentId, index: dragData.index },
              to: { parentId: dropZone.parentId, index: targetIndex },
              actualResult: result.bookmark,
              indexMatch: result.bookmark?.index === targetIndex
            });
 
            // CRITICAL FIX: Don't manually refresh here!
            // The Chrome bookmarks.onMoved event will trigger an automatic debounced refresh
            // Manual refresh here causes race conditions and incorrect positioning
            console.log('🔄 Skipping manual refresh - relying on automatic onMoved event refresh');
 
            showInsertionSuccess(dragData.title, insertIndex);
          } else {
            console.error('Failed to move bookmark to insertion point:', result.error);
            try {
              await DragDropLogger.logDropError(
                result.error || 'Failed to move bookmark via insertion point',
                dropZone
              );
            } catch (logErr) {
              console.warn('[InsertionPoint] Failed to log drop error', logErr);
            }
            showInsertionError(result.error || 'Failed to move bookmark');
          }
        } catch (error) {
          console.error('Error during insertion point drop:', error);
          try {
            await DragDropLogger.logDropError('Exception during insertion point drop', dropZone);
          } catch (logErr) {
            console.warn('[InsertionPoint] Failed to log drop exception', logErr);
          }
          showInsertionError('An error occurred while moving the bookmark');
        }
        
        return true; // Indicate we handled the drop
      }
    });
  }

  // Check if we should ignore this drop (same bookmark or adjacent)
  function shouldIgnoreDrop(dragData: DragData, dropZone: DropZoneData): boolean {
    // PERFORMANCE FIX: Reduced logging during frequent operations

    // If dragging from the same parent
    if (dragData.parentId === dropZone.parentId) {
      const dragIndex = dragData.index || 0;
      const targetIndex = dropZone.targetIndex || 0;

      // Only ignore if dropping at the exact same position
      if (dragIndex === targetIndex) {
        return true;
      }

      // FIXED: Don't ignore adjacent drops - they represent valid reordering
      // The previous logic was incorrectly preventing moves like position 2 -> 4
      // When Chrome removes an item and reinserts it, the indices shift naturally
      // We should allow all moves except dropping at the exact same position
    }

    return false;
  }

  // Visual feedback functions
  function showInsertionIndicator(dragData: DragData) {
    const indicator = document.createElement('div');
    indicator.className = 'bookmark-insertion-point-indicator';
    indicator.innerHTML = `
      <div class="insertion-line"></div>
      <div class="insertion-text">Insert "${dragData.title}" here</div>
    `;
    
    insertionElement.appendChild(indicator);
  }

  function hideInsertionIndicator() {
    const indicator = insertionElement?.querySelector('.bookmark-insertion-point-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  function showInsertionSuccess(bookmarkTitle: string, index: number) {
    const toast = document.createElement('div');
    toast.className = 'drag-drop-toast success';
    toast.innerHTML = `
      <div class="toast-icon">✅</div>
      <div class="toast-message">Inserted "${bookmarkTitle}" at position ${index + 1}</div>
    `;
    
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('slide-out');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  function showInsertionError(errorMessage: string) {
    const toast = document.createElement('div');
    toast.className = 'drag-drop-toast error';
    toast.innerHTML = `
      <div class="toast-icon">❌</div>
      <div class="toast-message">${errorMessage}</div>
    `;
    
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('slide-out');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 5000);
  }

  // REMOVED: Manual refresh function no longer needed
  // The Chrome bookmarks.onMoved event triggers automatic debounced refresh in App.svelte
  // This prevents race conditions and ensures consistent bookmark positioning

  // Setup on mount
  onMount(() => {
    console.log('🎯 BookmarkInsertionPoint mounted:', {
      parentId,
      insertIndex,
      isEditMode,
      insertionElement: !!insertionElement
    });

    // Add a small delay to ensure DOM is ready
    setTimeout(() => {
      updateDropZoneState();
    }, 100);
  });

  // Cleanup on destroy
  onDestroy(() => {
    unsubscribeEditMode();
    if (insertionElement) {
      DragDropManager.cleanup(insertionElement);
    }
  });
</script>

<div
  class="bookmark-insertion-point"
  class:active={isActive}
  class:edit-mode={isEditMode}
  bind:this={insertionElement}
  data-parent-id={parentId}
  data-insert-index={insertIndex}
>
  <!-- Always show for debugging -->
  <div class="insertion-line"></div>
  <div class="insertion-hint">Drop here (Index: {insertIndex})</div>
</div>

<style>
  .bookmark-insertion-point {
    /* Grid-compatible layout */
    grid-column: 1 / -1; /* Span full width of grid */
    height: 8px; /* Increased for better visibility */
    margin: 4px 0; /* Increased margin */
    position: relative;
    opacity: 0.3; /* Always slightly visible for debugging */
    transition: all 0.2s ease;
    z-index: 10; /* Ensure it's above other elements */

    /* Ensure it's visible for debugging */
    min-height: 8px;
    width: 100%;
    background: rgba(255, 0, 0, 0.1); /* Red tint for debugging */
    border: 1px solid rgba(255, 0, 0, 0.2); /* Red border for debugging */
  }

  .bookmark-insertion-point.edit-mode {
    opacity: 1; /* Fully visible in edit mode for debugging */
    background: rgba(59, 130, 246, 0.3); /* Blue background for debugging */
    border: 2px dashed rgba(59, 130, 246, 0.7); /* Strong blue border for debugging */
    height: 12px; /* Even larger in edit mode */
    margin: 6px 0;
  }

  .bookmark-insertion-point.active {
    opacity: 1;
    height: 12px; /* Larger for better visibility */
    margin: 6px 0;
    background: rgba(16, 185, 129, 0.1);
    border-radius: 4px;
  }

  .insertion-line {
    width: 100%;
    height: 2px;
    background: #3b82f6;
    border-radius: 2px;
    transition: all 0.2s ease;
    margin: 1px 0;
  }

  .bookmark-insertion-point.active .insertion-line {
    height: 6px;
    background: linear-gradient(90deg, #10b981, #34d399);
    box-shadow: 0 0 12px rgba(16, 185, 129, 0.6);
    animation: insertionPulse 1.5s ease-in-out infinite;
    border-radius: 3px;
  }

  .insertion-hint {
    position: absolute;
    top: -25px;
    left: 50%;
    transform: translateX(-50%);
    background: #3b82f6;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
    opacity: 1; /* Always visible for debugging */
    transition: opacity 0.2s ease;
    pointer-events: none;
    z-index: 20;
  }

  .bookmark-insertion-point.active .insertion-hint {
    opacity: 1;
    background: #10b981;
  }

  /* Global styles for insertion point indicators */
  :global(.bookmark-insertion-point-indicator) {
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    transform: translateY(-50%);
    pointer-events: none;
    z-index: 1001;
  }

  :global(.bookmark-insertion-point-indicator .insertion-line) {
    height: 3px;
    background: #10b981;
    border-radius: 2px;
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
    animation: insertionPulse 1s ease-in-out infinite;
  }

  :global(.bookmark-insertion-point-indicator .insertion-text) {
    position: absolute;
    top: -25px;
    left: 50%;
    transform: translateX(-50%);
    background: #10b981;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
  }

  @keyframes insertionPulse {
    0%, 100% {
      opacity: 0.8;
      transform: scaleY(1);
    }
    50% {
      opacity: 1;
      transform: scaleY(1.2);
    }
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .insertion-hint {
      font-size: 9px;
      padding: 1px 4px;
    }
    
    :global(.bookmark-insertion-point-indicator .insertion-text) {
      font-size: 11px;
      padding: 3px 6px;
    }
  }
</style>
