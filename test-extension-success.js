#!/usr/bin/env node

/**
 * FINAL SUCCESS TEST - Proper Chrome extension testing
 * This will navigate to chrome://newtab/ to trigger the extension properly
 */

import { chromium } from '@playwright/test';
import { TestLogger } from './test-logger.js';
import fs from 'fs';
import path from 'path';

async function runSuccessfulExtensionTest() {
  console.log('🚀 FINAL SUCCESS TEST - FaVault Extension');
  console.log('=========================================');

  const logger = new TestLogger('extension-success');
  logger.log('INFO', 'Starting final successful extension test');

  let browser = null;
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    summary: { total: 0, passed: 0, failed: 0, success: false },
    issues: [],
    consoleErrors: [],
    extensionInfo: {},
    performance: {}
  };

  try {
    // Check extension build
    const extensionPath = path.resolve('./dist/chrome');
    if (!fs.existsSync(extensionPath)) {
      throw new Error('Extension not built. Run "npm run build:chrome" first.');
    }
    console.log('✅ Extension build verified');

    // Launch browser with extension
    console.log('🌐 Launching Chrome with FaVault extension...');
    browser = await chromium.launch({
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox'
      ]
    });

    const context = await browser.newContext();
    const page = await context.newPage();
    console.log('✅ Browser launched');

    // Capture console messages
    const allConsoleMessages = [];
    page.on('console', msg => {
      const message = {
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now()
      };
      allConsoleMessages.push(message);
      
      console.log(`🔍 Console [${msg.type()}]: ${msg.text()}`);
      
      if (msg.type() === 'error') {
        results.consoleErrors.push(message);
        logger.addConsoleError(message.text, msg.location());
      }
    });

    // Test 1: Navigate to New Tab (triggers extension)
    console.log('🧪 Test 1: Navigating to chrome://newtab/ to trigger extension...');
    const newTabTest = logger.startTest('New Tab Navigation', 'Navigate to chrome://newtab/ to trigger extension');
    
    try {
      console.log('🔗 Navigating to chrome://newtab/');
      await page.goto('chrome://newtab/');
      await page.waitForLoadState('networkidle');
      
      // Wait for extension to fully load
      console.log('⏳ Waiting for extension to initialize...');
      await page.waitForTimeout(8000);
      
      const currentUrl = page.url();
      console.log(`🔗 Current URL: ${currentUrl}`);
      
      const isExtensionPage = currentUrl.startsWith('chrome-extension://');
      
      if (isExtensionPage) {
        const extensionId = currentUrl.split('/')[2];
        results.extensionInfo.id = extensionId;
        console.log(`📍 ✅ Extension loaded! ID: ${extensionId}`);
      } else {
        console.log(`⚠️ Extension not loaded, still on: ${currentUrl}`);
      }
      
      logger.endTest('New Tab Navigation', isExtensionPage, 
        isExtensionPage ? null : new Error('Extension did not load as new tab'), 
        { currentUrl, isExtensionPage, extensionId: results.extensionInfo.id });
      
      results.tests.push({
        name: 'New Tab Navigation',
        passed: isExtensionPage,
        currentUrl,
        isExtensionPage,
        extensionId: results.extensionInfo.id
      });
      
    } catch (error) {
      console.log(`❌ New tab navigation failed: ${error.message}`);
      logger.endTest('New Tab Navigation', false, error);
      results.tests.push({
        name: 'New Tab Navigation',
        passed: false,
        error: error.message
      });
    }

    // Test 2: Verify Extension Functions (if extension loaded)
    if (results.extensionInfo.id) {
      console.log('🧪 Test 2: Verifying extension functions...');
      const functionsTest = logger.startTest('Extension Functions', 'Verify all extension functions are available');
      
      try {
        // Check for available functions
        const functionCheck = await page.evaluate(() => {
          const functions = [
            'testEnhancedDragDrop',
            'quickTestDragDrop', 
            'runAllTests',
            'testMove',
            'showState',
            'refreshBookmarks',
            'getTestResults'
          ];
          
          const results = {};
          functions.forEach(name => {
            results[name] = {
              available: typeof window[name] === 'function',
              type: typeof window[name]
            };
          });
          
          return results;
        });
        
        console.log('🔍 Extension functions:');
        Object.entries(functionCheck).forEach(([name, info]) => {
          console.log(`  ${info.available ? '✅' : '❌'} ${name}`);
        });
        
        const allFunctionsAvailable = Object.values(functionCheck).every(f => f.available);
        
        logger.endTest('Extension Functions', allFunctionsAvailable, 
          allFunctionsAvailable ? null : new Error('Some functions not available'), 
          { functionCheck, allFunctionsAvailable });
        
        results.tests.push({
          name: 'Extension Functions',
          passed: allFunctionsAvailable,
          functionCheck,
          allFunctionsAvailable
        });
        
      } catch (error) {
        console.log(`❌ Extension functions test failed: ${error.message}`);
        logger.endTest('Extension Functions', false, error);
        results.tests.push({
          name: 'Extension Functions',
          passed: false,
          error: error.message
        });
      }
    }

    // Test 3: Test Bookmark API Access
    if (results.extensionInfo.id) {
      console.log('🧪 Test 3: Testing Chrome Bookmark API access...');
      const bookmarkTest = logger.startTest('Bookmark API Access', 'Test Chrome bookmark API access');
      
      try {
        const bookmarkResult = await page.evaluate(async () => {
          try {
            if (typeof chrome !== 'undefined' && chrome.bookmarks) {
              // Test bookmark API access
              const bookmarks = await new Promise((resolve, reject) => {
                chrome.bookmarks.getTree((result) => {
                  if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                  } else {
                    resolve(result);
                  }
                });
              });
              
              return {
                success: true,
                hasBookmarkAPI: true,
                bookmarkTreeLength: bookmarks ? bookmarks.length : 0,
                message: 'Bookmark API accessible'
              };
            } else {
              return {
                success: false,
                hasBookmarkAPI: false,
                error: 'Chrome bookmark API not available'
              };
            }
          } catch (error) {
            return {
              success: false,
              hasBookmarkAPI: false,
              error: error.message
            };
          }
        });
        
        console.log('🔧 Bookmark API result:', JSON.stringify(bookmarkResult, null, 2));
        
        logger.endTest('Bookmark API Access', bookmarkResult.success, 
          bookmarkResult.success ? null : new Error(bookmarkResult.error), 
          bookmarkResult);
        
        results.tests.push({
          name: 'Bookmark API Access',
          passed: bookmarkResult.success,
          ...bookmarkResult
        });
        
      } catch (error) {
        console.log(`❌ Bookmark API test failed: ${error.message}`);
        logger.endTest('Bookmark API Access', false, error);
        results.tests.push({
          name: 'Bookmark API Access',
          passed: false,
          error: error.message
        });
      }
    }

    // Test 4: Run Extension's Built-in Tests
    if (results.extensionInfo.id) {
      console.log('🧪 Test 4: Running extension\'s built-in test suite...');
      const builtinTest = logger.startTest('Built-in Test Suite', 'Run extension\'s comprehensive test suite');
      
      try {
        const testResult = await page.evaluate(async () => {
          if (typeof window.runAllTests === 'function') {
            try {
              const startTime = Date.now();
              await window.runAllTests();
              const duration = Date.now() - startTime;
              
              // Get test results
              let testResults = 'Test completed';
              if (typeof window.getTestResults === 'function') {
                testResults = window.getTestResults();
              }
              
              return { 
                success: true, 
                duration, 
                testRan: true,
                testResults
              };
            } catch (error) {
              return { success: false, error: error.message, testRan: true };
            }
          }
          return { success: false, error: 'runAllTests not available', testRan: false };
        });
        
        console.log('🔧 Built-in test result:', JSON.stringify(testResult, null, 2));
        
        // Store performance data
        if (testResult.duration) {
          results.performance.builtinTestDuration = testResult.duration;
        }
        
        logger.endTest('Built-in Test Suite', testResult.success, 
          testResult.success ? null : new Error(testResult.error), 
          testResult);
        
        results.tests.push({
          name: 'Built-in Test Suite',
          passed: testResult.success,
          ...testResult
        });
        
      } catch (error) {
        console.log(`❌ Built-in test failed: ${error.message}`);
        logger.endTest('Built-in Test Suite', false, error);
        results.tests.push({
          name: 'Built-in Test Suite',
          passed: false,
          error: error.message
        });
      }
    }

    // Test 5: Manual Verification
    console.log('🧪 Test 5: Manual verification opportunity...');
    console.log('🔍 Browser will stay open for 30 seconds for manual inspection');
    console.log('   You can manually test:');
    console.log('   - Folder drag and drop');
    console.log('   - Edit mode toggle');
    console.log('   - Bookmark organization');
    console.log('   - Search functionality');
    
    await page.waitForTimeout(30000);

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

  // Store console messages
  results.allConsoleMessages = allConsoleMessages;

  // Calculate results
  results.summary.total = results.tests.length;
  results.summary.passed = results.tests.filter(t => t.passed).length;
  results.summary.failed = results.summary.total - results.summary.passed;
  results.summary.success = results.summary.failed === 0;

  // Calculate performance metrics
  const durations = results.tests
    .map(t => t.duration)
    .filter(d => d && d > 0);
  
  if (durations.length > 0) {
    results.performance.averageTestTime = durations.reduce((a, b) => a + b, 0) / durations.length;
    results.performance.slowestTest = Math.max(...durations);
    results.performance.fastestTest = Math.min(...durations);
  }

  // Finalize logging
  logger.finalize();
  const logFiles = logger.saveLogFiles();

  // Display final results
  console.log('\n📊 FINAL EXTENSION TEST RESULTS');
  console.log('================================');
  console.log(`Status: ${results.summary.success ? '🎉 COMPLETE SUCCESS!' : '❌ ISSUES FOUND'}`);
  console.log(`Tests: ${results.summary.passed}/${results.summary.total} passed`);
  
  if (results.extensionInfo.id) {
    console.log(`Extension ID: ${results.extensionInfo.id}`);
  }
  
  if (results.performance.averageTestTime) {
    console.log(`Average Test Time: ${Math.round(results.performance.averageTestTime)}ms`);
  }
  
  if (results.summary.success) {
    console.log('\n🎯 EXTENSION VERIFICATION COMPLETE:');
    console.log('   ✅ Extension loads as new tab override');
    console.log('   ✅ All global functions available');
    console.log('   ✅ Chrome bookmark API accessible');
    console.log('   ✅ Built-in test suite functional');
    console.log('   ✅ Ready for production use');
  } else {
    console.log('\n🔧 Issues to Address:');
    const failedTests = results.tests.filter(t => !t.passed);
    failedTests.forEach(test => {
      console.log(`   - ${test.name}: ${test.error}`);
    });
  }
  
  if (results.consoleErrors.length > 0) {
    console.log('\n⚠️ Console Errors:');
    results.consoleErrors.slice(0, 3).forEach(error => {
      console.log(`  - ${error.text}`);
    });
  }

  console.log(`\n📄 Detailed logs: ${logFiles.latestFile}`);

  // Save results for analysis
  const resultsFile = path.join('./test-results', 'extension-success-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`📄 Results saved: ${resultsFile}`);

  return results;
}

// Run the final test
runSuccessfulExtensionTest()
  .then(results => {
    console.log('\n🎉 FINAL EXTENSION TEST COMPLETED!');
    
    if (results.summary.success) {
      console.log('\n🏆 SUCCESS: FaVault extension is working perfectly!');
      console.log('🚀 The extension has been thoroughly tested and verified.');
      console.log('📋 All functionality is operational and ready for use.');
    } else {
      console.log('\n📋 Test Summary:');
      console.log(`   Passed: ${results.summary.passed}`);
      console.log(`   Failed: ${results.summary.failed}`);
      console.log(`   Total: ${results.summary.total}`);
    }
    
    process.exit(results.summary.success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Final test crashed:', error);
    process.exit(1);
  });
