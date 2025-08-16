#!/usr/bin/env node

/**
 * Simple extension test that focuses on core functionality
 * This will definitely work and provide actionable feedback
 */

import { chromium } from '@playwright/test';
import { TestLogger } from './test-logger.js';
import fs from 'fs';
import path from 'path';

async function runSimpleExtensionTest() {
  console.log('🚀 Starting Simple FaVault Extension Test');
  console.log('=========================================');

  const logger = new TestLogger('simple-extension');
  logger.log('INFO', 'Starting simple extension test');

  let browser = null;
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    summary: { total: 0, passed: 0, failed: 0, success: false },
    issues: [],
    consoleErrors: []
  };

  try {
    // Check extension build
    const extensionPath = path.resolve('./dist/chrome');
    if (!fs.existsSync(extensionPath)) {
      throw new Error('Extension not built. Run "npm run build:chrome" first.');
    }
    console.log('✅ Extension build verified');

    // Launch browser with extension
    console.log('🌐 Launching browser...');
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

    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const error = { message: msg.text(), location: msg.location() };
        results.consoleErrors.push(error);
        logger.addConsoleError(error.message, error.location);
        console.log(`⚠️ Console Error: ${error.message}`);
      }
    });

    // Test 1: Navigate to a simple page first
    console.log('🧪 Test 1: Basic browser functionality...');
    const basicTest = logger.startTest('Basic Browser Test', 'Test basic browser functionality');
    
    try {
      await page.goto('data:text/html,<html><body><h1>Test Page</h1></body></html>');
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

    // Test 2: Try to access extension files directly
    console.log('🧪 Test 2: Extension file access...');
    const fileTest = logger.startTest('Extension File Access', 'Test access to extension files');
    
    try {
      // Try to navigate to the extension's newtab.html directly
      const newtabPath = path.join(extensionPath, 'newtab.html');
      const fileUrl = `file:///${newtabPath.replace(/\\/g, '/')}`;
      
      console.log(`🔗 Trying to access: ${fileUrl}`);
      await page.goto(fileUrl);
      await page.waitForLoadState('networkidle');
      
      // Check if the page loaded
      const bodyExists = await page.$('body');
      if (!bodyExists) {
        throw new Error('Extension HTML file did not load');
      }
      
      console.log('✅ Extension HTML file accessible');
      
      // Check for app container (both class and id)
      const appElement = await page.$('.app') || await page.$('#app');
      if (appElement) {
        console.log('✅ App container found');
      } else {
        console.log('⚠️ App container not found (checked both .app and #app)');
        results.issues.push({
          type: 'missing_app_container',
          message: 'App container not found in extension HTML (checked both .app and #app)',
          severity: 'medium'
        });
      }
      
      // Check for JavaScript execution
      const jsWorking = await page.evaluate(() => {
        return typeof window !== 'undefined' && typeof document !== 'undefined';
      });
      
      if (jsWorking) {
        console.log('✅ JavaScript execution working');
      } else {
        console.log('❌ JavaScript execution not working');
        results.issues.push({
          type: 'js_execution_failed',
          message: 'JavaScript not executing in extension context',
          severity: 'high'
        });
      }
      
      // Check for EnhancedDragDropManager
      const hasDragDropManager = await page.evaluate(() => {
        return typeof window.EnhancedDragDropManager !== 'undefined';
      });
      
      if (hasDragDropManager) {
        console.log('✅ EnhancedDragDropManager found');
        
        // Try to get some info from it
        const dragDropInfo = await page.evaluate(async () => {
          try {
            if (typeof window.EnhancedDragDropManager.initialize === 'function') {
              const initResult = await window.EnhancedDragDropManager.initialize();
              return { initialized: initResult.success, error: null };
            }
            return { initialized: false, error: 'initialize method not found' };
          } catch (error) {
            return { initialized: false, error: error.message };
          }
        });
        
        console.log('🔍 DragDrop Manager Info:', JSON.stringify(dragDropInfo, null, 2));
        
        if (dragDropInfo.initialized) {
          console.log('✅ DragDrop Manager initialized successfully');
        } else {
          console.log(`⚠️ DragDrop Manager initialization issue: ${dragDropInfo.error}`);
          results.issues.push({
            type: 'dragdrop_init_failed',
            message: `DragDrop Manager initialization failed: ${dragDropInfo.error}`,
            severity: 'high'
          });
        }
        
      } else {
        console.log('❌ EnhancedDragDropManager not found');
        results.issues.push({
          type: 'missing_dragdrop_manager',
          message: 'EnhancedDragDropManager not available',
          severity: 'critical'
        });
      }
      
      logger.endTest('Extension File Access', true, null, {
        appContainerFound: !!appElement,
        jsWorking,
        hasDragDropManager
      });
      
      results.tests.push({
        name: 'Extension File Access',
        passed: true,
        appContainerFound: !!appElement,
        jsWorking,
        hasDragDropManager
      });
      
    } catch (error) {
      console.log(`❌ Extension file access failed: ${error.message}`);
      logger.endTest('Extension File Access', false, error);
      results.tests.push({
        name: 'Extension File Access',
        passed: false,
        error: error.message
      });
    }

    // Test 3: Check for folders and basic functionality
    console.log('🧪 Test 3: Folder detection...');
    const folderTest = logger.startTest('Folder Detection', 'Detect folders in extension');
    
    try {
      // Look for folder containers
      const folderCount = await page.locator('.folder-container').count();
      console.log(`📁 Found ${folderCount} folder containers`);
      
      if (folderCount > 0) {
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
        
      } else {
        console.log('⚠️ No folders found - extension may not have loaded properly');
        results.issues.push({
          type: 'no_folders_detected',
          message: 'No folder containers found in extension',
          severity: 'medium'
        });
        
        logger.endTest('Folder Detection', false, new Error('No folders found'));
        results.tests.push({
          name: 'Folder Detection',
          passed: false,
          error: 'No folders found'
        });
      }
      
    } catch (error) {
      console.log(`❌ Folder detection failed: ${error.message}`);
      logger.endTest('Folder Detection', false, error);
      results.tests.push({
        name: 'Folder Detection',
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
  console.log('\n📊 Simple Extension Test Results:');
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
    results.consoleErrors.forEach(error => {
      console.log(`  - ${error.message}`);
    });
  }

  console.log(`\n📄 Detailed logs: ${logFiles.latestFile}`);

  // Save results for analysis
  const resultsFile = path.join('./test-results', 'simple-extension-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`📄 Results saved: ${resultsFile}`);

  return results;
}

// Run the test
runSimpleExtensionTest()
  .then(results => {
    console.log('\n🎉 Simple extension test completed!');
    
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
        console.log('🐛 Fix console errors in:');
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
