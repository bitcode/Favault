// Brave browser-specific drag-and-drop implementation
import { DragDropManager, type DragData, type DropZoneData } from './dragdrop';

export class BraveDragDropManager extends DragDropManager {
  private static braveWorkarounds = {
    forceUserInteraction: true,
    delayedInitialization: true,
    explicitEventBinding: true,
    enhancedLogging: true
  };

  /**
   * Detect if running in Brave browser
   */
  static isBraveBrowser(): boolean {
    // Multiple detection methods for Brave
    const userAgent = navigator.userAgent;
    const braveAPI = (navigator as any).brave;
    const isBraveFunction = braveAPI && typeof braveAPI.isBrave === 'function';
    const hasBraveFeatures = 'brave' in window || userAgent.includes('Brave');

    // Call the isBrave function if it exists
    let isBraveResult = false;
    if (isBraveFunction) {
      try {
        isBraveResult = braveAPI.isBrave();
      } catch (e) {
        console.log('🦁 Error calling brave.isBrave():', e);
      }
    }

    const result = !!(isBraveResult || hasBraveFeatures || userAgent.includes('Brave'));
    console.log('🦁 Brave detection:', {
      userAgent: userAgent.includes('Brave'),
      braveAPI: !!braveAPI,
      isBraveFunction,
      isBraveResult,
      hasBraveFeatures,
      finalResult: result
    });

    return result;
  }

  /**
   * Initialize drag functionality with Brave-specific workarounds
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
    if (this.isBraveBrowser()) {
      console.log('🦁 Brave browser detected - applying workarounds for:', dragData.title);
      this.initializeBraveDraggable(element, dragData, options);
    } else {
      super.initializeDraggable(element, dragData, options);
    }
  }

  /**
   * Brave-specific drag initialization
   */
  private static initializeBraveDraggable(
    element: HTMLElement,
    dragData: DragData,
    options: {
      dragHandle?: HTMLElement;
      onDragStart?: (data: DragData) => void;
      onDragEnd?: (data: DragData) => void;
    } = {}
  ): void {
    const dragHandle = options.dragHandle || element;

    // Brave workaround: Force explicit user interaction
    let userHasInteracted = false;
    
    // Track user interaction
    const trackInteraction = () => {
      userHasInteracted = true;
      console.log('🦁 User interaction detected for:', dragData.title);
    };

    // Add interaction listeners
    element.addEventListener('mousedown', trackInteraction, { once: true });
    element.addEventListener('touchstart', trackInteraction, { once: true });

    // Brave workaround: Delayed initialization
    const initializeDrag = () => {
      console.log('🦁 Initializing Brave drag for:', dragData.title);
      
      // Set draggable attribute explicitly
      element.setAttribute('draggable', 'true');
      element.style.cursor = 'grab';
      
      // Add visual indicators
      element.classList.add('brave-draggable');
      
      // Brave-specific drag start handler
      const handleDragStart = (e: DragEvent) => {
        if (!this.isEditModeEnabled()) {
          console.log('🦁 Brave: Edit mode not enabled, preventing drag');
          e.preventDefault();
          return false;
        }

        if (!userHasInteracted) {
          console.log('🦁 Brave: No user interaction detected, preventing drag');
          e.preventDefault();
          return false;
        }

        console.log('🦁 Brave: Drag started for:', dragData.title);
        
        // Brave workaround: Set data transfer with explicit MIME type
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', JSON.stringify(dragData));
          e.dataTransfer.setData('application/json', JSON.stringify(dragData));
          e.dataTransfer.setData('application/x-favault-bookmark', JSON.stringify(dragData));
        }

        // Visual feedback
        element.classList.add('brave-dragging');
        element.style.opacity = '0.5';
        element.style.transform = 'rotate(2deg)';

        // Call original handler
        options.onDragStart?.(dragData);
        
        return true;
      };

      // Brave-specific drag end handler
      const handleDragEnd = (e: DragEvent) => {
        console.log('🦁 Brave: Drag ended for:', dragData.title);
        
        // Reset visual state
        element.classList.remove('brave-dragging');
        element.style.opacity = '';
        element.style.transform = '';
        element.style.cursor = 'grab';

        // Call original handler
        options.onDragEnd?.(dragData);
      };

      // Brave workaround: Use capture phase for events
      element.addEventListener('dragstart', handleDragStart, true);
      element.addEventListener('dragend', handleDragEnd, true);

      // Store cleanup function
      (element as any)._braveDragCleanup = () => {
        element.removeEventListener('dragstart', handleDragStart, true);
        element.removeEventListener('dragend', handleDragEnd, true);
        element.removeEventListener('mousedown', trackInteraction);
        element.removeEventListener('touchstart', trackInteraction);
        element.classList.remove('brave-draggable', 'brave-dragging');
        element.removeAttribute('draggable');
        element.style.cursor = '';
        element.style.opacity = '';
        element.style.transform = '';
      };
    };

    // Brave workaround: Delayed initialization to ensure DOM is ready
    if (this.braveWorkarounds.delayedInitialization) {
      setTimeout(initializeDrag, 100);
    } else {
      initializeDrag();
    }
  }

  /**
   * Initialize drop zone with Brave-specific workarounds
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
    if (this.isBraveBrowser()) {
      console.log('🦁 Brave browser detected - applying drop zone workarounds');
      this.initializeBraveDropZone(element, dropZoneData, options);
    } else {
      super.initializeDropZone(element, dropZoneData, options);
    }
  }

  /**
   * Brave-specific drop zone initialization
   */
  private static initializeBraveDropZone(
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

    // Brave-specific drag over handler
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }
      
      return false;
    };

    // Brave-specific drag enter handler
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      dragEnterCounter++;
      
      if (dragEnterCounter === 1) {
        console.log('🦁 Brave: Drag entered drop zone');
        element.classList.add('brave-drag-over');
        element.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
        element.style.border = '2px dashed #3b82f6';
      }
      
      return false;
    };

    // Brave-specific drag leave handler
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      dragEnterCounter--;
      
      if (dragEnterCounter === 0) {
        console.log('🦁 Brave: Drag left drop zone');
        element.classList.remove('brave-drag-over');
        element.style.backgroundColor = '';
        element.style.border = '';
      }
      
      return false;
    };

    // Brave-specific drop handler
    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      dragEnterCounter = 0;
      element.classList.remove('brave-drag-over');
      element.style.backgroundColor = '';
      element.style.border = '';

      console.log('🦁 Brave: Drop event triggered');

      // Get drag data from multiple sources
      let dragData: DragData | null = null;
      
      if (e.dataTransfer) {
        try {
          // Try multiple MIME types
          const jsonData = e.dataTransfer.getData('application/json') ||
                          e.dataTransfer.getData('application/x-favault-bookmark') ||
                          e.dataTransfer.getData('text/plain');
          
          if (jsonData) {
            dragData = JSON.parse(jsonData);
            console.log('🦁 Brave: Retrieved drag data:', dragData);
          }
        } catch (error) {
          console.error('🦁 Brave: Failed to parse drag data:', error);
        }
      }

      if (!dragData) {
        console.error('🦁 Brave: No drag data available');
        return false;
      }

      // Validate drop
      if (!acceptTypes.includes(dragData.type)) {
        console.log('🦁 Brave: Drop rejected - invalid type:', dragData.type);
        return false;
      }

      try {
        // Call custom drop handler
        const handled = await options.onDrop?.(dragData, dropZoneData);
        console.log('🦁 Brave: Drop handled:', handled);
        return handled || false;
      } catch (error) {
        console.error('🦁 Brave: Drop handler failed:', error);
        return false;
      }
    };

    // Attach event listeners with capture phase
    element.addEventListener('dragover', handleDragOver, true);
    element.addEventListener('dragenter', handleDragEnter, true);
    element.addEventListener('dragleave', handleDragLeave, true);
    element.addEventListener('drop', handleDrop, true);

    // Store cleanup function
    (element as any)._braveDropCleanup = () => {
      element.removeEventListener('dragover', handleDragOver, true);
      element.removeEventListener('dragenter', handleDragEnter, true);
      element.removeEventListener('dragleave', handleDragLeave, true);
      element.removeEventListener('drop', handleDrop, true);
      element.classList.remove('brave-drag-over');
      element.style.backgroundColor = '';
      element.style.border = '';
    };
  }

  /**
   * Cleanup with Brave-specific handling
   */
  static cleanup(element: HTMLElement): void {
    // Brave-specific cleanup
    if ((element as any)._braveDragCleanup) {
      (element as any)._braveDragCleanup();
      delete (element as any)._braveDragCleanup;
    }
    
    if ((element as any)._braveDropCleanup) {
      (element as any)._braveDropCleanup();
      delete (element as any)._braveDropCleanup;
    }

    // Call parent cleanup
    super.cleanup(element);
  }

  /**
   * Enable edit mode with Brave-specific styles
   */
  static enableEditMode(): void {
    console.log('🦁 Enabling Brave edit mode');
    super.enableEditMode();
    
    // Add Brave-specific styles
    if (!document.getElementById('brave-drag-styles')) {
      const styles = document.createElement('style');
      styles.id = 'brave-drag-styles';
      styles.textContent = `
        .brave-draggable {
          cursor: grab !important;
          user-select: none;
        }
        
        .brave-draggable:active {
          cursor: grabbing !important;
        }
        
        .brave-dragging {
          opacity: 0.5 !important;
          transform: rotate(2deg) !important;
          z-index: 1000 !important;
        }
        
        .brave-drag-over {
          background-color: rgba(59, 130, 246, 0.1) !important;
          border: 2px dashed #3b82f6 !important;
          transform: scale(1.02) !important;
        }
      `;
      document.head.appendChild(styles);
    }
  }
}
