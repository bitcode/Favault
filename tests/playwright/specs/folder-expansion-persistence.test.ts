import { test, expect, ExtensionTestUtils } from '../fixtures/extension';
import { BookmarkTestUtils } from '../utils/bookmark-utils';
import { DragDropTestUtils } from '../utils/dragdrop-utils';

// STORAGE KEY must match src/lib/folder-state.ts
const STORAGE_KEY = 'favault-folder-expansion';

test.describe('Folder expansion persistence', () => {
  let bookmarkUtils: BookmarkTestUtils;
  let dragUtils: DragDropTestUtils;

  test.beforeEach(async ({ newTabPage, context }) => {
    // Use context-aware utils so we can generate test data when needed
    bookmarkUtils = new BookmarkTestUtils(newTabPage, context);
    dragUtils = new DragDropTestUtils(newTabPage);

    await ExtensionTestUtils.waitForExtensionReady(newTabPage);

    // Ensure there are enough folders for persistence testing
    // This utility will try real Chrome bookmark API first, and falls back to mock DOM
    await bookmarkUtils.setupTestBookmarks();

    await bookmarkUtils.waitForBookmarksToLoad();
  });

  async function readExpansionMap(page) {
    return await page.evaluate(async (STORAGE_KEY) => {
      const result: any = { source: 'none', map: {} };
      try {
        // Try chrome.storage.local first
        if (typeof chrome !== 'undefined' && chrome.storage?.local?.get) {
          const local = await chrome.storage.local.get(STORAGE_KEY);
          if (local && local[STORAGE_KEY] && Object.keys(local[STORAGE_KEY]).length) {
            result.source = 'chrome.storage.local';
            result.map = local[STORAGE_KEY];
            return result;
          }
        }
      } catch (_) {}
      try {
        // Fallback to chrome.storage.sync
        if (typeof chrome !== 'undefined' && chrome.storage?.sync?.get) {
          const sync = await chrome.storage.sync.get(STORAGE_KEY);
          if (sync && sync[STORAGE_KEY] && Object.keys(sync[STORAGE_KEY]).length) {
            result.source = 'chrome.storage.sync';
            result.map = sync[STORAGE_KEY];
            return result;
          }
        }
      } catch (_) {}
      try {
        // Fallback to window.localStorage
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          result.source = 'window.localStorage';
          result.map = JSON.parse(raw);
          return result;
        }
      } catch (_) {}
      return result;
    }, STORAGE_KEY);
  }

  async function mapFolderTitlesToIds(page, titles: string[]) {
    return await page.evaluate(async (titles) => {
      const results: Record<string, string> = {};
      if (typeof chrome === 'undefined' || !chrome.bookmarks?.getTree) {
        return results;
      }
      const tree = await chrome.bookmarks.getTree();
      const flat: any[] = [];
      const walk = (node: any) => {
        flat.push(node);
        if (node.children) node.children.forEach(walk);
      };
      tree.forEach(walk);
      for (const t of titles) {
        const match = flat.find(n => !n.url && n.title === t);
        if (match) results[t] = match.id;
      }
      return results;
    }, titles);
  }

  function folderLocatorByTitle(page, title: string) {
    return page.locator('.folder-container, [data-testid="bookmark-folder"]').filter({ hasText: title }).first();
  }

  async function isFolderExpanded(page, title: string) {
    const folder = folderLocatorByTitle(page, title);
    const grid = folder.locator('.bookmarks-grid');
    return await grid.count().then(async c => c > 0 && await grid.first().isVisible());
  }

  async function setFolderExpanded(page, title: string, expanded: boolean) {
    const header = folderLocatorByTitle(page, title).locator('.folder-header');
    // Toggle until desired
    for (let i = 0; i < 3; i++) {
      const current = await isFolderExpanded(page, title);
      if (current === expanded) return;
      await header.click();
      await page.waitForTimeout(100);
    }
  }

  test('persists expand/collapse immediately, across tabs, reloads, and modes', async ({ newTabPage, context, extensionPage }) => {
    // 1) Setup: collect 3 folder titles visible in UI
    const titles = (await bookmarkUtils.getFolderTitles()).slice(0, 3);
    test.skip(titles.length < 2, 'Need at least 2 folders to run persistence test');

    // Map to bookmark IDs for storage assertions
    const titleToId = await mapFolderTitlesToIds(newTabPage, titles);

    // 2) Manipulate state: create mixed expansion states
    const desiredStates: Record<string, boolean> = {};
    titles.forEach((t, i) => desiredStates[t] = i % 2 === 0); // alternate expanded/collapsed

    const toggleTimings: Record<string, number> = {};

    for (const t of titles) {
      const before = Date.now();
      await setFolderExpanded(newTabPage, t, desiredStates[t]);
      // 3) Immediate persistence: wait for storage to reflect change
      const id = titleToId[t];
      if (id) {
        await newTabPage.waitForFunction(({ STORAGE_KEY, id, expected }) => {
          return (async () => {
            try {
              const local = await chrome.storage.local.get(STORAGE_KEY);
              const map = local?.[STORAGE_KEY] || {};
              if (id in map) return map[id] === expected;
            } catch {}
            try {
              const sync = await chrome.storage.sync.get(STORAGE_KEY);
              const map = sync?.[STORAGE_KEY] || {};
              if (id in map) return map[id] === expected;
            } catch {}
            try {
              const raw = localStorage.getItem(STORAGE_KEY);
              if (raw) {
                const map = JSON.parse(raw);
                if (id in map) return map[id] === expected;
              }
            } catch {}
            return false;
          })();
        }, { STORAGE_KEY, id, expected: desiredStates[t] });
      } else {
        // Fallback: if we couldn't resolve a bookmark id for this title, at least ensure the UI reflects the change
        await newTabPage.waitForFunction(({ title, expected }) => {
          const folders = Array.from(document.querySelectorAll('.folder-container')) as HTMLElement[];
          const target = folders.find(f => f.textContent?.trim().includes(title));
          if (!target) return false;
          const expanded = !!target.querySelector('.bookmarks-grid');
          return expanded === expected;
        }, { title: t, expected: desiredStates[t] });
        test.info().annotations.push({ type: 'note', description: `Skipped storage assertion for folder "${t}" due to missing bookmark id mapping.` });
      }
      toggleTimings[t] = Date.now() - before;
    }

    // Verify UI states match desired
    for (const t of titles) {
      expect(await isFolderExpanded(newTabPage, t)).toBe(desiredStates[t]);
    }

    // Read and log storage map
    const storageSnapshot1 = await readExpansionMap(newTabPage);

    // 4) Cross-tab consistency: open a brand new tab in same context and verify
    const tab2 = await context.newPage();
    await tab2.goto('chrome://newtab/');
    await ExtensionTestUtils.waitForExtensionReady(tab2);
    await (new BookmarkTestUtils(tab2)).waitForBookmarksToLoad();

    for (const t of titles) {
      expect(await isFolderExpanded(tab2, t)).toBe(desiredStates[t]);
    }
    const storageSnapshot2 = await readExpansionMap(tab2);
    expect(storageSnapshot2.map).toMatchObject(storageSnapshot1.map);

    // 5) Session persistence: reload and verify restoration
    await newTabPage.reload();
    await bookmarkUtils.waitForBookmarksToLoad();
    for (const t of titles) {
      expect(await isFolderExpanded(newTabPage, t)).toBe(desiredStates[t]);
    }

    // 6) Edge case: switch edit/view mode
    await ExtensionTestUtils.enableEditMode(newTabPage);
    for (const t of titles) {
      expect(await isFolderExpanded(newTabPage, t)).toBe(desiredStates[t]);
    }
    await ExtensionTestUtils.disableEditMode(newTabPage);
    for (const t of titles) {
      expect(await isFolderExpanded(newTabPage, t)).toBe(desiredStates[t]);
    }

    // 7) Edge case: auto-expansion during drag enter persists (best-effort)
    // Pick a folder and ensure it is collapsed, then drag a bookmark over it
    const candidate = titles.find(t => desiredStates[t] === false) || titles[0];
    await setFolderExpanded(newTabPage, candidate, false);

    // Ensure there is at least one visible bookmark somewhere
    const allBookmarks = await newTabPage.locator('.bookmark-item, [data-testid="bookmark-item"]').all();
    if (allBookmarks.length > 0) {
      // Hover-drag over the collapsed folder header to simulate drag enter
      const src = allBookmarks[0];
      const tgtHeader = folderLocatorByTitle(newTabPage, candidate).locator('.folder-header');

      // Perform a partial drag (mouse down, move over header, then up)
      const srcBox = await src.boundingBox();
      const tgtBox = await tgtHeader.boundingBox();
      if (srcBox && tgtBox) {
        await newTabPage.mouse.move(srcBox.x + srcBox.width / 2, srcBox.y + srcBox.height / 2);
        await newTabPage.mouse.down();
        await newTabPage.mouse.move(tgtBox.x + tgtBox.width / 2, tgtBox.y + 5);
        await newTabPage.waitForTimeout(500);
        await newTabPage.mouse.up();
      }

      const autoExpanded = await isFolderExpanded(newTabPage, candidate);
      if (autoExpanded) {
        // If auto-expanded, verify it persisted
        const id = titleToId[candidate];
        await newTabPage.waitForFunction(({ STORAGE_KEY, id }) => {
          return (async () => {
            try {
              const local = await chrome.storage.local.get(STORAGE_KEY);
              const map = local?.[STORAGE_KEY] || {};
              return id && map[id] === true;
            } catch {}
            return false;
          })();
        }, { STORAGE_KEY, id });
        expect(await isFolderExpanded(newTabPage, candidate)).toBe(true);
      } else {
        test.info().annotations.push({ type: 'note', description: 'Auto-expansion on drag not supported in current UI; skipping persistence assertion for this sub-case.' });
      }
    } else {
      test.info().annotations.push({ type: 'note', description: 'No bookmarks available to simulate drag enter; skipping drag auto-expansion sub-test.' });
    }

    // Structured report for debugging
    const report = {
      titles,
      titleToId,
      desiredStates,
      timingsMs: toggleTimings,
      storageSource: storageSnapshot1.source,
      storageMap: storageSnapshot1.map,
    } as const;
    // eslint-disable-next-line no-console
    console.log('📊 Folder expansion persistence report:', JSON.stringify(report, null, 2));
  });
});

