import { Page, Locator } from '@playwright/test';

/**
 * Drag and drop testing utilities for FaVault extension
 * Provides methods to test drag-drop functionality, reordering, and visual feedback
 */
export class DragDropTestUtils {
  constructor(private page: Page) {}

  /**
   * Perform drag and drop operation between two elements
   */
  async dragAndDrop(source: Locator, target: Locator, options?: {
    force?: boolean;
    trial?: boolean;
    timeout?: number;
  }): Promise<void> {
    // Get bounding boxes for both elements
    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();
    
    if (!sourceBox || !targetBox) {
      throw new Error('Source or target element not found or not visible');
    }

    // Calculate center points
    const sourceCenter = {
      x: sourceBox.x + sourceBox.width / 2,
      y: sourceBox.y + sourceBox.height / 2
    };
    
    const targetCenter = {
      x: targetBox.x + targetBox.width / 2,
      y: targetBox.y + targetBox.height / 2
    };

    // Perform drag and drop
    await this.page.mouse.move(sourceCenter.x, sourceCenter.y);
    await this.page.mouse.down();
    
    // Move to target with intermediate steps for better simulation
    const steps = 5;
    for (let i = 1; i <= steps; i++) {
      const x = sourceCenter.x + (targetCenter.x - sourceCenter.x) * (i / steps);
      const y = sourceCenter.y + (targetCenter.y - sourceCenter.y) * (i / steps);
      await this.page.mouse.move(x, y);
      await this.page.waitForTimeout(50);
    }
    
    await this.page.mouse.up();
    
    // Wait for any animations or updates
    await this.page.waitForTimeout(1000);
  }

  /**
   * Drag folder to reorder position
   */
  async dragFolderToPosition(folderTitle: string, targetPosition: number): Promise<void> {
    const folders = await this.page.locator('.folder-container, [data-testid="bookmark-folder"]').all();
    
    if (targetPosition >= folders.length) {
      throw new Error(`Target position ${targetPosition} is out of range (max: ${folders.length - 1})`);
    }

    const sourceFolder = this.page.locator('.folder-container, [data-testid="bookmark-folder"]')
      .filter({ hasText: folderTitle });
    
    const targetFolder = folders[targetPosition];
    
    await this.dragAndDrop(sourceFolder, targetFolder);
  }

  /**
   * Drag bookmark into a folder
   */
  async dragBookmarkToFolder(bookmarkTitle: string, folderTitle: string): Promise<void> {
    const bookmark = this.page.locator('.bookmark-item, [data-testid="bookmark-item"]')
      .filter({ hasText: bookmarkTitle });
    
    const folder = this.page.locator('.folder-container, [data-testid="bookmark-folder"]')
      .filter({ hasText: folderTitle });
    
    await this.dragAndDrop(bookmark, folder);
  }

  /**
   * Simulate HTML5 drag and drop events
   */
  async simulateHtml5DragDrop(source: Locator, target: Locator, dragData?: any): Promise<void> {
    // Inject drag and drop simulation script
    await this.page.addInitScript(() => {
      (window as any).simulateDragDrop = function(sourceSelector: string, targetSelector: string, data: any) {
        const source = document.querySelector(sourceSelector);
        const target = document.querySelector(targetSelector);
        
        if (!source || !target) {
          throw new Error('Source or target element not found');
        }

        // Create drag events
        const dragStartEvent = new DragEvent('dragstart', {
          bubbles: true,
          cancelable: true,
          dataTransfer: new DataTransfer()
        });
        
        const dragOverEvent = new DragEvent('dragover', {
          bubbles: true,
          cancelable: true,
          dataTransfer: dragStartEvent.dataTransfer
        });
        
        const dropEvent = new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer: dragStartEvent.dataTransfer
        });
        
        const dragEndEvent = new DragEvent('dragend', {
          bubbles: true,
          cancelable: true,
          dataTransfer: dragStartEvent.dataTransfer
        });

        // Set drag data if provided
        if (data && dragStartEvent.dataTransfer) {
          dragStartEvent.dataTransfer.setData('application/json', JSON.stringify(data));
          dragStartEvent.dataTransfer.setData('text/plain', JSON.stringify(data));
        }

        // Dispatch events in sequence
        source.dispatchEvent(dragStartEvent);
        target.dispatchEvent(dragOverEvent);
        target.dispatchEvent(dropEvent);
        source.dispatchEvent(dragEndEvent);
      };
    });

    // Get selectors for the elements
    const sourceSelector = await this.getElementSelector(source);
    const targetSelector = await this.getElementSelector(target);

    // Execute the simulation
    await this.page.evaluate(({ sourceSelector, targetSelector, dragData }) => {
      (window as any).simulateDragDrop(sourceSelector, targetSelector, dragData);
    }, { sourceSelector, targetSelector, dragData });

    // Wait for any updates
    await this.page.waitForTimeout(1000);
  }

  /**
   * Verify drag and drop visual feedback
   */
  async verifyDragFeedback(source: Locator): Promise<{
    isDragging: boolean;
    hasGhostImage: boolean;
    hasDropZones: boolean;
  }> {
    // Start dragging
    await source.hover();
    await this.page.mouse.down();
    await this.page.waitForTimeout(100);

    // Check for drag feedback
    const isDragging = await this.page.locator('.dragging, [data-dragging="true"]').count() > 0;
    const hasGhostImage = await this.page.locator('.drag-ghost, .drag-preview').count() > 0;
    const hasDropZones = await this.page.locator('.drop-zone, .drop-target, [data-drop-zone="true"]').count() > 0;

    // End dragging
    await this.page.mouse.up();

    return {
      isDragging,
      hasGhostImage,
      hasDropZones
    };
  }

  /**
   * Test folder reordering with validation
   */
  async testFolderReorder(fromIndex: number, toIndex: number): Promise<{
    success: boolean;
    originalOrder: string[];
    newOrder: string[];
    error?: string;
  }> {
    try {
      // Get original order
      const originalOrder = await this.getFolderOrder();
      
      if (fromIndex >= originalOrder.length || toIndex >= originalOrder.length) {
        throw new Error(`Invalid indices: from=${fromIndex}, to=${toIndex}, max=${originalOrder.length - 1}`);
      }

      // Perform drag and drop
      const folders = await this.page.locator('.folder-container, [data-testid="bookmark-folder"]').all();
      await this.dragAndDrop(folders[fromIndex], folders[toIndex]);

      // Wait for reorder to complete
      await this.page.waitForTimeout(2000);

      // Get new order
      const newOrder = await this.getFolderOrder();

      return {
        success: true,
        originalOrder,
        newOrder
      };
    } catch (error) {
      return {
        success: false,
        originalOrder: [],
        newOrder: [],
        error: error.message
      };
    }
  }

  /**
   * Get current folder order
   */
  async getFolderOrder(): Promise<string[]> {
    const folders = await this.page.locator('.folder-container, [data-testid="bookmark-folder"]').all();
    const titles: string[] = [];
    
    for (const folder of folders) {
      const titleElement = folder.locator('.folder-title, h3, .folder-name, [data-testid="folder-title"]').first();
      const title = await titleElement.textContent();
      if (title) {
        titles.push(title.trim());
      }
    }
    
    return titles;
  }

  /**
   * Check if element is draggable
   */
  async isDraggable(element: Locator): Promise<boolean> {
    // Wait a bit for the enhanced drag-drop system to set attributes
    await this.page.waitForTimeout(500);

    // Check multiple ways the element might be marked as draggable
    const draggableAttr = await element.getAttribute('draggable');
    const draggableProperty = await element.evaluate((el: HTMLElement) => el.draggable);
    const hasDraggableClass = await element.locator('.draggable-item, .draggable-folder').count() > 0;

    console.log(`🔍 Draggable check: attr="${draggableAttr}", property=${draggableProperty}, hasClass=${hasDraggableClass}`);

    return draggableAttr === 'true' || draggableProperty === true || hasDraggableClass;
  }

  /**
   * Check if element is a valid drop target
   */
  async isDropTarget(element: Locator): Promise<boolean> {
    // Check for drop zone indicators
    const hasDropZoneClass = await element.locator('.drop-zone, .drop-target').count() > 0;
    const hasDropZoneAttr = await element.getAttribute('data-drop-zone') === 'true';
    
    return hasDropZoneClass || hasDropZoneAttr;
  }

  /**
   * Wait for drag and drop operation to complete
   */
  async waitForDragDropComplete(timeout = 5000): Promise<void> {
    // Wait for drag indicators to disappear
    await this.page.waitForFunction(() => {
      const draggingElements = document.querySelectorAll('.dragging, [data-dragging="true"]');
      const dropZones = document.querySelectorAll('.drop-zone-active, [data-drop-active="true"]');
      return draggingElements.length === 0 && dropZones.length === 0;
    }, { timeout });
  }

  /**
   * Get element selector for use in page.evaluate
   */
  private async getElementSelector(element: Locator): Promise<string> {
    // Try to get a unique selector
    const id = await element.getAttribute('id');
    if (id) return `#${id}`;
    
    const className = await element.getAttribute('class');
    if (className) {
      const classes = className.split(' ').filter(c => c.trim());
      if (classes.length > 0) {
        return `.${classes[0]}`;
      }
    }
    
    const testId = await element.getAttribute('data-testid');
    if (testId) return `[data-testid="${testId}"]`;
    
    // Fallback to tag name
    const tagName = await element.evaluate(el => el.tagName.toLowerCase());
    return tagName;
  }

  /**
   * Verify protected folder cannot be dragged
   */
  async verifyProtectedFolderNotDraggable(folderTitle: string): Promise<boolean> {
    const folder = this.page.locator('.folder-container, [data-testid="bookmark-folder"]')
      .filter({ hasText: folderTitle });
    
    // Check if folder has protected indicators
    const protectedIcon = folder.locator('🔒, .protected-icon, [data-protected="true"]');
    const hasProtectedIcon = await protectedIcon.count() > 0;
    
    if (!hasProtectedIcon) {
      return false; // Not a protected folder
    }
    
    // Try to drag the protected folder
    const originalOrder = await this.getFolderOrder();
    
    try {
      const folders = await this.page.locator('.folder-container, [data-testid="bookmark-folder"]').all();
      if (folders.length > 1) {
        await this.dragAndDrop(folder, folders[1]);
        await this.page.waitForTimeout(1000);
      }
    } catch (error) {
      // Expected to fail
    }
    
    const newOrder = await this.getFolderOrder();
    
    // Verify order hasn't changed
    return JSON.stringify(originalOrder) === JSON.stringify(newOrder);
  }
}
