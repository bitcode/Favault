#!/usr/bin/env node

/**
 * Demo of the comprehensive logging system for development feedback loop
 */

import { TestLogger } from './test-logger.js';
import fs from 'fs';
import path from 'path';

async function demonstrateLogging() {
  console.log('🚀 Demonstrating Comprehensive Test Logging System');
  console.log('=================================================');

  // Create logger for position accuracy tests
  const logger = new TestLogger('position-accuracy-demo');
  
  logger.log('INFO', 'Starting position accuracy test demonstration');

  // Simulate Test 1: Extension Setup
  const setupTest = logger.startTest('Extension Setup', 'Load and initialize extension for testing');
  
  // Simulate setup steps
  logger.addTestStep('Extension Setup', 'Build Extension', 'success', { buildTime: 850 });
  logger.addTestStep('Extension Setup', 'Launch Browser', 'success', { browserType: 'chromium' });
  logger.addTestStep('Extension Setup', 'Load Extension', 'success', { extensionId: 'demo-id-123' });
  logger.addTestStep('Extension Setup', 'Enable Edit Mode', 'success', { editModeActive: true });
  
  // Simulate a small delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  logger.endTest('Extension Setup', true, null, { 
    setupTime: 1000,
    extensionLoaded: true,
    editModeEnabled: true
  });

  // Simulate Test 2: Basic Position Accuracy
  const positionTest = logger.startTest('Basic Position Accuracy', 'Test moving folder to different positions');
  
  logger.addTestStep('Basic Position Accuracy', 'Get Initial Folder Order', 'success', { 
    folderCount: 5,
    folders: ['Work', 'Personal', 'Projects', 'Resources', 'Archive']
  });
  
  logger.addTestStep('Basic Position Accuracy', 'Move Folder 0 to Position 2', 'running');
  
  // Simulate move operation
  await new Promise(resolve => setTimeout(resolve, 800));
  
  logger.addTestStep('Basic Position Accuracy', 'Move Folder 0 to Position 2', 'success', {
    executionTime: 800,
    fromPosition: 0,
    toPosition: 2,
    folderMoved: 'Work'
  });
  
  logger.addTestStep('Basic Position Accuracy', 'Verify Position Change', 'success', {
    expectedPosition: 2,
    actualPosition: 2,
    accuracy: 100,
    newOrder: ['Personal', 'Projects', 'Work', 'Resources', 'Archive']
  });
  
  logger.endTest('Basic Position Accuracy', true, null, {
    accuracy: 100,
    executionTime: 800,
    positionCorrect: true
  });

  // Simulate Test 3: Multiple Position Tests
  const multiTest = logger.startTest('Multiple Position Tests', 'Test accuracy across multiple positions');
  
  const positions = [0, 1, 2, 3, 4];
  let successfulMoves = 0;
  
  for (let i = 0; i < positions.length; i++) {
    const targetPos = positions[i];
    logger.addTestStep('Multiple Position Tests', `Move to Position ${targetPos}`, 'running');
    
    // Simulate move with varying success
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const success = Math.random() > 0.1; // 90% success rate
    if (success) {
      successfulMoves++;
      logger.addTestStep('Multiple Position Tests', `Move to Position ${targetPos}`, 'success', {
        targetPosition: targetPos,
        actualPosition: targetPos,
        executionTime: 250 + Math.random() * 200
      });
    } else {
      logger.addTestStep('Multiple Position Tests', `Move to Position ${targetPos}`, 'failed', {
        targetPosition: targetPos,
        actualPosition: targetPos - 1,
        error: 'Position calculation off by 1'
      });
    }
  }
  
  const accuracy = (successfulMoves / positions.length) * 100;
  const passed = accuracy >= 80;
  
  logger.endTest('Multiple Position Tests', passed, passed ? null : new Error(`Low accuracy: ${accuracy}%`), {
    accuracy,
    successfulMoves,
    totalPositions: positions.length,
    threshold: 80
  });

  // Simulate some console errors for demonstration
  logger.addConsoleError('TypeError: Cannot read property of undefined', 'dragdrop-enhanced.ts:245');
  logger.addConsoleError('Warning: React Hook useEffect has missing dependency', 'App.svelte:156');

  // Simulate network requests
  logger.addNetworkRequest('chrome-extension://demo-id-123/newtab.html', 'GET', 200, 45);
  logger.addNetworkRequest('https://api.example.com/bookmarks', 'GET', 200, 120);

  // Simulate screenshot
  logger.addScreenshot('./test-results/screenshots/position-test-1.png', 'Folder position after move operation');

  // Finalize logging
  logger.finalize();
  
  // Save log files
  const logFiles = logger.saveLogFiles();
  
  console.log('\n📊 Test Logging Demo Results:');
  console.log('=============================');
  console.log(`Status: ${logger.results.summary.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Tests: ${logger.results.summary.passed}/${logger.results.summary.total} passed`);
  console.log(`Duration: ${logger.results.duration}ms`);
  console.log(`Average Test Time: ${Math.round(logger.results.performance.averageTestTime)}ms`);
  
  console.log('\n📄 Log Files Created:');
  console.log(`   Results: ${logFiles.resultsFile}`);
  console.log(`   Raw Logs: ${logFiles.logsFile}`);
  console.log(`   Summary: ${logFiles.summaryFile}`);
  console.log(`   Debug Info: ${logFiles.debugFile}`);
  console.log(`   Latest: ${logFiles.latestFile}`);

  // Show sample of the structured data
  console.log('\n📋 Sample Structured Results:');
  console.log(JSON.stringify({
    testSuite: logger.results.testSuite,
    summary: logger.results.summary,
    performance: logger.results.performance,
    sampleTest: logger.results.tests[0]
  }, null, 2));

  return logger.results;
}

// Run the demo
demonstrateLogging()
  .then(results => {
    console.log('\n🎉 Logging demonstration completed!');
    console.log('This shows how comprehensive logs are generated for the development feedback loop.');
    
    // Show how to read the logs back
    console.log('\n🔍 Reading Latest Results:');
    const latestResults = TestLogger.getLatestResults('position-accuracy-demo');
    if (latestResults) {
      console.log(`   Test Suite: ${latestResults.testSuite}`);
      console.log(`   Success: ${latestResults.summary.success}`);
      console.log(`   Tests: ${latestResults.summary.passed}/${latestResults.summary.total}`);
      console.log(`   Errors: ${latestResults.errors.length}`);
      console.log(`   Console Errors: ${latestResults.debugging.consoleErrors.length}`);
    }
    
    process.exit(results.summary.success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Demo failed:', error);
    process.exit(1);
  });
