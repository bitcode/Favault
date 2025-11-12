import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import Logger from '../../src/lib/logging';

/**
 * Global setup for FaVault extension testing
 * Builds extension, validates files, and prepares test environment
 */
async function globalSetup(config: FullConfig) {
  // Initialize the logger
  const logger = Logger.getInstance();
  logger.init();

  console.log('🚀 Starting FaVault Extension Test Setup...');

  // 1. Build the extension for testing
  console.log('📦 Building extension for testing...');
  await buildExtension();

  // 2. Validate extension files exist
  console.log('✅ Validating extension build...');
  await validateExtensionBuild();

  // 3. Create test data directories
  console.log('📁 Creating test directories...');
  await createTestDirectories();

  // 4. Warm up browser for faster test execution
  console.log('🌡️ Warming up browser...');
  await warmupBrowser();

  console.log('✅ Global setup completed successfully!');
}

/**
 * Build the extension for testing
 */
async function buildExtension(): Promise<void> {
  const { spawn } = await import('child_process');

  return new Promise((resolve, reject) => {
    const buildProcess = spawn('npm', ['run', 'build:chrome'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: true
    });

    buildProcess.on('close', (code: number) => {
      if (code === 0) {
        console.log('✅ Extension built successfully');
        resolve();
      } else {
        reject(new Error(`Extension build failed with code ${code}`));
      }
    });

    buildProcess.on('error', (error: Error) => {
      reject(new Error(`Failed to start build process: ${error.message}`));
    });
  });
}

/**
 * Validate that extension build files exist
 */
async function validateExtensionBuild(): Promise<void> {
  const extensionPath = path.join(process.cwd(), 'dist/chrome');
  const requiredFiles = [
    'manifest.json',
    'newtab.html',
    'newtab.js',
    'newtab.css',
    'service-worker.js',
    'icons'
  ];

  // Check if extension directory exists
  if (!fs.existsSync(extensionPath)) {
    throw new Error(`Extension build directory not found: ${extensionPath}`);
  }

  // Check required files
  for (const file of requiredFiles) {
    const filePath = path.join(extensionPath, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Required extension file missing: ${file}`);
    }
  }

  // Validate manifest.json
  const manifestPath = path.join(extensionPath, 'manifest.json');
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    if (!manifest.name || !manifest.version) {
      throw new Error('Invalid manifest.json: missing name or version');
    }
    
    if (!manifest.chrome_url_overrides?.newtab) {
      throw new Error('Invalid manifest.json: missing new tab override');
    }
    
    console.log(`✅ Extension validated: ${manifest.name} v${manifest.version}`);
  } catch (error) {
    throw new Error(`Invalid manifest.json: ${(error as Error).message}`);
  }
}

/**
 * Create necessary test directories
 */
async function createTestDirectories(): Promise<void> {
  const directories = [
    'test-results',
    'test-results/videos',
    'test-results/screenshots',
    'test-results/traces',
    'test-results/downloads'
  ];

  for (const dir of directories) {
    const dirPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  }
}

/**
 * Warm up browser to improve test performance
 */
async function warmupBrowser(): Promise<void> {
  const extensionPath = path.join(process.cwd(), 'dist/chrome');
  
  try {
    const browser = await chromium.launch({
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--disable-web-security',
        '--no-sandbox'
      ]
    });

    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Load extension to warm up
    await page.goto('chrome://newtab/');
    await page.waitForTimeout(2000);
    
    await browser.close();
    console.log('✅ Browser warmed up successfully');
  } catch (error) {
    console.warn('⚠️ Browser warmup failed:', (error as Error).message);
    // Don't fail setup if warmup fails
  }
}

export default globalSetup;
