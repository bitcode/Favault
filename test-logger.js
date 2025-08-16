/**
 * Comprehensive test logger for FaVault extension
 * Creates detailed log files for development feedback loop
 */

import fs from 'fs';
import path from 'path';

export class TestLogger {
  constructor(testSuite) {
    this.testSuite = testSuite;
    this.startTime = Date.now();
    this.logs = [];
    this.results = {
      testSuite,
      timestamp: new Date().toISOString(),
      startTime: this.startTime,
      endTime: null,
      duration: 0,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cwd: process.cwd()
      },
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        success: false
      },
      tests: [],
      errors: [],
      performance: {
        averageTestTime: 0,
        slowestTest: null,
        fastestTest: null,
        memoryUsage: null
      },
      debugging: {
        consoleErrors: [],
        networkRequests: [],
        screenshots: [],
        pageErrors: []
      }
    };
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data,
      elapsed: Date.now() - this.startTime
    };
    
    this.logs.push(logEntry);
    
    // Console output with color coding
    const colors = {
      INFO: '\x1b[36m',    // Cyan
      SUCCESS: '\x1b[32m', // Green
      ERROR: '\x1b[31m',   // Red
      WARN: '\x1b[33m',    // Yellow
      DEBUG: '\x1b[90m',   // Gray
      RESET: '\x1b[0m'
    };
    
    const color = colors[level] || colors.INFO;
    console.log(`${color}[${level}] ${message}${colors.RESET}${data ? ` | ${JSON.stringify(data)}` : ''}`);
  }

  startTest(testName, description = '') {
    const test = {
      name: testName,
      description,
      startTime: Date.now(),
      endTime: null,
      duration: 0,
      status: 'running',
      passed: false,
      error: null,
      steps: [],
      metadata: {},
      performance: {
        memoryBefore: process.memoryUsage(),
        memoryAfter: null,
        memoryDelta: null
      }
    };
    
    this.results.tests.push(test);
    this.log('INFO', `Starting test: ${testName}`, { description });
    
    return test;
  }

  addTestStep(testName, stepName, status, data = null) {
    const test = this.results.tests.find(t => t.name === testName);
    if (test) {
      const step = {
        name: stepName,
        timestamp: Date.now(),
        status,
        data,
        elapsed: Date.now() - test.startTime
      };
      test.steps.push(step);
      
      this.log('DEBUG', `Test step: ${testName} → ${stepName}`, { status, data });
    }
  }

  endTest(testName, passed, error = null, metadata = {}) {
    const test = this.results.tests.find(t => t.name === testName);
    if (test) {
      test.endTime = Date.now();
      test.duration = test.endTime - test.startTime;
      test.status = passed ? 'passed' : 'failed';
      test.passed = passed;
      test.error = error;
      test.metadata = metadata;
      test.performance.memoryAfter = process.memoryUsage();
      test.performance.memoryDelta = {
        rss: test.performance.memoryAfter.rss - test.performance.memoryBefore.rss,
        heapUsed: test.performance.memoryAfter.heapUsed - test.performance.memoryBefore.heapUsed
      };
      
      const level = passed ? 'SUCCESS' : 'ERROR';
      this.log(level, `Test completed: ${testName}`, { 
        duration: test.duration, 
        passed, 
        error: error?.message 
      });
    }
  }

  addError(error, context = '') {
    const errorEntry = {
      timestamp: Date.now(),
      message: error.message,
      stack: error.stack,
      context,
      type: error.constructor.name
    };
    
    this.results.errors.push(errorEntry);
    this.log('ERROR', `Error: ${error.message}`, { context, type: error.constructor.name });
  }

  addConsoleError(message, location = null) {
    this.results.debugging.consoleErrors.push({
      timestamp: Date.now(),
      message,
      location
    });
    this.log('WARN', `Console error: ${message}`, { location });
  }

  addNetworkRequest(url, method, status, duration) {
    this.results.debugging.networkRequests.push({
      timestamp: Date.now(),
      url,
      method,
      status,
      duration
    });
    this.log('DEBUG', `Network: ${method} ${url}`, { status, duration });
  }

  addScreenshot(path, description) {
    this.results.debugging.screenshots.push({
      timestamp: Date.now(),
      path,
      description
    });
    this.log('DEBUG', `Screenshot: ${description}`, { path });
  }

  finalize() {
    this.endTime = Date.now();
    this.results.endTime = this.endTime;
    this.results.duration = this.endTime - this.startTime;
    
    // Calculate summary
    this.results.summary.total = this.results.tests.length;
    this.results.summary.passed = this.results.tests.filter(t => t.passed).length;
    this.results.summary.failed = this.results.tests.filter(t => !t.passed).length;
    this.results.summary.success = this.results.summary.failed === 0;
    
    // Calculate performance metrics
    const testDurations = this.results.tests.map(t => t.duration).filter(d => d > 0);
    if (testDurations.length > 0) {
      this.results.performance.averageTestTime = testDurations.reduce((a, b) => a + b, 0) / testDurations.length;
      this.results.performance.slowestTest = Math.max(...testDurations);
      this.results.performance.fastestTest = Math.min(...testDurations);
    }
    
    this.results.performance.memoryUsage = process.memoryUsage();
    
    this.log('INFO', `Test suite completed: ${this.testSuite}`, {
      duration: this.results.duration,
      passed: this.results.summary.passed,
      failed: this.results.summary.failed,
      success: this.results.summary.success
    });
  }

  saveLogFiles() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logsDir = path.join('./test-results', 'logs');
    
    // Ensure logs directory exists
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    const baseFilename = `${this.testSuite}-${timestamp}`;
    
    // Save detailed results
    const resultsFile = path.join(logsDir, `${baseFilename}-results.json`);
    fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
    
    // Save raw logs
    const logsFile = path.join(logsDir, `${baseFilename}-logs.json`);
    fs.writeFileSync(logsFile, JSON.stringify(this.logs, null, 2));
    
    // Save human-readable summary
    const summaryFile = path.join(logsDir, `${baseFilename}-summary.txt`);
    const summary = this.generateSummaryText();
    fs.writeFileSync(summaryFile, summary);
    
    // Save debugging info
    const debugFile = path.join(logsDir, `${baseFilename}-debug.json`);
    fs.writeFileSync(debugFile, JSON.stringify(this.results.debugging, null, 2));
    
    // Save latest results (for automated feedback)
    const latestFile = path.join(logsDir, `${this.testSuite}-latest.json`);
    fs.writeFileSync(latestFile, JSON.stringify(this.results, null, 2));
    
    this.log('INFO', 'Log files saved', {
      resultsFile,
      logsFile,
      summaryFile,
      debugFile,
      latestFile
    });
    
    return {
      resultsFile,
      logsFile,
      summaryFile,
      debugFile,
      latestFile
    };
  }

  generateSummaryText() {
    const { results } = this;
    
    return `
FaVault Extension Test Results
==============================

Test Suite: ${results.testSuite}
Timestamp: ${results.timestamp}
Duration: ${results.duration}ms
Status: ${results.summary.success ? 'PASSED' : 'FAILED'}

Summary:
--------
Total Tests: ${results.summary.total}
Passed: ${results.summary.passed}
Failed: ${results.summary.failed}
Success Rate: ${((results.summary.passed / results.summary.total) * 100).toFixed(1)}%

Performance:
-----------
Average Test Time: ${Math.round(results.performance.averageTestTime)}ms
Slowest Test: ${results.performance.slowestTest}ms
Fastest Test: ${results.performance.fastestTest}ms
Memory Usage: ${Math.round(results.performance.memoryUsage.heapUsed / 1024 / 1024)}MB

Test Details:
------------
${results.tests.map(test => `
${test.passed ? '✅' : '❌'} ${test.name} (${test.duration}ms)
   ${test.description}
   Steps: ${test.steps.length}
   ${test.error ? `Error: ${test.error.message}` : ''}
   ${test.steps.map(step => `   - ${step.name}: ${step.status}`).join('\n')}
`).join('\n')}

${results.errors.length > 0 ? `
Errors:
-------
${results.errors.map(error => `
- ${error.message}
  Context: ${error.context}
  Type: ${error.type}
`).join('\n')}
` : ''}

${results.debugging.consoleErrors.length > 0 ? `
Console Errors:
--------------
${results.debugging.consoleErrors.map(error => `- ${error.message}`).join('\n')}
` : ''}

Environment:
-----------
Node Version: ${results.environment.nodeVersion}
Platform: ${results.environment.platform}
Architecture: ${results.environment.arch}
Working Directory: ${results.environment.cwd}

Generated: ${new Date().toISOString()}
`.trim();
  }

  // Static method to read latest test results for feedback loop
  static getLatestResults(testSuite) {
    const latestFile = path.join('./test-results', 'logs', `${testSuite}-latest.json`);
    
    if (fs.existsSync(latestFile)) {
      try {
        const content = fs.readFileSync(latestFile, 'utf8');
        return JSON.parse(content);
      } catch (error) {
        console.error(`Error reading latest results for ${testSuite}:`, error.message);
        return null;
      }
    }
    
    return null;
  }
}

export default TestLogger;
