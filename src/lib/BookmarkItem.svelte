<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { BookmarkItem } from './api';
  import { DragDropManager, type DragData, type DropZoneData } from './dragdrop';
  import { BraveDragDropManager } from './dragdrop-brave';
  import { editMode, bookmarkFolders } from './stores';
  import { BookmarkEditAPI } from './api';
  import { BookmarkManager } from './bookmarks';
  import { AutoSaveManager, createDebouncedInput } from './autosave';
  import AutoSaveStatus from './AutoSaveStatus.svelte';
  import { BookmarkValidator, createRealTimeValidator, type ValidationResult } from './validation';
  import ValidationStatus from './ValidationStatus.svelte';
  import { FaviconManager } from './favicon-utils';
  // import { DragDropValidator } from './drag-drop-validation'; // Disabled with on-bookmark drop zones

  export let bookmark: BookmarkItem;

  let bookmarkElement: HTMLElement;
  let isEditMode = false;
  let isEditing = false;
  let newTitle = '';
  let newUrl = '';
  let autoSaveManager: AutoSaveManager | null = null;
  let validationResult: ValidationResult | null = null;
  let realTimeValidator: ReturnType<typeof createRealTimeValidator> | null = null;

  // CRITICAL FIX: Track drag-drop initialization state to prevent duplicate registrations
  let dragDropInitialized = false;
  let lastInitializedBookmarkId = '';

  // Global drag candidate for mouse-based fallback (no HTML5 DnD in headless)
  // Stored on window to coordinate across component instances
  if (typeof window !== 'undefined' && !(window as any).__fav_dragCandidate) {
    (window as any).__fav_dragCandidate = null;
  }

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

  // Generate favicon URL using enhanced utility with performance optimization
  let faviconUrlCache: string | null = null;
  function getFaviconUrl(url: string): string {
    // Cache the favicon URL to prevent repeated calculations during refreshes
    if (faviconUrlCache === null) {
      faviconUrlCache = FaviconManager.getFaviconUrl(url, {
        size: 32,
        skipLocalUrls: true,
        skipSpecialUrls: true
      });
    }
    return faviconUrlCache;
  }

  // Handle favicon error using enhanced utility (performance optimized)
  function handleFaviconError(event: Event) {
    const img = event.target as HTMLImageElement;
    // Simple fallback to prevent excessive processing during refreshes
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

  // Minimal HTML5 drag handlers to satisfy tests and ensure dataTransfer
  function handleHtml5DragStart(e: DragEvent) {
    console.log('[BookmarkItem] dragstart for:', bookmark.title, bookmark.id);
    const data = {
      type: 'bookmark',
      id: bookmark.id,
      title: bookmark.title,
      url: bookmark.url || '',
      parentId: bookmark.parentId || '',
      index: bookmark.index ?? 0
    };
    try {
      e.dataTransfer?.setData('application/x-favault-bookmark', JSON.stringify(data));
      e.dataTransfer?.setData('text/plain', JSON.stringify(data));
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    } catch {}
    // Visual feedback (generic selectors used by tests)
    bookmarkElement.classList.add('dragging');
    document.body.classList.add('drag-active');
  }

  function handleHtml5DragEnd(_e: DragEvent) {
    bookmarkElement.classList.remove('dragging');
    document.body.classList.remove('drag-active');
  }

  // Bridge for Playwright mouse-based drag to HTML5 DnD
  function handleMouseDownBridge(e: MouseEvent) {
    // If global edit mode is enabled, prevent default to stop focus-induced auto-scroll
    // Do not preventDefault here; it breaks native dragstart.
    // Allow fallback drag bridge even if edit mode isn't toggled (Playwright compatibility)
    if (isEditing) return;
    if (e.button !== 0) return; // left-click only
    try {
      console.log('[BookmarkItem] mousedown bridge for:', bookmark.title, bookmark.id);
      // Mark global candidate at drag start
      if (typeof window !== 'undefined') {
        (window as any).__fav_dragCandidate = {
          id: bookmark.id,
          parentId: bookmark.parentId,
          title: bookmark.title,
          startedAt: Date.now()
        };
      }

      const dt = new DataTransfer();
      const payload = {
        type: 'bookmark',
        id: bookmark.id,
        title: bookmark.title,
        url: bookmark.url || '',
        parentId: bookmark.parentId || '',
        index: bookmark.index ?? 0
      };
      dt.setData('application/x-favault-bookmark', JSON.stringify(payload));
      dt.setData('text/plain', JSON.stringify(payload));

      const dragStart = new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt });
      // Ensure visual dragging state even if native dragstart isn't honored in headless
      bookmarkElement.classList.add('dragging');
      document.body.classList.add('drag-active');
      bookmarkElement.dispatchEvent(dragStart);

      const handleMouseUp = async (upEvt: MouseEvent) => {
        const target = document.elementFromPoint(upEvt.clientX, upEvt.clientY) as HTMLElement | null;
        if (target) {
          const dragOver = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt });
          target.dispatchEvent(dragOver);
          const drop = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt });
          const dropHandled = target.dispatchEvent(drop);

          // Fallback: if HTML5 drop handlers didn't execute, perform manual move based on DOM target
          try {
            const gc = (typeof window !== 'undefined' ? (window as any).__fav_dragCandidate : null);
            const currentParent = bookmark.parentId || '';
            const container = target.closest('.folder-container') as HTMLElement | null;
            const header = target.closest('.folder-header') as HTMLElement | null;
            const dropEl = container || header;
            const destFolderId = dropEl?.getAttribute('data-folder-id') || '';
            console.log('[DnD Fallback] mouseup at', {
              bookmarkId: bookmark.id,
              bookmarkTitle: bookmark.title,
              currentParent,
              destFolderId,
              overHeader: !!header,
              overContainer: !!container,
              dropHandled
            });
            if (gc && gc.id === bookmark.id && destFolderId && destFolderId !== currentParent) {
              // Append to end by default when dropping on container; insert at 0 for header
              const index = header ? 0 : undefined;
              console.log('🔥 [DnD Fallback] Moving bookmark', bookmark.title, 'to folder', destFolderId, 'index', index);
              console.log('🔥 DEBUG: Bookmark move parameters:', {
                bookmarkId: bookmark.id,
                bookmarkTitle: bookmark.title,
                currentParentId: bookmark.parentId,
                targetParentId: destFolderId,
                targetIndex: index,
                bookmarkUrl: bookmark.url
              });
              
              const result = await BookmarkEditAPI.moveBookmark(bookmark.id, { parentId: destFolderId, index });
              
              console.log('🔥 DEBUG: Move API result:', result);
              
              if (result.success) {
                console.log('🔥 ✅ SUCCESS: Bookmark move completed successfully');
                BookmarkManager.clearCache();
                await refreshBookmarks();
                
                // CRITICAL DEBUG: Verify the bookmark still exists after the move
                setTimeout(async () => {
                  try {
                    console.log('🔥 🚨 POST-MOVE VERIFICATION: Checking bookmark persistence...');
                    const folders = await BookmarkManager.getOrganizedBookmarks();
                    let foundBookmark = null;
                    
                    for (const folder of folders) {
                      const found = folder.bookmarks.find(b => b.id === bookmark.id);
                      if (found) {
                        foundBookmark = found;
                        console.log('🔥 ✅ POST-MOVE: Bookmark found in folder:', folder.title, 'at index:', folder.bookmarks.indexOf(found));
                        break;
                      }
                    }
                    
                    if (!foundBookmark) {
                      console.error('🔥 🚨 CRITICAL ERROR: Bookmark disappeared after move! ID:', bookmark.id, 'Title:', bookmark.title);
                    }
                  } catch (verifyError) {
                    console.error('🔥 🚨 POST-MOVE VERIFICATION FAILED:', verifyError);
                  }
                }, 200);
              } else {
                console.error('🔥 ❌ FAILED: [DnD Fallback] Failed to move bookmark:', result.error);
              }
            }
          } catch (err) {
            console.error('[DnD Fallback] Error during manual move:', err);
          } finally {
            if (typeof window !== 'undefined') (window as any).__fav_dragCandidate = null;
          }
        }
        const dragEnd = new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt });
        bookmarkElement.dispatchEvent(dragEnd);
        document.removeEventListener('mouseup', handleMouseUp, false);
      };
      // Use non-capturing so folder/header mouseup|capture can process first
      document.addEventListener('mouseup', handleMouseUp, false);
    } catch (err) {
      console.warn('Mouse-to-HTML5 DnD bridge failed:', err);
    }
  }


  // Update drag and drop state
  function updateDragDropState() {
    if (!bookmarkElement) {
      console.log('Bookmark element not available yet for:', bookmark.title);
      return;
    }

    // CRITICAL FIX: Prevent unnecessary re-initialization if already initialized for this bookmark
    // Only re-initialize if:
    // 1. Edit mode state changed (enabled/disabled)
    // 2. Bookmark ID changed (different bookmark)
    // 3. Never been initialized before
    const needsReinitialization =
      !dragDropInitialized ||
      lastInitializedBookmarkId !== bookmark.id ||
      (dragDropInitialized && !isEditMode); // Always cleanup when disabling edit mode

    if (!needsReinitialization && isEditMode) {
      console.log('Skipping drag-drop re-initialization for bookmark:', bookmark.title, '(already initialized)');
      return;
    }

    // Clean up any existing drag/drop functionality first
    DragDropManager.cleanup(bookmarkElement);

    if (isEditMode) {
      console.log('Initializing enhanced drag-drop for bookmark:', bookmark.title);

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
          console.log('🚀 Started dragging bookmark:', data.title, {
            id: data.id,
            parentId: data.parentId,
            index: data.index,
            type: data.type
          });

          // Add visual feedback for drag start
          bookmarkElement.classList.add('dragging-bookmark');
          document.body.classList.add('bookmark-drag-active');

          // Store original position for potential revert
          bookmarkElement.dataset.originalParent = data.parentId || '';
          bookmarkElement.dataset.originalIndex = String(data.index || 0);
        },
        onDragEnd: (data) => {
          console.log('Finished dragging bookmark:', data.title);
          // Clean up visual feedback
          bookmarkElement.classList.remove('dragging-bookmark');
          document.body.classList.remove('bookmark-drag-active');

          // Clean up temporary data
          delete bookmarkElement.dataset.originalParent;
          delete bookmarkElement.dataset.originalIndex;

          // Remove any lingering insertion point indicators
          document.querySelectorAll('.insertion-point-active').forEach(el => {
            el.classList.remove('insertion-point-active');
          });
        }
      });

      // DISABLED: On-bookmark drop zones to prevent conflicts with insertion points
      // The insertion points (BookmarkInsertionPoint.svelte) handle all bookmark reordering
      // setTimeout(() => {
      //   initializeBookmarkDropZone();
      // }, 100); // Small delay to ensure DOM is ready

      // Mark as initialized
      dragDropInitialized = true;
      lastInitializedBookmarkId = bookmark.id;

      // CRITICAL FIX: Mark element as managed by Svelte to prevent EnhancedDragDropManager interference
      bookmarkElement.setAttribute('data-svelte-managed-drag', 'true');

      console.log('Enhanced drag-drop initialized for bookmark:', bookmark.title);
    } else {
      console.log('Disabling drag-drop for bookmark:', bookmark.title);
      dragDropInitialized = false;
      lastInitializedBookmarkId = '';
    }
  }

  // DISABLED: On-bookmark drop zone functionality
  // This was causing conflicts with insertion points. All bookmark reordering
  // is now handled by BookmarkInsertionPoint.svelte components.
  /*
  function initializeBookmarkDropZone() {
    // This function has been disabled to prevent conflicts with insertion points
    // All bookmark reordering should use the insertion points between bookmarks
    console.log('⚠️ On-bookmark drop zones are disabled to prevent conflicts with insertion points');
  }
  */

  // Debounced refresh to prevent cascade refreshes
  let refreshTimeout: any | null = null;
  async function refreshBookmarks() {
    // Cancel any pending refresh
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
    }
    
    // Debounce refresh calls to prevent performance issues
    refreshTimeout = setTimeout(async () => {
      try {
        console.log('🔄 Performing debounced bookmark refresh (BookmarkItem)');
        const folders = await BookmarkManager.getOrganizedBookmarks();
        bookmarkFolders.set(folders);
        refreshTimeout = null;
      } catch (error) {
        console.error('Failed to refresh bookmarks:', error);
        refreshTimeout = null;
      }
    }, 150); // 150ms debounce
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

  // Visual feedback functions for drag-and-drop
  function showInsertionIndicator(dragData: DragData, dropZone: DropZoneData) {
    // Create or update insertion point indicator
    let indicator = document.querySelector('.bookmark-insertion-indicator') as HTMLElement;

    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'bookmark-insertion-indicator';
      indicator.innerHTML = `
        <div class="insertion-line"></div>
        <div class="insertion-text">Drop here to insert ${dragData.title}</div>
      `;
      document.body.appendChild(indicator);
    }

    // Position the indicator near the target bookmark
    const rect = bookmarkElement.getBoundingClientRect();
    const insertBefore = (dropZone.targetIndex || 0) <= (bookmark.index || 0);

    indicator.style.position = 'fixed';
    indicator.style.left = `${rect.left}px`;
    indicator.style.width = `${rect.width}px`;
    indicator.style.zIndex = '10001';

    if (insertBefore) {
      indicator.style.top = `${rect.top - 2}px`;
    } else {
      indicator.style.top = `${rect.bottom - 2}px`;
    }

    indicator.classList.add('active');
  }

  function hideInsertionIndicator() {
    const indicator = document.querySelector('.bookmark-insertion-indicator');
    if (indicator) {
      indicator.classList.remove('active');
      setTimeout(() => {
        if (indicator.parentNode) {
          indicator.parentNode.removeChild(indicator);
        }
      }, 200);
    }
  }

  function showMoveSuccessIndicator(bookmarkTitle: string) {
    const toast = document.createElement('div');
    toast.className = 'bookmark-move-success-toast';
    toast.innerHTML = `
      <div class="toast-icon">✅</div>
      <div class="toast-message">Moved "${bookmarkTitle}" successfully</div>
    `;

    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10002;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
      animation: slideInRight 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  function showMoveErrorIndicator(errorMessage: string) {
    const toast = document.createElement('div');
    toast.className = 'bookmark-move-error-toast';
    toast.innerHTML = `
      <div class="toast-icon">❌</div>
      <div class="toast-message">${errorMessage}</div>
    `;

    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ef4444;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10002;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
      animation: slideInRight 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 5000);
  }
</script>

<div
  class="bookmark-item"
  data-testid="bookmark-item"
  class:draggable-item={isEditMode}
  class:editing={isEditing}
  bind:this={bookmarkElement}
  on:click={handleClick}
  on:keydown={(e) => e.key === 'Enter' && handleClick()}
  on:mousedown={handleMouseDownBridge}
  tabindex={isEditMode ? -1 : 0}
  role="button"
  draggable={true}
  on:dragstart={handleHtml5DragStart}
  on:dragend={handleHtml5DragEnd}
  data-bookmark-id={bookmark.id}
  data-id={bookmark.id}
  data-url={bookmark.url || ''}
  data-title={bookmark.title}
  data-parent-id={bookmark.parentId || ''}
  data-index={bookmark.index || 0}
>
  <div class="favicon-container">
    {#if bookmark.url && getFaviconUrl(bookmark.url)}
      <img
        src={getFaviconUrl(bookmark.url)}
        alt=""
        class="favicon"
        on:error={handleFaviconError}
        loading="lazy"
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
      <div class="bookmark-title" class:editable={isEditMode} title={bookmark.title} on:dblclick={startEditing} role="button" tabindex="0">
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


  .bookmark-item.draggable-item {
    cursor: grab;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    position: relative;
  }

  .bookmark-item.draggable-item:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .bookmark-item.draggable-item:active {
    cursor: grabbing;
  }

  /* DISABLED: Drop zone highlighting - now handled by insertion points
  .bookmark-item.bookmark-drop-zone-active {
    background: rgba(59, 130, 246, 0.1) !important;
    border: 2px dashed #3b82f6 !important;
    transform: scale(1.02);
    transition: all 0.2s ease;
  }
  */

  /* Global styles for drag-and-drop indicators */
  :global(.bookmark-insertion-indicator) {
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  :global(.bookmark-insertion-indicator.active) {
    opacity: 1;
  }

  :global(.bookmark-insertion-indicator .insertion-line) {
    height: 3px;
    background: #3b82f6;
    border-radius: 2px;
    box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
  }

  :global(.bookmark-insertion-indicator .insertion-text) {
    position: absolute;
    top: -25px;
    left: 50%;
    transform: translateX(-50%);
    background: #3b82f6;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
  }

  /* Toast animations - defined globally */

  /* Body state classes for drag feedback */
  :global(body.bookmark-drag-active) .bookmark-item:not(.dragging-bookmark) {
    transition: all 0.2s ease;
  }

  :global(body.bookmark-drag-active) .bookmark-item:not(.dragging-bookmark):hover {
    background: rgba(59, 130, 246, 0.05);
    border-color: rgba(59, 130, 246, 0.2);
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
