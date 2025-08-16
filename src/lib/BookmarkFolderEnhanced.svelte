<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import BookmarkItem from './BookmarkItem.svelte';
  import type { BookmarkFolder } from './api';
  import { EnhancedDragDropManager } from './dragdrop-enhanced';
  import { editMode } from './stores';
  // import { BookmarkManager, bookmarkFolders } from './bookmarks'; // Commented out - may be needed for future features

  export let folder: BookmarkFolder;
  export let isVisible = true;

  let isExpanded = true;
  let folderElement: HTMLElement;
  let folderHeader: HTMLElement;
  let isEditMode = false;
  let isRenaming = false;
  let newFolderName = '';

  // Subscribe to edit mode changes
  const unsubscribeEditMode = editMode.subscribe(value => {
    isEditMode = value;
    console.log('Enhanced edit mode changed to:', value, 'for folder:', folder.title);
    
    // Update drag-drop state when edit mode changes
    setTimeout(() => {
      updateEnhancedDragDropState();
    }, 50);
  });

  // Reactive statement to update drag-drop when edit mode changes
  $: if (folderElement && typeof isEditMode !== 'undefined') {
    setTimeout(() => {
      updateEnhancedDragDropState();
    }, 50);
  }
  
  // Toggle folder expansion
  function toggleExpanded() {
    isExpanded = !isExpanded;
  }

  // Start inline renaming
  function startRenaming() {
    if (!isEditMode) return;
    isRenaming = true;
    newFolderName = folder.title;
  }

  // Cancel renaming
  function cancelRenaming() {
    isRenaming = false;
    newFolderName = '';
  }

  // Save folder name
  async function saveFolderName() {
    if (!newFolderName.trim()) {
      cancelRenaming();
      return;
    }

    try {
      // TODO: Implement folder renaming via BookmarkEditAPI
      // const result = await BookmarkEditAPI.updateBookmark(folder.id, { title: newFolderName.trim() });
      // if (result.success) {
      //   folder.title = newFolderName.trim();
      // }
      folder.title = newFolderName.trim(); // Temporary until API is connected
      isRenaming = false;
      newFolderName = '';
    } catch (error) {
      console.error('Failed to rename folder:', error);
      cancelRenaming();
    }
  }

  // Handle rename key events
  function handleRenameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveFolderName();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelRenaming();
    }
  }

  // Update enhanced drag and drop state with retry logic
  function updateEnhancedDragDropState() {
    if (!folderElement) {
      console.log('Folder element not available yet for:', folder.title, '- scheduling retry...');
      // Retry after a short delay to allow DOM to be ready
      setTimeout(() => {
        updateEnhancedDragDropState();
      }, 100);
      return;
    }

    if (isEditMode) {
      console.log('Enabling enhanced drag-drop for folder:', folder.title);

      // Initialize the enhanced system if not already done
      if (!EnhancedDragDropManager.isEditModeEnabled()) {
        EnhancedDragDropManager.enableEditMode().catch(error => {
          console.error('Failed to enable enhanced edit mode:', error);
        });
      }

      // Force folder setup after element is available
      setTimeout(() => {
        if (folderElement && EnhancedDragDropManager.isEditModeEnabled()) {
          console.log('🦁 Forcing folder setup for:', folder.title);
          EnhancedDragDropManager.setupFolderDragDrop();
        }
      }, 200);
    } else {
      console.log('Disabling enhanced drag-drop for folder:', folder.title);
      EnhancedDragDropManager.disableEditMode();
    }
  }

  // Refresh bookmarks after changes (currently unused but may be needed for future features)
  // async function refreshBookmarks() {
  //   try {
  //     const folders = await BookmarkManager.getOrganizedBookmarks();
  //     bookmarkFolders.set(folders);
  //   } catch (error) {
  //     console.error('Failed to refresh bookmarks:', error);
  //   }
  // }
  
  // Handle save-all-edits event
  function handleSaveAllEdits() {
    if (isRenaming) {
      saveFolderName();
    }
  }

  // Set up component
  onMount(() => {
    // Initialize enhanced drag-drop system asynchronously
    const initializeAsync = async () => {
      if (!EnhancedDragDropManager.isEditModeEnabled() && isEditMode) {
        const initResult = await EnhancedDragDropManager.initialize();
        if (initResult.success) {
          console.log('✅ Enhanced drag-drop system initialized for folder:', folder.title);
        } else {
          console.error('❌ Failed to initialize enhanced drag-drop:', initResult.error);
        }
      }

      // Update drag-drop state after a short delay to ensure DOM is ready
      setTimeout(() => {
        updateEnhancedDragDropState();
      }, 200); // Increased delay to allow for DOM readiness
    };

    initializeAsync();

    // Listen for save-all-edits event
    document.addEventListener('save-all-edits', handleSaveAllEdits);

    return () => {
      document.removeEventListener('save-all-edits', handleSaveAllEdits);
    };
  });

  // Cleanup on destroy
  onDestroy(() => {
    unsubscribeEditMode();
  });
</script>

<div class="folder-container" bind:this={folderElement} class:draggable-item={isEditMode}>
  <div class="folder-header" bind:this={folderHeader} on:click={toggleExpanded} on:keydown={(e) => e.key === 'Enter' && toggleExpanded()} tabindex="0" role="button">
    <div class="folder-color" style="background-color: {folder.color}"></div>

    <!-- Folder title with inline editing -->
    {#if isRenaming}
      <input
        class="folder-title-input"
        type="text"
        bind:value={newFolderName}
        on:blur={saveFolderName}
        on:keydown={handleRenameKeydown}
        on:click|stopPropagation
        autofocus
      />
    {:else}
      <h3 class="folder-title" class:editable={isEditMode} on:dblclick={startRenaming}>
        {folder.title}
      </h3>
    {/if}

    <div class="bookmark-count">({folder.bookmarks.length})</div>

    <!-- Edit mode actions -->
    {#if isEditMode && !isRenaming}
      <button class="edit-button" on:click|stopPropagation={startRenaming} title="Rename folder">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      </button>
    {/if}

    <div class="expand-icon" class:expanded={isExpanded}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <polyline points="6,9 12,15 18,9"></polyline>
      </svg>
    </div>
  </div>
  
  {#if isExpanded && isVisible}
    <div class="bookmarks-grid" class:expanded={isExpanded}>
      {#each folder.bookmarks as bookmark (bookmark.id)}
        <BookmarkItem {bookmark} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .folder-container {
    margin-bottom: 2rem;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    overflow: hidden;
    position: relative;
  }
  
  .folder-header {
    display: flex;
    align-items: center;
    padding: 1rem 1.25rem;
    cursor: pointer;
    transition: all 0.2s ease;
    background: rgba(255, 255, 255, 0.05);
    gap: 0.5rem;
  }
  
  .folder-header:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  
  .folder-header:focus {
    outline: 2px solid rgba(59, 130, 246, 0.5);
    outline-offset: -2px;
  }
  
  .folder-color {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    margin-right: 0.75rem;
    flex-shrink: 0;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
  
  .folder-title {
    flex: 1;
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    transition: all 0.2s ease;
  }

  .folder-title.editable {
    cursor: text;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }

  .folder-title.editable:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .folder-title-input {
    flex: 1;
    background: rgba(255, 255, 255, 0.9);
    border: 2px solid #3b82f6;
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    font-size: 1.1rem;
    font-weight: 600;
    color: #1f2937;
    outline: none;
  }

  .edit-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: all 0.2s ease;
    opacity: 0;
  }

  .folder-header:hover .edit-button {
    opacity: 1;
  }

  .edit-button:hover {
    background: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.9);
  }

  .edit-button svg {
    width: 14px;
    height: 14px;
  }
  
  .bookmark-count {
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.9rem;
    margin-right: 0.5rem;
  }
  
  .expand-icon {
    width: 20px;
    height: 20px;
    color: rgba(255, 255, 255, 0.7);
    transition: transform 0.2s ease;
  }
  
  .expand-icon.expanded {
    transform: rotate(180deg);
  }
  
  .expand-icon svg {
    width: 100%;
    height: 100%;
  }
  
  .bookmarks-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 0.75rem;
    padding: 1.25rem;
    animation: slideDown 0.3s ease-out;
  }
  
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @media (max-width: 768px) {
    .bookmarks-grid {
      grid-template-columns: 1fr;
      gap: 0.5rem;
      padding: 1rem;
    }
    
    .folder-header {
      padding: 0.75rem 1rem;
    }
    
    .folder-title {
      font-size: 1rem;
    }
  }

  /* Enhanced drag-drop integration styles */
  :global(.app.edit-mode) .folder-container {
    border: 1px dashed rgba(255, 255, 255, 0.3);
  }

  :global(.app.edit-mode) .folder-header {
    padding-left: 0.75rem;
  }

  @media (prefers-color-scheme: dark) {
    .folder-container {
      background: rgba(20, 20, 20, 0.3);
      border-color: rgba(255, 255, 255, 0.1);
    }

    .folder-header {
      background: rgba(0, 0, 0, 0.2);
    }

    .folder-header:hover {
      background: rgba(255, 255, 255, 0.05);
    }

    .folder-title-input {
      background: rgba(30, 30, 30, 0.9);
      color: #f9fafb;
      border-color: #3b82f6;
    }

    .edit-button {
      background: rgba(255, 255, 255, 0.05);
    }

    .edit-button:hover {
      background: rgba(255, 255, 255, 0.1);
    }
  }
</style>
