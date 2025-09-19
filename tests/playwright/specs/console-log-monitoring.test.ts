import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import { execSync } from 'child_process';

interface ConsoleMessage {
  type: 'log' | 'warn' | 'error' | 'info' | 'debug';
  text: string;
  timestamp: number;
  location?: string;
}

interface ClickTestResult {
  location: string;
  selector: string;
  messageCount: number;
  messages: ConsoleMessage[];
  errors: ConsoleMessage[];
  warnings: ConsoleMessage[];
  excessiveLogging: boolean;
  infiniteLoopDetected: boolean;
}

test.describe('Console Log Monitoring', () => {
  let context: BrowserContext;
  let page: Page;
  let consoleMessages: ConsoleMessage[] = [];
  
  // Configuration
  const MAX_MESSAGES_PER_CLICK = 5;
  const INFINITE_LOOP_THRESHOLD = 10;
  const RAPID_FIRE_WINDOW_MS = 1000;

  test.beforeAll(async () => {
    // Build the extension first
    console.log('Building Chrome extension...');
    execSync('npm run build:chrome', { cwd: process.cwd(), stdio: 'inherit' });
    
    // Launch browser with extension
    const extensionPath = path.join(process.cwd(), 'dist', 'chrome');
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
    
    page = await context.newPage();
    
    // Set up console monitoring
    setupConsoleMonitoring(page);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  function setupConsoleMonitoring(page: Page) {
    page.on('console', (msg) => {
      const consoleMessage: ConsoleMessage = {
        type: msg.type() as ConsoleMessage['type'],
        text: msg.text(),
        timestamp: Date.now(),
        location: msg.location()?.url || 'unknown'
      };
      consoleMessages.push(consoleMessage);
    });

    // Also capture page errors
    page.on('pageerror', (error) => {
      const consoleMessage: ConsoleMessage = {
        type: 'error',
        text: `Page Error: ${error.message}`,
        timestamp: Date.now(),
        location: 'page-error'
      };
      consoleMessages.push(consoleMessage);
    });
  }

  function clearConsoleMessages() {
    consoleMessages = [];
  }

  function analyzeConsoleMessages(startTime: number, endTime: number): {
    messages: ConsoleMessage[];
    messageCount: number;
    errors: ConsoleMessage[];
    warnings: ConsoleMessage[];
    excessiveLogging: boolean;
    infiniteLoopDetected: boolean;
  } {
    const relevantMessages = consoleMessages.filter(
      msg => msg.timestamp >= startTime && msg.timestamp <= endTime
    );

    const errors = relevantMessages.filter(msg => msg.type === 'error');
    const warnings = relevantMessages.filter(msg => msg.type === 'warn');
    
    // Check for infinite loops (same message repeated rapidly)
    const messageGroups = new Map<string, ConsoleMessage[]>();
    relevantMessages.forEach(msg => {
      const key = msg.text;
      if (!messageGroups.has(key)) {
        messageGroups.set(key, []);
      }
      messageGroups.get(key)!.push(msg);
    });

    let infiniteLoopDetected = false;
    for (const [text, messages] of messageGroups) {
      if (messages.length > INFINITE_LOOP_THRESHOLD) {
        // Check if they occurred within rapid-fire window
        const timeSpan = messages[messages.length - 1].timestamp - messages[0].timestamp;
        if (timeSpan < RAPID_FIRE_WINDOW_MS) {
          infiniteLoopDetected = true;
          console.warn(`Infinite loop detected: "${text}" repeated ${messages.length} times in ${timeSpan}ms`);
        }
      }
    }

    return {
      messages: relevantMessages,
      messageCount: relevantMessages.length,
      errors,
      warnings,
      excessiveLogging: relevantMessages.length > MAX_MESSAGES_PER_CLICK,
      infiniteLoopDetected
    };
  }

  async function performClickTest(
    selector: string, 
    description: string,
    waitTime: number = 500
  ): Promise<ClickTestResult> {
    console.log(`Testing click on: ${description}`);
    
    // Clear previous messages and wait a moment for any pending logs
    await page.waitForTimeout(200);
    clearConsoleMessages();
    
    const startTime = Date.now();
    
    try {
      // Perform the click
      await page.click(selector, { timeout: 5000 });
      
      // Wait for any async logging to complete
      await page.waitForTimeout(waitTime);
      
    } catch (error) {
      console.warn(`Could not click ${selector}: ${error}`);
    }
    
    const endTime = Date.now();
    const analysis = analyzeConsoleMessages(startTime, endTime);
    
    return {
      location: description,
      selector,
      messageCount: analysis.messageCount,
      messages: analysis.messages,
      errors: analysis.errors,
      warnings: analysis.warnings,
      excessiveLogging: analysis.excessiveLogging,
      infiniteLoopDetected: analysis.infiniteLoopDetected
    };
  }

  test('should monitor console logs during various page interactions', async () => {
    // Navigate to chrome://newtab first to trigger extension
    await page.goto('chrome://newtab/');
    await page.waitForTimeout(1000);

    // Check if we're redirected to the extension's new tab page
    const currentUrl = page.url();
    console.log(`Current URL after chrome://newtab: ${currentUrl}`);

    if (currentUrl.includes('chrome-extension://')) {
      console.log('Extension new tab page loaded successfully');
    } else {
      // Try to find and navigate to the extension directly
      const pages = await context.pages();
      let extensionPage = null;

      for (const p of pages) {
        const url = p.url();
        if (url.includes('chrome-extension://') && url.includes('newtab.html')) {
          extensionPage = p;
          break;
        }
      }

      if (extensionPage) {
        page = extensionPage;
        console.log(`Using existing extension page: ${page.url()}`);
      } else {
        // Create a new tab and try to navigate to a generic extension URL pattern
        const newPage = await context.newPage();
        await newPage.goto('chrome://extensions/');
        await newPage.waitForTimeout(1000);

        // Get all extension IDs and try each one
        const extensionIds = await newPage.evaluate(() => {
          const items = Array.from(document.querySelectorAll('extensions-item'));
          return items.map(item => item.getAttribute('id')).filter(Boolean);
        });

        console.log(`Found extension IDs: ${extensionIds.join(', ')}`);

        // Try each extension ID
        for (const id of extensionIds) {
          try {
            await newPage.goto(`chrome-extension://${id}/newtab.html`);
            await newPage.waitForLoadState('domcontentloaded', { timeout: 2000 });
            const title = await newPage.title();
            if (title.includes('FaVault') || title.includes('Favault') || title.includes('New Tab')) {
              page = newPage;
              console.log(`Found FaVault extension at: chrome-extension://${id}/newtab.html`);
              break;
            }
          } catch (e) {
            // Continue to next ID
          }
        }

        if (page === newPage && !page.url().includes('chrome-extension://')) {
          throw new Error('Could not find FaVault extension new tab page');
        }
      }
    }

    await page.waitForLoadState('domcontentloaded');
    
    // Wait for extension to fully initialize
    await page.waitForTimeout(2000);
    
    // Check that DOM status attributes are present
    const bridgeInstalled = await page.evaluate(() => {
      return document.body.getAttribute('data-dnd-bridge');
    });
    console.log(`DnD Bridge status: ${bridgeInstalled}`);
    
    const testResults: ClickTestResult[] = [];
    
    // Test 1: Click on empty areas
    console.log('\n=== Testing clicks on empty areas ===');
    testResults.push(await performClickTest('body', 'Empty body area'));
    testResults.push(await performClickTest('.app', 'Main app container'));
    
    // Test 2: Click on bookmark-related elements (if they exist)
    console.log('\n=== Testing clicks on bookmark elements ===');
    
    const bookmarkItems = await page.$$('.bookmark-item');
    if (bookmarkItems.length > 0) {
      testResults.push(await performClickTest('.bookmark-item:first-child', 'First bookmark item'));
    }
    
    const folderHeaders = await page.$$('.folder-header');
    if (folderHeaders.length > 0) {
      testResults.push(await performClickTest('.folder-header:first-child', 'First folder header'));
    }
    
    const folderContainers = await page.$$('.folder-container');
    if (folderContainers.length > 0) {
      testResults.push(await performClickTest('.folder-container:first-child', 'First folder container'));
    }
    
    // Test 3: Click on UI controls
    console.log('\n=== Testing clicks on UI controls ===');
    
    // Edit mode toggle
    const editToggle = await page.$('[data-testid="edit-toggle"], .edit-toggle, button:has-text("Edit")');
    if (editToggle) {
      testResults.push(await performClickTest('[data-testid="edit-toggle"], .edit-toggle, button:has-text("Edit")', 'Edit mode toggle'));
    }
    
    // Settings button
    const settingsBtn = await page.$('[data-testid="settings-button"], .settings-button, button:has-text("Settings")');
    if (settingsBtn) {
      testResults.push(await performClickTest('[data-testid="settings-button"], .settings-button, button:has-text("Settings")', 'Settings button'));
    }
    
    // Test 4: Multiple rapid clicks to detect accumulation
    console.log('\n=== Testing rapid clicks for accumulation ===');
    clearConsoleMessages();
    const rapidClickStartTime = Date.now();
    
    for (let i = 0; i < 5; i++) {
      await page.click('body');
      await page.waitForTimeout(100);
    }
    
    const rapidClickEndTime = Date.now();
    const rapidClickAnalysis = analyzeConsoleMessages(rapidClickStartTime, rapidClickEndTime);
    testResults.push({
      location: 'Rapid clicks test (5 clicks)',
      selector: 'body',
      messageCount: rapidClickAnalysis.messageCount,
      messages: rapidClickAnalysis.messages,
      errors: rapidClickAnalysis.errors,
      warnings: rapidClickAnalysis.warnings,
      excessiveLogging: rapidClickAnalysis.messageCount > (MAX_MESSAGES_PER_CLICK * 5),
      infiniteLoopDetected: rapidClickAnalysis.infiniteLoopDetected
    });
    
    // Analyze and report results
    console.log('\n=== CONSOLE LOG ANALYSIS RESULTS ===');
    
    let hasFailures = false;
    let totalErrors = 0;
    let totalWarnings = 0;
    let excessiveLoggingCount = 0;
    let infiniteLoopsDetected = 0;
    
    testResults.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.location}`);
      console.log(`   Selector: ${result.selector}`);
      console.log(`   Messages: ${result.messageCount}`);
      console.log(`   Errors: ${result.errors.length}`);
      console.log(`   Warnings: ${result.warnings.length}`);
      console.log(`   Excessive logging: ${result.excessiveLogging ? 'YES' : 'NO'}`);
      console.log(`   Infinite loop detected: ${result.infiniteLoopDetected ? 'YES' : 'NO'}`);
      
      if (result.messages.length > 0) {
        if (result.excessiveLogging) {
          console.log('   ALL messages (excessive logging detected):');
          result.messages.forEach((msg, idx) => {
            console.log(`     ${idx + 1}. [${msg.type.toUpperCase()}] ${msg.text}`);
          });
        } else {
          console.log('   Recent messages:');
          result.messages.slice(-3).forEach(msg => {
            console.log(`     [${msg.type.toUpperCase()}] ${msg.text}`);
          });
        }
      }
      
      // Track failures
      if (result.errors.length > 0) {
        totalErrors += result.errors.length;
        hasFailures = true;
      }
      if (result.warnings.length > 0) {
        totalWarnings += result.warnings.length;
      }
      if (result.excessiveLogging) {
        excessiveLoggingCount++;
        hasFailures = true;
      }
      if (result.infiniteLoopDetected) {
        infiniteLoopsDetected++;
        hasFailures = true;
      }
    });
    
    console.log('\n=== SUMMARY ===');
    console.log(`Total test locations: ${testResults.length}`);
    console.log(`Total errors: ${totalErrors}`);
    console.log(`Total warnings: ${totalWarnings}`);
    console.log(`Locations with excessive logging: ${excessiveLoggingCount}`);
    console.log(`Infinite loops detected: ${infiniteLoopsDetected}`);
    
    // Assertions
    expect(totalErrors, `Found ${totalErrors} JavaScript errors during click interactions`).toBe(0);
    expect(infiniteLoopsDetected, `Found ${infiniteLoopsDetected} infinite logging loops`).toBe(0);
    expect(excessiveLoggingCount, `Found ${excessiveLoggingCount} locations with excessive logging (>${MAX_MESSAGES_PER_CLICK} messages per click)`).toBe(0);
    
    if (hasFailures) {
      throw new Error('Console log monitoring test failed - see detailed output above');
    }
    
    console.log('\n✅ All console log monitoring tests passed!');
  });
});
