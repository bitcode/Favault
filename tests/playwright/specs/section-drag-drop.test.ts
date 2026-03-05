/**
 * Section Drag-and-Drop Diagnostic Tests
 *
 * These tests call `EnhancedDragDropManager.moveFolderToPosition` directly
 * (the same function the insertion-point drop handler calls) and then read
 * the Chrome Bookmarks API to verify the folder landed at the correct
 * sibling position.
 *
 * They use the SAME index criteria the codebase uses:
 *   - folderIndex  = UI display index (position in .folder-container NodeList)
 *   - insertionIndex = UI gap slot (0 = before first section, N = after last)
 *   - mode = 'insertion-index' (what FolderInsertionPoint.svelte passes)
 *
 * The tests then ask Chrome "where did this folder actually end up?" and
 * compare that Chrome sibling position (among folder-type children only, which
 * matches what the user sees) against the intended display position.
 */

import { test, expect } from '../fixtures/extension';
import { ExtensionTestUtils } from '../fixtures/extension';
import type { Page } from '@playwright/test';

// ─── Page-side helpers (run inside the extension page via evaluate) ───────────

/**
 * Returns the current section order as seen in the DOM.
 * Each entry: { displayIndex, title, bookmarkId }
 */
async function getDomSectionState(page: Page) {
    return page.evaluate(() => {
        const containers = Array.from(
            document.querySelectorAll('.folder-container')
        ) as HTMLElement[];
        return containers.map((el, i) => ({
            displayIndex: i,
            title: (
                el.querySelector<HTMLElement>('.folder-title, h3, .folder-name')
            )?.textContent?.trim() ?? '',
            bookmarkId: el.getAttribute('data-folder-id') ?? el.getAttribute('data-bookmark-id') ?? ''
        }));
    });
}

/**
 * Uses the Chrome Bookmarks API (via `EnhancedDragDropManager` which has access
 * to `browserAPI`) to get the actual sibling position of a folder, counting
 * only folder-type siblings (no URL nodes) — which matches what the user sees.
 *
 * Returns:
 *   chromeSiblingAll:    raw index in parentChildren (includes loose bookmarks)
 *   chromeFolderOnly:    index among folder-only siblings (what the UI shows)
 *   parentId:            Chrome parent bookmark ID
 *   parentChildren:      all sibling titles for diagnostics
 *   folderOnlySiblings:  folder sibling titles for diagnostics
 */
async function getChromeFolderPosition(page: Page, bookmarkId: string) {
    return page.evaluate(async (id: string) => {
        const api = (window as any).EnhancedDragDropManager;
        if (!api) throw new Error('EnhancedDragDropManager not on window');

        // Use the same browser API the manager uses internally
        // It's exposed on the window for testing
        const chromeBookmarks = (window as any).chrome?.bookmarks ?? (window as any).browser?.bookmarks;
        if (!chromeBookmarks) throw new Error('chrome.bookmarks API not accessible');

        const [node] = await chromeBookmarks.get(id);
        const parentChildren = await chromeBookmarks.getChildren(node.parentId);

        const chromeSiblingAll = parentChildren.findIndex((c: any) => c.id === id);
        const folderOnlySiblings = parentChildren.filter((c: any) => !c.url);
        const chromeFolderOnly = folderOnlySiblings.findIndex((c: any) => c.id === id);

        return {
            bookmarkId: id,
            parentId: node.parentId,
            chromeSiblingAll,
            chromeFolderOnly,
            parentChildren: parentChildren.map((c: any) => ({
                id: c.id,
                title: c.title,
                isFolder: !c.url,
                rawIndex: parentChildren.indexOf(c)
            })),
            folderOnlySiblings: folderOnlySiblings.map((c: any) => ({
                id: c.id,
                title: c.title,
                folderIndex: folderOnlySiblings.indexOf(c)
            }))
        };
    }, bookmarkId);
}

/**
 * Calls `EnhancedDragDropManager.moveFolderToPosition` directly — exactly
 * what FolderInsertionPoint.svelte does on drop.
 * Returns the result object from the manager + captured console logs.
 */
async function callMoveFolderToPosition(
    page: Page,
    fromDisplayIndex: number,
    insertionIndex: number
) {
    return page.evaluate(
        async ({ fromIdx, insIdx }: { fromIdx: number; insIdx: number }) => {
            const mgr = (window as any).EnhancedDragDropManager;
            if (!mgr) throw new Error('EnhancedDragDropManager not available');
            // This is exactly what FolderInsertionPoint.svelte calls after our fix:
            const result = await mgr.moveFolderToPosition(fromIdx, insIdx, { mode: 'insertion-index' });
            return result;
        },
        { fromIdx: fromDisplayIndex, insIdx: insertionIndex }
    );
}

/**
 * Returns the `folderBookmarkIds` map as a plain object for inspection.
 */
async function getFolderBookmarkIdMap(page: Page): Promise<Record<number, string>> {
    return page.evaluate(() => {
        const mgr = (window as any).EnhancedDragDropManager;
        if (!mgr) return {};
        // The map is private, but we expose a debug accessor below.
        // Fallback: scrape from DOM data attributes.
        const containers = Array.from(document.querySelectorAll('.folder-container')) as HTMLElement[];
        const map: Record<number, string> = {};
        containers.forEach((el, i) => {
            const id = el.getAttribute('data-folder-id') ?? el.getAttribute('data-bookmark-id') ?? '';
            if (id) map[i] = id;
        });
        return map;
    });
}

// ─── Shared beforeEach ────────────────────────────────────────────────────────

async function setupPage(page: Page) {
    await ExtensionTestUtils.waitForExtensionReady(page);
    await ExtensionTestUtils.enableEditMode(page);
    // Give the drag-drop system time to register all folder containers and
    // call restoreBookmarkFolderMappings().
    await page.waitForTimeout(800);
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

test.describe('Section Positioning — EnhancedDragDropManager.moveFolderToPosition', () => {

    /**
     * DIAGNOSTIC TEST 1 — Capture the exact indices for every section.
     *
     * This test doesn't assert pass/fail on ordering; it snapshots:
     *   - The UI display order (DOM)
     *   - The Chrome bookmark tree parent structure
     *   - The Chrome folder-only sibling index for each section
     *
     * Running this first gives us the ground truth before any moves.
     */
    test('DIAG: snapshot initial section state (Chrome API vs DOM)', async ({ newTabPage }) => {
        await setupPage(newTabPage);

        const domSections = await getDomSectionState(newTabPage);
        test.skip(domSections.length < 2, 'Need at least 2 sections to diagnose');

        const idMap = await getFolderBookmarkIdMap(newTabPage);

        // Build a full diagnostic snapshot
        const snapshot: any[] = [];
        for (const section of domSections) {
            const bId = idMap[section.displayIndex] ?? section.bookmarkId;
            if (!bId || bId.startsWith('placeholder')) {
                snapshot.push({ ...section, note: 'no bookmark ID — virtual/placeholder section' });
                continue;
            }
            const chromePos = await getChromeFolderPosition(newTabPage, bId);
            snapshot.push({
                domDisplayIndex: section.displayIndex,
                title: section.title,
                bookmarkId: bId,
                chromeSiblingAll: chromePos.chromeSiblingAll,
                chromeFolderOnly: chromePos.chromeFolderOnly,
                // Does the Chrome folder-only index match the DOM display index?
                indexMatchesDom: chromePos.chromeFolderOnly === section.displayIndex,
                parentId: chromePos.parentId
            });
        }

        // Print the full diagnostic table as a formatted string so it's visible
        // in the test reporter even on pass.
        const tableLines = snapshot.map(r =>
            `  [dom:${r.domDisplayIndex}] "${r.title}" ` +
            `→ Chrome all:${r.chromeSiblingAll} folder-only:${r.chromeFolderOnly} ` +
            `matchesDom:${r.indexMatchesDom} parentId:${r.parentId ?? 'n/a'}`
        );
        console.log('📊 SECTION STATE SNAPSHOT:\n' + tableLines.join('\n'));

        // Soft assertion: every section that has a real bookmark ID should have
        // a matching folder-only Chrome index.
        const mismatches = snapshot.filter(r => r.bookmarkId && !r.bookmarkId.startsWith('placeholder') && !r.indexMatchesDom);
        if (mismatches.length > 0) {
            console.warn(
                '⚠️ MISMATCH: DOM display indices do not match Chrome folder-only indices:\n' +
                mismatches.map(r =>
                    `  "${r.title}": dom=${r.domDisplayIndex} vs chrome-folder-only=${r.chromeFolderOnly}`
                ).join('\n') +
                '\nThis mismatch will cause wrong drop positions.'
            );
        }

        // The test always passes but reports — the diagnostic output shows the bug.
        expect(snapshot.length).toBeGreaterThan(0);
    });

    /**
     * DIAGNOSTIC TEST 2 — Call moveFolderToPosition and verify Chrome landing.
     *
     * This is the core regression test. It:
     *   1. Records the initial Chrome folder-only index of a folder.
     *   2. Calls moveFolderToPosition(fromIdx, insertionIdx, { mode: 'insertion-index' }).
     *   3. Reads the Chrome API to find the NEW folder-only index.
     *   4. Asserts the new index equals the expected one.
     *
     * The test parametrizes over multiple (from, insertionSlot) pairs.
     * Each failing case shows the ACTUAL vs EXPECTED Chrome index.
     */


    // ── Full directional test matrix ──────────────────────────────────────────
    //
    // Notation:
    //   fromDisplayIdx  = 0-based UI index of the dragged section
    //   insertionSlot   = gap slot (0 = before first, N = after last)
    //   expectedDisplayIdx = where the section should end up (0-based, folder-only)
    //
    // Every scenario is self-documenting so failures include the intent.

    const MOVE_SCENARIOS = [
        // ── No-op / same-slot moves ───────────────────────────────────────────
        { label: 'NOOP: S[0] → gap 0 (right before itself)', from: 0, gap: 0, expected: 0 },
        { label: 'NOOP: S[0] → gap 1 (right after itself)', from: 0, gap: 1, expected: 0 },
        { label: 'NOOP: S[1] → gap 1 (right before itself)', from: 1, gap: 1, expected: 1 },
        { label: 'NOOP: S[1] → gap 2 (right after itself)', from: 1, gap: 2, expected: 1 },

        // ── Move DOWN (section moves to a higher index) ────────────────────────
        { label: 'DOWN: S[0] → gap 2 → lands at index 1', from: 0, gap: 2, expected: 1 },
        { label: 'DOWN: S[0] → gap 3 → lands at index 2', from: 0, gap: 3, expected: 2 },
        { label: 'DOWN: S[1] → gap 3 → lands at index 2', from: 1, gap: 3, expected: 2 },
        { label: 'DOWN: S[1] → gap 4 → lands at index 3 (requires ≥4 sections)', from: 1, gap: 4, expected: 3 },

        // ── Move UP (section moves to a lower index) ───────────────────────────
        { label: 'UP: S[2] → gap 0 → lands at index 0', from: 2, gap: 0, expected: 0 },
        { label: 'UP: S[2] → gap 1 → lands at index 1', from: 2, gap: 1, expected: 1 },
        { label: 'UP: S[3] → gap 0 → lands at index 0 (requires ≥4 sections)', from: 3, gap: 0, expected: 0 },
        { label: 'UP: S[3] → gap 2 → lands at index 2 (requires ≥4 sections)', from: 3, gap: 2, expected: 2 },

        // ── Move to last position ──────────────────────────────────────────────
        // expectedDisplayIdx for "end" depends on section count; set dynamically below
        { label: 'END: S[0] → gap N (end of list)', from: 0, gap: 'end', expected: 'last' },
        { label: 'END: S[1] → gap N (end of list)', from: 1, gap: 'end', expected: 'last' },
    ] as const;

    for (const scenario of MOVE_SCENARIOS) {
        test(`[positioning] ${scenario.label}`, async ({ newTabPage }) => {
            await setupPage(newTabPage);

            const idMap = await getFolderBookmarkIdMap(newTabPage);
            const domSections = await getDomSectionState(newTabPage);
            const sectionCount = domSections.length;

            // Resolve dynamic "end" values
            const insertionSlot = scenario.gap === 'end' ? sectionCount : (scenario.gap as number);
            const expectedDisplayIdx = scenario.expected === 'last'
                ? sectionCount - 1
                : (scenario.expected as number);

            // Skip if we don't have enough sections
            const requiredCount = Math.max(scenario.from, insertionSlot, expectedDisplayIdx) + 1;
            if (sectionCount < requiredCount) {
                test.skip(true, `Need ≥${requiredCount} sections; only ${sectionCount} visible`);
                return;
            }

            const movedBId = idMap[scenario.from] ?? domSections[scenario.from]?.bookmarkId;
            if (!movedBId || movedBId.startsWith('placeholder')) {
                test.skip(true, 'No real bookmark ID for source section');
                return;
            }

            const beforePos = await getChromeFolderPosition(newTabPage, movedBId);
            console.log(
                `\n▶ [${scenario.label}]\n` +
                `   section: "${domSections[scenario.from]?.title}" (dom:${scenario.from})\n` +
                `   chrome-folder-only BEFORE: ${beforePos.chromeFolderOnly}\n` +
                `   gap: ${insertionSlot}  expectedDisplay: ${expectedDisplayIdx}`
            );

            // Capture position calculation logs for debugging
            const calcLogs: string[] = [];
            const consoleHandler = (msg: any) => {
                const t = msg.text();
                if (t.includes('Position calculation') || t.includes('uiTargetDisplayIdx') || t.includes('insertionChrome')) {
                    calcLogs.push(t);
                }
            };
            newTabPage.on('console', consoleHandler);

            // Call exactly what FolderInsertionPoint.svelte calls
            const moveResult = await callMoveFolderToPosition(newTabPage, scenario.from, insertionSlot);
            await newTabPage.waitForTimeout(700);

            newTabPage.off('console', consoleHandler);

            const afterPos = await getChromeFolderPosition(newTabPage, movedBId);

            console.log(
                `   chrome-folder-only AFTER: ${afterPos.chromeFolderOnly}\n` +
                `   folder order AFTER: [${afterPos.folderOnlySiblings.map(f => `"${f.title}"`).join(', ')}]\n` +
                `   calc logs:\n   ${calcLogs.slice(-2).join('\n   ')}`
            );

            expect(
                afterPos.chromeFolderOnly,
                `[FAIL] "${domSections[scenario.from]?.title}" should land at folder-only index ` +
                `${expectedDisplayIdx} but ended up at ${afterPos.chromeFolderOnly}.\n` +
                `gap=${insertionSlot}, result=${JSON.stringify(moveResult)}\n` +
                `Chrome order after move:\n` +
                afterPos.parentChildren
                    .map(c => `  [${c.rawIndex}] ${c.isFolder ? '📁' : '🔖'} "${c.title}"`)
                    .join('\n')
            ).toBe(expectedDisplayIdx);
        });
    }

    /**
     * SEQUENCE TEST — perform multiple moves in sequence and verify cumulative result.
     * This catches bugs where a first CORRECT move corrupts indices for a second move.
     */
    test('[sequence] move S[0]→end, then move S[last]→front: net result = rotated by 2', async ({ newTabPage }) => {
        await setupPage(newTabPage);

        const idMap = await getFolderBookmarkIdMap(newTabPage);
        const domSections = await getDomSectionState(newTabPage);
        test.skip(domSections.length < 3, 'Need ≥3 sections for sequence test');

        const N = domSections.length;

        const s0Id = idMap[0] ?? domSections[0]?.bookmarkId;
        const s1Id = idMap[1] ?? domSections[1]?.bookmarkId;
        test.skip(!s0Id || s0Id.startsWith('placeholder'), 'No real bookmark ID for S[0]');

        // Move 1: S[0] to end
        await callMoveFolderToPosition(newTabPage, 0, N);
        await newTabPage.waitForTimeout(800);

        // Re-read idMap since order changed (silent rebuild runs after 500ms)
        const idMap2 = await getFolderBookmarkIdMap(newTabPage);

        // Move 2: S[0] (which is now what was S[1]) to end as well
        const newS0Id = idMap2[0] ?? '';
        if (newS0Id && !newS0Id.startsWith('placeholder')) {
            await callMoveFolderToPosition(newTabPage, 0, N - 1); // -1 because one already moved out
            await newTabPage.waitForTimeout(800);
        }

        // Verify original S[0] is now at the last position
        const finalPos = await getChromeFolderPosition(newTabPage, s0Id);
        console.log(
            `Sequence test: original S[0] "${domSections[0]?.title}" is now at folder-only index ${finalPos.chromeFolderOnly}\n` +
            `Full order: [${finalPos.folderOnlySiblings.map(f => `"${f.title}"`).join(', ')}]`
        );

        expect(finalPos.chromeFolderOnly).toBe(N - 1);
    });


    /**
     * DIAGNOSTIC TEST 3 — Reveal the index offset caused by loose bookmarks.
     *
     * This test explicitly measures how many loose bookmarks (non-folder URLs)
     * are present in each section's parent, and asserts that the offset between
     * the Chrome all-sibling index and the folder-only index equals the number
     * of loose bookmarks that precede the folder.
     *
     * If this offset > 0 AND the codebase isn't accounting for it, every drop
     * will be off by this many positions.
     */
    test('DIAG: measure loose-bookmark offset in each section parent', async ({ newTabPage }) => {
        await setupPage(newTabPage);

        const idMap = await getFolderBookmarkIdMap(newTabPage);
        const domSections = await getDomSectionState(newTabPage);

        test.skip(domSections.length < 1, 'No sections found');

        const offsets: Array<{
            title: string;
            looseBookmarkCount: number;
            chromeSiblingAll: number;
            chromeFolderOnly: number;
            offset: number;
        }> = [];

        for (const section of domSections) {
            const bId = idMap[section.displayIndex] ?? section.bookmarkId;
            if (!bId || bId.startsWith('placeholder')) continue;

            const pos = await getChromeFolderPosition(newTabPage, bId);
            const looseBookmarks = pos.parentChildren.filter(c => !c.isFolder);
            const looseBeforeMe = pos.parentChildren
                .slice(0, pos.chromeSiblingAll)
                .filter(c => !c.isFolder);

            offsets.push({
                title: section.title,
                looseBookmarkCount: looseBookmarks.length,
                chromeSiblingAll: pos.chromeSiblingAll,
                chromeFolderOnly: pos.chromeFolderOnly,
                offset: pos.chromeSiblingAll - pos.chromeFolderOnly
            });
        }

        const lines = offsets.map(o =>
            `  "${o.title}": loose-in-parent=${o.looseBookmarkCount} ` +
            `chrome-all=${o.chromeSiblingAll} folder-only=${o.chromeFolderOnly} ` +
            `OFFSET=${o.offset}`
        );
        console.log('📊 LOOSE-BOOKMARK OFFSET TABLE:\n' + lines.join('\n'));

        const nonZeroOffsets = offsets.filter(o => o.offset !== 0);
        if (nonZeroOffsets.length > 0) {
            console.warn(
                '⚠️ These sections have a non-zero loose-bookmark offset — drop positions will be wrong:\n' +
                nonZeroOffsets.map(o =>
                    `  "${o.title}" offset=${o.offset} (${o.looseBookmarkCount} loose bookmarks in parent)`
                ).join('\n')
            );
        }

        // Always passes — this is a diagnostic snapshot test
        expect(offsets.length).toBeGreaterThan(0);
    });

    /**
     * DIAGNOSTIC TEST 4 — No-op: move a section to its current position.
     *
     * Drag display-index 1 to insertion-slot 1 (the gap right before it).
     * Chrome folder-only index should not change at all.
     */
    test('[noop] move section to same position — Chrome index must not change', async ({ newTabPage }) => {
        await setupPage(newTabPage);

        const idMap = await getFolderBookmarkIdMap(newTabPage);
        const domSections = await getDomSectionState(newTabPage);

        test.skip(domSections.length < 2, 'Need at least 2 sections');

        const fromDisplayIdx = 1;
        const insertionSlot = 1; // gap right before display-index 1 → no-op

        const bId = idMap[fromDisplayIdx] ?? domSections[fromDisplayIdx]?.bookmarkId;
        test.skip(!bId || bId.startsWith('placeholder'), 'No real bookmark ID for section 1');

        const beforePos = await getChromeFolderPosition(newTabPage, bId);

        await callMoveFolderToPosition(newTabPage, fromDisplayIdx, insertionSlot);
        await newTabPage.waitForTimeout(600);

        const afterPos = await getChromeFolderPosition(newTabPage, bId);

        console.log(
            `No-op test: before=${beforePos.chromeFolderOnly} after=${afterPos.chromeFolderOnly}`
        );

        expect(
            afterPos.chromeFolderOnly,
            `No-op drag should leave folder-only index unchanged.\n` +
            `Before: ${beforePos.chromeFolderOnly}, After: ${afterPos.chromeFolderOnly}`
        ).toBe(beforePos.chromeFolderOnly);
    });
});
