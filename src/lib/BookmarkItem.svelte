<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { BookmarkItem } from './api';
  import { DragDropManager, type DragData } from './dragdrop';
  import { BraveDragDropManager } from './dragdrop-brave';
  import { editMode, bookmarkFolders } from './stores';
  import { BookmarkEditAPI } from './api';
  import { BookmarkManager } from './bookmarks';
  import { AutoSaveManager, createDebouncedInput } from './autosave';
  import AutoSaveStatus from './AutoSaveStatus.svelte';
  import { BookmarkValidator, createRealTimeValidator, type ValidationResult } from './validation';
  import ValidationStatus from './ValidationStatus.svelte';

  export let bookmark: BookmarkItem;

  let bookmarkElement: HTMLElement;
  let isEditMode = false;
  let isEditing = false;
  let newTitle = '';
  let newUrl = '';
  let autoSaveManager: AutoSaveManager | null = null;
  let validationResult: ValidationResult | null = null;
  let realTimeValidator: ReturnType<typeof createRealTimeValidator> | null = null;

  // Subscribe to edit mode changes
  const unsubscribeEditMode = editMode.subscribe(value => {
    isEditMode = value;
    console.log('Edit mode changed to:', value, 'for bookmark:', bookmark.title);
    // Use setTimeout to ensure DOM updates are complete
    setTimeout(() => {
      updateDragDropState();
    }, 50);
  });

  // Reactive statement to update drag-drop when edit mode changes
  $: if (bookmarkElement && typeof isEditMode !== 'undefined') {
    setTimeout(() => {
      updateDragDropState();
    }, 50);
  }

  // Create debounced input handlers
  const debouncedTitleInput = createDebouncedInput((value: string) => {
    if (realTimeValidator) {
      realTimeValidator.validateBookmark(value, newUrl);
    }
    if (autoSaveManager && value !== bookmark.title) {
      autoSaveManager.markDirty();
    }
  }, 500);

  const debouncedUrlInput = createDebouncedInput((value: string) => {
    if (realTimeValidator) {
      realTimeValidator.validateBookmark(newTitle, value);
    }
    if (autoSaveManager && value !== bookmark.url) {
      autoSaveManager.markDirty();
    }
  }, 500);

  // Generate favicon URL
  function getFaviconUrl(url: string): string {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch {
      return '';
    }
  }
  
  // Handle favicon load error
  function handleFaviconError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }
  
  // Handle bookmark click
  function handleClick() {
    if (isEditMode || isEditing) return; // Don't navigate in edit mode
    if (bookmark.url) {
      window.open(bookmark.url, '_blank');
    }
  }

  // Start inline editing
  function startEditing() {
    if (!isEditMode) return;
    isEditing = true;
    newTitle = bookmark.title;
    newUrl = bookmark.url || '';

    // Initialize validation
    validationResult = BookmarkValidator.validateBookmark(newTitle, newUrl);
    realTimeValidator = createRealTimeValidator((result) => {
      validationResult = result;
    });

    // Initialize auto-save manager
    autoSaveManager = new AutoSaveManager({
      delay: 2000, // 2 seconds
      onSave: async () => {
        // Only auto-save if validation passes
        if (validationResult && validationResult.isValid) {
          await saveBookmark();
        }
      },
      onSaveStart: () => {
        console.log('Auto-saving bookmark:', bookmark.title);
      },
      onSaveComplete: (success, error) => {
        if (success) {
          console.log('Auto-save completed for:', bookmark.title);
        } else {
          console.error('Auto-save failed for:', bookmark.title, error);
        }
      }
    });
  }

  // Cancel editing
  function cancelEditing() {
    if (autoSaveManager) {
      autoSaveManager.destroy();
      autoSaveManager = null;
    }
    if (realTimeValidator) {
      realTimeValidator.destroy();
      realTimeValidator = null;
    }
    isEditing = false;
    newTitle = '';
    newUrl = '';
    validationResult = null;
  }

  // Save bookmark changes
  async function saveBookmark() {
    // Validate before saving
    const validation = BookmarkValidator.validateBookmark(newTitle, newUrl);
    if (!validation.isValid) {
      validationResult = validation;
      throw new Error(BookmarkValidator.getErrorMessage(validation));
    }

    if (!newTitle.trim()) {
      cancelEditing();
      return;
    }

    try {
      // Sanitize inputs
      const sanitizedTitle = BookmarkValidator.sanitizeTitle(newTitle);
      const sanitizedUrl = BookmarkValidator.sanitizeUrl(newUrl);

      const changes: any = { title: sanitizedTitle };
      if (sanitizedUrl) {
        changes.url = sanitizedUrl;
      }

      const result = await BookmarkEditAPI.updateBookmark(bookmark.id, changes);
      if (result.success) {
        bookmark.title = sanitizedTitle;
        if (sanitizedUrl) {
          bookmark.url = sanitizedUrl;
        }

        // Mark as clean in auto-save manager
        if (autoSaveManager) {
          autoSaveManager.markClean();
        }

        await refreshBookmarks();

        // End editing mode
        if (autoSaveManager) {
          autoSaveManager.destroy();
          autoSaveManager = null;
        }
        if (realTimeValidator) {
          realTimeValidator.destroy();
          realTimeValidator = null;
        }
        isEditing = false;
        newTitle = '';
        newUrl = '';
        validationResult = null;
      } else {
        console.error('Failed to update bookmark:', result.error);
        throw new Error(result.error || 'Failed to update bookmark');
      }
    } catch (error) {
      console.error('Failed to save bookmark:', error);
      // Don't cancel editing on save error, let user try again
      throw error;
    }
  }

  // Handle edit key events
  function handleEditKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveBookmark();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditing();
    }
  }

  // Update drag and drop state
  function updateDragDropState() {
    if (!bookmarkElement) {
      console.log('Bookmark element not available yet for:', bookmark.title);
      return;
    }

    // Clean up any existing drag/drop functionality first
    DragDropManager.cleanup(bookmarkElement);

    if (isEditMode) {
      console.log('Initializing drag-drop for bookmark:', bookmark.title);

      const dragData: DragData = {
        type: 'bookmark',
        id: bookmark.id,
        title: bookmark.title,
        url: bookmark.url,
        parentId: bookmark.parentId,
        index: bookmark.index
      };

      // Use Brave-specific manager if in Brave browser
      const DragManager = BraveDragDropManager.isBraveBrowser() ? BraveDragDropManager : DragDropManager;

      DragManager.initializeDraggable(bookmarkElement, dragData, {
        onDragStart: (data) => {
          console.log('Started dragging bookmark:', data.title);
        },
        onDragEnd: (data) => {
          console.log('Finished dragging bookmark:', data.title);
        }
      });

      console.log('Drag-drop initialized for bookmark:', bookmark.title);
    } else {
      console.log('Disabling drag-drop for bookmark:', bookmark.title);
    }
  }

  // Refresh bookmarks after changes
  async function refreshBookmarks() {
    try {
      const folders = await BookmarkManager.getOrganizedBookmarks();
      bookmarkFolders.set(folders);
    } catch (error) {
      console.error('Failed to refresh bookmarks:', error);
    }
  }

  // Handle save-all-edits event
  function handleSaveAllEdits() {
    if (isEditing) {
      saveBookmark();
    }
  }

  // Setup drag and drop on mount
  onMount(() => {
    updateDragDropState();

    // Listen for save-all-edits event
    document.addEventListener('save-all-edits', handleSaveAllEdits);

    return () => {
      if (bookmarkElement) {
        DragDropManager.cleanup(bookmarkElement);
      }
      document.removeEventListener('save-all-edits', handleSaveAllEdits);
    };
  });

  // Cleanup on destroy
  onDestroy(() => {
    unsubscribeEditMode();
    if (bookmarkElement) {
      DragDropManager.cleanup(bookmarkElement);
    }
  });
  
  // Get domain from URL for display
  function getDomain(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  }
</script>

<div
  class="bookmark-item"
  class:draggable-item={isEditMode}
  class:editing={isEditing}
  bind:this={bookmarkElement}
  on:click={handleClick}
  on:keydown={(e) => e.key === 'Enter' && handleClick()}
  tabindex="0"
  role="button"
>
  <div class="favicon-container">
    {#if bookmark.url}
      <img
        src={getFaviconUrl(bookmark.url)}
        alt=""
        class="favicon"
        on:error={handleFaviconError}
      />
    {/if}
    <div class="favicon-fallback">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
      </svg>
    </div>
  </div>

  <div class="bookmark-content">
    {#if isEditing}
      <!-- Inline editing mode -->
      <div class="edit-form">
        <input
          class="edit-title-input"
          type="text"
          bind:value={newTitle}
          on:input={debouncedTitleInput}
          on:keydown={handleEditKeydown}
          on:click|stopPropagation
          placeholder="Bookmark title"
        />
        <input
          class="edit-url-input"
          type="url"
          bind:value={newUrl}
          on:input={debouncedUrlInput}
          on:keydown={handleEditKeydown}
          on:click|stopPropagation
          placeholder="URL (optional)"
        />
        <div class="edit-actions">
          {#if validationResult}
            <ValidationStatus result={validationResult} compact />
          {/if}
          {#if autoSaveManager}
            <AutoSaveStatus {autoSaveManager} compact />
          {/if}
          <button
            class="save-button"
            disabled={validationResult && !validationResult.isValid}
            on:click|stopPropagation={saveBookmark}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <polyline points="20,6 9,17 4,12"></polyline>
            </svg>
          </button>
          <button class="cancel-button" on:click|stopPropagation={cancelEditing}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
    {:else}
      <!-- Normal display mode -->
      <div class="bookmark-title" class:editable={isEditMode} title={bookmark.title} on:dblclick={startEditing}>
        {bookmark.title}
      </div>
      {#if bookmark.url}
        <div class="bookmark-url" title={bookmark.url}>
          {getDomain(bookmark.url)}
        </div>
      {/if}
    {/if}
  </div>

  <!-- Edit button (only visible in edit mode) -->
  {#if isEditMode && !isEditing}
    <button class="edit-button" on:click|stopPropagation={startEditing} title="Edit bookmark">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
    </button>
  {/if}
</div>

<style>
  .bookmark-item {
    display: flex;
    align-items: center;
    padding: 0.75rem;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    backdrop-filter: blur(5px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    position: relative;
  }

  .bookmark-item.draggable-item {
    cursor: grab;
  }

  .bookmark-item.draggable-item:active {
    cursor: grabbing;
  }

  .bookmark-item.editing {
    cursor: default;
    background: rgba(255, 255, 255, 0.95);
  }
  
  .bookmark-item:hover {
    background: rgba(255, 255, 255, 0.95);
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  }
  
  .bookmark-item:focus {
    outline: 2px solid rgba(59, 130, 246, 0.5);
    outline-offset: 2px;
  }
  
  .favicon-container {
    position: relative;
    width: 24px;
    height: 24px;
    margin-right: 0.75rem;
    flex-shrink: 0;
  }
  
  .favicon {
    width: 100%;
    height: 100%;
    border-radius: 4px;
  }
  
  .favicon-fallback {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.1);
    border-radius: 4px;
    color: #666;
  }
  
  .favicon-fallback svg {
    width: 14px;
    height: 14px;
  }
  
  .favicon:not([style*="display: none"]) + .favicon-fallback {
    display: none;
  }
  
  .bookmark-content {
    flex: 1;
    min-width: 0;
  }
  
  .bookmark-title {
    font-weight: 500;
    color: #333;
    margin-bottom: 0.25rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.95rem;
    transition: all 0.2s ease;
  }

  .bookmark-title.editable {
    cursor: text;
    padding: 0.125rem 0.25rem;
    border-radius: 3px;
  }

  .bookmark-title.editable:hover {
    background: rgba(0, 0, 0, 0.05);
  }

  .edit-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
  }

  .edit-title-input,
  .edit-url-input {
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 0.375rem 0.5rem;
    font-size: 0.875rem;
    color: #374151;
    outline: none;
    transition: all 0.2s ease;
  }

  .edit-title-input:focus,
  .edit-url-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }

  .edit-actions {
    display: flex;
    gap: 0.25rem;
    justify-content: flex-end;
  }

  .save-button,
  .cancel-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .save-button {
    background: #10b981;
    color: white;
  }

  .save-button:hover:not(:disabled) {
    background: #059669;
  }

  .save-button:disabled {
    background: #9ca3af;
    cursor: not-allowed;
    opacity: 0.6;
  }

  .cancel-button {
    background: #ef4444;
    color: white;
  }

  .cancel-button:hover {
    background: #dc2626;
  }

  .save-button svg,
  .cancel-button svg {
    width: 12px;
    height: 12px;
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
    color: rgba(0, 0, 0, 0.5);
    cursor: pointer;
    transition: all 0.2s ease;
    opacity: 0;
    margin-left: 0.5rem;
  }

  .bookmark-item:hover .edit-button {
    opacity: 1;
  }

  .edit-button:hover {
    background: rgba(0, 0, 0, 0.1);
    color: rgba(0, 0, 0, 0.7);
  }

  .edit-button svg {
    width: 12px;
    height: 12px;
  }
  
  .bookmark-url {
    font-size: 0.8rem;
    color: #666;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  /* Drag and drop styles */
  .bookmark-item.dragging {
    opacity: 0.5;
    transform: rotate(2deg) scale(0.95);
    z-index: 1000;
  }

  /* Edit mode styles */
  :global(.app.edit-mode) .bookmark-item {
    border: 1px dashed rgba(0, 0, 0, 0.2);
  }

  @media (max-width: 768px) {
    .bookmark-item {
      padding: 0.5rem;
    }

    .edit-form {
      gap: 0.375rem;
    }

    .edit-title-input,
    .edit-url-input {
      font-size: 0.8rem;
      padding: 0.25rem 0.375rem;
    }

    .edit-button {
      width: 20px;
      height: 20px;
    }

    .edit-button svg {
      width: 10px;
      height: 10px;
    }
  }

  @media (prefers-color-scheme: dark) {
    .bookmark-item {
      background: rgba(40, 40, 40, 0.8);
      border-color: rgba(255, 255, 255, 0.1);
    }

    .bookmark-item:hover {
      background: rgba(50, 50, 50, 0.9);
    }

    .bookmark-item.editing {
      background: rgba(50, 50, 50, 0.95);
    }

    .bookmark-title {
      color: #fff;
    }

    .bookmark-title.editable:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .bookmark-url {
      color: #aaa;
    }

    .favicon-fallback {
      background: rgba(255, 255, 255, 0.1);
      color: #aaa;
    }

    .edit-title-input,
    .edit-url-input {
      background: rgba(30, 30, 30, 0.9);
      border-color: rgba(255, 255, 255, 0.2);
      color: #f9fafb;
    }

    .edit-title-input:focus,
    .edit-url-input:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
    }

    .edit-button {
      background: rgba(255, 255, 255, 0.05);
      color: rgba(255, 255, 255, 0.5);
    }

    .edit-button:hover {
      background: rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.7);
    }

    :global(.app.edit-mode) .bookmark-item {
      border-color: rgba(255, 255, 255, 0.2);
    }
  }
</style>
