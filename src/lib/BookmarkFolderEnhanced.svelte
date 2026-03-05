<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import BookmarkItem from "./BookmarkItem.svelte";
  import BookmarkInsertionPoint from "./BookmarkInsertionPoint.svelte";
  import type { BookmarkFolder } from "./api";
  import { EnhancedDragDropManager } from "./dragdrop-enhanced";
  import { editMode, bookmarkFolders } from "./stores";
  import {
    initFolderExpansionState,
    getFolderExpanded,
    setFolderExpanded,
  } from "./folder-state";
  import { DragDropManager } from "./dragdrop";
  import { BraveDragDropManager } from "./dragdrop-brave";
  import { BookmarkEditAPI } from "./api";
  import { BookmarkManager } from "./bookmarks";

  export let folder: BookmarkFolder;
  export let isVisible = true;

  // Grid Drag & Drop State
  let draggingBookmarkId: string | null = null;
  let dropTargetIndex: number | null = null;
  let dropPosition: "left" | "right" | null = null;

  function onGridDragStart(e: DragEvent, bookmark: any, index: number) {
    if (!isEditMode) {
      e.preventDefault();
      return;
    }
    draggingBookmarkId = bookmark.id;

    // Set drag data
    const dragData = {
      type: "bookmark",
      id: bookmark.id,
      title: bookmark.title,
      parentId: folder.id,
      index: index,
      url: bookmark.url,
    };

    e.dataTransfer!.setData("application/json", JSON.stringify(dragData));
    e.dataTransfer!.setData(
      "application/x-favault-bookmark",
      JSON.stringify(dragData),
    );
    e.dataTransfer!.effectAllowed = "move";

    // Custom drag image could go here
  }

  function onGridDragOver(e: DragEvent, index: number) {
    // Check if we are dragging a bookmark (either internal or external)
    const hasBookmarkData =
      e.dataTransfer?.types.includes("application/x-favault-bookmark") ||
      !!draggingBookmarkId;

    if (!hasBookmarkData) return;

    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";

    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;

    // Determine if we are on the left or right half
    const isRight = offsetX > rect.width / 2;

    const newDropPosition = isRight ? "right" : "left";

    // Log drag over sparingly if needed, or just update state
    if (dropTargetIndex !== index || dropPosition !== newDropPosition) {
      dropTargetIndex = index;
      dropPosition = newDropPosition;
    }
  }

  function onGridDragLeave(e: DragEvent) {
    // Optional: Logic to clear drop target if leaving the grid entirely
  }

  async function onGridDrop(e: DragEvent, index: number) {
    e.preventDefault();
    e.stopPropagation(); // Stop bubbling to container/folder handlers

    if (dropTargetIndex === null || !dropPosition) return;

    let bookmarkId = draggingBookmarkId;

    // If not local drag, try to get from dataTransfer
    if (!bookmarkId) {
      try {
        const data = e.dataTransfer?.getData("application/x-favault-bookmark");
        if (data) {
          const parsed = JSON.parse(data);
          bookmarkId = parsed.id;
        }
      } catch (err) {
        console.error("Failed to parse drag data", err);
      }
    }

    if (!bookmarkId) return;

    // Calculate insertion index
    let targetIndex = index + (dropPosition === "right" ? 1 : 0);

    console.log(
      `Grid Drop: Moving ${bookmarkId} to index ${targetIndex} in folder ${folder.id}`,
    );

    // Grab source parent from drag payload for optimistic move
    let fromParentId: string | null = null;
    try {
      const raw = e.dataTransfer?.getData("application/x-favault-bookmark");
      if (raw) fromParentId = JSON.parse(raw).parentId ?? null;
    } catch {}

    try {
      const result = await BookmarkEditAPI.moveBookmark(bookmarkId, {
        parentId: folder.id,
        index: targetIndex,
      });
      if (result.success) {
        // Instant optimistic update — no full re-render
        optimisticMove(bookmarkId, fromParentId, folder.id, targetIndex);
        // Reconcile silently in background after 1.5 s
        scheduleSilentSync();
      } else {
        console.error("Move failed:", result.error);
      }
    } catch (err) {
      console.error("Grid drop failed", err);
    }

    // Reset state
    draggingBookmarkId = null;
    dropTargetIndex = null;
    dropPosition = null;
  }

  let isExpanded = true;
  let folderElement: HTMLElement;
  let folderHeader: HTMLElement;
  let bookmarksGridEl: HTMLElement;
  let isEditMode = false;
  let isRenaming = false;
  let newFolderName = "";

  // Subscribe to edit mode changes
  const unsubscribeEditMode = editMode.subscribe((value) => {
    isEditMode = value;
    console.log(
      "Enhanced edit mode changed to:",
      value,
      "for folder:",
      folder.title,
    );

    // Update drag-drop state when edit mode changes
    setTimeout(() => {
      updateEnhancedDragDropState();
    }, 50);
  });

  // Reactive statement to update drag-drop when edit mode changes
  $: if (folderElement && typeof isEditMode !== "undefined") {
    setTimeout(() => {
      updateEnhancedDragDropState();
    }, 50);
  }

  // Initialize expansion state from storage
  onMount(async () => {
    await initFolderExpansionState();
    isExpanded = getFolderExpanded(folder.id, true);
  });

  // Toggle folder expansion
  function toggleExpanded() {
    isExpanded = !isExpanded;
    setFolderExpanded(folder.id, isExpanded);
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
    newFolderName = "";
  }

  // Save folder name via Chrome Bookmarks API
  async function saveFolderName() {
    if (!newFolderName.trim()) {
      cancelRenaming();
      return;
    }

    const trimmedName = newFolderName.trim();
    try {
      const result = await BookmarkEditAPI.updateBookmark(folder.id, {
        title: trimmedName,
      });
      if (result.success) {
        folder.title = trimmedName;
        BookmarkManager.clearCache();
        await refreshBookmarks();
      } else {
        console.error("Failed to rename folder:", result.error);
      }
    } catch (error) {
      console.error("Failed to rename folder:", error);
    } finally {
      isRenaming = false;
      newFolderName = "";
    }
  }

  // Delete folder (and all its contents) via Chrome Bookmarks API
  async function deleteFolder() {
    const confirmed = window.confirm(
      `Delete folder "${folder.title}" and all ${folder.bookmarks.length} bookmark(s) inside? This cannot be undone.`,
    );
    if (!confirmed) return;

    try {
      const result = await BookmarkEditAPI.removeBookmarkTree(folder.id);
      if (result.success) {
        BookmarkManager.clearCache();
        await refreshBookmarks();
      } else {
        console.error("Failed to delete folder:", result.error);
        alert(`Could not delete folder: ${result.error}`);
      }
    } catch (error) {
      console.error("Failed to delete folder:", error);
    }
  }

  // Handle rename key events
  function handleRenameKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      saveFolderName();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelRenaming();
    }
  }

  // Minimal native HTML5 DnD handlers to satisfy tests' expectations on dragenter/over/drop
  function getBookmarkDragPayload(e: DragEvent): any | null {
    try {
      const dt = e.dataTransfer;
      let raw = (
        dt?.getData("application/json") ||
        dt?.getData("application/x-favault-bookmark") ||
        dt?.getData("text/plain") ||
        ""
      ).trim();
      let payload: any = null;
      if (raw) {
        try {
          payload = JSON.parse(raw);
        } catch {}
      }
      const gc =
        typeof window !== "undefined"
          ? (window as any).__fav_dragCandidate
          : null;
      // Only accept explicit bookmark payloads; ignore folder payloads entirely
      if (payload && payload.id && payload.type === "bookmark") return payload;
      if (gc && gc.id) return { id: gc.id, parentId: gc.parentId || null };
    } catch {}
    return null;
  }

  // Debounce drop zone state changes to prevent flickering
  let dropZoneTimeout: number | null = null;
  let currentDropState = false;

  // Silent background sync: reconcile store with Chrome after a short delay without
  // triggering a jarring full re-render. Only one pending sync runs at a time.
  let silentSyncTimer: number | null = null;
  function scheduleSilentSync(delayMs = 1500) {
    if (silentSyncTimer) clearTimeout(silentSyncTimer);
    silentSyncTimer = window.setTimeout(async () => {
      silentSyncTimer = null;
      await refreshBookmarks();
    }, delayMs);
  }

  function markDropActive(el: HTMLElement, active: boolean) {
    if (!el) return;

    // Clear any pending timeout
    if (dropZoneTimeout) {
      clearTimeout(dropZoneTimeout);
      dropZoneTimeout = null;
    }

    // If we're already in the desired state, don't change anything
    if (currentDropState === active) return;

    if (active) {
      // Immediately activate drop zone
      currentDropState = true;
      el.classList.add("drop-zone-active", "drop-target");
      el.setAttribute("data-drop-active", "true");
    } else {
      // Debounce deactivation to prevent rapid flickering
      dropZoneTimeout = setTimeout(() => {
        currentDropState = false;
        el.classList.remove("drop-zone-active", "drop-target");
        el.removeAttribute("data-drop-active");
        dropZoneTimeout = null;
      }, 50); // 50ms debounce delay
    }
  }

  // Optimistic UI update to reflect moves immediately
  function optimisticMove(
    bookmarkId: string,
    fromParentId: string | null,
    toParentId: string,
    toIndex?: number,
  ) {
    try {
      bookmarkFolders.update((folders) => {
        // Shallow clone to avoid mutating original objects in place
        const copy = folders.map((f) => ({
          ...f,
          bookmarks: Array.isArray(f.bookmarks) ? [...f.bookmarks] : [],
        }));
        let moved: any = null;

        // Prefer removing from provided source, but fall back to scanning all folders
        if (fromParentId) {
          const src = copy.find((f) => f.id === fromParentId);
          if (src) {
            const idx = src.bookmarks.findIndex(
              (b: any) => b.id === bookmarkId,
            );
            if (idx >= 0) moved = src.bookmarks.splice(idx, 1)[0];
          }
        }
        if (!moved) {
          for (const f of copy) {
            const idx = f.bookmarks.findIndex((b: any) => b.id === bookmarkId);
            if (idx >= 0) {
              moved = f.bookmarks.splice(idx, 1)[0];
              break;
            }
          }
        }

        // Insert into target
        const tgt = copy.find((f) => f.id === toParentId);
        if (tgt && moved) {
          if (typeof toIndex === "number" && toIndex >= 0) {
            const ins = Math.min(toIndex, tgt.bookmarks.length);
            tgt.bookmarks.splice(ins, 0, moved);
          } else {
            tgt.bookmarks.push(moved);
          }
        }
        return copy;
      });
    } catch (err) {
      console.warn("Optimistic move failed:", err);
    }
  }

  // Header drag enter counter
  let headerDragEnterCount = 0;

  function onHeaderDragEnter(e: DragEvent) {
    const payload = getBookmarkDragPayload(e);
    if (payload) {
      e.preventDefault();
      headerDragEnterCount++;

      // Only activate on first enter
      if (headerDragEnterCount === 1) {
        markDropActive(folderHeader as HTMLElement, true);
      }
    }
  }
  function onHeaderDragOver(e: DragEvent) {
    const payload = getBookmarkDragPayload(e);
    if (payload) {
      e.preventDefault();
      (e.dataTransfer as DataTransfer).dropEffect = "move";
      // Don't call markDropActive here to avoid redundant calls
    }
  }
  async function onHeaderDrop(e: DragEvent) {
    const payload = getBookmarkDragPayload(e);
    if (payload) {
      e.preventDefault();
      try {
        console.log(
          "🟦 HEADER DROP: Processing bookmark drop on folder header",
        );
        console.log("🟦 DEBUG: Drop parameters:", {
          bookmarkId: payload.id,
          targetFolderId: folder.id,
          targetIndex: 0,
          folderTitle: folder.title,
          bookmarkParentId: payload.parentId,
        });

        // Perform move to beginning of folder when dropping on header
        const result = await BookmarkEditAPI.moveBookmark(payload.id, {
          parentId: folder.id,
          index: 0,
        });

        console.log("🟦 DEBUG: Header drop API result:", result);

        if (result.success) {
          // Instant optimistic update — no full re-render
          optimisticMove(payload.id, payload.parentId || null, folder.id, 0);
          // Reconcile silently in background after 1.5 s
          scheduleSilentSync();
        } else {
          console.error(
            "🟦 ❌ FAILED: Failed to move bookmark via native header drop:",
            result.error,
          );
        }
      } catch (err) {
        console.error(
          "🟦 🚨 ERROR: Error during native header drop move:",
          err,
        );
      } finally {
        markDropActive(folderHeader as HTMLElement, false);
      }
    }
  }
  function getDraggingBookmarkInfo(): {
    id: string | null;
    parentId: string | null;
  } {
    // Prefer global candidate
    const gc =
      typeof window !== "undefined"
        ? (window as any).__fav_dragCandidate
        : null;
    if (gc && gc.id) return { id: gc.id, parentId: gc.parentId || null };
    // Fallback: find element marked as dragging
    const el = document.querySelector(
      '.bookmark-item.dragging, [data-dragging="true"]',
    ) as HTMLElement | null;
    if (el) {
      const id =
        el.getAttribute("data-id") || el.getAttribute("data-bookmark-id");
      const parent = el.closest(".folder-container") as HTMLElement | null;
      const parentId = parent?.getAttribute("data-folder-id") || null;
      return { id: id || null, parentId };
    }
    return { id: null, parentId: null };
  }

  // Mouse-based fallback: if a drag candidate exists, treat mouseup on header as drop-at-beginning
  async function onHeaderMouseUp(_e: MouseEvent) {
    // Only act if a real drag (mouse moved while held) actually occurred
    if (!(window as any).__fav_isDragging) {
      if (typeof window !== "undefined")
        (window as any).__fav_dragCandidate = null;
      return;
    }
    try {
      const info = getDraggingBookmarkInfo();
      console.log(
        "[DnD Debug] Header mouseup triggered for folder",
        folder.title,
      );
      console.log("[DnD Debug] Dragging info:", info);
      console.log("[DnD Debug] Target folder details:", {
        folderId: folder.id,
        folderTitle: folder.title,
        destFolderId: folder.id, // This should be the destination
        targetIndex: 0,
      });

      if (info.id) {
        if (info.parentId !== folder.id) {
          console.log("[DnD Debug] Executing bookmark move:", {
            bookmarkId: info.id,
            fromParentId: info.parentId,
            toParentId: folder.id,
            targetIndex: 0,
            destFolderId: folder.id, // CRITICAL: This ensures destFolderId is not empty
          });

          const result = await BookmarkEditAPI.moveBookmark(info.id, {
            parentId: folder.id,
            index: 0,
          });
          if (result.success) {
            // Instant optimistic update — no full re-render
            optimisticMove(info.id, info.parentId, folder.id, 0);
            // Reconcile silently in background after 1.5 s
            scheduleSilentSync();
          } else {
            console.error("[DnD Debug] Failed to move bookmark:", result.error);
          }
        } else {
          console.log(
            "[DnD Debug] Source and destination are the same, skipping move",
          );
        }
      } else {
        console.warn("[DnD Debug] No dragging bookmark info available");
      }
    } catch (err) {
      console.error("[DnD Debug] Error during manual move:", err);
    } finally {
      if (typeof window !== "undefined") {
        (window as any).__fav_dragCandidate = null;
        (window as any).__fav_isDragging = false;
      }
      markDropActive(folderHeader as HTMLElement, false);
    }
  }
  function onHeaderDragLeave(e: DragEvent) {
    // Only decrement if we have a valid payload
    const payload = getBookmarkDragPayload(e);
    if (payload) {
      headerDragEnterCount--;

      // Only deactivate when all drag operations have left
      if (headerDragEnterCount <= 0) {
        headerDragEnterCount = 0; // Ensure it doesn't go negative
        markDropActive(folderHeader as HTMLElement, false);
      }
    }
  }

  // Drag enter counter to handle nested elements properly
  let containerDragEnterCount = 0;

  function onContainerDragEnter(e: DragEvent) {
    const payload = getBookmarkDragPayload(e);
    if (payload) {
      e.preventDefault();
      containerDragEnterCount++;

      // Only activate on first enter
      if (containerDragEnterCount === 1) {
        markDropActive(folderElement as HTMLElement, true);
      }
    }
  }
  function onContainerDragOver(e: DragEvent) {
    const payload = getBookmarkDragPayload(e);
    if (payload) {
      e.preventDefault();
      (e.dataTransfer as DataTransfer).dropEffect = "move";
      // Don't call markDropActive here to avoid redundant calls
    }
  }
  async function onContainerDrop(e: DragEvent) {
    const payload = getBookmarkDragPayload(e);
    if (payload) {
      e.preventDefault();
      try {
        console.log(
          "🟨 CONTAINER DROP: Processing bookmark drop on folder container",
        );
        // Append to end by default when dropping on container
        const appendIndex = Array.isArray(folder.bookmarks)
          ? folder.bookmarks.length
          : undefined;

        console.log("🟨 DEBUG: Container drop parameters:", {
          bookmarkId: payload.id,
          targetFolderId: folder.id,
          appendIndex: appendIndex,
          folderTitle: folder.title,
          folderBookmarkCount: folder.bookmarks.length,
          bookmarkParentId: payload.parentId,
        });

        const result = await BookmarkEditAPI.moveBookmark(payload.id, {
          parentId: folder.id,
          index: appendIndex,
        });

        console.log("🟨 DEBUG: Container drop API result:", result);

        if (result.success) {
          // Instant optimistic update — no full re-render
          optimisticMove(
            payload.id,
            payload.parentId || null,
            folder.id,
            appendIndex,
          );
          // Reconcile silently in background after 1.5 s
          scheduleSilentSync();
        } else {
          console.error(
            "🟨 ❌ FAILED: Failed to move bookmark via native container drop:",
            result.error,
          );
        }
      } catch (err) {
        console.error(
          "🟨 🚨 ERROR: Error during native container drop move:",
          err,
        );
      } finally {
        markDropActive(folderElement as HTMLElement, false);
      }
    }
  }
  // Mouse-based fallback: if a drag candidate exists, treat mouseup on container as drop-append
  async function onContainerMouseUp(_e: MouseEvent) {
    // Only act if a real drag (mouse moved while held) actually occurred
    if (!(window as any).__fav_isDragging) {
      if (typeof window !== "undefined")
        (window as any).__fav_dragCandidate = null;
      return;
    }
    try {
      const info = getDraggingBookmarkInfo();
      console.log(
        "[DnD Debug] Container mouseup triggered for folder",
        folder.title,
      );
      console.log("[DnD Debug] Dragging info:", info);

      const appendIndex = Array.isArray(folder.bookmarks)
        ? folder.bookmarks.length
        : undefined;
      console.log("[DnD Debug] Container drop target details:", {
        folderId: folder.id,
        folderTitle: folder.title,
        destFolderId: folder.id, // This should be the destination
        targetIndex: appendIndex,
        appendToEnd: true,
      });

      if (info.id) {
        if (info.parentId !== folder.id) {
          console.log("[DnD Debug] Executing container bookmark move:", {
            bookmarkId: info.id,
            fromParentId: info.parentId,
            toParentId: folder.id,
            targetIndex: appendIndex,
            destFolderId: folder.id, // CRITICAL: This ensures destFolderId is not empty
          });

          const result = await BookmarkEditAPI.moveBookmark(info.id, {
            parentId: folder.id,
            index: appendIndex,
          });
          if (result.success) {
            // Instant optimistic update — no full re-render
            optimisticMove(info.id, info.parentId, folder.id, appendIndex);
            // Reconcile silently in background after 1.5 s
            scheduleSilentSync();
          } else {
            console.error("[DnD Debug] Failed to move bookmark:", result.error);
          }
        } else {
          console.log(
            "[DnD Debug] Source and destination are the same, skipping move",
          );
        }
      } else {
        console.warn("[DnD Debug] No dragging bookmark info available");
      }
    } catch (err) {
      console.error("[DnD Debug] Error during manual move:", err);
    } finally {
      if (typeof window !== "undefined") {
        (window as any).__fav_dragCandidate = null;
        (window as any).__fav_isDragging = false;
      }
      markDropActive(folderElement as HTMLElement, false);
    }
  }
  function onContainerDragLeave(e: DragEvent) {
    // Only decrement if we have a valid payload
    const payload = getBookmarkDragPayload(e);
    if (payload) {
      containerDragEnterCount--;

      // Only deactivate when all drag operations have left
      if (containerDragEnterCount <= 0) {
        containerDragEnterCount = 0; // Ensure it doesn't go negative
        markDropActive(folderElement as HTMLElement, false);
      }
    }
  }

  // Retry tracking for updateEnhancedDragDropState
  let dragDropRetryCount = 0;
  const MAX_DRAGDROP_RETRIES = 10; // Maximum 10 retries (1 second total)
  let dragDropRetryTimeout: number | null = null;

  // Update enhanced drag and drop state with retry logic
  function updateEnhancedDragDropState() {
    // No setup needed when not in edit mode — skip silently to avoid noisy retries at page load
    if (!isEditMode) return;

    // Clear any existing retry timeout
    if (dragDropRetryTimeout) {
      clearTimeout(dragDropRetryTimeout);
      dragDropRetryTimeout = null;
    }

    if (!folderElement) {
      if (dragDropRetryCount < MAX_DRAGDROP_RETRIES) {
        dragDropRetryCount++;
        console.log(
          "Folder element not available yet for:",
          folder.title,
          `- scheduling retry ${dragDropRetryCount}/${MAX_DRAGDROP_RETRIES}...`,
        );

        // Retry after a short delay to allow DOM to be ready
        dragDropRetryTimeout = setTimeout(() => {
          updateEnhancedDragDropState();
        }, 100);
      } else {
        console.warn(
          "Max retries reached for folder element:",
          folder.title,
          "- giving up on drag-drop setup",
        );
        dragDropRetryCount = 0; // Reset for potential future attempts
      }
      return;
    }

    // Reset retry count on successful element access
    dragDropRetryCount = 0;

    if (isEditMode) {
      console.log("Enabling enhanced drag-drop for folder:", folder.title);

      // Initialize the enhanced system if not already done
      if (!EnhancedDragDropManager.isEditModeEnabled()) {
        EnhancedDragDropManager.enableEditMode().catch((error) => {
          console.error("Failed to enable enhanced edit mode:", error);
        });
      }

      // Force folder setup after element is available
      setTimeout(() => {
        if (folderElement && EnhancedDragDropManager.isEditModeEnabled()) {
          console.log("🦁 Forcing folder setup for:", folder.title);
          EnhancedDragDropManager.setupFolderDragDrop();
          // Also ensure this folder acts as a drop target for bookmarks (inter-folder move)
          setupFolderDropZones();
        }
      }, 200);
    } else {
      console.log("Disabling enhanced drag-drop for folder:", folder.title);
      EnhancedDragDropManager.disableEditMode();
    }
  }

  // Ensure this folder (header and container) accepts bookmark drops for inter-folder moves
  function setupFolderDropZones() {
    if (!folderElement) return;

    const DragManager = BraveDragDropManager.isBraveBrowser()
      ? BraveDragDropManager
      : DragDropManager;

    // Prevent double-initialization
    const markInitialized = (el: HTMLElement) =>
      el.setAttribute("data-drop-initialized", "true");
    const isInitialized = (el: HTMLElement | null | undefined) =>
      !!(el && el.getAttribute("data-drop-initialized"));

    // Header drop: insert at beginning (index 0)
    if (folderHeader && !isInitialized(folderHeader)) {
      DragManager.initializeDropZone(
        folderHeader as HTMLElement,
        { type: "folder", targetId: folder.id, targetIndex: 0 },
        {
          acceptTypes: ["bookmark"],
          onDragEnter: () => {
            console.log(
              "📥 Drag enter on folder header:",
              folder.title,
              folder.id,
            );
            folderHeader.classList.add("drop-zone-active", "drop-target");
            (folderHeader as HTMLElement).setAttribute(
              "data-drop-active",
              "true",
            );
          },
          onDragLeave: () => {
            console.log(
              "📤 Drag leave on folder header:",
              folder.title,
              folder.id,
            );
            folderHeader.classList.remove("drop-zone-active", "drop-target");
            (folderHeader as HTMLElement).removeAttribute("data-drop-active");
          },
          onDrop: async (dragData) => {
            console.log(
              "✅ Drop on folder header:",
              folder.title,
              folder.id,
              "dragData:",
              dragData,
            );
            try {
              console.log(
                "🟣 ENHANCED HEADER DROP: Processing bookmark drop via enhanced system",
              );
              console.log("🟣 DEBUG: Enhanced header drop parameters:", {
                bookmarkId: dragData.id,
                targetFolderId: folder.id,
                targetIndex: 0,
                folderTitle: folder.title,
                dragDataTitle: dragData.title,
              });

              const result = await BookmarkEditAPI.moveBookmark(dragData.id, {
                parentId: folder.id,
                index: 0,
              });

              console.log("🟣 DEBUG: Enhanced header drop API result:", result);

              if (result.success) {
                // Instant optimistic update — no full re-render
                optimisticMove(
                  dragData.id,
                  dragData.parentId || null,
                  folder.id,
                  0,
                );
                // Reconcile silently in background after 1.5 s
                scheduleSilentSync();
              } else {
                console.error(
                  "🟣 ❌ FAILED: Failed to move bookmark on enhanced header drop:",
                  result.error,
                );
              }
            } catch (err) {
              console.error(
                "🟣 🚨 ERROR: Error moving bookmark on enhanced header drop:",
                err,
              );
            }
            folderHeader.classList.remove("drop-zone-active", "drop-target");
            (folderHeader as HTMLElement).removeAttribute("data-drop-active");
            return true;
          },
        },
      );
      markInitialized(folderHeader as HTMLElement);
    }

    // Container drop: append to end (or to computed index)
    if (!isInitialized(folderElement as HTMLElement)) {
      DragManager.initializeDropZone(
        folderElement as HTMLElement,
        { type: "folder", targetId: folder.id },
        {
          acceptTypes: ["bookmark"],
          onDragEnter: () => {
            console.log(
              "\ud83d\udce5 Drag enter on folder container:",
              folder.title,
              folder.id,
            );
            folderElement.classList.add("drop-zone-active", "drop-target");
            (folderElement as HTMLElement).setAttribute(
              "data-drop-active",
              "true",
            );
          },
          onDragLeave: () => {
            console.log(
              "\ud83d\udce4 Drag leave on folder container:",
              folder.title,
              folder.id,
            );
            folderElement.classList.remove("drop-zone-active", "drop-target");
            (folderElement as HTMLElement).removeAttribute("data-drop-active");
          },
          onDrop: async (dragData) => {
            console.log(
              "\u2705 Drop on folder container:",
              folder.title,
              folder.id,
              "dragData:",
              dragData,
            );
            try {
              console.log(
                "🟪 ENHANCED CONTAINER DROP: Processing bookmark drop via enhanced system",
              );
              // Append to end by default
              const appendIndex = Array.isArray(folder.bookmarks)
                ? folder.bookmarks.length
                : undefined;

              console.log("🟪 DEBUG: Enhanced container drop parameters:", {
                bookmarkId: dragData.id,
                targetFolderId: folder.id,
                appendIndex: appendIndex,
                folderTitle: folder.title,
                folderBookmarkCount: folder.bookmarks.length,
                dragDataTitle: dragData.title,
              });

              const result = await BookmarkEditAPI.moveBookmark(dragData.id, {
                parentId: folder.id,
                index: appendIndex,
              });

              console.log(
                "🟪 DEBUG: Enhanced container drop API result:",
                result,
              );

              if (result.success) {
                // Instant optimistic update — no full re-render
                optimisticMove(
                  dragData.id,
                  dragData.parentId || null,
                  folder.id,
                  appendIndex,
                );
                // Reconcile silently in background after 1.5 s
                scheduleSilentSync();
              } else {
                console.error(
                  "🟪 ❌ FAILED: Failed to move bookmark on enhanced container drop:",
                  result.error,
                );
              }
            } catch (err) {
              console.error(
                "🟪 🚨 ERROR: Error moving bookmark on enhanced container drop:",
                err,
              );
            }
            folderElement.classList.remove("drop-zone-active", "drop-target");
            (folderElement as HTMLElement).removeAttribute("data-drop-active");
            return true;
          },
        },
      );

      markInitialized(folderElement as HTMLElement);
    }
  }

  // Refresh bookmarks after changes to ensure UI updates and persistence
  async function refreshBookmarks() {
    try {
      const fresh = await BookmarkManager.getOrganizedBookmarks();
      bookmarkFolders.update((current) => {
        // If the store is empty (first load), just use what Chrome gave us.
        if (!current || current.length === 0) return fresh;

        // Build a quick id→folder lookup from the fresh data.
        const freshMap = new Map(fresh.map((f) => [f.id, f]));

        // 1. Walk the *current* display order so sections never jump around.
        //    For each existing folder, swap in the fresh bookmark list.
        //    If Chrome no longer has a folder (it was deleted), drop it.
        const updated = current
          .map((f) => {
            const freshFolder = freshMap.get(f.id);
            if (!freshFolder) return null; // folder deleted — remove it
            return { ...f, bookmarks: freshFolder.bookmarks };
          })
          .filter((f): f is NonNullable<typeof f> => f !== null);

        // 2. Append any brand-new folders that weren't in the store yet
        //    (e.g. the user just created one).
        const currentIds = new Set(current.map((f) => f.id));
        const newFolders = fresh.filter((f) => !currentIds.has(f.id));

        return [...updated, ...newFolders];
      });
    } catch (error) {
      console.error("Failed to refresh bookmarks:", error);
    }
  }

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
          console.log(
            "✅ Enhanced drag-drop system initialized for folder:",
            folder.title,
          );
        } else {
          console.error(
            "❌ Failed to initialize enhanced drag-drop:",
            initResult.error,
          );
        }
      }

      // Always ensure basic folder drop zones exist (even outside edit mode) for inter-folder moves
      setTimeout(() => {
        setupFolderDropZones();
      }, 50);

      // Update drag-drop state after a short delay to ensure DOM is ready
      setTimeout(() => {
        updateEnhancedDragDropState();
      }, 200); // Increased delay to allow for DOM readiness
    };

    initializeAsync();

    // Global mouse bridge: capture source bookmark on mousedown at document level (Playwright mouse flow)
    if (
      typeof window !== "undefined" &&
      !(window as any).__fav_docMouseBridge
    ) {
      let _mouseDownX = 0;
      let _mouseDownY = 0;

      const onDocMouseDown = (e: MouseEvent) => {
        // Always reset drag state on a fresh mousedown
        (window as any).__fav_isDragging = false;
        (window as any).__fav_dragCandidate = null;

        _mouseDownX = e.clientX;
        _mouseDownY = e.clientY;

        const t = e.target as HTMLElement | null;
        const itemEl =
          t &&
          (t.closest?.(
            ".bookmark-item[data-bookmark-id]",
          ) as HTMLElement | null);
        if (!itemEl) return;
        const id =
          itemEl.getAttribute("data-bookmark-id") ||
          itemEl.getAttribute("data-id") ||
          "";
        const parentId =
          (
            itemEl.closest("[data-folder-id]") as HTMLElement | null
          )?.getAttribute("data-folder-id") || "";
        if (id) {
          (window as any).__fav_dragCandidate = { id, parentId };
          // Optional visual cue to aid getDraggingBookmarkInfo fallback
          itemEl.setAttribute("data-dragging", "true");
          itemEl.classList.add("dragging");
          setTimeout(() => {
            itemEl.removeAttribute("data-dragging");
          }, 2000);
        }
      };

      // Only mark as a real drag once the mouse has moved a few pixels
      const onDocMouseMove = (e: MouseEvent) => {
        if (
          (window as any).__fav_dragCandidate &&
          !(window as any).__fav_isDragging
        ) {
          const dx = Math.abs(e.clientX - _mouseDownX);
          const dy = Math.abs(e.clientY - _mouseDownY);
          if (dx > 4 || dy > 4) {
            (window as any).__fav_isDragging = true;
          }
        }
      };

      document.addEventListener("mousedown", onDocMouseDown, true);
      document.addEventListener("mousemove", onDocMouseMove, true);
      (window as any).__fav_docMouseBridge = true;
    }

    // Global mouseup bridge: perform move when releasing over a folder/header/grid
    if (
      typeof window !== "undefined" &&
      !(window as any).__fav_docMouseUpBridge
    ) {
      const onDocMouseUp = async (e: MouseEvent) => {
        try {
          console.log("[DnD Fallback] mouseup at", e.target);
          const t = e.target as HTMLElement | null;
          if (!t) {
            console.log("[DnD Fallback] No target element");
            return;
          }

          const container = t.closest?.(
            ".folder-header[data-folder-id], .bookmarks-grid[data-folder-id], .folder-container[data-folder-id]",
          ) as HTMLElement | null;
          console.log(
            "[DnD Fallback] Container found:",
            container?.className || "none",
          );

          if (!container) {
            console.log("[DnD Fallback] No container found");
            return;
          }

          const toParentId = container.getAttribute("data-folder-id") || "";
          console.log("[DnD Fallback] Target folder ID:", toParentId);

          if (!toParentId) {
            console.log("[DnD Fallback] No target folder ID found");
            return;
          }

          const gc =
            (typeof window !== "undefined"
              ? (window as any).__fav_dragCandidate
              : null) || {};
          const fromId = gc.id;
          const fromParentId = gc.parentId;

          console.log("[DnD Fallback] Debug log:", {
            bookmarkId: fromId || "",
            bookmarkTitle: gc.title || "Unknown",
            currentParent: fromParentId || "",
            destFolderId: toParentId, // CRITICAL: This should not be empty
            dropHandled: true,
            overContainer: !!container,
            overHeader: !!t.closest?.(".folder-header"),
          });

          if (!fromId) {
            console.log("[DnD Fallback] No source bookmark captured");
            return; // No source captured
          }

          // Determine placement: header => index 0, otherwise append
          const isHeader = !!t.closest?.(".folder-header");
          const toIndex = isHeader ? 0 : undefined;

          console.log("[DnD Fallback] Executing move:", {
            bookmarkId: fromId,
            fromParentId: fromParentId,
            destFolderId: toParentId,
            targetIndex: toIndex,
            isHeader: isHeader,
          });

          const result = await BookmarkEditAPI.moveBookmark(fromId, {
            parentId: toParentId,
            index: toIndex,
          });
          if (result?.success) {
            // Instant optimistic update — no full re-render
            optimisticMove(fromId, fromParentId || null, toParentId, toIndex);
            // Reconcile silently in background after 1.5 s
            scheduleSilentSync();
          } else {
            console.error(
              "[DnD Fallback] Failed to move bookmark",
              fromId,
              "->",
              toParentId,
              result?.error,
            );
          }
        } catch (err) {
          console.error("[DnD Fallback] Error handling mouseup drop:", err);
        } finally {
          if (typeof window !== "undefined") {
            (window as any).__fav_dragCandidate = null;
            (window as any).__fav_isDragging = false;
          }
        }
      };
      document.addEventListener("mouseup", onDocMouseUp, true);
      (window as any).__fav_docMouseUpBridge = true;
    }

    // Listen for save-all-edits event
    document.addEventListener("save-all-edits", handleSaveAllEdits);

    return () => {
      document.removeEventListener("save-all-edits", handleSaveAllEdits);
    };
  });

  // Cleanup on destroy
  onDestroy(() => {
    unsubscribeEditMode();

    // Clear any pending drag-drop retry timeout
    if (dragDropRetryTimeout) {
      clearTimeout(dragDropRetryTimeout);
      dragDropRetryTimeout = null;
    }

    // Clear any pending drop zone timeout
    if (dropZoneTimeout) {
      clearTimeout(dropZoneTimeout);
      dropZoneTimeout = null;
    }
  });
</script>

<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div
  class="folder-container"
  data-testid="bookmark-folder"
  bind:this={folderElement}
  class:draggable-item={isEditMode}
  data-folder-id={folder.id}
  data-folder-title={folder.title}
  on:dragenter|preventDefault={onContainerDragEnter}
  on:dragover|preventDefault={onContainerDragOver}
  on:drop|preventDefault={onContainerDrop}
  on:dragleave={onContainerDragLeave}
  on:mouseup|capture|preventDefault={onContainerMouseUp}
  role="group"
>
  <div
    class="folder-header"
    data-testid="folder-header"
    bind:this={folderHeader}
    data-folder-id={folder.id}
    data-folder-title={folder.title}
    on:click={toggleExpanded}
    on:keydown={(e) => e.key === "Enter" && toggleExpanded()}
    on:dragenter|preventDefault={onHeaderDragEnter}
    on:dragover|preventDefault={onHeaderDragOver}
    on:drop|preventDefault={onHeaderDrop}
    on:dragleave={onHeaderDragLeave}
    on:mouseup|capture|preventDefault={onHeaderMouseUp}
    tabindex="0"
    role="button"
  >
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
      />
    {:else}
      <h3
        class="folder-title"
        class:editable={isEditMode}
        on:dblclick={startRenaming}
      >
        {folder.title}
      </h3>
    {/if}

    <div class="bookmark-count">({folder.bookmarks.length})</div>

    <!-- Edit mode actions -->
    {#if isEditMode && !isRenaming}
      <button
        class="edit-button"
        on:click|stopPropagation={startRenaming}
        title="Rename folder"
        aria-label="Rename folder"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
          ></path>
          <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      </button>
      <button
        class="delete-button"
        on:click|stopPropagation={deleteFolder}
        title="Delete folder"
        aria-label="Delete folder"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <polyline points="3,6 5,6 21,6"></polyline>
          <path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"></path>
          <path d="M10,11v6"></path>
          <path d="M14,11v6"></path>
          <path d="M9,6V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1v2"></path>
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
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
    <div
      class="bookmarks-grid"
      class:expanded={isExpanded}
      bind:this={bookmarksGridEl}
      data-folder-id={folder.id}
      on:dragenter|preventDefault={onContainerDragEnter}
      on:dragover|preventDefault={onContainerDragOver}
      on:drop|preventDefault={onContainerDrop}
      on:dragleave={onContainerDragLeave}
      on:mouseup|capture|preventDefault={onContainerMouseUp}
      role="group"
    >
      {#each folder.bookmarks as bookmark, index (bookmark.id)}
        <div
          class="bookmark-wrapper"
          class:is-dragging={draggingBookmarkId === bookmark.id}
          draggable={$editMode}
          on:dragstart={(e) => onGridDragStart(e, bookmark, index)}
          on:dragover={(e) => onGridDragOver(e, index)}
          on:dragleave={onGridDragLeave}
          on:drop|preventDefault={(e) => onGridDrop(e, index)}
          role="listitem"
        >
          <BookmarkItem {bookmark} />

          {#if $editMode && dropTargetIndex === index}
            <div class="drop-indicator {dropPosition}"></div>
          {/if}
        </div>
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

  .edit-button,
  .delete-button {
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

  .folder-header:hover .edit-button,
  .folder-header:hover .delete-button {
    opacity: 1;
  }

  .edit-button:hover {
    background: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.9);
  }

  .delete-button:hover {
    background: rgba(239, 68, 68, 0.25);
    color: rgb(252, 165, 165);
  }

  .edit-button svg,
  .delete-button svg {
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

  /* Grid Drag and Drop Styles */

  .bookmark-wrapper {
    position: relative;
    transition:
      transform 0.2s ease,
      opacity 0.2s ease;
    height: 100%;
  }

  .bookmark-wrapper.is-dragging {
    opacity: 0.4;
    transform: scale(0.95);
  }

  .drop-indicator {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 4px;
    background-color: #3b82f6;
    border-radius: 2px;
    pointer-events: none;
    z-index: 10;
    box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
  }

  .drop-indicator.left {
    left: -6px;
  }

  .drop-indicator.right {
    right: -6px;
  }

  /* Ensure the grid doesn't collapse */
  .bookmarks-grid {
    display: grid;
    /* Maintain the grid layout defined in component */
  }
</style>
