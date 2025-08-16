#!/usr/bin/env node

/**
 * FaVault Extension Test Runner
 * Comprehensive test automation script for local development and CI/CD
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Test configurations
const TEST_SUITES = {
  bookmarks: {
    name: 'Bookmark Management',
    file: 'tests/playwright/specs/bookmark-management.test.ts',
    description: 'Tests bookmark loading, folder organization, and search functionality'
  },
  dragdrop: {
    name: 'Drag & Drop Functionality',
    file: 'tests/playwright/specs/dragdrop-functionality.test.ts',
    description: 'Tests folder reordering, bookmark moving, and protected folder validation'
  },
  'ui-visual': {
    name: 'UI Components & Visual',
    file: 'tests/playwright/specs/ui-components-visual.test.ts',
    description: 'Tests Svelte components, visual regression, and responsive design'
  },
  console: {
    name: 'Console & Network',
    file: 'tests/playwright/specs/console-network-testing.test.ts',
    description: 'Tests console capture, network monitoring, and script injection'
  },
  'cross-browser': {
    name: 'Cross-Browser Compatibility',
    file: 'tests/playwright/specs/cross-browser-compatibility.test.ts',
    description: 'Tests Chrome, Firefox, Safari, and Edge compatibility'
  }
};

const BROWSERS = {
  chrome: 'chromium-extension',
  edge: 'edge-extension',
  firefox: 'firefox-extension'
};

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  suite: 'all',
  browser: 'chrome',
  headed: false,
  debug: false,
  ui: false,
  report: false,
  build: true,
  help: false
};

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  switch (arg) {
    case '--suite':
    case '-s':
      options.suite = args[++i];
      break;
    case '--browser':
    case '-b':
      options.browser = args[++i];
      break;
    case '--headed':
    case '-h':
      options.headed = true;
      break;
    case '--debug':
    case '-d':
      options.debug = true;
      break;
    case '--ui':
    case '-u':
      options.ui = true;
      break;
    case '--report':
    case '-r':
      options.report = true;
      break;
    case '--no-build':
      options.build = false;
      break;
    case '--help':
      options.help = true;
      break;
    default:
      if (arg.startsWith('--')) {
        console.warn(`Unknown option: ${arg}`);
      }
  }
}

// Show help
if (options.help) {
  console.log(`
🧪 FaVault Extension Test Runner

Usage: node scripts/run-tests.js [options]

Options:
  --suite, -s <suite>    Test suite to run (${Object.keys(TEST_SUITES).join(', ')}, all)
  --browser, -b <browser> Browser to test (${Object.keys(BROWSERS).join(', ')})
  --headed, -h           Run tests in headed mode (visible browser)
  --debug, -d            Run tests in debug mode
  --ui, -u               Run tests in UI mode
  --report, -r           Show test report after completion
  --no-build             Skip extension build step
  --help                 Show this help message

Examples:
  node scripts/run-tests.js --suite bookmarks --headed
  node scripts/run-tests.js --suite dragdrop --browser chrome --debug
  node scripts/run-tests.js --suite all --report
  node scripts/run-tests.js --ui

Test Suites:
${Object.entries(TEST_SUITES).map(([key, suite]) => 
  `  ${key.padEnd(12)} - ${suite.description}`
).join('\n')}
`);
  process.exit(0);
}

// Utility functions
function log(message, type = 'info') {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };
  console.log(`[${timestamp}] ${icons[type] || 'ℹ️'} ${message}`);
}

function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    log(`Running: ${command} ${args.join(' ')}`);
    
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      cwd: rootDir,
      ...options
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function buildExtension() {
  if (!options.build) {
    log('Skipping extension build (--no-build specified)');
    return;
  }

  log('Building extension for testing...', 'info');
  
  try {
    await runCommand('npm', ['run', 'build:chrome']);
    log('Extension built successfully', 'success');
  } catch (error) {
    log(`Extension build failed: ${error.message}`, 'error');
    throw error;
  }
}

async function installPlaywright() {
  log('Checking Playwright installation...', 'info');
  
  try {
    // Check if Playwright is installed
    await runCommand('npx', ['playwright', '--version']);
    log('Playwright is installed', 'success');
  } catch (error) {
    log('Installing Playwright browsers...', 'info');
    await runCommand('npx', ['playwright', 'install']);
    log('Playwright browsers installed', 'success');
  }
}

async function runTestSuite(suiteName, browser) {
  const suite = TEST_SUITES[suiteName];
  if (!suite) {
    throw new Error(`Unknown test suite: ${suiteName}`);
  }

  const browserProject = BROWSERS[browser];
  if (!browserProject) {
    throw new Error(`Unknown browser: ${browser}`);
  }

  log(`Running ${suite.name} tests on ${browser}...`, 'info');

  const playwrightArgs = ['playwright', 'test', suite.file];
  
  // Add browser project
  playwrightArgs.push('--project', browserProject);
  
  // Add options
  if (options.headed) playwrightArgs.push('--headed');
  if (options.debug) playwrightArgs.push('--debug');
  if (options.ui) playwrightArgs.push('--ui');

  try {
    await runCommand('npx', playwrightArgs);
    log(`${suite.name} tests completed successfully`, 'success');
  } catch (error) {
    log(`${suite.name} tests failed: ${error.message}`, 'error');
    throw error;
  }
}

async function runAllTests(browser) {
  log('Running all test suites...', 'info');
  
  const results = {};
  
  for (const [suiteName, suite] of Object.entries(TEST_SUITES)) {
    try {
      await runTestSuite(suiteName, browser);
      results[suiteName] = 'passed';
    } catch (error) {
      results[suiteName] = 'failed';
      log(`Test suite ${suiteName} failed, continuing with next suite...`, 'warning');
    }
  }
  
  // Summary
  log('Test Results Summary:', 'info');
  const passed = Object.values(results).filter(r => r === 'passed').length;
  const failed = Object.values(results).filter(r => r === 'failed').length;
  
  for (const [suite, result] of Object.entries(results)) {
    const icon = result === 'passed' ? '✅' : '❌';
    log(`  ${icon} ${suite}: ${result}`);
  }
  
  log(`Total: ${passed} passed, ${failed} failed`, passed === Object.keys(results).length ? 'success' : 'warning');
  
  if (failed > 0) {
    throw new Error(`${failed} test suite(s) failed`);
  }
}

async function showReport() {
  if (!options.report) return;
  
  log('Opening test report...', 'info');
  
  try {
    await runCommand('npx', ['playwright', 'show-report']);
  } catch (error) {
    log(`Failed to open report: ${error.message}`, 'warning');
  }
}

async function main() {
  try {
    log('🚀 Starting FaVault Extension Test Runner', 'info');
    log(`Configuration: suite=${options.suite}, browser=${options.browser}, headed=${options.headed}`, 'info');
    
    // Build extension
    await buildExtension();
    
    // Install Playwright if needed
    await installPlaywright();
    
    // Run tests
    if (options.suite === 'all') {
      await runAllTests(options.browser);
    } else {
      await runTestSuite(options.suite, options.browser);
    }
    
    // Show report
    await showReport();
    
    log('🎉 All tests completed successfully!', 'success');
    
  } catch (error) {
    log(`Test runner failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
