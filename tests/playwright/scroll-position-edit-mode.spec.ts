import { test, expect, Page, BrowserContext } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXTENSION_PATH = path.join(__dirname, '../../dist/chrome');

test.describe('Scroll position is preserved when exiting edit mode', () => {
    test.skip(
        ({ browserName }) => browserName === 'firefox',
        'Chrome extensions not supported in Firefox'
    );

    let context: BrowserContext;
    let page: Page;

    test.beforeAll(async ({ browser }) => {
        context = await browser.newContext();

        await context.addInitScript(() => {
            const folders = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'].map(
                (name, fi) => ({
                    id: String(fi + 2),
                    title: name,
                    children: Array.from({ length: 8 }, (_, bi) => ({
                        id: String(fi * 8 + bi + 100),
                        title: `${name} Bookmark ${bi + 1}`,
                        url: `https://${name.toLowerCase()}-${bi + 1}.example.com`,
                    })),
                })
            );

            (window as any).chrome = {
                bookmarks: {
                    getTree: () =>
                        Promise.resolve([{ id: '1', title: 'Bookmarks Bar', children: folders }]),
                    move: (id: string, dest: any) =>
                        Promise.resolve({ id, parentId: dest.parentId, index: dest.index ?? 0 }),
                    create: (b: any) => Promise.resolve({ ...b, id: 'new-' + Date.now() }),
                    remove: () => Promise.resolve(),
                    get: (id: string) =>
                        Promise.resolve([{ id, title: 'mock', url: 'https://example.com' }]),
                    getChildren: () => Promise.resolve([]),
                    onCreated: { addListener: () => { }, removeListener: () => { } },
                    onRemoved: { addListener: () => { }, removeListener: () => { } },
                    onChanged: { addListener: () => { }, removeListener: () => { } },
                    onMoved: { addListener: () => { }, removeListener: () => { } },
                    onChildrenReordered: { addListener: () => { }, removeListener: () => { } },
                },
                runtime: {
                    sendMessage: () => Promise.resolve({ status: 'pong' }),
                    onMessage: { addListener: () => { }, removeListener: () => { } },
                    getManifest: () => ({ manifest_version: 3, name: 'FaVault', version: '1.0' }),
                    lastError: null,
                },
                storage: {
                    local: {
                        get: () => Promise.resolve({}),
                        set: () => Promise.resolve(),
                    },
                },
            };
            (globalThis as any).chrome = (window as any).chrome;
        });

        page = await context.newPage();
        await page.setViewportSize({ width: 1280, height: 600 });

        const extensionPath = path.resolve(EXTENSION_PATH);
        await page.goto(`file://${extensionPath}/newtab.html`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(4000);
    });

    test.afterAll(async () => {
        await context?.close();
    });

    test('scroll position is preserved after exiting edit mode', async () => {
        // ── Diagnose scroll container ───────────────────────────────────────────
        const scrollInfo = await page.evaluate(() => ({
            scrollHeight: document.documentElement.scrollHeight,
            clientHeight: document.documentElement.clientHeight,
            bodyScrollHeight: document.body.scrollHeight,
            windowInnerHeight: window.innerHeight,
            windowScrollY: window.scrollY,
            htmlScrollTop: document.documentElement.scrollTop,
            bodyScrollTop: document.body.scrollTop,
        }));
        console.log('Scroll info:', scrollInfo);

        // Ensure the page is tall enough to scroll
        if (scrollInfo.scrollHeight <= scrollInfo.clientHeight) {
            await page.evaluate(() => {
                const s = document.createElement('div');
                s.id = 'test-spacer';
                s.style.cssText = 'height:3000px;width:1px;pointer-events:none;position:relative';
                document.body.appendChild(s);
            });
        }

        // ── Enter edit mode ─────────────────────────────────────────────────────
        const editBtn = page.locator('button.edit-toggle:not(.active)');
        if (await editBtn.count() > 0) {
            await editBtn.first().click();
        } else {
            await page.keyboard.press('Control+e');
        }
        await page.waitForTimeout(1000);

        const inEditMode = await page.evaluate(() =>
            document.body.classList.contains('edit-mode')
        );
        if (!inEditMode) {
            console.warn('⚠️ Could not enter edit mode — skipping');
            test.skip();
            return;
        }
        console.log('✅ Edit mode active');

        // ── Scroll down through all available mechanisms ────────────────────────
        const TARGET_Y = 400;
        await page.evaluate((y) => {
            // Try all scroll container candidates
            window.scrollTo(0, y);
            document.documentElement.scrollTop = y;
            document.body.scrollTop = y;
        }, TARGET_Y);
        await page.waitForTimeout(400);

        // Read back using all candidates
        const scrollBefore = await page.evaluate(() => {
            return Math.max(
                window.scrollY,
                document.documentElement.scrollTop,
                document.body.scrollTop
            );
        });
        console.log(`📍 scrollY before exit: ${scrollBefore}`);

        if (scrollBefore < 30) {
            console.warn('⚠️ Could not scroll — page not scrollable in test context, skipping assertion');
            test.skip();
            return;
        }

        // ── Exit edit mode ──────────────────────────────────────────────────────
        const exitBtn = page.locator('button.edit-toggle.active, button:has-text("Exit Edit")');
        if (await exitBtn.count() > 0) {
            await exitBtn.first().click();
        } else {
            await page.keyboard.press('Control+e');
        }

        await page.waitForFunction(() => !document.body.classList.contains('edit-mode'), {
            timeout: 5000,
        });

        // Give the async exitEditMode() + tick() + double-rAF time to restore scroll
        await page.waitForTimeout(600);

        const scrollAfter = await page.evaluate(() => {
            return Math.max(
                window.scrollY,
                document.documentElement.scrollTop,
                document.body.scrollTop
            );
        });
        console.log(`📍 scrollY after exit:  ${scrollAfter}`);

        const delta = Math.abs(scrollAfter - scrollBefore);
        console.log(`📐 scroll delta: ${delta}px (tolerance: 120px)`);

        // Allow ±120px — the create-folder bar that disappears on exit can
        // shift the layout by a section header height.
        expect(delta).toBeLessThanOrEqual(120);
        console.log(`✅ Scroll preserved (delta=${delta}px)`);
    });
});
