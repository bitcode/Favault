import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Global teardown for FaVault extension testing
 * Cleans up test artifacts and generates final reports
 */
async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting FaVault Extension Test Teardown...');

  // 1. Generate test summary
  console.log('📊 Generating test summary...');
  await generateTestSummary();

  // 2. Clean up temporary files (optional)
  console.log('🗑️ Cleaning up temporary files...');
  await cleanupTempFiles();

  // 3. Archive test results (optional)
  console.log('📦 Archiving test results...');
  await archiveTestResults();

  console.log('✅ Global teardown completed successfully!');
}

/**
 * Generate a summary of test results
 */
async function generateTestSummary(): Promise<void> {
  try {
    const resultsPath = path.join(process.cwd(), 'test-results/results.json');
    
    if (!fs.existsSync(resultsPath)) {
      console.log('ℹ️ No test results file found, skipping summary generation');
      return;
    }

    const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    
    const summary = {
      timestamp: new Date().toISOString(),
      totalTests: results.stats?.total || 0,
      passed: results.stats?.passed || 0,
      failed: results.stats?.failed || 0,
      skipped: results.stats?.skipped || 0,
      duration: results.stats?.duration || 0,
      projects: results.suites?.map((suite: any) => ({
        name: suite.title,
        tests: suite.specs?.length || 0,
        passed: suite.specs?.filter((spec: any) => spec.ok).length || 0,
        failed: suite.specs?.filter((spec: any) => !spec.ok).length || 0
      })) || []
    };

    const summaryPath = path.join(process.cwd(), 'test-results/summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    
    console.log('📊 Test Summary:');
    console.log(`   Total Tests: ${summary.totalTests}`);
    console.log(`   Passed: ${summary.passed}`);
    console.log(`   Failed: ${summary.failed}`);
    console.log(`   Skipped: ${summary.skipped}`);
    console.log(`   Duration: ${Math.round(summary.duration / 1000)}s`);
    
  } catch (error) {
    console.warn('⚠️ Failed to generate test summary:', error.message);
  }
}

/**
 * Clean up temporary files
 */
async function cleanupTempFiles(): Promise<void> {
  try {
    const tempDirs = [
      'test-results/temp',
      'test-results/.tmp'
    ];

    for (const dir of tempDirs) {
      const dirPath = path.join(process.cwd(), dir);
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
        console.log(`🗑️ Cleaned up: ${dir}`);
      }
    }
  } catch (error) {
    console.warn('⚠️ Failed to clean up temporary files:', error.message);
  }
}

/**
 * Archive test results for CI/CD
 */
async function archiveTestResults(): Promise<void> {
  try {
    const resultsDir = path.join(process.cwd(), 'test-results');
    
    if (!fs.existsSync(resultsDir)) {
      console.log('ℹ️ No test results directory found, skipping archival');
      return;
    }

    // Create archive info file
    const archiveInfo = {
      timestamp: new Date().toISOString(),
      branch: process.env.GITHUB_REF_NAME || 'local',
      commit: process.env.GITHUB_SHA || 'unknown',
      runId: process.env.GITHUB_RUN_ID || 'local',
      environment: process.env.NODE_ENV || 'test'
    };

    const archiveInfoPath = path.join(resultsDir, 'archive-info.json');
    fs.writeFileSync(archiveInfoPath, JSON.stringify(archiveInfo, null, 2));
    
    console.log('📦 Test results archived with metadata');
    
  } catch (error) {
    console.warn('⚠️ Failed to archive test results:', error.message);
  }
}

export default globalTeardown;
