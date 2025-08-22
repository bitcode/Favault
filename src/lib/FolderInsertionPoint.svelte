<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { EnhancedDragDropManager } from './dragdrop-enhanced';
  import { editMode } from './stores';

  export let insertionIndex: number;
  export let isFirst = false;
  export let isLast = false;

  let insertionElement: HTMLElement;
  let isEditMode = false;
  let isDragOver = false;
  let unsubscribeEditMode: () => void;
  let eventListeners: Array<{ event: string; handler: any }> = [];

  // Reactive statement to update drop zone when element is bound
  $: if (insertionElement) {
    updateDropZoneState();
  }

  // Subscribe to edit mode changes
  onMount(() => {
    unsubscribeEditMode = editMode.subscribe(value => {
      isEditMode = value;
      updateDropZoneState();
    });

    // Initial setup of drop zone state
    setTimeout(() => {
      updateDropZoneState();
    }, 100);
  });

  onDestroy(() => {
    if (unsubscribeEditMode) {
      unsubscribeEditMode();
    }
    cleanupEventListeners();
  });

  function addTrackedEventListener(event: string, handler: any) {
    if (insertionElement) {
      insertionElement.addEventListener(event, handler);
      eventListeners.push({ event, handler });
    }
  }

  function cleanupEventListeners() {
    if (insertionElement) {
      eventListeners.forEach(({ event, handler }) => {
        insertionElement.removeEventListener(event, handler);
      });
    }
    eventListeners = [];
  }

  function updateDropZoneState() {
    // Clean up existing listeners first
    cleanupEventListeners();

    if (!insertionElement) {
      return;
    }

    // Always set up drop zone listeners (not just in edit mode)
    // The enhanced drag-drop manager will handle edit mode checks
    addTrackedEventListener('dragover', handleDragOver);
    addTrackedEventListener('dragenter', handleDragEnter);
    addTrackedEventListener('dragleave', handleDragLeave);
    addTrackedEventListener('drop', handleDrop);

    // Mark element as a drop zone
    insertionElement.setAttribute('data-drop-zone', 'insertion-point');
    insertionElement.setAttribute('data-insertion-index', insertionIndex.toString());

    console.log(`📍 Insertion point ${insertionIndex} listeners set up (edit mode: ${isEditMode})`);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();

    // Always allow drops and set move effect
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }

    // Debug: Log available data types
    if (e.dataTransfer?.types) {
      console.log(`📍 Drag over insertion point ${insertionIndex}, available types:`, e.dataTransfer.types);
    }
  }

  function handleDragEnter(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();

    isDragOver = true;
    insertionElement.classList.add('drag-over-insertion');
    console.log(`📍 Drag enter insertion point ${insertionIndex}`);
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();

    // Only remove drag-over if we're actually leaving the element
    if (!insertionElement.contains(e.relatedTarget as Node)) {
      isDragOver = false;
      insertionElement.classList.remove('drag-over-insertion');
      console.log(`📍 Drag leave insertion point ${insertionIndex}`);
    }
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    isDragOver = false;
    insertionElement.classList.remove('drag-over-insertion');

    try {
      // Try to get drag data from multiple formats
      let dragDataStr = e.dataTransfer?.getData('application/x-favault-bookmark');
      if (!dragDataStr) {
        dragDataStr = e.dataTransfer?.getData('text/plain');
      }

      if (!dragDataStr) {
        console.log('❌ No drag data found in any format');
        console.log('Available types:', e.dataTransfer?.types);
        return;
      }

      console.log(`📍 Drop on insertion point ${insertionIndex}, data:`, dragDataStr);

      const dragData = JSON.parse(dragDataStr);
      if (dragData.type !== 'folder') {
        console.log('❌ Not a folder drag operation, type:', dragData.type);
        return;
      }

      console.log(`🎯 INSERTION POINT DROP: "${dragData.title}" at insertion point ${insertionIndex}`);
      console.log(`🎯 VISUAL EXPECTATION: Folder should be placed at position ${insertionIndex + 1}`);
      console.log(`🎯 CALLING: moveFolderToPosition(${dragData.index}, ${insertionIndex})`);

      // Use the enhanced drag-drop manager to handle the insertion
      const result = await EnhancedDragDropManager.moveFolderToPosition(dragData.index, insertionIndex);

      if (result.success) {
        console.log('✅ Folder reordered successfully');
        // Note: moveFolderToPosition already handles UI refresh and system state refresh
        // No additional refresh calls needed here to prevent conflicts
      } else {
        console.error('❌ Failed to reorder folder:', result.error);
      }
    } catch (error) {
      console.error('Error handling folder drop:', error);
    }
  }
</script>

{#if isEditMode}
  <div 
    class="insertion-point" 
    class:first={isFirst}
    class:last={isLast}
    class:drag-over={isDragOver}
    bind:this={insertionElement}
    data-insertion-index={insertionIndex}
  >
    <div class="insertion-line">
      <div class="insertion-indicator">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 5v14M5 12l7-7 7 7"/>
        </svg>
        <span>Drop folder here (Will be placed at position {insertionIndex + 1})</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .insertion-point {
    height: 8px;
    margin: 0.5rem 0;
    position: relative;
    transition: all 0.3s ease;
    opacity: 0.3;
  }

  .insertion-point.first {
    margin-top: 0;
  }

  .insertion-point.last {
    margin-bottom: 0;
  }

  /* Enhanced visibility during edit mode */
  :global(.app.edit-mode) .insertion-point {
    opacity: 0.6;
    height: 12px;
  }

  /* Hover state */
  .insertion-point:hover {
    height: 40px;
    opacity: 1;
    margin: 1rem 0;
  }

  /* Drag over state */
  .insertion-point.drag-over {
    height: 50px;
    opacity: 1;
    margin: 1.5rem 0;
    z-index: 100;
  }

  /* Global drag active state - all insertion points become visible */
  :global(.drag-active) .insertion-point {
    height: 35px;
    opacity: 0.8;
    margin: 1rem 0;
    /* Prevent layout shifts that could trigger auto-scroll */
    transform: translateZ(0);
    will-change: opacity, height;
  }

  /* Enhanced drag active state for edit mode */
  :global(.app.edit-mode.drag-active) .insertion-point {
    height: 45px;
    opacity: 0.9;
    margin: 1.2rem 0;
    /* Prevent layout shifts that could trigger auto-scroll */
    transform: translateZ(0);
    will-change: opacity, height;
  }

  /* Specific drag over state takes precedence */
  :global(.drag-active) .insertion-point.drag-over {
    height: 60px;
    opacity: 1;
    margin: 1.5rem 0;
    z-index: 200;
    /* Prevent layout shifts that could trigger auto-scroll */
    transform: translateZ(0);
    will-change: opacity, height;
  }

  .insertion-line {
    width: 100%;
    height: 100%;
    border: 2px dashed transparent;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    background: rgba(59, 130, 246, 0.05);
  }

  /* Enhanced line visibility in edit mode */
  :global(.app.edit-mode) .insertion-line {
    border-color: rgba(59, 130, 246, 0.3);
    background: rgba(59, 130, 246, 0.08);
  }

  /* Hover state styling */
  .insertion-point:hover .insertion-line {
    border-color: #3b82f6;
    background: rgba(59, 130, 246, 0.12);
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.2);
  }

  /* Drag active state styling */
  :global(.drag-active) .insertion-line {
    border-color: rgba(59, 130, 246, 0.6);
    background: rgba(59, 130, 246, 0.1);
    box-shadow: 0 0 15px rgba(59, 130, 246, 0.15);
  }

  /* Drag over state styling */
  .insertion-point.drag-over .insertion-line {
    border-color: #3b82f6;
    border-width: 3px;
    background: rgba(59, 130, 246, 0.2);
    box-shadow: 0 0 25px rgba(59, 130, 246, 0.3);
    animation: pulse-insertion 1.5s ease-in-out infinite;
  }

  .insertion-indicator {
    display: none;
    align-items: center;
    gap: 0.5rem;
    color: #3b82f6;
    font-size: 0.875rem;
    font-weight: 500;
    opacity: 0.9;
    white-space: nowrap;
  }

  /* Show indicators on hover */
  .insertion-point:hover .insertion-indicator {
    display: flex;
  }

  /* Show indicators during drag operations */
  :global(.drag-active) .insertion-indicator {
    display: flex;
    opacity: 0.7;
  }

  /* Enhanced indicators for drag over */
  .insertion-point.drag-over .insertion-indicator {
    display: flex;
    opacity: 1;
    font-weight: 600;
  }

  .insertion-indicator svg {
    width: 16px;
    height: 16px;
  }

  @keyframes pulse-insertion {
    0%, 100% {
      box-shadow: 0 0 25px rgba(59, 130, 246, 0.3);
      transform: scale(1);
    }
    50% {
      box-shadow: 0 0 35px rgba(59, 130, 246, 0.5);
      transform: scale(1.02);
    }
  }

  /* Enhanced visual feedback for active drag operations */
  :global(.app.edit-mode) .insertion-point.drag-over {
    height: 60px;
    margin: 1.5rem 0;
  }

  :global(.app.edit-mode) .insertion-point.drag-over .insertion-line {
    border-width: 3px;
    border-style: solid;
    background: rgba(59, 130, 246, 0.15);
    animation: pulse-insertion 1s ease-in-out infinite;
  }

  @keyframes pulse-insertion {
    0%, 100% {
      box-shadow: 0 0 20px rgba(59, 130, 246, 0.2);
    }
    50% {
      box-shadow: 0 0 30px rgba(59, 130, 246, 0.4);
    }
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .insertion-point:hover,
    .insertion-point.drag-over {
      height: 32px;
      margin: 0.75rem 0;
    }

    .insertion-indicator {
      font-size: 0.75rem;
    }

    .insertion-indicator svg {
      width: 14px;
      height: 14px;
    }
  }
</style>
