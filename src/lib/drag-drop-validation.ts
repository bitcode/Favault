// Comprehensive validation system for drag-and-drop operations
import type { DragData, DropZoneData } from './dragdrop';
import { browserAPI } from './api';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warning?: string;
  canProceed: boolean;
}

export interface ValidationContext {
  dragData: DragData;
  dropZone: DropZoneData;
  currentBookmarks?: any[];
  folderHierarchy?: Map<string, string[]>;
}

export class DragDropValidator {
  private static readonly PROTECTED_FOLDER_IDS = ['1', '2', '3'];
  private static readonly PROTECTED_FOLDER_TITLES = [
    'Bookmarks Bar',
    'Bookmarks',
    'Other Bookmarks', 
    'Mobile Bookmarks',
    'Bookmarks Menu'
  ];

  /**
   * Validate a drag-and-drop operation comprehensively
   */
  static async validateDragDrop(context: ValidationContext): Promise<ValidationResult> {
    const { dragData, dropZone } = context;

    // Basic validation checks
    const basicValidation = this.validateBasicRules(dragData, dropZone);
    if (!basicValidation.isValid) {
      return basicValidation;
    }

    // Self-drop validation
    const selfDropValidation = this.validateSelfDrop(dragData, dropZone);
    if (!selfDropValidation.isValid) {
      return selfDropValidation;
    }

    // Protected folder validation
    const protectedValidation = await this.validateProtectedFolders(dragData, dropZone);
    if (!protectedValidation.isValid) {
      return protectedValidation;
    }

    // Circular reference validation (for folders)
    if (dragData.type === 'folder') {
      const circularValidation = await this.validateCircularReference(dragData, dropZone);
      if (!circularValidation.isValid) {
        return circularValidation;
      }
    }

    // Position validation
    const positionValidation = this.validatePosition(dragData, dropZone);
    if (!positionValidation.isValid) {
      return positionValidation;
    }

    // Duplicate validation
    const duplicateValidation = await this.validateDuplicates(dragData, dropZone);
    if (!duplicateValidation.canProceed) {
      return duplicateValidation;
    }

    return {
      isValid: true,
      canProceed: true,
      warning: duplicateValidation.warning
    };
  }

  /**
   * Validate basic drag-and-drop rules
   */
  private static validateBasicRules(dragData: DragData, dropZone: DropZoneData): ValidationResult {
    // Check if drag data is valid
    if (!dragData || !dragData.id || !dragData.title) {
      return {
        isValid: false,
        canProceed: false,
        error: 'Invalid drag data'
      };
    }

    // Check if drop zone is valid
    if (!dropZone || !dropZone.targetId) {
      return {
        isValid: false,
        canProceed: false,
        error: 'Invalid drop zone'
      };
    }

    // Check type compatibility
    if (dropZone.type === 'folder' && dragData.type === 'folder') {
      // Folder-to-folder drops need special handling
      return {
        isValid: true,
        canProceed: true,
        warning: 'Moving folders requires careful consideration of hierarchy'
      };
    }

    return { isValid: true, canProceed: true };
  }

  /**
   * Validate self-drop operations
   */
  private static validateSelfDrop(dragData: DragData, dropZone: DropZoneData): ValidationResult {
    // Can't drop item on itself
    if (dragData.id === dropZone.targetId) {
      return {
        isValid: false,
        canProceed: false,
        error: 'Cannot drop item on itself'
      };
    }

    // For within-folder drops, check if it's a meaningless position change
    if (dropZone.type === 'within-folder' && 
        dragData.parentId === dropZone.parentId &&
        dragData.index !== undefined && 
        dropZone.targetIndex !== undefined) {
      
      const dragIndex = dragData.index;
      const targetIndex = dropZone.targetIndex;
      
      // If dropping at the same position or immediately adjacent
      if (Math.abs(dragIndex - targetIndex) <= 1 && dragIndex !== targetIndex) {
        return {
          isValid: false,
          canProceed: false,
          error: 'No meaningful position change'
        };
      }
    }

    return { isValid: true, canProceed: true };
  }

  /**
   * Validate operations involving protected folders
   */
  private static async validateProtectedFolders(dragData: DragData, dropZone: DropZoneData): Promise<ValidationResult> {
    try {
      // Check if dragging a protected folder
      if (this.PROTECTED_FOLDER_IDS.includes(dragData.id)) {
        return {
          isValid: false,
          canProceed: false,
          error: 'Cannot move system folders'
        };
      }

      // Check if dropping into root folder
      if (dropZone.parentId === '0' || dropZone.targetId === '0') {
        return {
          isValid: false,
          canProceed: false,
          error: 'Cannot drop items into root folder'
        };
      }

      // Get folder information to check titles
      if (dropZone.type === 'folder') {
        try {
          const [targetFolder] = await browserAPI.bookmarks.get(dropZone.targetId);
          if (targetFolder && this.PROTECTED_FOLDER_TITLES.includes(targetFolder.title)) {
            return {
              isValid: true,
              canProceed: true,
              warning: `Dropping into system folder "${targetFolder.title}"`
            };
          }
        } catch (error) {
          console.warn('Could not verify target folder protection status:', error);
        }
      }

      return { isValid: true, canProceed: true };
    } catch (error) {
      console.error('Error validating protected folders:', error);
      return {
        isValid: true,
        canProceed: true,
        warning: 'Could not verify folder protection status'
      };
    }
  }

  /**
   * Validate circular references for folder moves
   */
  private static async validateCircularReference(dragData: DragData, dropZone: DropZoneData): Promise<ValidationResult> {
    if (dragData.type !== 'folder') {
      return { isValid: true, canProceed: true };
    }

    try {
      // Get the folder hierarchy to check for circular references
      const isCircular = await this.checkCircularReference(dragData.id, dropZone.parentId || dropZone.targetId);
      
      if (isCircular) {
        return {
          isValid: false,
          canProceed: false,
          error: 'Cannot move folder into its own subfolder (circular reference)'
        };
      }

      return { isValid: true, canProceed: true };
    } catch (error) {
      console.error('Error checking circular reference:', error);
      return {
        isValid: true,
        canProceed: true,
        warning: 'Could not verify circular reference'
      };
    }
  }

  /**
   * Check if moving a folder would create a circular reference
   */
  private static async checkCircularReference(folderId: string, targetParentId: string): Promise<boolean> {
    if (!targetParentId || targetParentId === '0') {
      return false;
    }

    // Traverse up the target parent hierarchy to see if we encounter the folder being moved
    let currentParentId = targetParentId;
    const visited = new Set<string>();

    while (currentParentId && currentParentId !== '0' && !visited.has(currentParentId)) {
      visited.add(currentParentId);

      if (currentParentId === folderId) {
        return true; // Circular reference detected
      }

      try {
        const [parent] = await browserAPI.bookmarks.get(currentParentId);
        currentParentId = parent?.parentId || '0';
      } catch (error) {
        console.warn('Error traversing folder hierarchy:', error);
        break;
      }
    }

    return false;
  }

  /**
   * Validate position-related constraints
   */
  private static validatePosition(dragData: DragData, dropZone: DropZoneData): ValidationResult {
    // Validate index bounds
    if (dropZone.targetIndex !== undefined && dropZone.targetIndex < 0) {
      return {
        isValid: false,
        canProceed: false,
        error: 'Invalid target position'
      };
    }

    // For within-folder drops, ensure reasonable positioning
    if (dropZone.type === 'within-folder' && 
        dragData.parentId === dropZone.parentId &&
        dragData.index !== undefined &&
        dropZone.targetIndex !== undefined) {
      
      // This is a reorder within the same folder
      const dragIndex = dragData.index;
      const targetIndex = dropZone.targetIndex;
      
      if (dragIndex === targetIndex) {
        return {
          isValid: false,
          canProceed: false,
          error: 'Item is already at this position'
        };
      }
    }

    return { isValid: true, canProceed: true };
  }

  /**
   * Validate for potential duplicates
   */
  private static async validateDuplicates(dragData: DragData, dropZone: DropZoneData): Promise<ValidationResult> {
    if (dragData.type !== 'bookmark' || !dragData.url) {
      return { isValid: true, canProceed: true };
    }

    try {
      // Get bookmarks in the target folder
      const targetFolderId = dropZone.parentId || dropZone.targetId;
      const children = await browserAPI.bookmarks.getChildren(targetFolderId);
      
      // Check for duplicate URLs
      const duplicateUrl = children.find(child => 
        child.url === dragData.url && child.id !== dragData.id
      );

      if (duplicateUrl) {
        return {
          isValid: true,
          canProceed: true,
          warning: `A bookmark with this URL already exists in the target folder: "${duplicateUrl.title}"`
        };
      }

      // Check for duplicate titles
      const duplicateTitle = children.find(child => 
        child.title === dragData.title && child.id !== dragData.id
      );

      if (duplicateTitle) {
        return {
          isValid: true,
          canProceed: true,
          warning: `A bookmark with this title already exists in the target folder`
        };
      }

      return { isValid: true, canProceed: true };
    } catch (error) {
      console.error('Error checking for duplicates:', error);
      return {
        isValid: true,
        canProceed: true,
        warning: 'Could not check for duplicate bookmarks'
      };
    }
  }

  /**
   * Quick validation for UI feedback (non-async)
   */
  static validateQuick(dragData: DragData, dropZone: DropZoneData): ValidationResult {
    // Basic validation only
    const basicValidation = this.validateBasicRules(dragData, dropZone);
    if (!basicValidation.isValid) {
      return basicValidation;
    }

    const selfDropValidation = this.validateSelfDrop(dragData, dropZone);
    if (!selfDropValidation.isValid) {
      return selfDropValidation;
    }

    const positionValidation = this.validatePosition(dragData, dropZone);
    if (!positionValidation.isValid) {
      return positionValidation;
    }

    return { isValid: true, canProceed: true };
  }
}
