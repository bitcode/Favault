import { test as base, chromium, firefox, type BrowserContext, type Page } from '@playwright/test';
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getExtensionProtocol, navigateToExtensionHome, resolveExtensionOrigin } from '../utils/extension-target';

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
const FIREFOX_USER_PREFS = {
  'extensions.autoDisableScopes': 0,
  'extensions.enabledScopes': 15,
  'xpinstall.signatures.required': false,
  'xpinstall.whitelist.required': false,
  'browser.aboutwelcome.enabled': false,
  'trailhead.firstrun.branches': 'nofirstrun-empty',
  'browser.startup.homepage_override.mstone': 'ignore',
  'browser.startup.firstrunSkipsHomepage': true,
  'startup.homepage_welcome_url': 'about:blank',
  'startup.homepage_welcome_url.additional': '',
  'browser.shell.checkDefaultBrowser': false,
  'browser.shell.didSkipDefaultBrowserCheckOnFirstRun': true,
  'browser.tabs.warnOnClose': false,
  'datareporting.policy.dataSubmissionEnabled': false,
  'datareporting.healthreport.uploadEnabled': false,
  'datareporting.policy.firstRunURL': '',
  'datareporting.policy.dataSubmissionPolicyAcceptedVersion': 2,
  'toolkit.telemetry.reportingpolicy.firstRun': false,
  'toolkit.telemetry.reportingpolicy.firstRunShown': true,
  'toolkit.telemetry.enabled': false,
  'browser.messaging-system.whatsNewPanel.enabled': false,
  'browser.discovery.enabled': false,
  'browser.newtabpage.activity-stream.asrouter.userprefs.cfr.addons': false,
  'browser.newtabpage.activity-stream.asrouter.userprefs.cfr.features': false,
  'devtools.debugger.remote-enabled': true,
  'devtools.debugger.prompt-connection': false,
  'toolkit.startup.max_resumed_crashes': -1
} as const;

async function getFirefoxAddonId(extensionPath: string): Promise<string> {
  const manifestPath = path.join(extensionPath, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const addonId = manifest.browser_specific_settings?.gecko?.id;

  if (!addonId) {
    throw new Error(`Firefox manifest is missing browser_specific_settings.gecko.id: ${manifestPath}`);
  }

  return addonId;
}

async function installFirefoxExtensionToProfile(extensionPath: string, profileDir: string): Promise<string> {
  const addonId = await getFirefoxAddonId(extensionPath);
  const extensionsDir = path.join(profileDir, 'extensions');
  const packagedExtensionPath = path.join(process.cwd(), 'dist', 'favault-firefox.xpi');
  const profileExtensionPath = path.join(extensionsDir, `${addonId}.xpi`);

  await mkdir(extensionsDir, { recursive: true });
  await copyFile(packagedExtensionPath, profileExtensionPath);

  console.log(`Prepared Firefox profile add-on: ${profileExtensionPath}`);
  return addonId;
}

async function prepareFirefoxProfile(extensionPath: string): Promise<{ profileDir: string; addonId: string }> {
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
  const addonId = await installFirefoxExtensionToProfile(extensionPath, profileDir);
  return { profileDir, addonId };
}

async function launchFirefoxExtensionContext(pathToExtension: string): Promise<BrowserContext> {
  const headless = isEnvEnabled('PLAYWRIGHT_FIREFOX_HEADLESS', false);
  const executablePath = process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH;
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { profileDir, addonId } = await prepareFirefoxProfile(pathToExtension);
      console.log(`Launching Firefox extension context (attempt ${attempt}/2)...`);
      console.log(`Using Firefox profile: ${profileDir}`);
      console.log(`Using Firefox add-on ID: ${addonId}`);
      const context = await firefox.launchPersistentContext(profileDir, {
        headless,
        executablePath,
        acceptDownloads: true,
        firefoxUserPrefs: FIREFOX_USER_PREFS,
        viewport: { width: 1280, height: 720 },
        recordVideo: {
          dir: 'test-results/videos/',
          size: { width: 1280, height: 720 }
        }
      });

      const probePage = await context.newPage();
      await probePage.goto('about:newtab');
      await probePage.waitForLoadState('domcontentloaded');
      await probePage.waitForTimeout(1000);
      console.log(`Firefox new tab after profile preload: ${probePage.url()}`);
      await probePage.close();
      return context;
    } catch (error) {
      lastError = error;
      console.warn(`Firefox extension launch/install attempt ${attempt} failed:`, error);
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }

  throw lastError;
}

export const test = base.extend<ExtensionFixtures>({
  /**
   * Browser context with extension loaded
   */
  context: [async ({ browserName }, use) => {
    const isFirefox = browserName === 'firefox';
    const pathToExtension = path.join(__dirname, `../../../dist/${isFirefox ? 'firefox' : 'chrome'}`);

    const context = isFirefox
      ? await launchFirefoxExtensionContext(pathToExtension)
      : await chromium.launchPersistentContext('', {
          channel: 'chromium',
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
