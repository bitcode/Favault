/**
 * Unit tests for section drag-and-drop index mapping math.
 *
 * These tests run purely in Node (no browser) to validate the core
 * `moveFolderToPosition` index algebra independently of the Chrome
 * bookmarks API.
 *
 * Chrome bookmarks.move(id, {index: N}) semantics:
 *   1. Removes `id` from its current position.
 *   2. Inserts `id` at position N in the already-shrunk parent list.
 *
 * Correct formula (insertion-index mode, gap G, N folders):
 *   insertionChrome = ChromeIdxOf(folderSiblings[G])   (or parentLen for end)
 *   targetIndex     = fromChrome < insertionChrome
 *                     ? insertionChrome - 1    (moving down)
 *                     : insertionChrome         (moving up or same)
 *   uiTargetDisplayIdx = fromFolderSiblingIdx < G
 *                        ? G - 1   (moving down)
 *                        : G       (moving up or same)
 *
 * Run with:  npx playwright test tests/unit/section-dnd-index-math.test.ts
 */

import { test, expect } from '@playwright/test';

// ─── Pure helper — mirrors the logic in dragdrop-enhanced.ts ─────────────────

interface CalcResult {
    uiTargetDisplayIdx: number;
    targetIndex: number;   // Chrome API index
}

/**
 * Calculate the correct Chrome API index and UI display index for a section move.
 */
function calcMove(
    fromFolderSiblingIdx: number,
    fromChromeIdx: number,
    clampedGap: number,
    folderCount: number,
    folderChromeSiblingIdxOf: (folderIdx: number) => number,
    parentChildCount: number,
): CalcResult {
    let uiTargetDisplayIdx: number;
    let insertionChrome: number;

    if (clampedGap >= folderCount) {
        // Drop at end
        insertionChrome = parentChildCount;
        uiTargetDisplayIdx = Math.max(0, folderCount - 1);
    } else {
        insertionChrome = folderChromeSiblingIdxOf(clampedGap);
        uiTargetDisplayIdx = fromFolderSiblingIdx < clampedGap
            ? clampedGap - 1   // moving down
            : clampedGap;      // moving up or same
    }

    const targetIndex = fromChromeIdx < insertionChrome
        ? insertionChrome - 1   // moving down: Chrome removes item first → offset
        : insertionChrome;      // moving up or same: no offset

    return { uiTargetDisplayIdx, targetIndex };
}

/** Simulate chrome.bookmarks.move: remove from fromIdx, insert at targetIndex. */
function simulateChromeMove<T>(arr: T[], fromIdx: number, targetIndex: number): T[] {
    const copy = [...arr];
    const [item] = copy.splice(fromIdx, 1);
    const insertAt = Math.min(targetIndex, copy.length);
    copy.splice(insertAt, 0, item);
    return copy;
}

/** Apply optimisticFolderReorder splice logic. */
function applyMove<T>(arr: T[], fromIdx: number, toIdx: number): T[] {
    const copy = [...arr];
    const [item] = copy.splice(fromIdx, 1);
    const clampedTo = Math.max(0, Math.min(toIdx, copy.length));
    copy.splice(clampedTo, 0, item);
    return copy;
}

// ─── Convenience builder ──────────────────────────────────────────────────────

/** Build an all-folders array (no loose bookmarks). */
const allFolders = (n: number) => Array.from({ length: n }, (_, i) => `S${i + 1}`);
// When no loose bookmarks, ChromeIdx(folderIdx) === folderIdx
const identity = (i: number) => i;

/** Run a complete move scenario for an all-folders parent. */
function runAllFolders(
    fromIdx: number,
    gap: number,
    expectedFinal: string[],
): { passed: boolean; chromeActual: string[]; uiActual: string[]; details: CalcResult } {
    const N = expectedFinal.length;
    const clampedGap = Math.max(0, Math.min(gap, N));
    const result = calcMove(fromIdx, fromIdx, clampedGap, N, identity, N);
    const folders = allFolders(N);
    const chromeActual = simulateChromeMove(folders, fromIdx, result.targetIndex);
    const uiActual = applyMove(folders, fromIdx, result.uiTargetDisplayIdx);
    return {
        passed: JSON.stringify(chromeActual) === JSON.stringify(expectedFinal)
            && JSON.stringify(uiActual) === JSON.stringify(expectedFinal),
        chromeActual,
        uiActual,
        details: result,
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Section DnD index mapping — all-folders parent (5 sections)', () => {
    const N = 5;

    // Helper that builds the assertion label
    function scenario(
        label: string,
        fromIdx: number,
        gap: number,
        expectedFinal: string[],
    ) {
        test(label, () => {
            const r = runAllFolders(fromIdx, gap, expectedFinal);
            expect(
                r.chromeActual,
                `Chrome result mismatch for "${label}".\n` +
                `  calcMove returned: targetIndex=${r.details.targetIndex}, uiTargetDisplayIdx=${r.details.uiTargetDisplayIdx}`
            ).toEqual(expectedFinal);
            expect(
                r.uiActual,
                `UI (optimistic) result mismatch for "${label}".\n` +
                `  calcMove returned: targetIndex=${r.details.targetIndex}, uiTargetDisplayIdx=${r.details.uiTargetDisplayIdx}`
            ).toEqual(expectedFinal);
        });
    }

    // ── No-op / same-slot drops ────────────────────────────────────────────
    scenario(
        'NOOP: S2 (idx 1) → gap 1 (right before itself)',
        1, 1, ['S1', 'S2', 'S3', 'S4', 'S5'],
    );
    scenario(
        'NOOP: S2 (idx 1) → gap 2 (right after itself)',
        1, 2, ['S1', 'S2', 'S3', 'S4', 'S5'],
    );
    scenario(
        'NOOP: S1 (idx 0) → gap 0 (right before itself)',
        0, 0, ['S1', 'S2', 'S3', 'S4', 'S5'],
    );
    scenario(
        'NOOP: S5 (idx 4) → gap 5 (right after itself / end)',
        4, 5, ['S1', 'S2', 'S3', 'S4', 'S5'],
    );

    // ── Moving DOWN ────────────────────────────────────────────────────────
    scenario(
        'DOWN: S1 (idx 0) → gap 2 → lands at index 1 (between S2 and S3)',
        0, 2, ['S2', 'S1', 'S3', 'S4', 'S5'],
    );
    scenario(
        'DOWN: S1 (idx 0) → gap 3 → lands at index 2 (between S3 and S4)',
        0, 3, ['S2', 'S3', 'S1', 'S4', 'S5'],
    );
    scenario(
        'DOWN: S1 (idx 0) → gap 5 (end) → moves to last',
        0, 5, ['S2', 'S3', 'S4', 'S5', 'S1'],
    );
    scenario(
        'DOWN: S2 (idx 1) → gap 3 → lands at index 2 (between S3 and S4)',
        1, 3, ['S1', 'S3', 'S2', 'S4', 'S5'],
    );
    scenario(
        'DOWN: S2 (idx 1) → gap 4 → lands at index 3 (between S4 and S5)',
        1, 4, ['S1', 'S3', 'S4', 'S2', 'S5'],
    );
    scenario(
        'DOWN: S2 (idx 1) → gap 5 (end) → moves to last',
        1, 5, ['S1', 'S3', 'S4', 'S5', 'S2'],
    );
    scenario(
        'DOWN: S3 (idx 2) → gap 4 → lands at index 3 (between S4 and S5)',
        2, 4, ['S1', 'S2', 'S4', 'S3', 'S5'],
    );
    scenario(
        'DOWN: S3 (idx 2) → gap 5 (end) → moves to last',
        2, 5, ['S1', 'S2', 'S4', 'S5', 'S3'],
    );

    // ── Moving UP ──────────────────────────────────────────────────────────
    scenario(
        'UP: S5 (idx 4) → gap 0 → moves to first',
        4, 0, ['S5', 'S1', 'S2', 'S3', 'S4'],
    );
    scenario(
        'UP: S5 (idx 4) → gap 1 → lands between S1 and S2',
        4, 1, ['S1', 'S5', 'S2', 'S3', 'S4'],
    );
    scenario(
        'UP: S5 (idx 4) → gap 2 → lands between S2 and S3',
        4, 2, ['S1', 'S2', 'S5', 'S3', 'S4'],
    );
    scenario(
        'UP: S4 (idx 3) → gap 0 → moves to first',
        3, 0, ['S4', 'S1', 'S2', 'S3', 'S5'],
    );
    scenario(
        'UP: S4 (idx 3) → gap 2 → lands between S2 and S3',
        3, 2, ['S1', 'S2', 'S4', 'S3', 'S5'],
    );
    scenario(
        'UP: S3 (idx 2) → gap 0 → moves to first',
        2, 0, ['S3', 'S1', 'S2', 'S4', 'S5'],
    );
    scenario(
        'UP: S3 (idx 2) → gap 1 → lands between S1 and S2',
        2, 1, ['S1', 'S3', 'S2', 'S4', 'S5'],
    );
});

test.describe('Section DnD index mapping — with loose bookmarks interspersed', () => {
    /**
     * Parent: [BK1(0), S1(1), BK2(2), S2(3), S3(4), BK3(5), S4(6)]
     * folderSiblings = [S1, S2, S3, S4], chromeIndices = [1, 3, 4, 6]
     * parentChildCount = 7
     */
    const folderSiblings = ['S1', 'S2', 'S3', 'S4'];
    const folderChromeIndices = [1, 3, 4, 6];
    const parentChildren = ['BK1', 'S1', 'BK2', 'S2', 'S3', 'BK3', 'S4'];
    const N = 4;

    function runWithLoose(fromFolderIdx: number, gap: number): { chromeFolders: string[]; uiFolders: string[]; details: CalcResult } {
        const fromChromeIdx = folderChromeIndices[fromFolderIdx];
        const clampedGap = Math.max(0, Math.min(gap, N));
        const result = calcMove(
            fromFolderIdx, fromChromeIdx, clampedGap, N,
            (i) => folderChromeIndices[i] ?? i,
            parentChildren.length,
        );
        const newParent = simulateChromeMove([...parentChildren], fromChromeIdx, result.targetIndex);
        const chromeFolders = newParent.filter(s => !s.startsWith('BK'));
        const uiFolders = applyMove([...folderSiblings], fromFolderIdx, result.uiTargetDisplayIdx);
        return { chromeFolders, uiFolders, details: result };
    }

    test('S1 (chromeIdx=1) → gap 3 → lands between S3 and S4', () => {
        const r = runWithLoose(0, 3);
        // After move: chrome order should be [S2, S3, S1, S4]
        expect(r.chromeFolders).toEqual(['S2', 'S3', 'S1', 'S4']);
        expect(r.uiFolders).toEqual(['S2', 'S3', 'S1', 'S4']);
    });

    test('S4 (chromeIdx=6) → gap 1 → lands between S1 and S2', () => {
        const r = runWithLoose(3, 1);
        expect(r.chromeFolders).toEqual(['S1', 'S4', 'S2', 'S3']);
        expect(r.uiFolders).toEqual(['S1', 'S4', 'S2', 'S3']);
    });

    test('S2 (chromeIdx=3) → gap 0 → moves to front', () => {
        const r = runWithLoose(1, 0);
        expect(r.chromeFolders).toEqual(['S2', 'S1', 'S3', 'S4']);
        expect(r.uiFolders).toEqual(['S2', 'S1', 'S3', 'S4']);
    });

    test('S1 (chromeIdx=1) → gap 0 (before itself) → no-op', () => {
        const r = runWithLoose(0, 0);
        expect(r.chromeFolders).toEqual(['S1', 'S2', 'S3', 'S4']);
    });

    test('S1 (chromeIdx=1) → gap 4 (end) → moves to last', () => {
        const r = runWithLoose(0, 4);
        expect(r.chromeFolders).toEqual(['S2', 'S3', 'S4', 'S1']);
        expect(r.uiFolders).toEqual(['S2', 'S3', 'S4', 'S1']);
    });
});

test.describe('Edge cases', () => {
    test('single folder: any gap is a no-op', () => {
        for (const gap of [0, 1, 99]) {
            const clampedGap = Math.max(0, Math.min(gap, 1));
            const r = calcMove(0, 0, clampedGap, 1, identity, 1);
            const result = simulateChromeMove(['Only'], 0, r.targetIndex);
            expect(result).toEqual(['Only']);
        }
    });

    test('two folders: swap first↔last both ways', () => {
        // First to last
        const r1 = calcMove(0, 0, 2, 2, identity, 2);
        expect(simulateChromeMove(['A', 'B'], 0, r1.targetIndex)).toEqual(['B', 'A']);
        expect(applyMove(['A', 'B'], 0, r1.uiTargetDisplayIdx)).toEqual(['B', 'A']);

        // Last to first
        const r2 = calcMove(1, 1, 0, 2, identity, 2);
        expect(simulateChromeMove(['A', 'B'], 1, r2.targetIndex)).toEqual(['B', 'A']);
        expect(applyMove(['A', 'B'], 1, r2.uiTargetDisplayIdx)).toEqual(['B', 'A']);
    });

    test('over-large gap clamps to last valid position', () => {
        const r = calcMove(0, 0, 99, 5, identity, 5);
        // gap 99 >= folderCount 5, so drop at end
        expect(r.uiTargetDisplayIdx).toBe(4);
        const result = simulateChromeMove(['S1', 'S2', 'S3', 'S4', 'S5'], 0, r.targetIndex);
        expect(result).toEqual(['S2', 'S3', 'S4', 'S5', 'S1']);
    });
});
