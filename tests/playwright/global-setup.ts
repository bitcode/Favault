import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import Logger from '../../src/lib/logging';

/**
 * Global setup for FaVault extension testing
 * Builds extension, validates files, and prepares test environment
 */
async function globalSetup(config: FullConfig) {
  const activeProjectNames = new Set(config.projects.map((project) => project.name));
  const buildTargets = getBuildTargets(activeProjectNames);

  // Initialize the logger
  const logger = Logger.getInstance();
  logger.init();

  console.log('🚀 Starting FaVault Extension Test Setup...');

  // 1. Build the extension for testing
  console.log('📦 Building extension for testing...');
  await buildExtension(buildTargets);

  if (buildTargets.includes('firefox')) {
    console.log('🧩 Packaging Firefox extension for profile-based loading...');
    await packageFirefoxExtension();
  }

  // 2. Validate extension files exist
  console.log('✅ Validating extension build...');
  await validateExtensionBuild(buildTargets);

  // 3. Create test data directories
  console.log('📁 Creating test directories...');
  await createTestDirectories();

  // 4. Warm up browser for faster test execution
  if (process.env.PLAYWRIGHT_WARMUP === '1') {
    const shouldWarmChromium = [...activeProjectNames].some((projectName) =>
      ['chromium-extension', 'chrome-extension', 'edge-extension'].includes(projectName)
    );

    if (shouldWarmChromium) {
      console.log('🌡️ Warming up Chromium-based browser...');
      await warmupBrowser();
    } else {
      console.log('⏭️ Skipping Chromium warmup because the active projects do not use Chromium');
    }
  } else {
    console.log('⏭️ Skipping browser warmup (set PLAYWRIGHT_WARMUP=1 to enable)');
  }

  console.log('✅ Global setup completed successfully!');
}

/**
 * Build the extension for testing
 */
async function buildExtension(buildTargets: Array<'chrome' | 'firefox' | 'edge'>): Promise<void> {
  const { spawn } = await import('child_process');

  for (const browserTarget of buildTargets) {
    await new Promise<void>((resolve, reject) => {
      const buildProcess = spawn('npm', ['run', `build:${browserTarget}`], {
        cwd: process.cwd(),
        stdio: 'inherit',
        shell: true
      });

      buildProcess.on('close', (code: number) => {
        if (code === 0) {
          console.log(`✅ ${browserTarget} extension built successfully`);
          resolve();
        } else {
          reject(new Error(`${browserTarget} extension build failed with code ${code}`));
        }
      });

      buildProcess.on('error', (error: Error) => {
        reject(new Error(`Failed to start ${browserTarget} build process: ${error.message}`));
      });
    });
  }
}

/**
 * Validate that extension build files exist
 */
async function validateExtensionBuild(buildTargets: Array<'chrome' | 'firefox' | 'edge'>): Promise<void> {
  const requiredFiles = [
    'manifest.json',
    'newtab.html',
    'newtab.js',
    'newtab.css',
    'service-worker.js',
    'icons'
  ];

  for (const browserTarget of buildTargets) {
    const extensionPath = path.join(process.cwd(), `dist/${browserTarget}`);

    if (!fs.existsSync(extensionPath)) {
      throw new Error(`Extension build directory not found: ${extensionPath}`);
    }

    for (const file of requiredFiles) {
      const filePath = path.join(extensionPath, file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Required ${browserTarget} extension file missing: ${file}`);
      }
    }

    const manifestPath = path.join(extensionPath, 'manifest.json');
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      if (!manifest.name || !manifest.version) {
        throw new Error('Invalid manifest.json: missing name or version');
      }

      if (!manifest.chrome_url_overrides?.newtab) {
        throw new Error('Invalid manifest.json: missing new tab override');
      }

      console.log(`✅ ${browserTarget} extension validated: ${manifest.name} v${manifest.version}`);
    } catch (error) {
      throw new Error(`Invalid ${browserTarget} manifest.json: ${(error as Error).message}`);
    }
  }
}

async function packageFirefoxExtension(): Promise<void> {
  const { spawn } = await import('child_process');
  const firefoxDistDir = path.join(process.cwd(), 'dist/firefox');
  const packagedPath = path.join(process.cwd(), 'dist/favault-firefox.xpi');

  if (fs.existsSync(packagedPath)) {
    fs.rmSync(packagedPath, { force: true });
  }

  await new Promise<void>((resolve, reject) => {
    const zipProcess = spawn('zip', ['-qr', packagedPath, '.'], {
      cwd: firefoxDistDir,
      stdio: 'inherit'
    });

    zipProcess.on('close', (code: number) => {
      if (code === 0) {
        console.log(`✅ Firefox extension packaged: ${packagedPath}`);
        resolve();
      } else {
        reject(new Error(`Firefox extension packaging failed with code ${code}`));
      }
    });

    zipProcess.on('error', (error: Error) => {
      reject(new Error(`Failed to start Firefox packaging process: ${error.message}`));
    });
  });
}

function getBuildTargets(activeProjectNames: Set<string>): Array<'chrome' | 'firefox' | 'edge'> {
  const targets = new Set<'chrome' | 'firefox' | 'edge'>();

  for (const projectName of activeProjectNames) {
    if (projectName === 'firefox-extension') {
      targets.add('firefox');
    }
    if (projectName === 'edge-extension') {
      targets.add('edge');
    }
    if (projectName === 'chromium-extension' || projectName === 'chrome-extension') {
      targets.add('chrome');
    }
  }

  if (targets.size === 0) {
    targets.add('chrome');
  }

  return Array.from(targets);
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
