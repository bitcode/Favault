#!/usr/bin/env node

/**
 * Test extension in proper Chrome extension context
 * This will load the extension properly so it has access to Chrome APIs
 */

import { chromium } from '@playwright/test';
import { TestLogger } from './test-logger.js';
import fs from 'fs';
import path from 'path';

async function testInChromeContext() {
  console.log('🚀 Testing FaVault Extension in Proper Chrome Context');
  console.log('====================================================');

  const logger = new TestLogger('chrome-context');
  logger.log('INFO', 'Starting Chrome extension context test');

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

    // Launch browser with extension properly loaded
    console.log('🌐 Launching Chrome with extension in proper context...');
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
    console.log('✅ Browser launched');

    // Capture console messages
    const allConsoleMessages = [];
    
    // Test 1: Open a new tab to trigger the extension
    console.log('🧪 Test 1: Opening new tab to trigger extension...');
    const newTabTest = logger.startTest('New Tab Trigger', 'Open new tab to trigger extension');
    
    try {
      // Create a new page (this should trigger the new tab override)
      const page = await context.newPage();
      
      // Set up console capture for this page
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
      
      // Wait for the extension to load
      console.log('⏳ Waiting for extension to load...');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(5000);
      
      // Check if we're on the extension page
      const currentUrl = page.url();
      console.log(`🔗 Current URL: ${currentUrl}`);
      
      const isExtensionPage = currentUrl.startsWith('chrome-extension://');
      
      if (isExtensionPage) {
        const extensionId = currentUrl.split('/')[2];
        results.extensionInfo.id = extensionId;
        console.log(`📍 Extension ID: ${extensionId}`);
      }
      
      logger.endTest('New Tab Trigger', isExtensionPage, 
        isExtensionPage ? null : new Error('Extension did not load as new tab'), 
        { currentUrl, isExtensionPage, extensionId: results.extensionInfo.id });
      
      results.tests.push({
        name: 'New Tab Trigger',
        passed: isExtensionPage,
        currentUrl,
        isExtensionPage,
        extensionId: results.extensionInfo.id
      });
      
      if (isExtensionPage) {
        // Test 2: Check Extension Functions in Chrome Context
        console.log('🧪 Test 2: Testing extension functions in Chrome context...');
        const functionsTest = logger.startTest('Extension Functions', 'Test extension functions with Chrome API access');
        
        try {
          // Wait a bit more for full initialization
          await page.waitForTimeout(3000);
          
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
          
          console.log('🔍 Available functions in Chrome context:');
          Object.entries(functionCheck).forEach(([name, info]) => {
            console.log(`  ${info.available ? '✅' : '❌'} ${name}: ${info.type}`);
          });
          
          const allFunctionsAvailable = Object.values(functionCheck).every(f => f.available);
          
          if (allFunctionsAvailable) {
            // Test 3: Run Quick Test with Chrome API Access
            console.log('🧪 Test 3: Running quickTestDragDrop with Chrome API...');
            
            const quickTestResult = await page.evaluate(async () => {
              if (typeof window.quickTestDragDrop === 'function') {
                try {
                  const startTime = Date.now();
                  await window.quickTestDragDrop();
                  const duration = Date.now() - startTime;
                  return { success: true, duration, testRan: true };
                } catch (error) {
                  return { success: false, error: error.message, testRan: true };
                }
              }
              return { success: false, error: 'quickTestDragDrop not available', testRan: false };
            });
            
            console.log('🔧 Quick test result with Chrome API:', JSON.stringify(quickTestResult, null, 2));
            
            // Test 4: Check Bookmark Access
            console.log('🧪 Test 4: Testing bookmark API access...');
            
            const bookmarkTest = await page.evaluate(async () => {
              try {
                // Check if Chrome bookmark API is available
                if (typeof chrome !== 'undefined' && chrome.bookmarks) {
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
                    bookmarkCount: bookmarks ? bookmarks.length : 0
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
            
            console.log('🔧 Bookmark API test result:', JSON.stringify(bookmarkTest, null, 2));
            
            // Test 5: Run Comprehensive Test Suite
            console.log('🧪 Test 5: Running comprehensive test suite...');
            
            const comprehensiveResult = await page.evaluate(async () => {
              if (typeof window.runAllTests === 'function') {
                try {
                  const startTime = Date.now();
                  await window.runAllTests();
                  const duration = Date.now() - startTime;
                  
                  // Get test results
                  let testResults = null;
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
            
            console.log('🔧 Comprehensive test result:', JSON.stringify(comprehensiveResult, null, 2));
            
            const allTestsPassed = quickTestResult.success && bookmarkTest.success && comprehensiveResult.success;
            
            logger.endTest('Extension Functions', allTestsPassed, 
              allTestsPassed ? null : new Error('Some tests failed'), 
              { 
                functionCheck, 
                quickTestResult, 
                bookmarkTest, 
                comprehensiveResult,
                allTestsPassed
              });
            
            results.tests.push({
              name: 'Extension Functions',
              passed: allTestsPassed,
              functionCheck,
              quickTestResult,
              bookmarkTest,
              comprehensiveResult
            });
            
          } else {
            throw new Error('Not all functions available');
          }
          
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
      
      // Keep browser open for manual inspection
      console.log('🔍 Keeping browser open for 20 seconds for manual inspection...');
      console.log('   You can manually test the extension functionality');
      await page.waitForTimeout(20000);
      
    } catch (error) {
      console.log(`❌ New tab test failed: ${error.message}`);
      logger.endTest('New Tab Trigger', false, error);
      results.tests.push({
        name: 'New Tab Trigger',
        passed: false,
        error: error.message
      });
    }

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

  // Finalize logging
  logger.finalize();
  const logFiles = logger.saveLogFiles();

  // Display results
  console.log('\n📊 Chrome Context Test Results:');
  console.log('===============================');
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
      console.log(`  - ${error.text}`);
    });
  }

  console.log(`\n📄 Detailed logs: ${logFiles.latestFile}`);

  // Save results for analysis
  const resultsFile = path.join('./test-results', 'chrome-context-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`📄 Results saved: ${resultsFile}`);

  return results;
}

// Run the test
testInChromeContext()
  .then(results => {
    console.log('\n🎉 Chrome context test completed!');
    
    if (results.summary.success) {
      console.log('\n✅ SUCCESS: Extension working correctly in Chrome context!');
      console.log('\n🎯 Extension Functionality Verified:');
      console.log('   ✅ Extension loads as new tab override');
      console.log('   ✅ Chrome extension context active');
      console.log('   ✅ Bookmark API accessible');
      console.log('   ✅ All test functions working');
      console.log('   ✅ Drag-drop functionality operational');
    } else {
      console.log('\n🔧 Issues Found:');
      const failedTests = results.tests.filter(t => !t.passed);
      failedTests.forEach(test => {
        console.log(`   - ${test.name}: ${test.error}`);
      });
    }
    
    process.exit(results.summary.success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Chrome context test crashed:', error);
    process.exit(1);
  });
