// Global teardown for Playwright extension testing
import fs from 'fs';
import path from 'path';

async function globalTeardown() {
  // Generate summary report
  const resultsPath = './test-results/results.json';
  if (fs.existsSync(resultsPath)) {
    const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    
    const summary = {
      timestamp: new Date().toISOString(),
      totalTests: results.stats?.total || 0,
      passed: results.stats?.passed || 0,
      failed: results.stats?.failed || 0,
      skipped: results.stats?.skipped || 0,
      duration: results.stats?.duration || 0,
      success: (results.stats?.failed || 0) === 0
    };
    
    fs.writeFileSync('./test-results/summary.json', JSON.stringify(summary, null, 2));
    console.log('📊 Test summary generated');
  }
}

export default globalTeardown;
