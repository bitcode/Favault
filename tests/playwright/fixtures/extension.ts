import { test as base, chromium, firefox, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { mkdir, mkdtemp, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getExtensionProtocol, navigateToExtensionHome, resolveExtensionOrigin } from '../utils/extension-target';
import { FIREFOX_USER_PREFS } from '../utils/firefox-prefs';

export { FIREFOX_USER_PREFS };

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Extended test fixtures for FaVault browser extension testing
 * Provides extension loading, context management, and utility functions
 */

export interface ExtensionFixtures {
  context: BrowserContext;
  extensionId: string;
  extensionPage: Page;
  newTabPage: Page;
}

function isEnvEnabled(name: string, defaultValue = false): boolean {
  const value = process.env[name];
  if (value === undefined) {
    return defaultValue;
  }

  return value === '1' || value.toLowerCase() === 'true';
}

const FIREFOX_PROFILE_ROOT = path.join(process.cwd(), '.playwright');

async function getFirefoxAddonId(extensionPath: string): Promise<string> {
  const manifestPath = path.join(extensionPath, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const addonId = manifest.browser_specific_settings?.gecko?.id;

  if (!addonId) {
    throw new Error(`Firefox manifest is missing browser_specific_settings.gecko.id: ${manifestPath}`);
  }

  return addonId;
}

async function prepareFirefoxProfile(extensionPath: string): Promise<{ profileDir: string; addonId: string; policiesPath: string }> {
  await mkdir(FIREFOX_PROFILE_ROOT, { recursive: true });
  const profileDir = await mkdtemp(path.join(FIREFOX_PROFILE_ROOT, 'firefox-extension-profile-'));

  const userJs = `${Object.entries(FIREFOX_USER_PREFS)
    .map(([key, value]) =>
      typeof value === 'string'
        ? `user_pref("${key}", ${JSON.stringify(value)});`
        : `user_pref("${key}", ${value});`
    )
    .join('\n')}\n`;

  await writeFile(path.join(profileDir, 'user.js'), userJs, 'utf8');

  const addonId = await getFirefoxAddonId(extensionPath);

  // Use Firefox Enterprise Policies to force-install the extension.
  // The policy approach uses a different code path than normal XPI scanning —
  // it bypasses signature requirements and installs the extension synchronously.
  // Playwright's Firefox supports this via PLAYWRIGHT_FIREFOX_POLICIES_JSON env var.
  const xpiPath = path.join(process.cwd(), 'dist', 'favault-firefox.xpi');
  const policies = {
    policies: {
      ExtensionSettings: {
        [addonId]: {
          installation_mode: 'force_installed',
          install_url: `file://${xpiPath}`
        }
      }
    }
  };
  const policiesPath = path.join(profileDir, 'policies.json');
  await writeFile(policiesPath, JSON.stringify(policies, null, 2), 'utf8');

  console.log(`Prepared Firefox policies.json: ${policiesPath}`);
  console.log(`  Force-installing: ${addonId} from ${xpiPath}`);

  return { profileDir, addonId, policiesPath };
}

/**
 * Wait for the Firefox XPI newtab override to become active, then return the extension origin.
 *
 * Firefox installs XPI extensions asynchronously after launch. The approach that works:
 * 1. Open about:newtab immediately — this triggers Firefox to resolve the newtab handler,
 *    which kicks off the XPI scanner if it hasn't started.
 * 2. Wait a fixed idle period for the XPI to fully activate.
 * 3. Probe about:newtab again — by now the extension newtab override is registered.
 */
async function waitForFirefoxExtensionReady(
  context: BrowserContext,
  idleWaitMs = 3000
): Promise<string> {
  // Open about:newtab immediately — this can trigger Firefox to process the extension proxy file.
  const probe1 = await context.newPage();
  try {
    await probe1.goto('about:newtab', { waitUntil: 'domcontentloaded', timeout: 8000 });
    await probe1.waitForTimeout(500);
    const url1 = probe1.url();
    if (url1.startsWith('moz-extension://')) {
      return new URL(url1).origin;
    }
    console.log(`Firefox newtab first probe: ${url1}. Waiting ${idleWaitMs}ms...`);
  } catch {
    // ignore
  } finally {
    await probe1.close().catch(() => {});
  }

  await new Promise((resolve) => setTimeout(resolve, idleWaitMs));

  const probe2 = await context.newPage();
  try {
    await probe2.goto('about:newtab', { waitUntil: 'domcontentloaded', timeout: 8000 });
    const url2 = probe2.url();
    console.log(`Firefox newtab second probe: ${url2}`);
    if (url2.startsWith('moz-extension://')) {
      return new URL(url2).origin;
    }
    return '';
  } catch {
    return '';
  } finally {
    await probe2.close().catch(() => {});
  }
}

async function launchFirefoxExtensionContext(pathToExtension: string): Promise<BrowserContext> {
  // Default: headed locally, headless on CI. Override with PLAYWRIGHT_FIREFOX_HEADLESS=1.
  const headless = isEnvEnabled('PLAYWRIGHT_FIREFOX_HEADLESS', !!process.env.CI);
  const executablePath = process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH;
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { profileDir, addonId, policiesPath } = await prepareFirefoxProfile(pathToExtension);
      console.log(`Launching Firefox extension context (attempt ${attempt}/2)...`);
      console.log(`Using Firefox profile: ${profileDir}`);
      console.log(`Using Firefox add-on ID: ${addonId}`);

      // Tell Playwright's Firefox to load our policies.json.
      // We pass the path both via env var (used by playwright.cfg's getenv() call)
      // and directly via firefoxUserPrefs (as a fallback).
      process.env.PLAYWRIGHT_FIREFOX_POLICIES_JSON = policiesPath;

      const context = await firefox.launchPersistentContext(profileDir, {
        headless,
        executablePath,
        acceptDownloads: true,
        firefoxUserPrefs: {
          ...FIREFOX_USER_PREFS,
          // Directly set the policies path pref (Firefox reads this at startup).
          'browser.policies.alternatePath': policiesPath
        },
        viewport: { width: 1280, height: 720 },
        recordVideo: {
          dir: 'test-results/videos/',
          size: { width: 1280, height: 720 }
        }
      });

      // Close any pages Firefox auto-opened (welcome tabs, tour pages, etc.) before
      // Playwright gets control. These interfere with extension test navigation.
      await closeFirefoxWelcomeTabs(context);

      // Wait for the XPI newtab override to become active before returning the context.
      // Any downstream fixture (page, newTabPage, etc.) will then see the extension URL
      // when navigating to about:newtab, regardless of which fixtures the test requests.
      const extensionOrigin = await waitForFirefoxExtensionReady(context);
      console.log(`Firefox extension active: ${extensionOrigin || '(not detected — tests will navigate directly)'}`);

      return context;
    } catch (error) {
      lastError = error;
      console.warn(`Firefox extension launch/install attempt ${attempt} failed:`, error);
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }

  throw lastError;
}

/**
 * Close any tabs Firefox automatically opens on startup (welcome page, tour, etc.)
 * that are not part of the extension. These can block test navigation.
 */
async function closeFirefoxWelcomeTabs(context: BrowserContext): Promise<void> {
  const welcomePatterns = [
    'about:welcome',
    'about:home',
    'https://www.mozilla.org',
    'firefox.com',
    'support.mozilla.org'
  ];

  const pages = context.pages();
  for (const page of pages) {
    const url = page.url();
    const isWelcomePage = welcomePatterns.some((pattern) => url.includes(pattern));
    if (isWelcomePage) {
      console.log(`Closing Firefox welcome tab: ${url}`);
      try {
        await page.close();
      } catch {
        // Page may have already closed
      }
    }
  }
}

export const test = base.extend<ExtensionFixtures>({
  /**
   * Browser context with extension loaded
   */
  context: [async ({ browserName }, use, testInfo: TestInfo) => {
    const isFirefox = browserName === 'firefox';
    // browserName is always 'chromium' for Edge — detect Edge via the project's channel setting
    const projectChannel = (testInfo.project.use as { channel?: string }).channel;
    const isEdge = projectChannel === 'msedge';
    const distDir = isFirefox ? 'firefox' : isEdge ? 'edge' : 'chrome';
    const pathToExtension = path.join(__dirname, `../../../dist/${distDir}`);

    const context = isFirefox
      ? await launchFirefoxExtensionContext(pathToExtension)
      : await chromium.launchPersistentContext('', {
          channel: isEdge ? 'msedge' : 'chromium',
          headless: false,
          args: [
            `--disable-extensions-except=${pathToExtension}`,
            `--load-extension=${pathToExtension}`,
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
          ],
          viewport: { width: 1280, height: 720 },
          recordVideo: {
            dir: 'test-results/videos/',
            size: { width: 1280, height: 720 }
          }
        });

    await use(context);
    await context.close();
  }, { timeout: 90000 }],

  /**
   * Extension ID extracted from service worker
   */
  extensionId: async ({ context, browserName }, use) => {
    const extensionOrigin = await resolveExtensionOrigin(context, browserName);
    const extensionId = extensionOrigin ? new URL(extensionOrigin).hostname : '';
    console.log('Extension ID:', extensionId);

    await use(extensionId);
  },

  /**
   * Extension popup page
   */
  extensionPage: async ({ context, extensionId, browserName }, use) => {
    // Create new page for extension popup
    const page = await context.newPage();
    const extensionOrigin = extensionId
      ? `${getExtensionProtocol(browserName)}//${extensionId}`
      : await resolveExtensionOrigin(context, browserName);
    
    // Navigate to extension popup (if it exists)
    // For new tab extensions, we'll use the new tab page
    if (!extensionOrigin) {
      throw new Error('Unable to resolve extension origin for extension page');
    }
    await page.goto(`${extensionOrigin}/newtab.html`);
    
    // Wait for extension to load
    await page.waitForLoadState('networkidle');
    
    await use(page);
    await page.close();
  },

  /**
   * New tab page with extension loaded
   */
  newTabPage: async ({ context, extensionId, browserName }, use) => {
    const page = await context.newPage();
    const extensionOrigin = extensionId
      ? `${getExtensionProtocol(browserName)}//${extensionId}`
      : await resolveExtensionOrigin(context, browserName);
    
    // Navigate to new tab (which should load our extension)
    await navigateToExtensionHome(page, browserName, extensionOrigin);
    
    // Wait for extension content to load
    await page.waitForLoadState('networkidle');
    
    // Verify extension is loaded by checking for our app container
    await page.waitForSelector('[data-testid="favault-app"], .app-container, #app', { timeout: 10000 });
    
    // Wait for critical test functions to be available on the window object
    await page.waitForFunction(() =>
      (window as any).testUtils &&
      (window as any).settingsManager &&
      (window as any).EnhancedDragDropManager,
      { timeout: 10000 }
    ).catch(() => {
      console.warn('⚠️ Critical test functions not found on window object after timeout.');
    });

    await use(page);
    await page.close();
  },
});

export const expect = test.expect;

/**
 * Extension-specific test utilities
 */
export class ExtensionTestUtils {
  /**
   * Wait for extension to be fully loaded and initialized
   */
  static async waitForExtensionReady(page: Page, timeout = 10000): Promise<void> {
    // Wait for main app container
    await page.waitForSelector('[data-testid="favault-app"], .app-container, #app', { timeout });
    
    // Wait for bookmarks to load (if any)
    await page.waitForFunction(() => {
      return window.document.readyState === 'complete' && 
             !window.document.querySelector('.loading, [data-loading="true"]');
    }, { timeout });
    
    // Additional wait for any async initialization
    await page.waitForTimeout(1000);
  }

  /**
   * Get extension console messages
   */
  static async getConsoleMessages(page: Page): Promise<string[]> {
    const messages: string[] = [];
    
    page.on('console', msg => {
      messages.push(`${msg.type()}: ${msg.text()}`);
    });
    
    return messages;
  }

  /**
   * Inject test utilities into the page
   */
  static async injectTestUtils(page: Page): Promise<void> {
    await page.addInitScript(() => {
      // Add test utilities to window object
      (window as any).testUtils = {
        // Get all bookmark folders
        getBookmarkFolders: () => {
          return Array.from(document.querySelectorAll('.folder-container, [data-testid="bookmark-folder"]'));
        },
        
        // Get all bookmarks
        getBookmarks: () => {
          return Array.from(document.querySelectorAll('.bookmark-item, [data-testid="bookmark-item"]'));
        },
        
        // Simulate drag and drop
        simulateDragDrop: (source: Element, target: Element) => {
          const dragStartEvent = new DragEvent('dragstart', { bubbles: true, cancelable: true });
          const dropEvent = new DragEvent('drop', { bubbles: true, cancelable: true });
          const dragEndEvent = new DragEvent('dragend', { bubbles: true, cancelable: true });
          
          source.dispatchEvent(dragStartEvent);
          target.dispatchEvent(dropEvent);
          source.dispatchEvent(dragEndEvent);
        },
        
        // Wait for element to be visible
        waitForElement: (selector: string, timeout = 5000) => {
          return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
              resolve(element);
              return;
            }
            
            const observer = new MutationObserver(() => {
              const element = document.querySelector(selector);
              if (element) {
                observer.disconnect();
                resolve(element);
              }
            });
            
            observer.observe(document.body, { childList: true, subtree: true });
            
            setTimeout(() => {
              observer.disconnect();
              reject(new Error(`Element ${selector} not found within ${timeout}ms`));
            }, timeout);
          });
        }
      };
    });
  }

  /**
   * Enable edit mode in the extension
   */
  static async enableEditMode(page: Page): Promise<void> {
    console.log('🔧 Enabling edit mode...');
    
    // Directly enable edit mode via settingsManager
    await page.evaluate(async () => {
      if ((window as any).settingsManager) {
        await (window as any).settingsManager.updateEditMode({ enabled: true });
      } else {
        throw new Error('settingsManager not available on window object');
      }
    });

    // Wait for the UI to update and for the drag-drop system to be ready
    await page.waitForFunction(() => {
      const isEditMode = document.body.classList.contains('edit-mode');
      const dragDropReady = (window as any).enhancedDragDropReady === true;
      const draggableFolders = document.querySelectorAll('.folder-container[draggable="true"]').length > 0;
      return isEditMode && dragDropReady && draggableFolders;
    }, { timeout: 15000 });

    console.log('✅ Edit mode fully enabled and ready for testing');
  }

  /**
   * Disable edit mode in the extension
   */
  static async disableEditMode(page: Page): Promise<void> {
    // Try keyboard shortcut first
    await page.keyboard.press('Control+E');

    // Wait a bit for the mode to change
    await page.waitForTimeout(500);

    // Use the correct selectors to verify edit mode is disabled
    try {
      await page.waitForSelector('.app.edit-mode, body.edit-mode', {
        state: 'hidden',
        timeout: 5000
      });
    } catch (error) {
      // Check if edit toggle is no longer active
      const editToggleActive = await page.locator('.edit-toggle.active').count();
      if (editToggleActive === 0) {
        console.log('Edit mode disabled - toggle not active');
      } else {
        console.log('Edit mode elements not found, assuming disabled');
      }
    }
  }
}
