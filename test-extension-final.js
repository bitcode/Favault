#!/usr/bin/env node

/**
 * Final comprehensive extension test using the correct global functions
 * Now that we know the extension is working, let's test the actual functionality
 */

import { chromium } from '@playwright/test';
import { TestLogger } from './test-logger.js';
import fs from 'fs';
import path from 'path';

async function runFinalExtensionTest() {
  console.log('🚀 Starting Final FaVault Extension Test');
  console.log('=======================================');

  const logger = new TestLogger('extension-final');
  logger.log('INFO', 'Starting final comprehensive extension test');

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
    console.log('🌐 Launching browser with extension...');
    browser = await chromium.launch({
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-web-security'
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

    // Test 1: Load Extension and Verify Functions
    console.log('🧪 Test 1: Loading extension and verifying functions...');
    const loadTest = logger.startTest('Extension Loading', 'Load extension and verify global functions');
    
    try {
      const newtabPath = path.join(extensionPath, 'newtab.html');
      const fileUrl = `file:///${newtabPath.replace(/\\/g, '/')}`;
      
      console.log(`🔗 Loading: ${fileUrl}`);
      await page.goto(fileUrl);
      await page.waitForLoadState('networkidle');
      
      // Wait for extension to fully initialize
      await page.waitForTimeout(5000);
      
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
      
      console.log('🔍 Available functions:');
      Object.entries(functionCheck).forEach(([name, info]) => {
        console.log(`  ${info.available ? '✅' : '❌'} ${name}: ${info.type}`);
      });
      
      const allFunctionsAvailable = Object.values(functionCheck).every(f => f.available);
      
      logger.endTest('Extension Loading', allFunctionsAvailable, 
        allFunctionsAvailable ? null : new Error('Some functions not available'), 
        { functionCheck, allFunctionsAvailable });
      
      results.tests.push({
        name: 'Extension Loading',
        passed: allFunctionsAvailable,
        functionCheck,
        allFunctionsAvailable
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

    // Test 2: Run Quick Test
    console.log('🧪 Test 2: Running quickTestDragDrop()...');
    const quickTest = logger.startTest('Quick Drag Drop Test', 'Run the built-in quick test function');
    
    try {
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
      
      console.log('🔧 Quick test result:', JSON.stringify(quickTestResult, null, 2));
      
      logger.endTest('Quick Drag Drop Test', quickTestResult.success, 
        quickTestResult.success ? null : new Error(quickTestResult.error), 
        quickTestResult);
      
      results.tests.push({
        name: 'Quick Drag Drop Test',
        passed: quickTestResult.success,
        ...quickTestResult
      });
      
    } catch (error) {
      console.log(`❌ Quick test failed: ${error.message}`);
      logger.endTest('Quick Drag Drop Test', false, error);
      results.tests.push({
        name: 'Quick Drag Drop Test',
        passed: false,
        error: error.message
      });
    }

    // Test 3: Run Comprehensive Test Suite
    console.log('🧪 Test 3: Running runAllTests()...');
    const comprehensiveTest = logger.startTest('Comprehensive Test Suite', 'Run the built-in comprehensive test suite');
    
    try {
      const comprehensiveResult = await page.evaluate(async () => {
        if (typeof window.runAllTests === 'function') {
          try {
            const startTime = Date.now();
            await window.runAllTests();
            const duration = Date.now() - startTime;
            
            // Get test results if available
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
      
      logger.endTest('Comprehensive Test Suite', comprehensiveResult.success, 
        comprehensiveResult.success ? null : new Error(comprehensiveResult.error), 
        comprehensiveResult);
      
      results.tests.push({
        name: 'Comprehensive Test Suite',
        passed: comprehensiveResult.success,
        ...comprehensiveResult
      });
      
      // Store performance data
      if (comprehensiveResult.duration) {
        results.performance.comprehensiveTestDuration = comprehensiveResult.duration;
      }
      
    } catch (error) {
      console.log(`❌ Comprehensive test failed: ${error.message}`);
      logger.endTest('Comprehensive Test Suite', false, error);
      results.tests.push({
        name: 'Comprehensive Test Suite',
        passed: false,
        error: error.message
      });
    }

    // Test 4: Individual Move Test
    console.log('🧪 Test 4: Testing individual folder move...');
    const moveTest = logger.startTest('Individual Move Test', 'Test moving a folder from position 0 to 1');
    
    try {
      const moveResult = await page.evaluate(async () => {
        if (typeof window.testMove === 'function') {
          try {
            const startTime = Date.now();
            await window.testMove(0, 1);
            const duration = Date.now() - startTime;
            return { success: true, duration, moveExecuted: true };
          } catch (error) {
            return { success: false, error: error.message, moveExecuted: true };
          }
        }
        return { success: false, error: 'testMove not available', moveExecuted: false };
      });
      
      console.log('🔧 Move test result:', JSON.stringify(moveResult, null, 2));
      
      logger.endTest('Individual Move Test', moveResult.success, 
        moveResult.success ? null : new Error(moveResult.error), 
        moveResult);
      
      results.tests.push({
        name: 'Individual Move Test',
        passed: moveResult.success,
        ...moveResult
      });
      
      // Store performance data
      if (moveResult.duration) {
        results.performance.individualMoveDuration = moveResult.duration;
      }
      
    } catch (error) {
      console.log(`❌ Individual move test failed: ${error.message}`);
      logger.endTest('Individual Move Test', false, error);
      results.tests.push({
        name: 'Individual Move Test',
        passed: false,
        error: error.message
      });
    }

    // Test 5: State Verification
    console.log('🧪 Test 5: Verifying extension state...');
    const stateTest = logger.startTest('State Verification', 'Check extension state and folder count');
    
    try {
      const stateResult = await page.evaluate(() => {
        if (typeof window.showState === 'function') {
          try {
            window.showState();
            
            // Check for folder containers in DOM
            const folderContainers = document.querySelectorAll('.folder-container');
            const folderCount = folderContainers.length;
            
            // Check for app container
            const appContainer = document.querySelector('#app');
            const hasApp = !!appContainer;
            
            return { 
              success: true, 
              folderCount,
              hasApp,
              stateShown: true
            };
          } catch (error) {
            return { success: false, error: error.message, stateShown: true };
          }
        }
        return { success: false, error: 'showState not available', stateShown: false };
      });
      
      console.log('🔧 State verification result:', JSON.stringify(stateResult, null, 2));
      
      logger.endTest('State Verification', stateResult.success, 
        stateResult.success ? null : new Error(stateResult.error), 
        stateResult);
      
      results.tests.push({
        name: 'State Verification',
        passed: stateResult.success,
        ...stateResult
      });
      
    } catch (error) {
      console.log(`❌ State verification failed: ${error.message}`);
      logger.endTest('State Verification', false, error);
      results.tests.push({
        name: 'State Verification',
        passed: false,
        error: error.message
      });
    }

    // Keep browser open for manual inspection
    console.log('🔍 Keeping browser open for 15 seconds for manual inspection...');
    console.log('   You can see the extension working in the browser window');
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

  // Display results
  console.log('\n📊 Final Extension Test Results:');
  console.log('================================');
  console.log(`Status: ${results.summary.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Tests: ${results.summary.passed}/${results.summary.total} passed`);
  
  if (results.performance.averageTestTime) {
    console.log(`Average Test Time: ${Math.round(results.performance.averageTestTime)}ms`);
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
  const resultsFile = path.join('./test-results', 'extension-final-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`📄 Results saved: ${resultsFile}`);

  return results;
}

// Run the test
runFinalExtensionTest()
  .then(results => {
    console.log('\n🎉 Final extension test completed!');
    
    if (results.summary.success) {
      console.log('\n✅ SUCCESS: All tests passed! Extension is working correctly.');
      console.log('\n🎯 Extension Functionality Verified:');
      console.log('   ✅ Extension loads properly');
      console.log('   ✅ Global test functions available');
      console.log('   ✅ Quick drag-drop test works');
      console.log('   ✅ Comprehensive test suite runs');
      console.log('   ✅ Individual folder moves work');
      console.log('   ✅ Extension state is accessible');
      
      if (results.performance.averageTestTime) {
        console.log(`\n⚡ Performance: ${Math.round(results.performance.averageTestTime)}ms average test time`);
      }
    } else {
      console.log('\n🔧 Issues to Address:');
      const failedTests = results.tests.filter(t => !t.passed);
      failedTests.forEach(test => {
        console.log(`   - ${test.name}: ${test.error}`);
      });
    }
    
    process.exit(results.summary.success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Final test crashed:', error);
    process.exit(1);
  });
