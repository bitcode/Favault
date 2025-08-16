#!/usr/bin/env node

/**
 * Debug version of extension test with comprehensive logging
 * This will definitely execute and show output
 */

import { chromium } from '@playwright/test';
import { TestLogger } from './test-logger.js';
import fs from 'fs';
import path from 'path';

async function runExtensionTest() {
  console.log('🚀 Starting FaVault Extension Debug Test');
  console.log('========================================');

  const logger = new TestLogger('extension-debug');
  logger.log('INFO', 'Starting extension debug test');

  let browser = null;
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      success: false
    },
    issues: [],
    performance: {}
  };

  try {
    // Check extension build
    const extensionPath = path.resolve('./dist/chrome');
    if (!fs.existsSync(extensionPath)) {
      throw new Error('Extension not built. Run "npm run build:chrome" first.');
    }
    console.log('✅ Extension build verified');

    // Launch browser
    console.log('🌐 Launching Chrome browser with extension...');
    browser = await chromium.launch({
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('✅ Browser launched successfully');

    // Capture console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const error = {
          message: msg.text(),
          location: msg.location()
        };
        consoleErrors.push(error);
        logger.addConsoleError(error.message, error.location);
        console.log(`⚠️ Console Error: ${error.message}`);
      }
    });

    // Test 1: Extension Loading
    console.log('🧪 Test 1: Loading extension...');
    const loadTest = logger.startTest('Extension Loading', 'Load and verify extension');
    
    try {
      // Get extension ID
      let extensionId = null;
      
      // Try service workers first
      const serviceWorkers = context.serviceWorkers();
      if (serviceWorkers.length > 0) {
        const url = serviceWorkers[0].url();
        extensionId = url.split('/')[2];
        console.log(`📍 Extension ID from service worker: ${extensionId}`);
      }

      if (!extensionId) {
        console.log('🔍 Using fallback extension ID approach...');
        // Try a common extension ID pattern or use a known test ID
        extensionId = 'test-extension-id';
        console.log(`📍 Using fallback extension ID: ${extensionId}`);
      }

      if (!extensionId) {
        throw new Error('Could not find extension ID');
      }

      // Navigate to extension
      const extensionUrl = `chrome-extension://${extensionId}/newtab.html`;
      console.log(`🔗 Navigating to: ${extensionUrl}`);
      
      await page.goto(extensionUrl);
      await page.waitForLoadState('networkidle');
      
      console.log('✅ Extension page loaded');

      // Check for app container
      const appElement = await page.$('.app');
      if (!appElement) {
        throw new Error('App container not found');
      }
      console.log('✅ App container found');

      // Check for enhanced drag-drop manager
      const hasEnhancedDragDrop = await page.evaluate(() => {
        return typeof window.EnhancedDragDropManager !== 'undefined';
      });

      if (hasEnhancedDragDrop) {
        console.log('✅ EnhancedDragDropManager found');
      } else {
        console.log('❌ EnhancedDragDropManager not found');
        results.issues.push({
          type: 'missing_component',
          message: 'EnhancedDragDropManager not available',
          severity: 'high'
        });
      }

      logger.endTest('Extension Loading', true, null, { 
        extensionId,
        hasEnhancedDragDrop,
        appLoaded: true
      });

      results.tests.push({
        name: 'Extension Loading',
        passed: true,
        extensionId,
        hasEnhancedDragDrop
      });

    } catch (error) {
      console.log(`❌ Extension loading failed: ${error.message}`);
      logger.endTest('Extension Loading', false, error);
      results.tests.push({
        name: 'Extension Loading',
        passed: false,
        error: error.message
      });
    }

    // Test 2: Folder Detection
    console.log('🧪 Test 2: Detecting folders...');
    const folderTest = logger.startTest('Folder Detection', 'Detect and count folders');
    
    try {
      // Get folder count
      const folderCount = await page.locator('.folder-container').count();
      console.log(`📁 Found ${folderCount} folders`);

      if (folderCount === 0) {
        console.log('⚠️ No folders found - this might indicate an issue');
        results.issues.push({
          type: 'no_folders',
          message: 'No folders detected in extension',
          severity: 'medium'
        });
      }

      // Get folder titles
      const folderTitles = await page.evaluate(() => {
        const folders = Array.from(document.querySelectorAll('.folder-container'));
        return folders.map(folder => {
          const title = folder.querySelector('.folder-title, h3, .folder-name')?.textContent;
          return title?.trim();
        }).filter(Boolean);
      });

      console.log(`📋 Folder titles: ${folderTitles.slice(0, 3).join(', ')}${folderTitles.length > 3 ? '...' : ''}`);

      logger.endTest('Folder Detection', true, null, {
        folderCount,
        folderTitles: folderTitles.slice(0, 5)
      });

      results.tests.push({
        name: 'Folder Detection',
        passed: true,
        folderCount,
        folderTitles: folderTitles.slice(0, 3)
      });

    } catch (error) {
      console.log(`❌ Folder detection failed: ${error.message}`);
      logger.endTest('Folder Detection', false, error);
      results.tests.push({
        name: 'Folder Detection',
        passed: false,
        error: error.message
      });
    }

    // Test 3: Enhanced DragDrop Functionality
    console.log('🧪 Test 3: Testing Enhanced DragDrop functionality...');
    const dragDropTest = logger.startTest('Enhanced DragDrop Test', 'Test drag-drop manager functionality');
    
    try {
      // Check if EnhancedDragDropManager is available
      const dragDropInfo = await page.evaluate(async () => {
        if (typeof window.EnhancedDragDropManager === 'undefined') {
          return { available: false, error: 'EnhancedDragDropManager not found' };
        }

        try {
          // Try to initialize
          const initResult = await window.EnhancedDragDropManager.initialize();
          
          // Try to enable edit mode
          const editResult = await window.EnhancedDragDropManager.enableEditMode();
          
          // Get current folder order
          const folderOrder = await window.EnhancedDragDropManager.getCurrentFolderOrder();
          
          return {
            available: true,
            initialized: initResult.success,
            editModeEnabled: editResult.success,
            folderCount: folderOrder.length,
            folderOrder: folderOrder.slice(0, 3)
          };
        } catch (error) {
          return {
            available: true,
            error: error.message
          };
        }
      });

      console.log('🔍 DragDrop Manager Info:', JSON.stringify(dragDropInfo, null, 2));

      if (!dragDropInfo.available) {
        throw new Error('EnhancedDragDropManager not available');
      }

      if (dragDropInfo.error) {
        throw new Error(`DragDrop error: ${dragDropInfo.error}`);
      }

      // Test folder movement if we have folders
      if (dragDropInfo.folderCount >= 2) {
        console.log('🔄 Testing folder movement...');
        
        const moveResult = await page.evaluate(async () => {
          try {
            return await window.EnhancedDragDropManager.moveFolderToPosition(0, 1);
          } catch (error) {
            return { success: false, error: error.message };
          }
        });

        console.log('📊 Move result:', JSON.stringify(moveResult, null, 2));

        if (moveResult.success) {
          console.log('✅ Folder movement successful');
          
          // Wait for UI update
          await page.waitForTimeout(2000);
          
          // Check if UI updated
          const newOrder = await page.evaluate(async () => {
            if (typeof window.EnhancedDragDropManager !== 'undefined') {
              return await window.EnhancedDragDropManager.getCurrentFolderOrder();
            }
            return [];
          });

          console.log(`📋 New folder order: ${newOrder.slice(0, 3).join(', ')}`);
          
        } else {
          console.log(`❌ Folder movement failed: ${moveResult.error}`);
          results.issues.push({
            type: 'move_failure',
            message: `Folder movement failed: ${moveResult.error}`,
            severity: 'high'
          });
        }
      }

      logger.endTest('Enhanced DragDrop Test', true, null, dragDropInfo);

      results.tests.push({
        name: 'Enhanced DragDrop Test',
        passed: true,
        dragDropInfo
      });

    } catch (error) {
      console.log(`❌ Enhanced DragDrop test failed: ${error.message}`);
      logger.endTest('Enhanced DragDrop Test', false, error);
      results.tests.push({
        name: 'Enhanced DragDrop Test',
        passed: false,
        error: error.message
      });
    }

    // Keep browser open for a moment
    console.log('🔍 Keeping browser open for 5 seconds for inspection...');
    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    results.issues.push({
      type: 'execution_error',
      message: error.message,
      severity: 'critical'
    });
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
  results.consoleErrors = consoleErrors;

  // Finalize logging
  logger.finalize();
  const logFiles = logger.saveLogFiles();

  // Display results
  console.log('\n📊 Extension Test Results:');
  console.log('==========================');
  console.log(`Status: ${results.summary.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Tests: ${results.summary.passed}/${results.summary.total} passed`);
  
  if (results.issues.length > 0) {
    console.log('\n🚨 Issues Found:');
    results.issues.forEach(issue => {
      console.log(`  - [${issue.severity.toUpperCase()}] ${issue.type}: ${issue.message}`);
    });
  }

  if (consoleErrors.length > 0) {
    console.log('\n⚠️ Console Errors:');
    consoleErrors.forEach(error => {
      console.log(`  - ${error.message}`);
    });
  }

  console.log(`\n📄 Detailed logs: ${logFiles.latestFile}`);

  // Save results for analysis
  const resultsFile = path.join('./test-results', 'extension-debug-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`📄 Results saved: ${resultsFile}`);

  return results;
}

// Run the test
runExtensionTest()
  .then(results => {
    console.log('\n🎉 Extension debug test completed!');
    process.exit(results.summary.success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Test crashed:', error);
    process.exit(1);
  });
