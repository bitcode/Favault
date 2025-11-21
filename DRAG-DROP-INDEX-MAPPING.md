# Drag-and-drop index mapping: insertion point vs API index

This note explains **why you may see different indices** for the same drop operation and how the logging now exposes both values clearly.

## 1. Two different indices for the same drop

For a drag-and-drop move within a folder there are two relevant indices:

1. **Insertion-point index (visual/index in UI)**  
   - This is the index that comes from the drop zone / insertion point.  
   - Example: dropping between items `D` and `E` in a list of 5 items might correspond to `targetIndex = 4`.

2. **API index (Chrome bookmarks.move index)**  
   - This is the index actually passed to `browserAPI.bookmarks.move()`.
   - Chrome removes the bookmark first, then inserts it, so when moving **down within the same parent**, all indices after the original position shift by `-1`.
   - Example: if the bookmark started at index `1` and you drop at insertion-point index `4`, the API index is adjusted to `3` (`4 - 1`).

Both indices are **correct**, but they describe different stages:
- insertion-point index = where the user dropped in the original list
- API index = where Chrome expects the bookmark to be inserted **after** it has been removed

## 2. Where the adjustment happens

The adjustment logic lives in `BookmarkEditAPI.moveBookmark` (`src/lib/api.ts`):

- It computes `adjustedIndex` from `destination.index` (the insertion-point index).
- When moving **within the same parent** and **downwards** (`currentIndex < destination.index`), it subtracts `1` to account for the removal step.
- When moving **up** or **to a different parent**, no adjustment is needed.

This logic has not been changed; it remains the single source of truth for index adjustment.

## 3. What is now logged

To make the behaviour transparent in logs, two layers now collaborate:

### 3.1 DragDropLogger

`src/lib/logging/drag-drop-logger.ts` now has an optional `indexMapping` field on `DragDropLogMetadata` and a helper:

- **`DragDropLogger.logDrop(...)`**  
  Logs a high-level "drop succeeded" event (unchanged behaviour).

- **`DragDropLogger.logDropIndexMapping(mapping)`**  
  Records the relationship between UI and API indices:
  - `bookmarkId`, `bookmarkTitle`
  - `currentParentId`, `currentIndex`
  - `targetParentId`
  - `requestedIndex` (insertion-point index from drop zone)
  - `adjustedIndex` (index actually passed to `browser.bookmarks.move`)
  - `finalIndex` (index reported back by the browser after the move)
  - `isSameParent` (whether the move was within the same folder)

These entries appear in the log with message `"📐 Drop index mapping"` and context `indexMapping`.

### 3.2 BookmarkEditAPI.moveBookmark

`src/lib/api.ts` calls `DragDropLogger.logDropIndexMapping(...)` **after** the move completes and the final index is known:

- It uses the same `destination.index` that the drop zone passed in (insertion-point index).
- It uses the computed `adjustedIndex` that was passed to the API.
- It uses `result.index` from `browserAPI.bookmarks.move(...)` as `finalIndex`.

This means each logged mapping gives a complete picture of **UI intent vs API reality** for that move.

## 4. Brave vs standard drag-drop

The standard `DragDropManager` (`src/lib/dragdrop.ts`) and the Brave-specific manager (`src/lib/dragdrop-brave.ts`) now both:

- Perform early validation on the drop (edit mode, type, location).
- Call `DragDropLogger.logDropError(...)` on rejected drops (with reason).
- Call `DragDropLogger.logDrop(...)` on successful drops, passing the drop zone and its `targetIndex`.

Because Brave previously skipped `DragDropLogger.logDrop(...)`, drop entries were missing from logs. This has been fixed by wiring the Brave drop handler into the same logging flow as the standard manager.

## 5. How to interpret future logs

For a single drag-and-drop move you can now expect to see:

1. A `"📦 MOVE OPERATION"` console log summarising the move request.
2. A `"📐 INDEX ADJUSTMENT ..."` console log describing any index adjustment.
3. A `DragDropLogger.logDrop(...)` entry with `operation: 'drop'` and `index` = insertion-point index.
4. A `"📐 Drop index mapping"` entry with `indexMapping` containing:
   - `requestedIndex` (UI insertion-point index)
   - `adjustedIndex` (API index after adjustment)
   - `finalIndex` (actual index reported by the browser)

If a drop is rejected or fails, you will instead see `DragDropLogger.logDropError(...)` entries with a descriptive `error` field.

This should remove ambiguity about "why did the bookmark end up at index 3?" by showing:
- where the user dropped it (insertion-point index), and
- how and why the index was adjusted for the underlying bookmarks API.

