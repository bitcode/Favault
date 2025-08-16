#!/usr/bin/env node

/**
 * Demo script to show automated testing capabilities
 * Returns structured results without verbose logging
 */

import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

class FaVaultTestDemo {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      browser: 'chromium',
      tests: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        duration: 0,
        success: false
      },
      errors: []
    };
  }

  async runDemo() {
    console.log('🚀 FaVault Automated Test Demo');
    console.log('==============================');
    
    const startTime = Date.now();
    
    try {
      // Check if extension is built
      const extensionPath = path.resolve('./dist/chrome');
      if (!fs.existsSync(extensionPath)) {
        throw new Error('Extension not built. Run "npm run build:chrome" first.');
      }

      // Launch browser with extension
      const browser = await chromium.launch({
        headless: false,
        args: [
          `--disable-extensions-except=${extensionPath}`,
          `--load-extension=${extensionPath}`,
          '--no-sandbox'
        ]
      });

      const context = await browser.newContext();
      const page = await context.newPage();

      // Test 1: Extension Loading
      await this.testExtensionLoading(page);

      // Test 2: Basic Functionality
      await this.testBasicFunctionality(page);

      // Test 3: Folder Reordering
      await this.testFolderReordering(page);

      await browser.close();

      this.results.summary.duration = Date.now() - startTime;
      this.calculateSummary();

      return this.results;

    } catch (error) {
      this.results.errors.push({
        type: 'demo_error',
        message: error.message
      });
      
      this.results.summary.duration = Date.now() - startTime;
      this.calculateSummary();
      
      return this.results;
    }
  }

  async testExtensionLoading(page) {
    const test = {
      name: 'Extension Loading',
      status: 'running',
      startTime: Date.now(),
      duration: 0,
      passed: false,
      error: null
    };

    try {
      // Get extension ID
      const extensionId = await this.getExtensionId(page);
      
      if (!extensionId) {
        throw new Error('Extension ID not found');
      }

      // Navigate to extension
      const extensionUrl = `chrome-extension://${extensionId}/newtab.html`;
      await page.goto(extensionUrl, { timeout: 10000 });
      
      // Wait for page to load
      await page.waitForLoadState('networkidle');
      
      // Check if enhanced drag-drop manager is available
      const hasEnhancedDragDrop = await page.evaluate(() => {
        return typeof window.EnhancedDragDropManager !== 'undefined';
      });

      if (!hasEnhancedDragDrop) {
        throw new Error('EnhancedDragDropManager not found');
      }

      test.passed = true;
      test.status = 'passed';

    } catch (error) {
      test.passed = false;
      test.status = 'failed';
      test.error = error.message;
    }

    test.duration = Date.now() - test.startTime;
    this.results.tests.push(test);
  }

  async testBasicFunctionality(page) {
    const test = {
      name: 'Basic Functionality',
      status: 'running',
      startTime: Date.now(),
      duration: 0,
      passed: false,
      error: null
    };

    try {
      // Wait for folders to load
      await page.waitForSelector('.folder-container', { timeout: 10000 });
      
      // Count folders
      const folderCount = await page.locator('.folder-container').count();
      
      if (folderCount === 0) {
        throw new Error('No folders found');
      }

      // Check for insertion points
      const insertionPointCount = await page.locator('.insertion-point').count();
      const expectedInsertionPoints = folderCount + 1;
      
      if (insertionPointCount !== expectedInsertionPoints) {
        throw new Error(`Expected ${expectedInsertionPoints} insertion points, found ${insertionPointCount}`);
      }

      test.passed = true;
      test.status = 'passed';
      test.metadata = {
        folderCount,
        insertionPointCount
      };

    } catch (error) {
      test.passed = false;
      test.status = 'failed';
      test.error = error.message;
    }

    test.duration = Date.now() - test.startTime;
    this.results.tests.push(test);
  }

  async testFolderReordering(page) {
    const test = {
      name: 'Folder Reordering',
      status: 'running',
      startTime: Date.now(),
      duration: 0,
      passed: false,
      error: null
    };

    try {
      // Enable edit mode
      const editToggle = await page.locator('[data-testid="edit-mode-toggle"], .edit-mode-toggle, button:has-text("Edit")').first();
      
      if (await editToggle.isVisible()) {
        await editToggle.click();
        await page.waitForTimeout(1000);
      }

      // Initialize enhanced drag-drop
      await page.evaluate(async () => {
        if (typeof window.EnhancedDragDropManager !== 'undefined') {
          const initResult = await window.EnhancedDragDropManager.initialize();
          if (initResult.success) {
            await window.EnhancedDragDropManager.enableEditMode();
          }
          return initResult;
        }
        return { success: false };
      });

      // Get initial folder order
      const initialOrder = await page.evaluate(() => {
        const folders = Array.from(document.querySelectorAll('.folder-container'));
        return folders.map(folder => {
          const title = folder.querySelector('.folder-title, h3, .folder-name')?.textContent;
          return title?.trim();
        }).filter(Boolean);
      });

      if (initialOrder.length < 2) {
        throw new Error('Need at least 2 folders for reordering test');
      }

      // Perform folder move
      const moveResult = await page.evaluate(async () => {
        if (typeof window.EnhancedDragDropManager !== 'undefined') {
          return await window.EnhancedDragDropManager.moveFolderToPosition(0, 1);
        }
        return { success: false, error: 'EnhancedDragDropManager not available' };
      });

      if (!moveResult.success) {
        throw new Error(`Move operation failed: ${moveResult.error}`);
      }

      // Wait for UI update
      await page.waitForTimeout(2000);

      // Check if order changed
      const newOrder = await page.evaluate(() => {
        const folders = Array.from(document.querySelectorAll('.folder-container'));
        return folders.map(folder => {
          const title = folder.querySelector('.folder-title, h3, .folder-name')?.textContent;
          return title?.trim();
        }).filter(Boolean);
      });

      const orderChanged = JSON.stringify(initialOrder) !== JSON.stringify(newOrder);
      
      if (!orderChanged) {
        throw new Error('UI did not update after folder move');
      }

      test.passed = true;
      test.status = 'passed';
      test.metadata = {
        initialOrder: initialOrder.slice(0, 3),
        newOrder: newOrder.slice(0, 3),
        moveOperation: moveResult
      };

    } catch (error) {
      test.passed = false;
      test.status = 'failed';
      test.error = error.message;
    }

    test.duration = Date.now() - test.startTime;
    this.results.tests.push(test);
  }

  async getExtensionId(page) {
    try {
      // Try to get extension ID from chrome://extensions
      await page.goto('chrome://extensions/');
      await page.waitForTimeout(1000);
      
      const extensionCards = await page.$$('extensions-item');
      if (extensionCards.length > 0) {
        return await extensionCards[0].getAttribute('id');
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  calculateSummary() {
    this.results.summary.total = this.results.tests.length;
    this.results.summary.passed = this.results.tests.filter(t => t.passed).length;
    this.results.summary.failed = this.results.tests.filter(t => !t.passed).length;
    this.results.summary.success = this.results.summary.failed === 0 && this.results.errors.length === 0;
  }

  printResults() {
    console.log('\n📊 Test Results:');
    console.log('================');
    console.log(`Status: ${this.results.summary.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Tests: ${this.results.summary.passed}/${this.results.summary.total} passed`);
    console.log(`Duration: ${this.results.summary.duration}ms`);
    
    if (this.results.summary.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.tests.filter(t => !t.passed).forEach(test => {
        console.log(`  - ${test.name}: ${test.error}`);
      });
    }

    if (this.results.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.results.errors.forEach(error => {
        console.log(`  - ${error.type}: ${error.message}`);
      });
    }

    return this.results;
  }
}

// Run demo if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const demo = new FaVaultTestDemo();
  
  demo.runDemo()
    .then(results => {
      demo.printResults();
      
      // Write results to file
      const resultsDir = './test-results';
      if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
      }
      
      fs.writeFileSync(
        path.join(resultsDir, 'demo-results.json'),
        JSON.stringify(results, null, 2)
      );
      
      console.log(`\n📄 Results saved: ${path.resolve(resultsDir, 'demo-results.json')}`);
      
      process.exit(results.summary.success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Demo failed:', error);
      process.exit(1);
    });
}

export default FaVaultTestDemo;
