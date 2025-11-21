import { BookmarkEditAPI, type BookmarkItem, type BookmarkFolder } from './api';
import { bookmarkFolders } from './stores';
import DragDropLogger from './logging/drag-drop-logger';

// Drag and drop data types
export interface DragData {
  type: 'bookmark' | 'folder';
  id: string;
  title: string;
  parentId?: string;
  index?: number;
  url?: string;
}

export interface DropZoneData {
  type: 'folder' | 'between-folders' | 'within-folder';
  targetId: string;
  targetIndex?: number;
  parentId?: string;
}

export interface DragState {
  isDragging: boolean;
  dragData: DragData | null;
  dragElement: HTMLElement | null;
  dropZone: DropZoneData | null;
  ghostElement: HTMLElement | null;
}

// Global drag state
let dragState: DragState = {
  isDragging: false,
  dragData: null,
  dragElement: null,
  dropZone: null,
  ghostElement: null
};

// Drag and drop utility class
export class DragDropManager {
  private static readonly DRAG_MIME_TYPE = 'application/x-favault-bookmark';
  private static readonly DRAG_THRESHOLD = 5; // pixels
  private static dragStartPosition = { x: 0, y: 0 };
  private static eventListeners: Map<string, Function[]> = new Map();

  /**
   * Initialize drag functionality for an element
   */
  static initializeDraggable(
    element: HTMLElement,
    dragData: DragData,
    options: {
      dragHandle?: HTMLElement;
      onDragStart?: (data: DragData) => void;
      onDragEnd?: (data: DragData) => void;
    } = {}
  ): void {
    const dragHandle = options.dragHandle || element;

    console.log('Initializing draggable for:', dragData.title, 'Edit mode enabled:', this.isEditModeEnabled());

    // Set draggable attribute based on edit mode
    const updateDraggable = () => {
      const isEnabled = this.isEditModeEnabled();
      element.draggable = isEnabled;
      if (isEnabled) {
        element.classList.add('draggable-item');
      } else {
        element.classList.remove('draggable-item');
      }
      console.log('Updated draggable state for:', dragData.title, 'draggable:', isEnabled);
    };

    // Initial setup
    updateDraggable();

    // Update draggable state when edit mode changes
    const editModeObserver = new MutationObserver(() => {
      updateDraggable();
    });

    editModeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });

    // Drag start handler
    const handleDragStart = (e: DragEvent) => {
      if (!this.isEditModeEnabled()) {
        console.log('Preventing drag - edit mode not enabled');
        e.preventDefault();
        return;
      }

      console.log('Drag started for:', dragData.title);

      // Start drag session logging
      DragDropLogger.startDragSession(dragData, 'standard');

      this.dragStartPosition = { x: e.clientX, y: e.clientY };

      // Set drag data
      e.dataTransfer!.setData(this.DRAG_MIME_TYPE, JSON.stringify(dragData));
      e.dataTransfer!.effectAllowed = 'move';

      // Create drag ghost
      this.createDragGhost(element, dragData);

      // Update global state
      dragState.isDragging = true;
      dragState.dragData = dragData;
      dragState.dragElement = element;

      // Add drag class for styling
      element.classList.add('dragging');
      document.body.classList.add('drag-active');

      // Notify listeners
      this.notifyEventListeners('dragstart', { dragData, element });
      options.onDragStart?.(dragData);
    };

    // Drag end handler
    const handleDragEnd = (e: DragEvent) => {
      console.log('Drag ended for:', dragData.title);

      // End drag session logging
      DragDropLogger.endDragSession(false);

      // Clean up
      this.endDrag();
      options.onDragEnd?.(dragData);

      // Remove drag class
      element.classList.remove('dragging');
      document.body.classList.remove('drag-active');

      // Notify listeners
      this.notifyEventListeners('dragend', { dragData, element });
    };

    // Attach event listeners
    element.addEventListener('dragstart', handleDragStart);
    element.addEventListener('dragend', handleDragEnd);

    // Store cleanup function
    (element as any)._dragCleanup = () => {
      element.removeEventListener('dragstart', handleDragStart);
      element.removeEventListener('dragend', handleDragEnd);
      editModeObserver.disconnect();
    };
  }

  /**
   * Initialize drop zone functionality for an element
   */
  static initializeDropZone(
    element: HTMLElement,
    dropZoneData: DropZoneData,
    options: {
      onDragEnter?: (data: DragData, zone: DropZoneData) => void;
      onDragLeave?: (data: DragData, zone: DropZoneData) => void;
      onDrop?: (data: DragData, zone: DropZoneData) => Promise<boolean>;
      acceptTypes?: ('bookmark' | 'folder')[];
    } = {}
  ): void {
    const acceptTypes = options.acceptTypes || ['bookmark', 'folder'];
    
    let dragEnterCounter = 0;

    // Drag enter handler
    const handleDragEnter = (e: DragEvent) => {
      if (!this.isEditModeEnabled() && !(dropZoneData.type === 'folder' && acceptTypes.includes('bookmark'))) return;

      dragEnterCounter++;
      e.preventDefault();

      const dragData = this.getDragData(e);
      if (!dragData || !acceptTypes.includes(dragData.type)) return;

      if (dragEnterCounter === 1) {
        element.classList.add('drag-over');
        dragState.dropZone = dropZoneData;

        // Log drag enter
        DragDropLogger.logDragEnter(dropZoneData);

        options.onDragEnter?.(dragData, dropZoneData);
        this.notifyEventListeners('dragenter', { dragData, dropZone: dropZoneData, element });
      }
    };

    // Drag over handler
    const handleDragOver = (e: DragEvent) => {
      if (!this.isEditModeEnabled() && !(dropZoneData.type === 'folder' && acceptTypes.includes('bookmark'))) return;

      e.preventDefault();
      e.dataTransfer!.dropEffect = 'move';
    };

    // Drag leave handler
    const handleDragLeave = (e: DragEvent) => {
      if (!this.isEditModeEnabled() && !(dropZoneData.type === 'folder' && acceptTypes.includes('bookmark'))) return;

      dragEnterCounter--;

      if (dragEnterCounter === 0) {
        element.classList.remove('drag-over');

        const dragData = this.getDragData(e);
        if (dragData) {
          // Log drag leave
          DragDropLogger.logDragLeave(dropZoneData);

          options.onDragLeave?.(dragData, dropZoneData);
          this.notifyEventListeners('dragleave', { dragData, dropZone: dropZoneData, element });
        }

        if (dragState.dropZone === dropZoneData) {
          dragState.dropZone = null;
        }
      }
    };

    // Drop handler
    const handleDrop = async (e: DragEvent) => {
      const allowed = this.isEditModeEnabled() || (dropZoneData.type === 'folder' && acceptTypes.includes('bookmark'));
      if (!allowed) {
        console.warn('[DragDropManager] Drop ignored - not allowed for this drop zone', {
          dropZoneType: dropZoneData.type,
          acceptTypes,
          isEditModeEnabled: this.isEditModeEnabled()
        });
        await DragDropLogger.logDropError('Drop rejected - not allowed for this drop zone', dropZoneData);
        return;
      }

      console.log('[DragDropManager] drop received on element:', element.className, 'zone:', dropZoneData);

      e.preventDefault();
      dragEnterCounter = 0;

      element.classList.remove('drag-over');

      let dragData = this.getDragData(e);
      if (!dragData) {
        dragData = this.getFallbackDragDataFromDOM();
      }
      console.log('[DragDropManager] parsed dragData:', dragData);
      if (!dragData) {
        const errorMsg = 'Drop rejected - no drag data available';
        console.warn('[DragDropManager]', errorMsg, { dropZoneData });
        await DragDropLogger.logDropError(errorMsg, dropZoneData);
        return;
      }
      if (!acceptTypes.includes(dragData.type)) {
        const errorMsg = `Drop rejected - unsupported drag type: ${dragData.type}`;
        console.warn('[DragDropManager]', errorMsg, { acceptTypes, dropZoneData });
        await DragDropLogger.logDropError(errorMsg, dropZoneData);
        return;
      }

      // Validate drop
      if (!this.validateDrop(dragData, dropZoneData)) {
        const errorMsg = 'Invalid drop location';
        this.showDropError(errorMsg);
        await DragDropLogger.logDropError(errorMsg, dropZoneData);
        return;
      }

      try {
        // Call custom drop handler if provided
        const handled = await options.onDrop?.(dragData, dropZoneData);
        console.log('[DragDropManager] Drop handler completed. handled =', handled);

        if (!handled) {
          console.log('[DragDropManager] Performing default drop behavior');
          // Default drop behavior
          await this.performDrop(dragData, dropZoneData);
        }

        console.log('[DragDropManager] Logging successful drop via DragDropLogger', {
          targetIndex: dropZoneData.targetIndex
        });
        // Log successful drop
        await DragDropLogger.logDrop(dropZoneData, dropZoneData.targetIndex);

        this.notifyEventListeners('drop', { dragData, dropZone: dropZoneData, element });
      } catch (error) {
        console.error('Drop operation failed:', error);
        const errorMsg = 'Failed to move bookmark';
        this.showDropError(errorMsg);
        await DragDropLogger.logDropError(errorMsg, dropZoneData);
      }
    };

    // Attach event listeners
    // Use capture phase to ensure container receives drag events even when children are present
    element.addEventListener('dragenter', handleDragEnter, true);
    element.addEventListener('dragover', handleDragOver, true);
    element.addEventListener('dragleave', handleDragLeave, true);
    element.addEventListener('drop', handleDrop, true);

    // Store cleanup function
    (element as any)._dropCleanup = () => {
      element.removeEventListener('dragenter', handleDragEnter, true);
      element.removeEventListener('dragover', handleDragOver, true);
      element.removeEventListener('dragleave', handleDragLeave, true);
      element.removeEventListener('drop', handleDrop, true);
    };
  }

  /**
   * Clean up drag and drop functionality
   */
  static cleanup(element: HTMLElement): void {
    if ((element as any)._dragCleanup) {
      (element as any)._dragCleanup();
      delete (element as any)._dragCleanup;
    }
    
    if ((element as any)._dropCleanup) {
      (element as any)._dropCleanup();
      delete (element as any)._dropCleanup;
    }
  }

  /**
   * Get current drag state
   */
  static getDragState(): DragState {
    return { ...dragState };
  }

  /**
   * Check if edit mode is enabled
   */
  private static isEditModeEnabled(): boolean {
    // Check multiple ways to ensure edit mode is detected
    return document.body.classList.contains('edit-mode') ||
           document.querySelector('.app.edit-mode') !== null ||
           document.body.classList.contains('drag-enabled');
  }

  /**
   * Start drag operation
   */
  private static startDrag(element: HTMLElement, dragData: DragData): void {
    dragState.isDragging = true;
    dragState.dragData = dragData;
    dragState.dragElement = element;
  }

  /**
   * End drag operation
   */
  private static endDrag(): void {
    // Remove ghost element
    if (dragState.ghostElement) {
      dragState.ghostElement.remove();
    }

    // Clear drop zone highlighting
    document.querySelectorAll('.drag-over').forEach(el => {
      el.classList.remove('drag-over');
    });

    // Reset state
    dragState.isDragging = false;
    dragState.dragData = null;
    dragState.dragElement = null;
    dragState.dropZone = null;
    dragState.ghostElement = null;
  }

  /**
   * Create enhanced drag ghost element with better visual feedback
   */
  private static createDragGhost(element: HTMLElement, dragData: DragData): void {
    const ghost = element.cloneNode(true) as HTMLElement;
    ghost.classList.add('drag-ghost', 'enhanced-drag-preview');

    // Enhanced styling for better visual feedback
    ghost.style.cssText = `
      position: fixed;
      top: -1000px;
      left: -1000px;
      pointer-events: none;
      opacity: 0.9;
      transform: rotate(3deg) scale(1.05);
      z-index: 10000;
      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.3);
      border: 2px solid #3b82f6;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      transition: all 0.2s ease;
    `;

    // Add drag type indicator
    const typeIndicator = document.createElement('div');
    typeIndicator.className = 'drag-type-indicator';
    typeIndicator.innerHTML = dragData.type === 'bookmark' ? '🔖' : '📁';
    typeIndicator.style.cssText = `
      position: absolute;
      top: -10px;
      right: -10px;
      width: 24px;
      height: 24px;
      background: #3b82f6;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
    `;
    ghost.appendChild(typeIndicator);

    // Add title overlay for better identification
    const titleOverlay = document.createElement('div');
    titleOverlay.className = 'drag-title-overlay';
    titleOverlay.textContent = dragData.title;
    titleOverlay.style.cssText = `
      position: absolute;
      bottom: -30px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
    `;
    ghost.appendChild(titleOverlay);

    document.body.appendChild(ghost);
    dragState.ghostElement = ghost;

    // Animate ghost appearance
    setTimeout(() => {
      if (ghost.parentNode) {
        ghost.style.opacity = '0.8';
        ghost.style.transform = 'rotate(2deg) scale(0.95)';
      }
    }, 50);
  }

  /**
   * Get drag data from drag event
   */
  private static getDragData(e: DragEvent): DragData | null {
    try {
      const data = e.dataTransfer?.getData(this.DRAG_MIME_TYPE);
      return data ? JSON.parse(data) : dragState.dragData;
    } catch {
      return dragState.dragData;
    }
  }

  /**
   * Fallback: infer drag data from DOM when HTML5 dataTransfer is not available
   */
  private static getFallbackDragDataFromDOM(): DragData | null {
    try {
      const draggingEl = document.querySelector('.bookmark-item.dragging') as HTMLElement | null;
      if (!draggingEl) return null;
      const id = draggingEl.getAttribute('data-bookmark-id') || draggingEl.getAttribute('data-id');
      if (!id) return null;
      const title = draggingEl.getAttribute('data-title') || draggingEl.querySelector('.bookmark-title')?.textContent?.trim() || '';
      const url = draggingEl.getAttribute('data-url') || '';
      const parentId = draggingEl.getAttribute('data-parent-id') || '';
      const indexAttr = draggingEl.getAttribute('data-index');
      const index = indexAttr ? parseInt(indexAttr, 10) : undefined;
      return { type: 'bookmark', id, title, url, parentId, index } as DragData;
    } catch {
      return null;
    }
  }

  /**
   * Validate drop operation
   */
  private static validateDrop(dragData: DragData, dropZone: DropZoneData): boolean {
    // Can't drop on itself
    if (dragData.id === dropZone.targetId) {
      return false;
    }

    // Can't drop folder into its own child
    if (dragData.type === 'folder' && dropZone.type === 'folder') {
      // This would require checking the folder hierarchy
      // For now, we'll allow it and let the API validation handle it
    }

    return true;
  }

  /**
   * Perform the actual drop operation
   */
  private static async performDrop(dragData: DragData, dropZone: DropZoneData): Promise<void> {
    let destination: { parentId?: string; index?: number } = {};

    switch (dropZone.type) {
      case 'folder':
        destination.parentId = dropZone.targetId;
        destination.index = dropZone.targetIndex;
        break;

      case 'within-folder':
        destination.parentId = dropZone.parentId;
        destination.index = dropZone.targetIndex;
        break;

      case 'between-folders':
        destination.parentId = dropZone.parentId;
        destination.index = dropZone.targetIndex;
        break;
    }

    // Perform the move operation
    const result = await BookmarkEditAPI.moveBookmark(dragData.id, destination);

    if (!result.success) {
      throw new Error(result.error || 'Failed to move bookmark');
    }

    // Refresh bookmarks to reflect changes
    this.notifyEventListeners('bookmarkMoved', { dragData, dropZone, result });
  }

  /**
   * Show drop error message
   */
  private static showDropError(message: string): void {
    // Create temporary error toast
    const toast = document.createElement('div');
    toast.className = 'drag-error-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ef4444;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 10001;
      animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * Add event listener
   */
  static addEventListener(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  static removeEventListener(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Notify event listeners
   */
  private static notifyEventListeners(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in drag-drop event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Enable edit mode drag functionality
   */
  static enableEditMode(): void {
    console.log('Enabling edit mode drag functionality');
    document.body.classList.add('drag-enabled');

    // Add enhanced CSS for drag states
    if (!document.getElementById('drag-drop-styles')) {
      const styles = document.createElement('style');
      styles.id = 'drag-drop-styles';
      styles.textContent = `
        /* Enhanced draggable item styles */
        .drag-enabled .draggable-item {
          cursor: grab;
          transition: all 0.2s ease;
          position: relative;
        }

        .drag-enabled .draggable-item:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .drag-enabled .draggable-item:active {
          cursor: grabbing;
        }

        /* Enhanced dragging state */
        .dragging {
          background-color: rgba(128, 128, 128, 0.6);
          transform: rotate(2deg) scale(0.95);
          z-index: 1000;
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
          transition: all 0.2s ease;
        }

        /* Enhanced drop zone highlighting - stable version without flickering */
        .drag-over {
          background: rgba(59, 130, 246, 0.1) !important;
          border: 2px dashed #3b82f6 !important;
          transition: background-color 0.2s ease, border-color 0.2s ease;
        }

        /* Enhanced drag ghost */
        .drag-ghost {
          box-shadow: 0 15px 35px rgba(0, 0, 0, 0.3);
          border-radius: 8px;
          overflow: hidden;
        }

        .enhanced-drag-preview {
          animation: dragStart 0.2s ease-out;
        }

        /* Drop zone pulse animation */
        @keyframes dropZoneHighlight {
          0%, 100% {
            border-color: rgba(59, 130, 246, 0.4);
            background: rgba(59, 130, 246, 0.05);
          }
          50% {
            border-color: rgba(59, 130, 246, 0.8);
            background: rgba(59, 130, 246, 0.15);
          }
        }

        /* Drag start animation */
        @keyframes dragStart {
          from {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
          to {
            transform: scale(0.95) rotate(2deg);
            opacity: 0.8;
          }
        }

        /* Toast animations */
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }

        /* Global drag state styles */
        body.drag-active {
          user-select: none;
        }

        body.drag-active * {
          cursor: grabbing !important;
        }

        /* Prevent text selection during drag */
        body.bookmark-drag-active,
        body.folder-drag-active {
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
        }
      `;
      document.head.appendChild(styles);
    }
  }

  /**
   * Disable edit mode drag functionality
   */
  static disableEditMode(): void {
    console.log('Disabling edit mode drag functionality');
    document.body.classList.remove('drag-enabled');

    // End any active drag
    if (dragState.isDragging) {
      this.endDrag();
    }
  }
}
