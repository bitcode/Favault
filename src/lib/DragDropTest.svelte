<script lang="ts">
  import { onMount } from 'svelte';
  import { DragDropManager, type DragData, type DropZoneData } from './dragdrop';
  import { BraveDragDropManager } from './dragdrop-brave';
  import { editMode } from './stores';
  
  let testElement: HTMLElement;
  let dropZone: HTMLElement;
  let isEditMode = false;
  
  // Subscribe to edit mode
  const unsubscribe = editMode.subscribe(value => {
    isEditMode = value;
    updateDragDrop();
  });
  
  function updateDragDrop() {
    if (!testElement || !dropZone) return;
    
    // Clean up first
    DragDropManager.cleanup(testElement);
    DragDropManager.cleanup(dropZone);
    
    if (isEditMode) {
      console.log('Setting up test drag-drop');

      // Use Brave-specific manager if in Brave browser
      const DragManager = BraveDragDropManager.isBraveBrowser() ? BraveDragDropManager : DragDropManager;
      console.log('Using drag manager:', DragManager === BraveDragDropManager ? 'Brave' : 'Standard');

      // Make test element draggable
      const dragData: DragData = {
        type: 'bookmark',
        id: 'test-1',
        title: 'Test Bookmark',
        url: 'https://example.com'
      };

      DragManager.initializeDraggable(testElement, dragData, {
        onDragStart: (data) => {
          console.log('Test drag started:', data.title);
        },
        onDragEnd: (data) => {
          console.log('Test drag ended:', data.title);
        }
      });

      // Make drop zone
      const dropZoneData: DropZoneData = {
        type: 'folder',
        targetId: 'test-folder'
      };

      DragManager.initializeDropZone(dropZone, dropZoneData, {
        onDrop: async (dragData, dropZone) => {
          console.log('Test drop successful:', dragData.title);
          return true;
        }
      });

      DragManager.enableEditMode();
    }
  }
  
  onMount(() => {
    updateDragDrop();
    
    return () => {
      unsubscribe();
      if (testElement) DragDropManager.cleanup(testElement);
      if (dropZone) DragDropManager.cleanup(dropZone);
    };
  });
</script>

{#if isEditMode}
  <div class="test-container">
    <h3>Drag-Drop Test</h3>
    <div 
      class="test-draggable" 
      bind:this={testElement}
    >
      📖 Drag me!
    </div>
    
    <div 
      class="test-drop-zone" 
      bind:this={dropZone}
    >
      📁 Drop here!
    </div>
    
    <div class="debug-info">
      <p><strong>🦁 Brave Browser:</strong> {BraveDragDropManager.isBraveBrowser() ? 'YES' : 'NO'}</p>
      <p><strong>Edit Mode:</strong> {isEditMode}</p>
      <p><strong>Body Classes:</strong> {document?.body?.className || 'N/A'}</p>
      <p><strong>Test Element Draggable:</strong> {testElement?.draggable || 'N/A'}</p>
      <p><strong>User Agent:</strong> {navigator.userAgent.includes('Brave') ? 'Contains Brave' : 'Standard'}</p>
      <p><strong>Drag Manager:</strong> {BraveDragDropManager.isBraveBrowser() ? 'Brave-Specific' : 'Standard'}</p>

      <div class="debug-buttons">
        <button on:click={() => BraveDragDropManager.isBraveBrowser() && console.log('🦁 Brave detection:', BraveDragDropManager.isBraveBrowser())}>
          Test Detection
        </button>
        <button on:click={() => {
          if (typeof window !== 'undefined') {
            const testFn = (window as any).testBraveDrag;
            if (testFn) {
              testFn();
            } else {
              console.log('testBraveDrag not available');
            }
          }
        }}>
          Run Test
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .test-container {
    position: fixed;
    top: 100px;
    right: 20px;
    background: rgba(255, 255, 255, 0.9);
    border: 2px solid #3b82f6;
    border-radius: 8px;
    padding: 1rem;
    z-index: 1000;
    min-width: 200px;
  }
  
  .test-draggable {
    background: #3b82f6;
    color: white;
    padding: 1rem;
    border-radius: 4px;
    margin: 0.5rem 0;
    cursor: grab;
    user-select: none;
  }
  
  .test-draggable:active {
    cursor: grabbing;
  }
  
  .test-drop-zone {
    background: #10b981;
    color: white;
    padding: 1rem;
    border-radius: 4px;
    margin: 0.5rem 0;
    border: 2px dashed transparent;
    transition: all 0.2s ease;
  }
  
  .test-drop-zone.drag-over {
    border-color: #f59e0b;
    background: #059669;
  }
  
  .debug-info {
    font-size: 0.75rem;
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid #e5e7eb;
  }
  
  .debug-info p {
    margin: 0.25rem 0;
  }

  .debug-buttons {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .debug-buttons button {
    padding: 0.25rem 0.5rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.75rem;
  }

  .debug-buttons button:hover {
    background: #2563eb;
  }
  
  @media (prefers-color-scheme: dark) {
    .test-container {
      background: rgba(30, 30, 30, 0.9);
      color: white;
    }
  }
</style>
