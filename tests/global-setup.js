// Global setup for Playwright extension testing
import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

async function globalSetup() {
  // Ensure extension is built
  const extensionPath = path.resolve('./dist/chrome');
  if (!fs.existsSync(extensionPath)) {
    throw new Error('Extension not built. Run "npm run build:chrome" first.');
  }

  // Verify manifest exists
  const manifestPath = path.join(extensionPath, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('Extension manifest not found.');
  }

  console.log('✅ Extension build verified');
  
  // Create test results directory
  const resultsDir = './test-results';
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  return async () => {
    // Cleanup function
  };
}

export default globalSetup;
