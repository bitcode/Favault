#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Automated test runner for FaVault extension
 * Provides structured, concise results without verbose logging
 */

class TestRunner {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
        success: false
      },
      testSuites: [],
      errors: [],
      performance: {
        averageTestTime: 0,
        slowestTest: null,
        fastestTest: null
      }
    };
  }

  async runTests() {
    console.log('🚀 Starting automated FaVault extension tests...');
    
    try {
      // Ensure extension is built
      this.buildExtension();
      
      // Run test suites
      await this.runTestSuite('Position Accuracy', 'test:position');
      await this.runTestSuite('UI Refresh', 'test:ui-refresh');
      await this.runTestSuite('Drop Zone', 'test:drop-zone');
      await this.runTestSuite('Cross-Browser', 'test:cross-browser-new');
      
      // Calculate final results
      this.calculateSummary();
      
      // Generate report
      this.generateReport();
      
      return this.results;
      
    } catch (error) {
      this.results.errors.push({
        type: 'runner_error',
        message: error.message,
        stack: error.stack
      });
      
      console.error('❌ Test runner failed:', error.message);
      return this.results;
    }
  }

  buildExtension() {
    console.log('🔨 Building extension...');
    
    try {
      execSync('npm run build:chrome', { 
        stdio: 'pipe',
        timeout: 60000 
      });
      console.log('✅ Extension built successfully');
    } catch (error) {
      throw new Error(`Extension build failed: ${error.message}`);
    }
  }

  async runTestSuite(name, script) {
    console.log(`🧪 Running ${name} tests...`);
    
    const startTime = Date.now();
    const suite = {
      name,
      script,
      status: 'running',
      duration: 0,
      tests: [],
      passed: 0,
      failed: 0,
      errors: []
    };

    try {
      const output = execSync(`npm run ${script}`, { 
        stdio: 'pipe',
        timeout: 120000,
        encoding: 'utf8'
      });
      
      suite.duration = Date.now() - startTime;
      suite.status = 'completed';
      
      // Parse test results from output
      this.parseTestOutput(suite, output);
      
      console.log(`✅ ${name}: ${suite.passed}/${suite.tests.length} passed (${suite.duration}ms)`);
      
    } catch (error) {
      suite.duration = Date.now() - startTime;
      suite.status = 'failed';
      suite.errors.push({
        message: error.message,
        stdout: error.stdout?.toString() || '',
        stderr: error.stderr?.toString() || ''
      });
      
      console.log(`❌ ${name}: Failed (${suite.duration}ms)`);
    }
    
    this.results.testSuites.push(suite);
  }

  parseTestOutput(suite, output) {
    // Extract test results from Playwright output
    const lines = output.split('\n');
    
    for (const line of lines) {
      // Look for test result patterns
      if (line.includes('✓') || line.includes('passed')) {
        suite.passed++;
        suite.tests.push({
          name: this.extractTestName(line),
          status: 'passed',
          duration: this.extractDuration(line)
        });
      } else if (line.includes('✗') || line.includes('failed')) {
        suite.failed++;
        suite.tests.push({
          name: this.extractTestName(line),
          status: 'failed',
          duration: this.extractDuration(line),
          error: this.extractError(line)
        });
      }
    }
    
    // If no specific tests found, check overall status
    if (suite.tests.length === 0) {
      if (output.includes('All tests passed') || !output.includes('failed')) {
        suite.passed = 1;
        suite.tests.push({
          name: suite.name,
          status: 'passed',
          duration: suite.duration
        });
      } else {
        suite.failed = 1;
        suite.tests.push({
          name: suite.name,
          status: 'failed',
          duration: suite.duration,
          error: 'Test suite failed'
        });
      }
    }
  }

  extractTestName(line) {
    // Extract test name from Playwright output line
    const match = line.match(/(?:✓|✗)\s+(.+?)(?:\s+\(\d+ms\))?$/);
    return match ? match[1].trim() : 'Unknown test';
  }

  extractDuration(line) {
    // Extract duration from Playwright output line
    const match = line.match(/\((\d+)ms\)/);
    return match ? parseInt(match[1]) : 0;
  }

  extractError(line) {
    // Extract error message from failed test line
    return line.includes('Error:') ? line.split('Error:')[1]?.trim() : 'Test failed';
  }

  calculateSummary() {
    this.results.summary.totalTests = this.results.testSuites.reduce((sum, suite) => sum + suite.tests.length, 0);
    this.results.summary.passed = this.results.testSuites.reduce((sum, suite) => sum + suite.passed, 0);
    this.results.summary.failed = this.results.testSuites.reduce((sum, suite) => sum + suite.failed, 0);
    this.results.summary.duration = this.results.testSuites.reduce((sum, suite) => sum + suite.duration, 0);
    this.results.summary.success = this.results.summary.failed === 0;

    // Calculate performance metrics
    const allTests = this.results.testSuites.flatMap(suite => suite.tests);
    if (allTests.length > 0) {
      const durations = allTests.map(test => test.duration).filter(d => d > 0);
      
      if (durations.length > 0) {
        this.results.performance.averageTestTime = durations.reduce((a, b) => a + b, 0) / durations.length;
        this.results.performance.slowestTest = Math.max(...durations);
        this.results.performance.fastestTest = Math.min(...durations);
      }
    }
  }

  generateReport() {
    // Create test results directory
    const resultsDir = './test-results';
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    // Write detailed results
    fs.writeFileSync(
      path.join(resultsDir, 'automated-test-results.json'),
      JSON.stringify(this.results, null, 2)
    );

    // Write summary
    const summary = {
      timestamp: this.results.timestamp,
      success: this.results.summary.success,
      totalTests: this.results.summary.totalTests,
      passed: this.results.summary.passed,
      failed: this.results.summary.failed,
      duration: this.results.summary.duration,
      averageTestTime: Math.round(this.results.performance.averageTestTime),
      testSuites: this.results.testSuites.map(suite => ({
        name: suite.name,
        status: suite.status,
        passed: suite.passed,
        failed: suite.failed,
        duration: suite.duration
      }))
    };

    fs.writeFileSync(
      path.join(resultsDir, 'test-summary.json'),
      JSON.stringify(summary, null, 2)
    );

    // Console output
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    console.log(`Status: ${this.results.summary.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Tests: ${this.results.summary.passed}/${this.results.summary.totalTests} passed`);
    console.log(`Duration: ${this.results.summary.duration}ms`);
    console.log(`Average: ${Math.round(this.results.performance.averageTestTime)}ms per test`);
    
    if (this.results.summary.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.testSuites.forEach(suite => {
        if (suite.failed > 0) {
          console.log(`  - ${suite.name}: ${suite.failed} failed`);
        }
      });
    }
    
    console.log(`\n📄 Detailed results: ${path.resolve(resultsDir, 'automated-test-results.json')}`);
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new TestRunner();
  
  runner.runTests()
    .then(results => {
      process.exit(results.summary.success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test runner crashed:', error);
      process.exit(1);
    });
}

export default TestRunner;
