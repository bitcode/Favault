#!/usr/bin/env node

/**
 * Simple test to demonstrate automated testing capabilities
 */

import fs from 'fs';
import path from 'path';

console.log('🚀 FaVault Automated Test Demo');
console.log('==============================');

// Check if extension is built
const extensionPath = path.resolve('./dist/chrome');
const manifestPath = path.join(extensionPath, 'manifest.json');

const results = {
  timestamp: new Date().toISOString(),
  tests: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    success: false
  }
};

// Test 1: Extension Build Check
console.log('🧪 Test 1: Extension Build Check');
const buildTest = {
  name: 'Extension Build Check',
  passed: false,
  error: null
};

if (fs.existsSync(extensionPath) && fs.existsSync(manifestPath)) {
  buildTest.passed = true;
  console.log('✅ Extension built successfully');
} else {
  buildTest.passed = false;
  buildTest.error = 'Extension not built or manifest missing';
  console.log('❌ Extension build check failed');
}

results.tests.push(buildTest);

// Test 2: Manifest Validation
console.log('🧪 Test 2: Manifest Validation');
const manifestTest = {
  name: 'Manifest Validation',
  passed: false,
  error: null
};

try {
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    if (manifest.name && manifest.version && manifest.manifest_version) {
      manifestTest.passed = true;
      console.log('✅ Manifest validation passed');
      console.log(`   Name: ${manifest.name}`);
      console.log(`   Version: ${manifest.version}`);
    } else {
      manifestTest.passed = false;
      manifestTest.error = 'Manifest missing required fields';
      console.log('❌ Manifest validation failed');
    }
  } else {
    manifestTest.passed = false;
    manifestTest.error = 'Manifest file not found';
    console.log('❌ Manifest file not found');
  }
} catch (error) {
  manifestTest.passed = false;
  manifestTest.error = error.message;
  console.log('❌ Manifest parsing failed:', error.message);
}

results.tests.push(manifestTest);

// Test 3: Required Files Check
console.log('🧪 Test 3: Required Files Check');
const filesTest = {
  name: 'Required Files Check',
  passed: false,
  error: null,
  details: {}
};

const requiredFiles = [
  'newtab.html',
  'newtab.js',
  'newtab.css',
  'service-worker.js'
];

let allFilesExist = true;
const fileStatus = {};

for (const file of requiredFiles) {
  const filePath = path.join(extensionPath, file);
  const exists = fs.existsSync(filePath);
  fileStatus[file] = exists;
  
  if (exists) {
    console.log(`✅ ${file} found`);
  } else {
    console.log(`❌ ${file} missing`);
    allFilesExist = false;
  }
}

filesTest.passed = allFilesExist;
filesTest.details = fileStatus;

if (!allFilesExist) {
  filesTest.error = 'Some required files are missing';
}

results.tests.push(filesTest);

// Calculate summary
results.summary.total = results.tests.length;
results.summary.passed = results.tests.filter(t => t.passed).length;
results.summary.failed = results.tests.filter(t => !t.passed).length;
results.summary.success = results.summary.failed === 0;

// Print results
console.log('\n📊 Test Results:');
console.log('================');
console.log(`Status: ${results.summary.success ? '✅ PASSED' : '❌ FAILED'}`);
console.log(`Tests: ${results.summary.passed}/${results.summary.total} passed`);

if (results.summary.failed > 0) {
  console.log('\n❌ Failed Tests:');
  results.tests.filter(t => !t.passed).forEach(test => {
    console.log(`  - ${test.name}: ${test.error}`);
  });
}

// Save results
const resultsDir = './test-results';
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

fs.writeFileSync(
  path.join(resultsDir, 'simple-test-results.json'),
  JSON.stringify(results, null, 2)
);

console.log(`\n📄 Results saved: ${path.resolve(resultsDir, 'simple-test-results.json')}`);

// Demonstrate structured output
console.log('\n📋 Structured Test Results:');
console.log(JSON.stringify({
  success: results.summary.success,
  passed: results.summary.passed,
  total: results.summary.total,
  timestamp: results.timestamp
}, null, 2));

process.exit(results.summary.success ? 0 : 1);
