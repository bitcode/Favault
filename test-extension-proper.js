#!/usr/bin/env node

/**
 * Proper extension test using chrome-extension:// protocol
 * This addresses the CORS issues and tests the actual extension functionality
 */

import { chromium } from '@playwright/test';
import { TestLogger } from './test-logger.js';
import fs from 'fs';
import path from 'path';

async function runProperExtensionTest() {
  console.log('🚀 Starting Proper FaVault Extension Test');
  console.log('========================================');

  const logger = new TestLogger('extension-proper');
  logger.log('INFO', 'Starting proper extension test with chrome-extension protocol');

  let browser = null;
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    summary: { total: 0, passed: 0, failed: 0, success: false },
    issues: [],
    consoleErrors: [],
    extensionInfo: {}
  };

  try {
    // Check extension build
    const extensionPath = path.resolve('./dist/chrome');
    if (!fs.existsSync(extensionPath)) {
      throw new Error('Extension not built. Run "npm run build:chrome" first.');
    }
    console.log('✅ Extension build verified');

    // Launch browser with extension
    console.log('🌐 Launching browser with extension...');
    browser = await chromium.launch({
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-web-security',
        '--allow-running-insecure-content',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    const context = await browser.newContext();
    const page = await context.newPage();
    console.log('✅ Browser launched');

    // Capture console messages
    page.on('console', msg => {
      const message = msg.text();
      console.log(`🔍 Console [${msg.type()}]: ${message}`);
      
      if (msg.type() === 'error') {
        const error = { message, location: msg.location() };
        results.consoleErrors.push(error);
        logger.addConsoleError(error.message, error.location);
      }
    });

    // Test 1: Get Extension ID
    console.log('🧪 Test 1: Getting extension ID...');
    const extensionTest = logger.startTest('Extension ID Detection', 'Get extension ID from browser');
    
    let extensionId = null;
    try {
      // Navigate to chrome://extensions to get the extension ID
      await page.goto('chrome://extensions/');
      await page.waitForTimeout(2000);
      
      // Enable developer mode if not already enabled
      const devModeToggle = await page.$('extensions-manager')
        .then(manager => manager?.$('extensions-toolbar'))
        .then(toolbar => toolbar?.$('#devMode'))
        .catch(() => null);
      
      if (devModeToggle) {
        const isChecked = await devModeToggle.isChecked();
        if (!isChecked) {
          await devModeToggle.click();
          await page.waitForTimeout(1000);
        }
      }
      
      // Get extension cards
      const extensionCards = await page.$$('extensions-item');
      console.log(`🔍 Found ${extensionCards.length} extension cards`);
      
      if (extensionCards.length > 0) {
        // Look for our extension by name
        for (const card of extensionCards) {
          try {
            const nameElement = await card.$('#name');
            const name = nameElement ? await nameElement.textContent() : '';
            
            if (name && (name.includes('FaVault') || name.includes('New Tab'))) {
              extensionId = await card.getAttribute('id');
              console.log(`📍 Found FaVault extension: ${name} (ID: ${extensionId})`);
              break;
            }
          } catch (e) {
            // Continue searching
          }
        }
        
        // If not found by name, use the first extension
        if (!extensionId && extensionCards.length > 0) {
          extensionId = await extensionCards[0].getAttribute('id');
          console.log(`📍 Using first extension ID: ${extensionId}`);
        }
      }
      
      if (!extensionId) {
        throw new Error('Could not find extension ID');
      }
      
      results.extensionInfo.id = extensionId;
      
      logger.endTest('Extension ID Detection', true, null, { extensionId });
      results.tests.push({
        name: 'Extension ID Detection',
        passed: true,
        extensionId
      });
      
    } catch (error) {
      console.log(`❌ Extension ID detection failed: ${error.message}`);
      logger.endTest('Extension ID Detection', false, error);
      results.tests.push({
        name: 'Extension ID Detection',
        passed: false,
        error: error.message
      });
      
      // Try a fallback approach
      console.log('🔄 Trying fallback extension ID approach...');
      extensionId = 'fallback-test-id';
    }

    // Test 2: Navigate to Extension
    console.log('🧪 Test 2: Navigating to extension...');
    const navTest = logger.startTest('Extension Navigation', 'Navigate to extension newtab page');
    
    try {
      const extensionUrl = `chrome-extension://${extensionId}/newtab.html`;
      console.log(`🔗 Navigating to: ${extensionUrl}`);
      
      await page.goto(extensionUrl);
      await page.waitForLoadState('networkidle');
      
      // Wait for the extension to load
      await page.waitForTimeout(3000);
      
      console.log('✅ Extension page loaded');
      
      logger.endTest('Extension Navigation', true, null, { url: extensionUrl });
      results.tests.push({
        name: 'Extension Navigation',
        passed: true,
        url: extensionUrl
      });
      
    } catch (error) {
      console.log(`❌ Extension navigation failed: ${error.message}`);
      logger.endTest('Extension Navigation', false, error);
      results.tests.push({
        name: 'Extension Navigation',
        passed: false,
        error: error.message
      });
    }

    // Test 3: Check Extension Components
    console.log('🧪 Test 3: Checking extension components...');
    const componentTest = logger.startTest('Extension Components', 'Check for app container and key components');
    
    try {
      // Check for app container (both class and id)
      const appElement = await page.$('.app') || await page.$('#app');
      const hasAppContainer = !!appElement;
      
      if (hasAppContainer) {
        console.log('✅ App container found');
      } else {
        console.log('⚠️ App container not found');
        results.issues.push({
          type: 'missing_app_container',
          message: 'App container not found',
          severity: 'medium'
        });
      }
      
      // Check for folders
      const folderCount = await page.locator('.folder-container').count();
      console.log(`📁 Found ${folderCount} folder containers`);
      
      // Check for enhanced drag-drop manager
      const hasDragDropManager = await page.evaluate(() => {
        return typeof window.EnhancedDragDropManager !== 'undefined';
      });
      
      if (hasDragDropManager) {
        console.log('✅ EnhancedDragDropManager found');
      } else {
        console.log('❌ EnhancedDragDropManager not found');
        results.issues.push({
          type: 'missing_dragdrop_manager',
          message: 'EnhancedDragDropManager not available',
          severity: 'critical'
        });
      }
      
      // Check for debug functions
      const debugFunctions = await page.evaluate(() => {
        const functions = [
          'debugGlobalScope',
          'testEnhancedDragDrop',
          'quickTestDragDrop',
          'runAllTests'
        ];
        
        return functions.map(name => ({
          name,
          available: typeof window[name] !== 'undefined'
        }));
      });
      
      console.log('🔍 Debug functions availability:');
      debugFunctions.forEach(func => {
        console.log(`  ${func.available ? '✅' : '❌'} ${func.name}`);
      });
      
      const componentInfo = {
        hasAppContainer,
        folderCount,
        hasDragDropManager,
        debugFunctions
      };
      
      logger.endTest('Extension Components', true, null, componentInfo);
      results.tests.push({
        name: 'Extension Components',
        passed: true,
        ...componentInfo
      });
      
    } catch (error) {
      console.log(`❌ Extension components check failed: ${error.message}`);
      logger.endTest('Extension Components', false, error);
      results.tests.push({
        name: 'Extension Components',
        passed: false,
        error: error.message
      });
    }

    // Test 4: Test Enhanced DragDrop Functionality
    console.log('🧪 Test 4: Testing Enhanced DragDrop functionality...');
    const dragDropTest = logger.startTest('Enhanced DragDrop Test', 'Test drag-drop manager functionality');
    
    try {
      // Run the debug global scope function
      const debugResult = await page.evaluate(() => {
        if (typeof window.debugGlobalScope === 'function') {
          window.debugGlobalScope();
          return { success: true, debugRan: true };
        }
        return { success: false, error: 'debugGlobalScope not available' };
      });
      
      console.log('🔍 Debug result:', debugResult);
      
      // Try to initialize the enhanced drag-drop system
      const initResult = await page.evaluate(async () => {
        if (typeof window.EnhancedDragDropManager !== 'undefined') {
          try {
            const result = await window.EnhancedDragDropManager.initialize();
            return { success: true, initResult: result };
          } catch (error) {
            return { success: false, error: error.message };
          }
        }
        return { success: false, error: 'EnhancedDragDropManager not available' };
      });
      
      console.log('🔧 Initialization result:', initResult);
      
      // Try to run the quick test
      const quickTestResult = await page.evaluate(async () => {
        if (typeof window.quickTestDragDrop === 'function') {
          try {
            await window.quickTestDragDrop();
            return { success: true, testRan: true };
          } catch (error) {
            return { success: false, error: error.message };
          }
        }
        return { success: false, error: 'quickTestDragDrop not available' };
      });
      
      console.log('🧪 Quick test result:', quickTestResult);
      
      const dragDropInfo = {
        debugResult,
        initResult,
        quickTestResult
      };
      
      const testPassed = debugResult.success && initResult.success;
      
      logger.endTest('Enhanced DragDrop Test', testPassed, testPassed ? null : new Error('DragDrop test failed'), dragDropInfo);
      results.tests.push({
        name: 'Enhanced DragDrop Test',
        passed: testPassed,
        ...dragDropInfo
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

    // Keep browser open for inspection
    console.log('🔍 Keeping browser open for 10 seconds for inspection...');
    await page.waitForTimeout(10000);

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

  // Finalize logging
  logger.finalize();
  const logFiles = logger.saveLogFiles();

  // Display results
  console.log('\n📊 Proper Extension Test Results:');
  console.log('=================================');
  console.log(`Status: ${results.summary.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Tests: ${results.summary.passed}/${results.summary.total} passed`);
  
  if (results.issues.length > 0) {
    console.log('\n🚨 Issues Found:');
    results.issues.forEach(issue => {
      console.log(`  - [${issue.severity.toUpperCase()}] ${issue.type}: ${issue.message}`);
    });
  }

  if (results.consoleErrors.length > 0) {
    console.log('\n⚠️ Console Errors:');
    results.consoleErrors.slice(0, 5).forEach(error => {
      console.log(`  - ${error.message}`);
    });
    if (results.consoleErrors.length > 5) {
      console.log(`  ... and ${results.consoleErrors.length - 5} more errors`);
    }
  }

  console.log(`\n📄 Detailed logs: ${logFiles.latestFile}`);

  // Save results for analysis
  const resultsFile = path.join('./test-results', 'extension-proper-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`📄 Results saved: ${resultsFile}`);

  return results;
}

// Run the test
runProperExtensionTest()
  .then(results => {
    console.log('\n🎉 Proper extension test completed!');
    
    // Provide actionable feedback
    if (!results.summary.success) {
      console.log('\n🔧 Recommended Actions:');
      
      const criticalIssues = results.issues.filter(i => i.severity === 'critical');
      const highIssues = results.issues.filter(i => i.severity === 'high');
      
      if (criticalIssues.length > 0) {
        console.log('🚨 CRITICAL - Fix immediately:');
        criticalIssues.forEach(issue => {
          console.log(`   - ${issue.message}`);
        });
      }
      
      if (highIssues.length > 0) {
        console.log('⚠️ HIGH PRIORITY:');
        highIssues.forEach(issue => {
          console.log(`   - ${issue.message}`);
        });
      }
      
      if (results.consoleErrors.length > 0) {
        console.log('🐛 Console errors detected:');
        console.log('   - Check browser console for detailed error messages');
        console.log('   - Verify all JavaScript files are loading correctly');
      }
    }
    
    process.exit(results.summary.success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Test crashed:', error);
    process.exit(1);
  });
