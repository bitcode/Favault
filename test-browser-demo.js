#!/usr/bin/env node

/**
 * Simple Playwright browser automation demo
 * This will actually open a browser and interact with the extension
 */

import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

async function runBrowserDemo() {
  console.log('🚀 Starting Playwright Browser Automation Demo');
  console.log('==============================================');
  
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      success: false
    }
  };

  let browser = null;
  
  try {
    // Check if extension is built
    const extensionPath = path.resolve('./dist/chrome');
    if (!fs.existsSync(extensionPath)) {
      throw new Error('Extension not built. Run "npm run build:chrome" first.');
    }

    console.log('🌐 Launching Chrome browser with extension...');
    
    // Launch browser with extension loaded
    browser = await chromium.launch({
      headless: false, // Show the browser so you can see it working!
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-dev-shm-usage'
      ]
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('✅ Browser launched successfully');

    // Test 1: Navigate to extension
    console.log('🧪 Test 1: Loading extension page...');
    const test1 = { name: 'Load Extension', passed: false, startTime: Date.now() };
    
    try {
      // Get extension ID by checking service workers
      const serviceWorkers = context.serviceWorkers();
      let extensionId = null;
      
      if (serviceWorkers.length > 0) {
        const url = serviceWorkers[0].url();
        extensionId = url.split('/')[2];
      }
      
      if (!extensionId) {
        // Fallback: try to get extension ID from chrome://extensions
        await page.goto('chrome://extensions/');
        await page.waitForTimeout(2000);
        
        // Try to find extension card
        const extensionCards = await page.$$('extensions-item');
        if (extensionCards.length > 0) {
          extensionId = await extensionCards[0].getAttribute('id');
        }
      }
      
      if (!extensionId) {
        throw new Error('Could not find extension ID');
      }
      
      console.log(`📍 Extension ID found: ${extensionId}`);
      
      // Navigate to extension page
      const extensionUrl = `chrome-extension://${extensionId}/newtab.html`;
      await page.goto(extensionUrl);
      await page.waitForLoadState('networkidle');
      
      console.log('✅ Extension page loaded successfully');
      test1.passed = true;
      
    } catch (error) {
      console.log('❌ Failed to load extension:', error.message);
      test1.error = error.message;
    }
    
    test1.duration = Date.now() - test1.startTime;
    results.tests.push(test1);

    // Test 2: Check for extension elements
    console.log('🧪 Test 2: Checking extension elements...');
    const test2 = { name: 'Check Extension Elements', passed: false, startTime: Date.now() };
    
    try {
      // Wait for and check key elements
      await page.waitForSelector('body', { timeout: 10000 });
      
      // Check for app container
      const appElement = await page.$('.app');
      if (!appElement) {
        throw new Error('App container not found');
      }
      
      // Check for folders
      const folderCount = await page.locator('.folder-container').count();
      console.log(`📁 Found ${folderCount} folders`);
      
      // Check for enhanced drag-drop manager
      const hasEnhancedDragDrop = await page.evaluate(() => {
        return typeof window.EnhancedDragDropManager !== 'undefined';
      });
      
      if (!hasEnhancedDragDrop) {
        throw new Error('EnhancedDragDropManager not found');
      }
      
      console.log('✅ Extension elements verified');
      test2.passed = true;
      test2.metadata = { folderCount, hasEnhancedDragDrop };
      
    } catch (error) {
      console.log('❌ Extension elements check failed:', error.message);
      test2.error = error.message;
    }
    
    test2.duration = Date.now() - test2.startTime;
    results.tests.push(test2);

    // Test 3: Try basic interaction
    console.log('🧪 Test 3: Testing basic interaction...');
    const test3 = { name: 'Basic Interaction', passed: false, startTime: Date.now() };
    
    try {
      // Try to get folder titles
      const folderTitles = await page.evaluate(() => {
        const folders = Array.from(document.querySelectorAll('.folder-container'));
        return folders.map(folder => {
          const title = folder.querySelector('.folder-title, h3, .folder-name')?.textContent;
          return title?.trim();
        }).filter(Boolean);
      });
      
      console.log(`📋 Folder titles: ${folderTitles.slice(0, 3).join(', ')}${folderTitles.length > 3 ? '...' : ''}`);
      
      // Try to click on settings or edit button if available
      const editButton = await page.$('[data-testid="edit-mode-toggle"], .edit-mode-toggle, button:has-text("Edit")');
      if (editButton) {
        await editButton.click();
        await page.waitForTimeout(1000);
        console.log('✅ Edit mode toggled');
      }
      
      console.log('✅ Basic interaction successful');
      test3.passed = true;
      test3.metadata = { folderTitles: folderTitles.slice(0, 5) };
      
    } catch (error) {
      console.log('❌ Basic interaction failed:', error.message);
      test3.error = error.message;
    }
    
    test3.duration = Date.now() - test3.startTime;
    results.tests.push(test3);

    // Keep browser open for a moment so you can see it
    console.log('🔍 Browser will stay open for 5 seconds so you can see the extension...');
    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    results.errors = [{ message: error.message }];
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 Browser closed');
    }
  }

  // Calculate results
  results.summary.total = results.tests.length;
  results.summary.passed = results.tests.filter(t => t.passed).length;
  results.summary.failed = results.summary.total - results.summary.passed;
  results.summary.success = results.summary.failed === 0;

  // Display results
  console.log('\n📊 Browser Automation Demo Results:');
  console.log('===================================');
  console.log(`Status: ${results.summary.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Tests: ${results.summary.passed}/${results.summary.total} passed`);
  
  if (results.summary.failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.tests.filter(t => !t.passed).forEach(test => {
      console.log(`  - ${test.name}: ${test.error}`);
    });
  }

  // Save results
  const resultsDir = './test-results';
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(resultsDir, 'browser-demo-results.json'),
    JSON.stringify(results, null, 2)
  );

  console.log(`\n📄 Results saved: ${path.resolve(resultsDir, 'browser-demo-results.json')}`);

  return results;
}

// Run the demo
runBrowserDemo()
  .then(results => {
    console.log('\n🎉 Browser automation demo completed!');
    process.exit(results.summary.success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Demo crashed:', error);
    process.exit(1);
  });
