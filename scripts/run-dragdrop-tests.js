#!/usr/bin/env node

/**
 * Comprehensive Drag-and-Drop Test Runner for FaVault
 * 
 * This script runs the Playwright test suite for bookmark drag-and-drop functionality
 * and provides detailed reporting on the results.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

console.log('🧪 FaVault Drag-and-Drop Test Runner');
console.log('=====================================\n');

// Check if extension is built
const distPath = path.join(rootDir, 'dist');
if (!fs.existsSync(distPath)) {
  console.error('❌ Extension not built. Running build first...');
  await runCommand('npm', ['run', 'build:chrome']);
}

// Check if Playwright is installed
try {
  await runCommand('npx', ['playwright', '--version'], { stdio: 'pipe' });
} catch (error) {
  console.log('📦 Installing Playwright browsers...');
  await runCommand('npx', ['playwright', 'install']);
}

console.log('🚀 Starting comprehensive drag-and-drop tests...\n');

// Run the tests
try {
  const testResults = await runPlaywrightTests();
  await generateTestReport(testResults);
} catch (error) {
  console.error('❌ Test execution failed:', error.message);
  process.exit(1);
}

async function runPlaywrightTests() {
  const args = [
    'playwright', 'test',
    'tests/playwright/bookmark-drag-drop.spec.ts',
    '--project=chrome-extension',
    '--reporter=json',
    '--output=test-results/dragdrop-results.json'
  ];

  console.log('Running command:', 'npx', args.join(' '));

  return new Promise((resolve, reject) => {
    const process = spawn('npx', args, {
      cwd: rootDir,
      stdio: ['inherit', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(data.toString());
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(data.toString());
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, exitCode: code });
      } else {
        // Don't reject on test failures, we want to analyze the results
        resolve({ stdout, stderr, exitCode: code });
      }
    });

    process.on('error', (error) => {
      reject(error);
    });
  });
}

async function generateTestReport(testResults) {
  console.log('\n📊 Test Results Analysis');
  console.log('========================\n');

  // Try to read JSON results
  const resultsPath = path.join(rootDir, 'test-results', 'dragdrop-results.json');
  
  if (fs.existsSync(resultsPath)) {
    try {
      const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
      
      console.log(`📈 Test Summary:`);
      console.log(`   Total Tests: ${results.stats?.total || 'Unknown'}`);
      console.log(`   ✅ Passed: ${results.stats?.passed || 0}`);
      console.log(`   ❌ Failed: ${results.stats?.failed || 0}`);
      console.log(`   ⏭️ Skipped: ${results.stats?.skipped || 0}`);
      console.log(`   ⏱️ Duration: ${results.stats?.duration || 'Unknown'}ms\n`);

      // Analyze specific test categories
      if (results.suites) {
        analyzeTestSuites(results.suites);
      }

      // Show failed tests
      if (results.stats?.failed > 0) {
        showFailedTests(results);
      }

    } catch (error) {
      console.warn('⚠️ Could not parse test results JSON:', error.message);
    }
  } else {
    console.log('📄 JSON results not found, analyzing stdout...');
    analyzeStdoutResults(testResults.stdout);
  }

  // Exit with appropriate code
  if (testResults.exitCode === 0) {
    console.log('\n🎉 All tests passed! Drag-and-drop functionality is working correctly.');
  } else {
    console.log('\n⚠️ Some tests failed. Please review the results above.');
    console.log('\n🔧 Troubleshooting Tips:');
    console.log('   1. Ensure the extension is built: npm run build:chrome');
    console.log('   2. Check that edit mode is working in the extension');
    console.log('   3. Verify insertion points are visible between bookmarks');
    console.log('   4. Run debug functions: debugInsertionPoints(), testInsertionPoints()');
  }

  process.exit(testResults.exitCode);
}

function analyzeTestSuites(suites) {
  console.log('📋 Test Categories:');
  
  suites.forEach(suite => {
    if (suite.title) {
      const passed = suite.specs?.filter(spec => spec.ok).length || 0;
      const total = suite.specs?.length || 0;
      const status = passed === total ? '✅' : '❌';
      
      console.log(`   ${status} ${suite.title}: ${passed}/${total} passed`);
      
      // Show failed specs
      if (suite.specs) {
        suite.specs.forEach(spec => {
          if (!spec.ok) {
            console.log(`      ❌ ${spec.title}`);
            if (spec.tests) {
              spec.tests.forEach(test => {
                if (test.status === 'failed') {
                  console.log(`         Error: ${test.error?.message || 'Unknown error'}`);
                }
              });
            }
          }
        });
      }
    }
  });
  
  console.log('');
}

function showFailedTests(results) {
  console.log('❌ Failed Tests Details:');
  console.log('========================\n');
  
  // This would need to be implemented based on the actual JSON structure
  // from Playwright results
  console.log('See detailed error messages above.\n');
}

function analyzeStdoutResults(stdout) {
  const lines = stdout.split('\n');
  let passedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  lines.forEach(line => {
    if (line.includes('✓') || line.includes('passed')) passedCount++;
    if (line.includes('✗') || line.includes('failed')) failedCount++;
    if (line.includes('skipped')) skippedCount++;
  });

  console.log(`📈 Estimated Results from Output:`);
  console.log(`   ✅ Passed: ${passedCount}`);
  console.log(`   ❌ Failed: ${failedCount}`);
  console.log(`   ⏭️ Skipped: ${skippedCount}\n`);
}

async function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, {
      cwd: rootDir,
      stdio: 'inherit',
      ...options
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    process.on('error', (error) => {
      reject(error);
    });
  });
}
