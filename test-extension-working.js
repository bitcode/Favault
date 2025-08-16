#!/usr/bin/env node

/**
 * Working extension test that focuses on functionality
 * Uses a simpler approach to avoid browser closing issues
 */

import { chromium } from '@playwright/test';
import { TestLogger } from './test-logger.js';
import fs from 'fs';
import path from 'path';

async function runWorkingExtensionTest() {
  console.log('🚀 Starting Working FaVault Extension Test');
  console.log('==========================================');

  const logger = new TestLogger('extension-working');
  logger.log('INFO', 'Starting working extension test');

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
        '--allow-running-insecure-content'
      ]
    });

    const context = await browser.newContext();
    
    // Create a new tab that will trigger the extension
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

    // Test 1: Navigate to a simple page first to ensure browser is working
    console.log('🧪 Test 1: Basic browser functionality...');
    const basicTest = logger.startTest('Basic Browser Test', 'Test basic browser functionality');
    
    try {
      await page.goto('data:text/html,<html><body><h1>Test Page</h1><script>console.log("Browser working");</script></body></html>');
      await page.waitForLoadState('networkidle');
      
      const title = await page.textContent('h1');
      if (title !== 'Test Page') {
        throw new Error('Basic page navigation failed');
      }
      
      console.log('✅ Basic browser functionality working');
      logger.endTest('Basic Browser Test', true);
      results.tests.push({ name: 'Basic Browser Test', passed: true });
      
    } catch (error) {
      console.log(`❌ Basic browser test failed: ${error.message}`);
      logger.endTest('Basic Browser Test', false, error);
      results.tests.push({ name: 'Basic Browser Test', passed: false, error: error.message });
    }

    // Test 2: Check if extension is loaded by looking for service workers
    console.log('🧪 Test 2: Extension service worker detection...');
    const serviceWorkerTest = logger.startTest('Service Worker Detection', 'Check if extension service worker is running');
    
    try {
      // Get service workers from the context
      const serviceWorkers = context.serviceWorkers();
      console.log(`🔍 Found ${serviceWorkers.length} service workers`);
      
      let extensionServiceWorker = null;
      for (const sw of serviceWorkers) {
        const url = sw.url();
        console.log(`🔍 Service Worker URL: ${url}`);
        
        if (url.includes('chrome-extension://')) {
          extensionServiceWorker = sw;
          const extensionId = url.split('/')[2];
          results.extensionInfo.id = extensionId;
          console.log(`📍 Found extension service worker: ${extensionId}`);
          break;
        }
      }
      
      if (extensionServiceWorker) {
        console.log('✅ Extension service worker found');
        logger.endTest('Service Worker Detection', true, null, { 
          serviceWorkerUrl: extensionServiceWorker.url(),
          extensionId: results.extensionInfo.id
        });
        results.tests.push({
          name: 'Service Worker Detection',
          passed: true,
          extensionId: results.extensionInfo.id
        });
      } else {
        throw new Error('No extension service worker found');
      }
      
    } catch (error) {
      console.log(`❌ Service worker detection failed: ${error.message}`);
      logger.endTest('Service Worker Detection', false, error);
      results.tests.push({
        name: 'Service Worker Detection',
        passed: false,
        error: error.message
      });
    }

    // Test 3: Try to navigate to extension using detected ID
    if (results.extensionInfo.id) {
      console.log('🧪 Test 3: Extension page navigation...');
      const navTest = logger.startTest('Extension Page Navigation', 'Navigate to extension newtab page');
      
      try {
        const extensionUrl = `chrome-extension://${results.extensionInfo.id}/newtab.html`;
        console.log(`🔗 Navigating to: ${extensionUrl}`);
        
        await page.goto(extensionUrl);
        await page.waitForLoadState('networkidle');
        
        // Wait for the extension to load
        await page.waitForTimeout(5000);
        
        console.log('✅ Extension page loaded');
        
        logger.endTest('Extension Page Navigation', true, null, { url: extensionUrl });
        results.tests.push({
          name: 'Extension Page Navigation',
          passed: true,
          url: extensionUrl
        });
        
      } catch (error) {
        console.log(`❌ Extension navigation failed: ${error.message}`);
        logger.endTest('Extension Page Navigation', false, error);
        results.tests.push({
          name: 'Extension Page Navigation',
          passed: false,
          error: error.message
        });
      }
    }

    // Test 4: Check Extension Components and Functionality
    console.log('🧪 Test 4: Extension functionality check...');
    const funcTest = logger.startTest('Extension Functionality', 'Check extension components and functions');
    
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
      
      // Check for enhanced drag-drop manager and other global functions
      const globalFunctions = await page.evaluate(() => {
        const functions = [
          'EnhancedDragDropManager',
          'debugGlobalScope',
          'testEnhancedDragDrop',
          'quickTestDragDrop',
          'runAllTests',
          'testMove'
        ];
        
        const results = {};
        functions.forEach(name => {
          results[name] = {
            available: typeof window[name] !== 'undefined',
            type: typeof window[name]
          };
        });
        
        return results;
      });
      
      console.log('🔍 Global functions availability:');
      Object.entries(globalFunctions).forEach(([name, info]) => {
        console.log(`  ${info.available ? '✅' : '❌'} ${name}: ${info.type}`);
      });
      
      // Try to run debugGlobalScope if available
      let debugResult = null;
      if (globalFunctions.debugGlobalScope?.available) {
        debugResult = await page.evaluate(() => {
          try {
            window.debugGlobalScope();
            return { success: true, ran: true };
          } catch (error) {
            return { success: false, error: error.message };
          }
        });
        console.log('🔍 Debug function result:', debugResult);
      }
      
      // Try to initialize EnhancedDragDropManager if available
      let initResult = null;
      if (globalFunctions.EnhancedDragDropManager?.available) {
        initResult = await page.evaluate(async () => {
          try {
            if (typeof window.EnhancedDragDropManager.initialize === 'function') {
              const result = await window.EnhancedDragDropManager.initialize();
              return { success: true, result };
            }
            return { success: false, error: 'initialize method not found' };
          } catch (error) {
            return { success: false, error: error.message };
          }
        });
        console.log('🔧 Initialization result:', initResult);
      }
      
      const functionalityInfo = {
        hasAppContainer,
        folderCount,
        globalFunctions,
        debugResult,
        initResult
      };
      
      const testPassed = hasAppContainer && globalFunctions.EnhancedDragDropManager?.available;
      
      logger.endTest('Extension Functionality', testPassed, testPassed ? null : new Error('Key functionality missing'), functionalityInfo);
      results.tests.push({
        name: 'Extension Functionality',
        passed: testPassed,
        ...functionalityInfo
      });
      
    } catch (error) {
      console.log(`❌ Extension functionality check failed: ${error.message}`);
      logger.endTest('Extension Functionality', false, error);
      results.tests.push({
        name: 'Extension Functionality',
        passed: false,
        error: error.message
      });
    }

    // Keep browser open for inspection
    console.log('🔍 Keeping browser open for 15 seconds for inspection...');
    console.log('   You can manually inspect the extension in the browser window');
    await page.waitForTimeout(15000);

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
  console.log('\n📊 Working Extension Test Results:');
  console.log('==================================');
  console.log(`Status: ${results.summary.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Tests: ${results.summary.passed}/${results.summary.total} passed`);
  
  if (results.extensionInfo.id) {
    console.log(`Extension ID: ${results.extensionInfo.id}`);
  }
  
  if (results.issues.length > 0) {
    console.log('\n🚨 Issues Found:');
    results.issues.forEach(issue => {
      console.log(`  - [${issue.severity.toUpperCase()}] ${issue.type}: ${issue.message}`);
    });
  }

  if (results.consoleErrors.length > 0) {
    console.log('\n⚠️ Console Errors:');
    results.consoleErrors.slice(0, 3).forEach(error => {
      console.log(`  - ${error.message}`);
    });
    if (results.consoleErrors.length > 3) {
      console.log(`  ... and ${results.consoleErrors.length - 3} more errors`);
    }
  }

  console.log(`\n📄 Detailed logs: ${logFiles.latestFile}`);

  // Save results for analysis
  const resultsFile = path.join('./test-results', 'extension-working-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`📄 Results saved: ${resultsFile}`);

  return results;
}

// Run the test
runWorkingExtensionTest()
  .then(results => {
    console.log('\n🎉 Working extension test completed!');
    
    // Provide actionable feedback based on results
    if (!results.summary.success) {
      console.log('\n🔧 Recommended Actions Based on Test Results:');
      
      const criticalIssues = results.issues.filter(i => i.severity === 'critical');
      const mediumIssues = results.issues.filter(i => i.severity === 'medium');
      
      if (criticalIssues.length > 0) {
        console.log('🚨 CRITICAL - Fix immediately:');
        criticalIssues.forEach(issue => {
          console.log(`   - ${issue.message}`);
        });
      }
      
      if (mediumIssues.length > 0) {
        console.log('⚠️ MEDIUM PRIORITY:');
        mediumIssues.forEach(issue => {
          console.log(`   - ${issue.message}`);
        });
      }
      
      // Specific recommendations based on test results
      const failedTests = results.tests.filter(t => !t.passed);
      if (failedTests.length > 0) {
        console.log('\n🔧 Specific Fixes Needed:');
        failedTests.forEach(test => {
          console.log(`   - ${test.name}: ${test.error}`);
        });
      }
    } else {
      console.log('\n✅ All tests passed! Extension is working correctly.');
    }
    
    process.exit(results.summary.success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Test crashed:', error);
    process.exit(1);
  });
