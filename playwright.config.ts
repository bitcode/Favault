import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Playwright configuration for FaVault browser extension testing
 * Supports Chrome extension testing with cross-browser compatibility
 */
export default defineConfig({
  // Test directory
  testDir: './tests/playwright',

  // Global test timeout
  timeout: 30000,

  // Expect timeout for assertions
  expect: {
    timeout: 5000,
  },

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list']
  ],

  // Shared settings for all the projects below
  use: {
    // Base URL for the extension
    baseURL: 'chrome-extension://',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Record video on failure
    video: 'retain-on-failure',

    // Take screenshot on failure
    screenshot: 'only-on-failure',

    // Global test timeout
    actionTimeout: 10000,

    // Navigation timeout
    navigationTimeout: 15000,
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium-extension',
      use: {
        ...devices['Desktop Chrome'],
        // Extension-specific settings
        channel: 'chromium',
        launchOptions: {
          // Required for extension testing
          args: [
            '--disable-extensions-except=' + path.join(__dirname, 'dist/chrome'),
            '--load-extension=' + path.join(__dirname, 'dist/chrome'),
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--no-sandbox',
            '--disable-setuid-sandbox'
          ],
        },
      },
    },
    
    {
      name: 'chrome-extension',
      use: { 
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        launchOptions: {
          args: [
            '--disable-extensions-except=' + path.join(__dirname, 'dist/chrome'),
            '--load-extension=' + path.join(__dirname, 'dist/chrome'),
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
          ],
        },
      },
    },

    // Firefox extension testing (requires different approach)
    {
      name: 'firefox-extension',
      use: { 
        ...devices['Desktop Firefox'],
        launchOptions: {
          firefoxUserPrefs: {
            'extensions.autoDisableScopes': 0,
            'extensions.enabledScopes': 15,
          },
        },
      },
    },

    // Edge extension testing
    {
      name: 'edge-extension',
      use: { 
        ...devices['Desktop Edge'],
        channel: 'msedge',
        launchOptions: {
          args: [
            '--disable-extensions-except=' + path.join(__dirname, 'dist/edge'),
            '--load-extension=' + path.join(__dirname, 'dist/edge'),
            '--disable-web-security'
          ],
        },
      },
    },

    // Mobile testing for responsive design
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Global setup and teardown
  globalSetup: './tests/playwright/global-setup.ts',
  globalTeardown: './tests/playwright/global-teardown.ts',

  // Output directory for test artifacts
  outputDir: 'test-results/',
  
  // Test match patterns
  testMatch: [
    '**/tests/playwright/**/*.test.ts',
    '**/tests/playwright/**/*.spec.ts'
  ],
  
  // Test ignore patterns
  testIgnore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/test-results/**'
  ],
});
