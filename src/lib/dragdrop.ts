import { BookmarkEditAPI, type BookmarkItem, type BookmarkFolder } from './api';
import { bookmarkFolders } from './stores';

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
      if (!this.isEditModeEnabled()) return;
      
      dragEnterCounter++;
      e.preventDefault();
      
      const dragData = this.getDragData(e);
      if (!dragData || !acceptTypes.includes(dragData.type)) return;
      
      if (dragEnterCounter === 1) {
        element.classList.add('drag-over');
        dragState.dropZone = dropZoneData;
        options.onDragEnter?.(dragData, dropZoneData);
        this.notifyEventListeners('dragenter', { dragData, dropZone: dropZoneData, element });
      }
    };

    // Drag over handler
    const handleDragOver = (e: DragEvent) => {
      if (!this.isEditModeEnabled()) return;
      
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'move';
    };

    // Drag leave handler
    const handleDragLeave = (e: DragEvent) => {
      if (!this.isEditModeEnabled()) return;
      
      dragEnterCounter--;
      
      if (dragEnterCounter === 0) {
        element.classList.remove('drag-over');
        
        const dragData = this.getDragData(e);
        if (dragData) {
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
      if (!this.isEditModeEnabled()) return;
      
      e.preventDefault();
      dragEnterCounter = 0;
      
      element.classList.remove('drag-over');
      
      const dragData = this.getDragData(e);
      if (!dragData || !acceptTypes.includes(dragData.type)) return;
      
      // Validate drop
      if (!this.validateDrop(dragData, dropZoneData)) {
        this.showDropError('Invalid drop location');
        return;
      }
      
      try {
        // Call custom drop handler if provided
        const handled = await options.onDrop?.(dragData, dropZoneData);
        
        if (!handled) {
          // Default drop behavior
          await this.performDrop(dragData, dropZoneData);
        }
        
        this.notifyEventListeners('drop', { dragData, dropZone: dropZoneData, element });
      } catch (error) {
        console.error('Drop operation failed:', error);
        this.showDropError('Failed to move bookmark');
      }
    };

    // Attach event listeners
    element.addEventListener('dragenter', handleDragEnter);
    element.addEventListener('dragover', handleDragOver);
    element.addEventListener('dragleave', handleDragLeave);
    element.addEventListener('drop', handleDrop);
    
    // Store cleanup function
    (element as any)._dropCleanup = () => {
      element.removeEventListener('dragenter', handleDragEnter);
      element.removeEventListener('dragover', handleDragOver);
      element.removeEventListener('dragleave', handleDragLeave);
      element.removeEventListener('drop', handleDrop);
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
   * Create drag ghost element
   */
  private static createDragGhost(element: HTMLElement, dragData: DragData): void {
    const ghost = element.cloneNode(true) as HTMLElement;
    ghost.classList.add('drag-ghost');
    ghost.style.position = 'fixed';
    ghost.style.top = '-1000px';
    ghost.style.left = '-1000px';
    ghost.style.pointerEvents = 'none';
    ghost.style.opacity = '0.8';
    ghost.style.transform = 'rotate(5deg)';
    ghost.style.zIndex = '10000';

    document.body.appendChild(ghost);
    dragState.ghostElement = ghost;
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

    // Add CSS for drag states
    if (!document.getElementById('drag-drop-styles')) {
      const styles = document.createElement('style');
      styles.id = 'drag-drop-styles';
      styles.textContent = `
        .drag-enabled .draggable-item {
          cursor: grab;
        }

        .drag-enabled .draggable-item:active {
          cursor: grabbing;
        }

        .dragging {
          opacity: 0.5;
          transform: rotate(2deg);
        }

        .drag-over {
          background: rgba(59, 130, 246, 0.1) !important;
          border: 2px dashed #3b82f6 !important;
        }

        .drag-ghost {
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        }

        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
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
