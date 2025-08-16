#!/usr/bin/env node

/**
 * Comprehensive test runner with detailed logging for development feedback loop
 * Creates log files for: position, ui-refresh, and drop-zone tests
 */

import { chromium } from '@playwright/test';
import { TestLogger } from './test-logger.js';
import { ExtensionHelper } from './tests/extension-helper.js';
import fs from 'fs';
import path from 'path';

class LoggedTestRunner {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      testSuites: [],
      overallSummary: {
        totalSuites: 0,
        passedSuites: 0,
        failedSuites: 0,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        success: false
      }
    };
  }

  async runAllTests() {
    console.log('🚀 Starting Comprehensive Logged Test Suite');
    console.log('============================================');

    try {
      // Ensure extension is built
      await this.ensureExtensionBuilt();

      // Run each test suite with comprehensive logging
      await this.runPositionAccuracyTests();
      await this.runUIRefreshTests();
      await this.runDropZoneTests();

      // Generate overall summary
      this.generateOverallSummary();
      this.saveOverallResults();

      return this.results;

    } catch (error) {
      console.error('❌ Test runner failed:', error.message);
      this.results.error = error.message;
      return this.results;
    }
  }

  async ensureExtensionBuilt() {
    const extensionPath = path.resolve('./dist/chrome');
    if (!fs.existsSync(extensionPath)) {
      throw new Error('Extension not built. Run "npm run build:chrome" first.');
    }
    console.log('✅ Extension build verified');
  }

  async runPositionAccuracyTests() {
    const logger = new TestLogger('position-accuracy');
    logger.log('INFO', 'Starting position accuracy test suite');

    let browser = null;
    const suiteResult = {
      name: 'Position Accuracy',
      startTime: Date.now(),
      endTime: null,
      duration: 0,
      passed: false,
      tests: [],
      logFiles: null
    };

    try {
      // Launch browser
      logger.log('INFO', 'Launching browser for position accuracy tests');
      browser = await chromium.launch({
        headless: false,
        args: [
          '--disable-extensions-except=./dist/chrome',
          '--load-extension=./dist/chrome',
          '--no-sandbox'
        ]
      });

      const context = await browser.newContext();
      const page = await context.newPage();
      const helper = new ExtensionHelper(page, context);

      // Setup extension
      const setupTest = logger.startTest('Extension Setup', 'Load and initialize extension');
      try {
        await helper.navigateToExtension();
        await helper.waitForExtensionReady();
        await helper.enableEditMode();
        logger.endTest('Extension Setup', true, null, { extensionLoaded: true });
      } catch (error) {
        logger.endTest('Extension Setup', false, error);
        throw error;
      }

      // Test 1: Basic Position Accuracy
      const basicTest = logger.startTest('Basic Position Accuracy', 'Test moving folder to different positions');
      try {
        const initialOrder = await helper.getFolderOrder();
        logger.addTestStep('Basic Position Accuracy', 'Get Initial Order', 'success', { folderCount: initialOrder.length });

        if (initialOrder.length < 2) {
          throw new Error('Need at least 2 folders for position testing');
        }

        // Test moving first folder to position 1
        logger.addTestStep('Basic Position Accuracy', 'Move Folder 0 to Position 1', 'running');
        const moveResult = await helper.moveFolderToPosition(0, 1);
        
        if (!moveResult.success) {
          throw new Error(`Move operation failed: ${moveResult.error}`);
        }

        logger.addTestStep('Basic Position Accuracy', 'Move Folder 0 to Position 1', 'success', moveResult);

        // Verify position change
        const newOrder = await helper.getFolderOrder();
        const orderChanged = JSON.stringify(initialOrder) !== JSON.stringify(newOrder);
        
        logger.addTestStep('Basic Position Accuracy', 'Verify Position Change', orderChanged ? 'success' : 'failed', {
          initialOrder: initialOrder.slice(0, 3),
          newOrder: newOrder.slice(0, 3),
          orderChanged
        });

        logger.endTest('Basic Position Accuracy', orderChanged, orderChanged ? null : new Error('Position did not change'), {
          accuracy: orderChanged ? 100 : 0,
          executionTime: moveResult.executionTime
        });

        suiteResult.tests.push({
          name: 'Basic Position Accuracy',
          passed: orderChanged,
          duration: moveResult.executionTime,
          accuracy: orderChanged ? 100 : 0
        });

      } catch (error) {
        logger.endTest('Basic Position Accuracy', false, error);
        suiteResult.tests.push({
          name: 'Basic Position Accuracy',
          passed: false,
          error: error.message
        });
      }

      // Test 2: Multiple Position Tests
      const multiTest = logger.startTest('Multiple Position Tests', 'Test accuracy across multiple positions');
      try {
        const folders = await helper.getFolderOrder();
        let successfulMoves = 0;
        const totalPositions = Math.min(folders.length + 1, 4); // Limit to 4 positions for speed

        for (let targetPos = 0; targetPos < totalPositions; targetPos++) {
          logger.addTestStep('Multiple Position Tests', `Move to Position ${targetPos}`, 'running');
          
          const moveResult = await helper.moveFolderToPosition(0, targetPos);
          if (moveResult.success) {
            const newOrder = await helper.getFolderOrder();
            const actualPos = newOrder.indexOf(folders[0]);
            
            if (actualPos === targetPos) {
              successfulMoves++;
              logger.addTestStep('Multiple Position Tests', `Move to Position ${targetPos}`, 'success', { actualPos });
            } else {
              logger.addTestStep('Multiple Position Tests', `Move to Position ${targetPos}`, 'failed', { 
                expectedPos: targetPos, 
                actualPos 
              });
            }
          } else {
            logger.addTestStep('Multiple Position Tests', `Move to Position ${targetPos}`, 'failed', { 
              error: moveResult.error 
            });
          }

          // Reset position for next test
          if (targetPos < totalPositions - 1) {
            await helper.moveFolderToPosition(targetPos, 0);
          }
        }

        const accuracy = (successfulMoves / totalPositions) * 100;
        const passed = accuracy >= 80; // 80% threshold

        logger.endTest('Multiple Position Tests', passed, passed ? null : new Error(`Low accuracy: ${accuracy}%`), {
          accuracy,
          successfulMoves,
          totalPositions
        });

        suiteResult.tests.push({
          name: 'Multiple Position Tests',
          passed,
          accuracy,
          successfulMoves,
          totalPositions
        });

      } catch (error) {
        logger.endTest('Multiple Position Tests', false, error);
        suiteResult.tests.push({
          name: 'Multiple Position Tests',
          passed: false,
          error: error.message
        });
      }

      suiteResult.passed = suiteResult.tests.every(t => t.passed);

    } catch (error) {
      logger.addError(error, 'Position Accuracy Test Suite');
      suiteResult.passed = false;
      suiteResult.error = error.message;
    } finally {
      if (browser) {
        await browser.close();
      }
      
      logger.finalize();
      suiteResult.logFiles = logger.saveLogFiles();
      suiteResult.endTime = Date.now();
      suiteResult.duration = suiteResult.endTime - suiteResult.startTime;
      
      this.results.testSuites.push(suiteResult);
      
      console.log(`📊 Position Accuracy Tests: ${suiteResult.passed ? '✅ PASSED' : '❌ FAILED'} (${suiteResult.duration}ms)`);
      console.log(`📄 Logs: ${suiteResult.logFiles.latestFile}`);
    }
  }

  async runUIRefreshTests() {
    const logger = new TestLogger('ui-refresh');
    logger.log('INFO', 'Starting UI refresh test suite');

    let browser = null;
    const suiteResult = {
      name: 'UI Refresh',
      startTime: Date.now(),
      endTime: null,
      duration: 0,
      passed: false,
      tests: [],
      logFiles: null
    };

    try {
      // Launch browser
      browser = await chromium.launch({
        headless: false,
        args: [
          '--disable-extensions-except=./dist/chrome',
          '--load-extension=./dist/chrome',
          '--no-sandbox'
        ]
      });

      const context = await browser.newContext();
      const page = await context.newPage();
      const helper = new ExtensionHelper(page, context);

      // Setup
      await helper.navigateToExtension();
      await helper.waitForExtensionReady();
      await helper.enableEditMode();

      // Test UI Refresh Speed
      const refreshTest = logger.startTest('UI Refresh Speed', 'Test how quickly UI updates after folder moves');
      try {
        const initialOrder = await helper.getFolderOrder();
        
        if (initialOrder.length < 2) {
          throw new Error('Need at least 2 folders for UI refresh testing');
        }

        const startTime = Date.now();
        const moveResult = await helper.moveFolderToPosition(0, 1);
        
        if (!moveResult.success) {
          throw new Error(`Move failed: ${moveResult.error}`);
        }

        // Check UI update timing
        let uiUpdated = false;
        let checkCount = 0;
        const maxChecks = 10;
        
        while (!uiUpdated && checkCount < maxChecks) {
          await page.waitForTimeout(200);
          const currentOrder = await helper.getFolderOrder();
          uiUpdated = JSON.stringify(initialOrder) !== JSON.stringify(currentOrder);
          checkCount++;
        }

        const refreshTime = Date.now() - startTime;
        
        logger.endTest('UI Refresh Speed', uiUpdated, uiUpdated ? null : new Error('UI did not update'), {
          refreshTime,
          checksRequired: checkCount,
          uiUpdated
        });

        suiteResult.tests.push({
          name: 'UI Refresh Speed',
          passed: uiUpdated,
          refreshTime,
          checksRequired: checkCount
        });

      } catch (error) {
        logger.endTest('UI Refresh Speed', false, error);
        suiteResult.tests.push({
          name: 'UI Refresh Speed',
          passed: false,
          error: error.message
        });
      }

      suiteResult.passed = suiteResult.tests.every(t => t.passed);

    } catch (error) {
      logger.addError(error, 'UI Refresh Test Suite');
      suiteResult.passed = false;
      suiteResult.error = error.message;
    } finally {
      if (browser) {
        await browser.close();
      }
      
      logger.finalize();
      suiteResult.logFiles = logger.saveLogFiles();
      suiteResult.endTime = Date.now();
      suiteResult.duration = suiteResult.endTime - suiteResult.startTime;
      
      this.results.testSuites.push(suiteResult);
      
      console.log(`📊 UI Refresh Tests: ${suiteResult.passed ? '✅ PASSED' : '❌ FAILED'} (${suiteResult.duration}ms)`);
      console.log(`📄 Logs: ${suiteResult.logFiles.latestFile}`);
    }
  }

  async runDropZoneTests() {
    const logger = new TestLogger('drop-zone');
    logger.log('INFO', 'Starting drop zone test suite');

    let browser = null;
    const suiteResult = {
      name: 'Drop Zone',
      startTime: Date.now(),
      endTime: null,
      duration: 0,
      passed: false,
      tests: [],
      logFiles: null
    };

    try {
      // Launch browser
      browser = await chromium.launch({
        headless: false,
        args: [
          '--disable-extensions-except=./dist/chrome',
          '--load-extension=./dist/chrome',
          '--no-sandbox'
        ]
      });

      const context = await browser.newContext();
      const page = await context.newPage();
      const helper = new ExtensionHelper(page, context);

      // Setup
      await helper.navigateToExtension();
      await helper.waitForExtensionReady();
      await helper.enableEditMode();

      // Test Insertion Point Count
      const countTest = logger.startTest('Insertion Point Count', 'Verify correct number of insertion points');
      try {
        const folderCount = (await helper.getFolderOrder()).length;
        const insertionPointCount = await helper.getInsertionPointCount();
        const expectedCount = folderCount + 1;
        const correctCount = insertionPointCount === expectedCount;

        logger.endTest('Insertion Point Count', correctCount, correctCount ? null : new Error(`Expected ${expectedCount}, got ${insertionPointCount}`), {
          folderCount,
          insertionPointCount,
          expectedCount,
          correctCount
        });

        suiteResult.tests.push({
          name: 'Insertion Point Count',
          passed: correctCount,
          folderCount,
          insertionPointCount,
          expectedCount
        });

      } catch (error) {
        logger.endTest('Insertion Point Count', false, error);
        suiteResult.tests.push({
          name: 'Insertion Point Count',
          passed: false,
          error: error.message
        });
      }

      suiteResult.passed = suiteResult.tests.every(t => t.passed);

    } catch (error) {
      logger.addError(error, 'Drop Zone Test Suite');
      suiteResult.passed = false;
      suiteResult.error = error.message;
    } finally {
      if (browser) {
        await browser.close();
      }
      
      logger.finalize();
      suiteResult.logFiles = logger.saveLogFiles();
      suiteResult.endTime = Date.now();
      suiteResult.duration = suiteResult.endTime - suiteResult.startTime;
      
      this.results.testSuites.push(suiteResult);
      
      console.log(`📊 Drop Zone Tests: ${suiteResult.passed ? '✅ PASSED' : '❌ FAILED'} (${suiteResult.duration}ms)`);
      console.log(`📄 Logs: ${suiteResult.logFiles.latestFile}`);
    }
  }

  generateOverallSummary() {
    this.results.overallSummary.totalSuites = this.results.testSuites.length;
    this.results.overallSummary.passedSuites = this.results.testSuites.filter(s => s.passed).length;
    this.results.overallSummary.failedSuites = this.results.overallSummary.totalSuites - this.results.overallSummary.passedSuites;
    
    this.results.overallSummary.totalTests = this.results.testSuites.reduce((sum, suite) => sum + suite.tests.length, 0);
    this.results.overallSummary.passedTests = this.results.testSuites.reduce((sum, suite) => sum + suite.tests.filter(t => t.passed).length, 0);
    this.results.overallSummary.failedTests = this.results.overallSummary.totalTests - this.results.overallSummary.passedTests;
    
    this.results.overallSummary.success = this.results.overallSummary.failedSuites === 0;
  }

  saveOverallResults() {
    const logsDir = path.join('./test-results', 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const overallFile = path.join(logsDir, `overall-results-${timestamp}.json`);
    const latestFile = path.join(logsDir, 'overall-latest.json');

    fs.writeFileSync(overallFile, JSON.stringify(this.results, null, 2));
    fs.writeFileSync(latestFile, JSON.stringify(this.results, null, 2));

    console.log('\n📊 Overall Test Results:');
    console.log('========================');
    console.log(`Status: ${this.results.overallSummary.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Test Suites: ${this.results.overallSummary.passedSuites}/${this.results.overallSummary.totalSuites} passed`);
    console.log(`Individual Tests: ${this.results.overallSummary.passedTests}/${this.results.overallSummary.totalTests} passed`);
    console.log(`📄 Overall results: ${latestFile}`);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new LoggedTestRunner();
  
  runner.runAllTests()
    .then(results => {
      process.exit(results.overallSummary.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test runner crashed:', error);
      process.exit(1);
    });
}

export default LoggedTestRunner;
