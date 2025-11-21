/**
 * Drag-and-drop specific logging utilities
 * Provides specialized logging functions for tracking drag-drop operations
 */

import Logger from './index';
import type { LogEntry, LogContext } from './types';
import { queryLogs } from './log-query-utils';

export interface DragDropLogMetadata {
  dragId?: string;
  dragType?: 'bookmark' | 'folder';
  dragTitle?: string;
  sourceId?: string;
  sourceParentId?: string;
  sourceIndex?: number;
  targetId?: string;
  targetParentId?: string;
  parentId?: string;
  dropZoneType?: string;
  position?: { x: number; y: number };
  index?: number;
  requestedIndex?: number;
  targetIndex?: number;
  beforeId?: string;
  afterId?: string;
  operation?: 'start' | 'move' | 'enter' | 'leave' | 'drop' | 'end' | 'cancel' | 'start-detail';
  success?: boolean;
  error?: string;
  duration?: number;
  sessionDuration?: number;
  handlerPath?: string;
  lastDropZoneType?: string;
  lastTargetId?: string;

  // Optional mapping between the visual insertion-point index (e.g. from a drop
  // zone) and the final index sent to / returned by the bookmarks API. This is
  // populated by BookmarkEditAPI.moveBookmark when the move was triggered via
  // drag-and-drop.
  indexMapping?: {
    bookmarkId: string;
    bookmarkTitle?: string;
    currentParentId?: string;
    currentIndex?: number;
    targetParentId?: string;
    // The index coming from the drop zone / insertion point (visual index)
    requestedIndex?: number;
    // The index actually passed to browser.bookmarks.move
    adjustedIndex?: number;
    // The index reported back by the browser after the move
    finalIndex?: number;
    // Whether the move was within the same parent (and therefore subject to
    // index shifting when moving down)
    isSameParent?: boolean;
  };
}

class DragDropLogger {
  private static activeDragSession: {
    dragId: string;
    startTime: number;
    dragData: any;
    handlerPath?: string;
    dropEventLogged: boolean;
    lastDropZone?: {
      dropZoneType?: string;
      targetId?: string;
      parentId?: string;
      targetIndex?: number;
      beforeId?: string;
      afterId?: string;
    };
  } | null = null;

  static hasActiveSession(): boolean {
    return this.activeDragSession !== null;
  }


  /**
   * Start tracking a drag operation
   */
  static startDragSession(
    dragData: any,
    handlerPath: 'standard' | 'brave' | 'fallback' = 'standard'
  ): string {
    const dragId = `drag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.activeDragSession = {
      dragId,
      startTime: Date.now(),
      dragData,
      handlerPath,
      dropEventLogged: false,
    };

    Logger.setContext('drag-drop');

    Logger.info('🚀 Drag operation started', 'drag-drop', {
      dragId,
      dragType: dragData.type,
      dragTitle: dragData.title,
      sourceId: dragData.id,
      sourceParentId: dragData.parentId,
      sourceIndex: dragData.index,
      position: dragData.startPosition,
      handlerPath,
      operation: 'start',
    } as DragDropLogMetadata);

    return dragId;
  }


  /**
   * Detailed drag-start log with optional position
   */
  static logDragStart(dragData: any, position?: { x: number; y: number }): void {
    if (!this.activeDragSession) return;

    Logger.info('🎯 Drag started', 'drag-drop', {
      dragId: this.activeDragSession.dragId,
      dragType: dragData.type,
      dragTitle: dragData.title,
      sourceId: dragData.id,
      sourceParentId: dragData.parentId,
      sourceIndex: dragData.index,
      position,
      handlerPath: this.activeDragSession.handlerPath,
      operation: 'start-detail',
    } as DragDropLogMetadata);
  }

  /**
   * Log drag movement
   */
  static logDragMove(position: { x: number; y: number }): void {
    if (!this.activeDragSession) return;

    Logger.debug('Moving dragged item', 'drag-drop', {
      dragId: this.activeDragSession.dragId,
      position,
      handlerPath: this.activeDragSession.handlerPath,
      operation: 'move',
    } as DragDropLogMetadata);
  }

  /**
   * Log entering a drop zone
   */
  static logDragEnter(dropZoneData: any): void {
    if (!this.activeDragSession) return;

    this.activeDragSession.lastDropZone = {
      dropZoneType: dropZoneData.type,
      targetId: dropZoneData.id ?? dropZoneData.targetId,
      parentId: dropZoneData.parentId,
      targetIndex: dropZoneData.targetIndex,
      beforeId: dropZoneData.beforeId,
      afterId: dropZoneData.afterId,
    };

    Logger.info('📍 Entered drop zone', 'drag-drop', {
      dragId: this.activeDragSession.dragId,
      targetId: dropZoneData.id ?? dropZoneData.targetId,
      targetParentId: dropZoneData.parentId,
      parentId: dropZoneData.parentId,
      dropZoneType: dropZoneData.type,
      targetIndex: dropZoneData.targetIndex,
      beforeId: dropZoneData.beforeId,
      afterId: dropZoneData.afterId,
      handlerPath: this.activeDragSession.handlerPath,
      operation: 'enter',
    } as DragDropLogMetadata);
  }

  /**
   * Log leaving a drop zone
   */
  static logDragLeave(dropZoneData: any): void {
    if (!this.activeDragSession) return;

    Logger.debug('Leaving drop zone', 'drag-drop', {
      dragId: this.activeDragSession.dragId,
      targetId: dropZoneData.id ?? dropZoneData.targetId,
      targetParentId: dropZoneData.parentId,
      parentId: dropZoneData.parentId,
      dropZoneType: dropZoneData.type,
      targetIndex: dropZoneData.targetIndex,
      handlerPath: this.activeDragSession.handlerPath,
      operation: 'leave',
    } as DragDropLogMetadata);
  }

  /**
   * Log successful drop
   */
  static async logDrop(dropZoneData: any, index?: number): Promise<void> {
    if (!this.activeDragSession) return;

    this.activeDragSession.dropEventLogged = true;

    const duration = Date.now() - this.activeDragSession.startTime;

    await Logger.info('✅ Drop successful', 'drag-drop', {
      dragId: this.activeDragSession.dragId,
      dragType: this.activeDragSession.dragData?.type,
      dragTitle: this.activeDragSession.dragData?.title,
      sourceId: this.activeDragSession.dragData?.id,
      sourceParentId: this.activeDragSession.dragData?.parentId,
      sourceIndex: this.activeDragSession.dragData?.index,
      targetId: dropZoneData.id ?? dropZoneData.targetId,
      targetParentId: dropZoneData.parentId,
      parentId: dropZoneData.parentId,
      dropZoneType: dropZoneData.type,
      requestedIndex: dropZoneData.targetIndex ?? index,
      targetIndex: index ?? dropZoneData.targetIndex,
      index: index ?? dropZoneData.targetIndex,
      beforeId: dropZoneData.beforeId,
      afterId: dropZoneData.afterId,
      handlerPath: this.activeDragSession.handlerPath,
      operation: 'drop',
      success: true,
      duration,
    } as DragDropLogMetadata);
  }

  /**
   * Log failed drop
   */
  static async logDropError(error: string, dropZoneData?: any): Promise<void> {
    if (!this.activeDragSession) return;

    this.activeDragSession.dropEventLogged = true;

    const duration = Date.now() - this.activeDragSession.startTime;

    await Logger.error(`❌ Drop failed: ${error}`, 'drag-drop', {
      dragId: this.activeDragSession.dragId,
      dragType: this.activeDragSession.dragData?.type,
      dragTitle: this.activeDragSession.dragData?.title,
      sourceId: this.activeDragSession.dragData?.id,
      sourceParentId: this.activeDragSession.dragData?.parentId,
      sourceIndex: this.activeDragSession.dragData?.index,
      targetId: dropZoneData?.id ?? dropZoneData?.targetId,
      targetParentId: dropZoneData?.parentId,
      parentId: dropZoneData?.parentId,
      dropZoneType: dropZoneData?.type,
      requestedIndex: dropZoneData?.targetIndex,
      targetIndex: dropZoneData?.targetIndex,
      index: dropZoneData?.targetIndex,
      beforeId: dropZoneData?.beforeId,
      afterId: dropZoneData?.afterId,
      handlerPath: this.activeDragSession.handlerPath,
      operation: 'drop',
      success: false,
      error,
      duration,
    } as DragDropLogMetadata);
  }

  /**
   * Log the mapping between insertion-point index and API index for a move
   * operation that was triggered by drag-and-drop.
   */
  static async logDropIndexMapping(mapping: NonNullable<DragDropLogMetadata['indexMapping']>): Promise<void> {
    if (!this.activeDragSession) return;

    const duration = Date.now() - this.activeDragSession.startTime;

    await Logger.info('📐 Drop index mapping', 'drag-drop', {
      dragId: this.activeDragSession.dragId,
      dragType: this.activeDragSession.dragData?.type,
      dragTitle: this.activeDragSession.dragData?.title,
      sourceId: mapping.bookmarkId,
      sourceParentId: mapping.currentParentId,
      sourceIndex: mapping.currentIndex,
      targetParentId: mapping.targetParentId,
      requestedIndex: mapping.requestedIndex,
      targetIndex: mapping.adjustedIndex,
      index: mapping.requestedIndex,
      handlerPath: this.activeDragSession.handlerPath,
      operation: 'drop',
      success: true,
      duration,
      indexMapping: mapping,
    } as DragDropLogMetadata);
  }


  /**
   * End drag session
   */
  static endDragSession(cancelled: boolean = false): void {
    if (!this.activeDragSession) return;

    const session = this.activeDragSession;
    const duration = Date.now() - session.startTime;

    // If the session ended without any drop being logged, emit a diagnostic warning
    if (!cancelled && !session.dropEventLogged) {
      Logger.warn('⚠️ Drag ended without a drop event (no drop zone at mouse-up?)', 'drag-drop', {
        dragId: session.dragId,
        handlerPath: session.handlerPath,
        lastDropZoneType: session.lastDropZone?.dropZoneType,
        lastTargetId: session.lastDropZone?.targetId,
        targetId: session.lastDropZone?.targetId,
        targetParentId: session.lastDropZone?.parentId,
        parentId: session.lastDropZone?.parentId,
        targetIndex: session.lastDropZone?.targetIndex,
        beforeId: session.lastDropZone?.beforeId,
        afterId: session.lastDropZone?.afterId,
        operation: 'end',
        sessionDuration: duration,
      } as DragDropLogMetadata);
    }

    Logger.info(cancelled ? '🚫 Drag cancelled' : '🏁 Drag ended', 'drag-drop', {
      dragId: session.dragId,
      handlerPath: session.handlerPath,
      operation: cancelled ? 'cancel' : 'end',
      duration,
      sessionDuration: duration,
    } as DragDropLogMetadata);

    this.activeDragSession = null;
    Logger.setContext(null);
  }

  /**
   * Get all drag-drop logs
   */
  static async getDragDropLogs(): Promise<LogEntry[]> {
    return queryLogs({ context: 'drag-drop' });
  }

  /**
   * Get logs for a specific drag session
   */
  static async getSessionLogs(dragId: string): Promise<LogEntry[]> {
    const allDragLogs = await this.getDragDropLogs();
    return allDragLogs.filter(log =>
      log.metadata && (log.metadata as DragDropLogMetadata).dragId === dragId
    );
  }

  /**
   * Get current active drag session info
   */
  static getActiveDragSession() {
    return this.activeDragSession;
  }

  /**
   * Export drag-drop logs to file
   */
  static async exportDragDropLogs(): Promise<void> {
    const logs = await this.getDragDropLogs();
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `favault-dragdrop-logs-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log(`✅ Exported ${logs.length} drag-drop logs`);
  }

  /**
   * Get drag-drop statistics
   */
  static async getDragDropStats(): Promise<{
    totalDrags: number;
    successfulDrops: number;
    failedDrops: number;
    cancelledDrags: number;
    averageDuration: number;
  }> {
    const logs = await this.getDragDropLogs();

    const dragStarts = logs.filter(log =>
      log.metadata && (log.metadata as DragDropLogMetadata).operation === 'start'
    );

    const successfulDrops = logs.filter(log =>
      log.metadata &&
      (log.metadata as DragDropLogMetadata).operation === 'drop' &&
      (log.metadata as DragDropLogMetadata).success === true
    );

    const failedDrops = logs.filter(log =>
      log.metadata &&
      (log.metadata as DragDropLogMetadata).operation === 'drop' &&
      (log.metadata as DragDropLogMetadata).success === false
    );

    const cancelledDrags = logs.filter(log =>
      log.metadata && (log.metadata as DragDropLogMetadata).operation === 'cancel'
    );

    const durations = logs
      .filter(log => log.metadata && (log.metadata as DragDropLogMetadata).duration)
      .map(log => (log.metadata as DragDropLogMetadata).duration!);

    const averageDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    return {
      totalDrags: dragStarts.length,
      successfulDrops: successfulDrops.length,
      failedDrops: failedDrops.length,
      cancelledDrags: cancelledDrags.length,
      averageDuration: Math.round(averageDuration),
    };
  }
}

export default DragDropLogger;

