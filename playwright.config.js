import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Run tests sequentially for extension testing
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for extension testing
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['line']
  ],
  use: {
    baseURL: 'chrome-extension://test',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: false, // Required for extension testing
  },

  projects: [
    {
      name: 'chrome-extension',
      use: { 
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        launchOptions: {
          args: [
            '--disable-extensions-except=./dist/chrome',
            '--load-extension=./dist/chrome',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--no-sandbox'
          ],
        },
      },
    },
    {
      name: 'brave-extension',
      use: { 
        ...devices['Desktop Chrome'],
        channel: 'chrome', // Use Chrome channel but detect Brave in tests
        launchOptions: {
          executablePath: process.env.BRAVE_PATH || undefined,
          args: [
            '--disable-extensions-except=./dist/chrome',
            '--load-extension=./dist/chrome',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--no-sandbox'
          ],
        },
      },
    },
  ],

  // Global setup and teardown
  globalSetup: require.resolve('./tests/global-setup.js'),
  globalTeardown: require.resolve('./tests/global-teardown.js'),
});
