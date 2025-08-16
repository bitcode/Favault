#!/usr/bin/env node

/**
 * Debug test specifically for JavaScript execution in extension
 * This will help identify why the EnhancedDragDropManager is not available
 */

import { chromium } from '@playwright/test';
import { TestLogger } from './test-logger.js';
import fs from 'fs';
import path from 'path';

async function debugJavaScriptExecution() {
  console.log('🚀 Starting JavaScript Execution Debug Test');
  console.log('============================================');

  const logger = new TestLogger('js-debug');
  logger.log('INFO', 'Starting JavaScript execution debug');

  let browser = null;
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    summary: { total: 0, passed: 0, failed: 0, success: false },
    issues: [],
    consoleErrors: [],
    jsExecution: {}
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

    // Capture ALL console messages
    const allConsoleMessages = [];
    page.on('console', msg => {
      const message = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
        timestamp: Date.now()
      };
      allConsoleMessages.push(message);
      
      console.log(`🔍 Console [${msg.type()}]: ${msg.text()}`);
      
      if (msg.type() === 'error') {
        results.consoleErrors.push(message);
        logger.addConsoleError(message.text, message.location);
      }
    });

    // Test 1: Direct file access to newtab.html
    console.log('🧪 Test 1: Direct file access to newtab.html...');
    const fileTest = logger.startTest('Direct File Access', 'Access newtab.html directly via file:// protocol');
    
    try {
      const newtabPath = path.join(extensionPath, 'newtab.html');
      const fileUrl = `file:///${newtabPath.replace(/\\/g, '/')}`;
      
      console.log(`🔗 Accessing: ${fileUrl}`);
      await page.goto(fileUrl);
      await page.waitForLoadState('networkidle');
      
      // Wait for potential JavaScript execution
      await page.waitForTimeout(5000);
      
      // Check basic HTML structure
      const appElement = await page.$('#app');
      const hasApp = !!appElement;
      
      const loadingElement = await page.$('.loading-fallback');
      const hasLoading = !!loadingElement;
      
      console.log(`📋 App element: ${hasApp ? '✅' : '❌'}`);
      console.log(`📋 Loading element: ${hasLoading ? '✅' : '❌'}`);
      
      // Check if loading is still visible (indicates JS didn't run)
      const loadingVisible = hasLoading ? await loadingElement.isVisible() : false;
      console.log(`📋 Loading still visible: ${loadingVisible ? '❌ (JS not running)' : '✅ (JS ran)'}`);
      
      // Check for any global variables
      const globalCheck = await page.evaluate(() => {
        const globals = [
          'EnhancedDragDropManager',
          'debugGlobalScope',
          'testEnhancedDragDrop',
          'quickTestDragDrop',
          'runAllTests'
        ];
        
        const results = {};
        globals.forEach(name => {
          results[name] = typeof window[name];
        });
        
        // Also check for any custom properties on window
        const customProps = [];
        for (const prop in window) {
          if (prop.startsWith('Enhanced') || prop.startsWith('debug') || prop.startsWith('test') || prop.startsWith('run')) {
            customProps.push(prop);
          }
        }
        
        return {
          globals: results,
          customProps,
          windowKeys: Object.keys(window).length
        };
      });
      
      console.log('🔍 Global variables check:', JSON.stringify(globalCheck, null, 2));
      
      const fileTestResult = {
        hasApp,
        hasLoading,
        loadingVisible,
        globalCheck,
        jsExecuted: !loadingVisible
      };
      
      logger.endTest('Direct File Access', true, null, fileTestResult);
      results.tests.push({
        name: 'Direct File Access',
        passed: true,
        ...fileTestResult
      });
      
    } catch (error) {
      console.log(`❌ Direct file access failed: ${error.message}`);
      logger.endTest('Direct File Access', false, error);
      results.tests.push({
        name: 'Direct File Access',
        passed: false,
        error: error.message
      });
    }

    // Test 2: Check for service worker and get extension ID
    console.log('🧪 Test 2: Service worker and extension ID detection...');
    const swTest = logger.startTest('Service Worker Detection', 'Find extension service worker');
    
    try {
      // Wait a bit for service workers to register
      await page.waitForTimeout(2000);
      
      const serviceWorkers = context.serviceWorkers();
      console.log(`🔍 Found ${serviceWorkers.length} service workers`);
      
      let extensionId = null;
      for (const sw of serviceWorkers) {
        const url = sw.url();
        console.log(`🔍 Service Worker URL: ${url}`);
        
        if (url.includes('chrome-extension://')) {
          extensionId = url.split('/')[2];
          console.log(`📍 Found extension ID: ${extensionId}`);
          break;
        }
      }
      
      if (!extensionId) {
        // Try alternative method - check for extension context
        extensionId = await page.evaluate(() => {
          // Check if we're in an extension context
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
            return chrome.runtime.id;
          }
          return null;
        });
        
        if (extensionId) {
          console.log(`📍 Extension ID from runtime: ${extensionId}`);
        }
      }
      
      const swResult = {
        serviceWorkerCount: serviceWorkers.length,
        extensionId,
        foundExtension: !!extensionId
      };
      
      logger.endTest('Service Worker Detection', !!extensionId, extensionId ? null : new Error('No extension ID found'), swResult);
      results.tests.push({
        name: 'Service Worker Detection',
        passed: !!extensionId,
        ...swResult
      });
      
      // If we found an extension ID, try chrome-extension:// protocol
      if (extensionId) {
        console.log('🧪 Test 3: Chrome extension protocol access...');
        const chromeTest = logger.startTest('Chrome Extension Protocol', 'Access via chrome-extension:// protocol');
        
        try {
          const extensionUrl = `chrome-extension://${extensionId}/newtab.html`;
          console.log(`🔗 Navigating to: ${extensionUrl}`);
          
          await page.goto(extensionUrl);
          await page.waitForLoadState('networkidle');
          
          // Wait for JavaScript execution
          await page.waitForTimeout(5000);
          
          // Check the same things as before
          const appElement = await page.$('#app');
          const hasApp = !!appElement;
          
          const loadingElement = await page.$('.loading-fallback');
          const hasLoading = !!loadingElement;
          const loadingVisible = hasLoading ? await loadingElement.isVisible() : false;
          
          console.log(`📋 App element: ${hasApp ? '✅' : '❌'}`);
          console.log(`📋 Loading element: ${hasLoading ? '✅' : '❌'}`);
          console.log(`📋 Loading still visible: ${loadingVisible ? '❌ (JS not running)' : '✅ (JS ran)'}`);
          
          // Check for global variables again
          const globalCheck = await page.evaluate(() => {
            const globals = [
              'EnhancedDragDropManager',
              'debugGlobalScope',
              'testEnhancedDragDrop',
              'quickTestDragDrop',
              'runAllTests'
            ];
            
            const results = {};
            globals.forEach(name => {
              results[name] = typeof window[name];
            });
            
            // Check for Svelte app instance
            const svelteApp = typeof window.__SVELTE__ !== 'undefined';
            
            return {
              globals: results,
              svelteApp,
              windowKeys: Object.keys(window).length
            };
          });
          
          console.log('🔍 Global variables check (chrome-extension):', JSON.stringify(globalCheck, null, 2));
          
          const chromeTestResult = {
            hasApp,
            hasLoading,
            loadingVisible,
            globalCheck,
            jsExecuted: !loadingVisible,
            protocol: 'chrome-extension'
          };
          
          logger.endTest('Chrome Extension Protocol', true, null, chromeTestResult);
          results.tests.push({
            name: 'Chrome Extension Protocol',
            passed: true,
            ...chromeTestResult
          });
          
        } catch (error) {
          console.log(`❌ Chrome extension protocol access failed: ${error.message}`);
          logger.endTest('Chrome Extension Protocol', false, error);
          results.tests.push({
            name: 'Chrome Extension Protocol',
            passed: false,
            error: error.message
          });
        }
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

    // Keep browser open for manual inspection
    console.log('🔍 Keeping browser open for 20 seconds for manual inspection...');
    console.log('   Check the browser console and network tab for errors');
    await page.waitForTimeout(20000);

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

  // Store all console messages
  results.jsExecution.allConsoleMessages = allConsoleMessages;

  // Calculate results
  results.summary.total = results.tests.length;
  results.summary.passed = results.tests.filter(t => t.passed).length;
  results.summary.failed = results.summary.total - results.summary.passed;
  results.summary.success = results.summary.failed === 0;

  // Finalize logging
  logger.finalize();
  const logFiles = logger.saveLogFiles();

  // Display results
  console.log('\n📊 JavaScript Debug Test Results:');
  console.log('=================================');
  console.log(`Status: ${results.summary.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Tests: ${results.summary.passed}/${results.summary.total} passed`);
  
  if (results.consoleErrors.length > 0) {
    console.log('\n⚠️ Console Errors Found:');
    results.consoleErrors.slice(0, 5).forEach(error => {
      console.log(`  - ${error.text}`);
    });
  }

  console.log('\n🔍 Key Findings:');
  results.tests.forEach(test => {
    if (test.jsExecuted !== undefined) {
      console.log(`  - ${test.name}: JavaScript ${test.jsExecuted ? '✅ executed' : '❌ not executed'}`);
    }
    if (test.globalCheck) {
      const hasEnhanced = test.globalCheck.globals?.EnhancedDragDropManager !== 'undefined';
      console.log(`  - ${test.name}: EnhancedDragDropManager ${hasEnhanced ? '✅ available' : '❌ not available'}`);
    }
  });

  console.log(`\n📄 Detailed logs: ${logFiles.latestFile}`);

  // Save results for analysis
  const resultsFile = path.join('./test-results', 'js-debug-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`📄 Results saved: ${resultsFile}`);

  return results;
}

// Run the test
debugJavaScriptExecution()
  .then(results => {
    console.log('\n🎉 JavaScript debug test completed!');
    
    // Provide specific debugging recommendations
    console.log('\n🔧 Debug Recommendations:');
    
    const jsNotExecuting = results.tests.some(t => t.jsExecuted === false);
    const noEnhancedManager = results.tests.every(t => 
      t.globalCheck?.globals?.EnhancedDragDropManager === 'undefined'
    );
    
    if (jsNotExecuting) {
      console.log('🚨 CRITICAL: JavaScript not executing properly');
      console.log('   - Check for CORS errors in browser console');
      console.log('   - Verify newtab.js file is loading correctly');
      console.log('   - Check for module loading errors');
    }
    
    if (noEnhancedManager) {
      console.log('🚨 CRITICAL: EnhancedDragDropManager not available');
      console.log('   - Check if exposeEnhancedDragDropGlobally() is being called');
      console.log('   - Verify the Svelte app is mounting correctly');
      console.log('   - Check for JavaScript errors preventing initialization');
    }
    
    if (results.consoleErrors.length > 0) {
      console.log('🐛 Console errors detected - check browser console for details');
    }
    
    process.exit(results.summary.success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Debug test crashed:', error);
    process.exit(1);
  });
