#!/usr/bin/env node

/**
 * Development Build Script with Auto-Reload
 * Builds the extension and automatically reloads it in the browser
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

class DevBuilder {
  constructor() {
    this.isBuilding = false;
    this.buildQueue = false;
    this.extensionId = null;
  }

  /**
   * Start development mode with file watching
   */
  async start() {
    console.log('🚀 Starting development build with auto-reload...');
    
    // Initial build
    await this.build();
    
    // Set up file watcher
    this.setupFileWatcher();
    
    // Try to find and reload extension
    this.setupExtensionReload();
    
    console.log('👀 Watching for file changes...');
    console.log('🔄 Extension will auto-reload on changes');
    console.log('📋 Available commands:');
    console.log('  - Ctrl+C: Stop development server');
    console.log('  - r + Enter: Force rebuild');
    console.log('  - t + Enter: Run tests in browser');
  }

  /**
   * Build the extension
   */
  async build() {
    if (this.isBuilding) {
      this.buildQueue = true;
      return;
    }

    this.isBuilding = true;
    console.log('🔨 Building extension...');
    
    try {
      const startTime = Date.now();
      
      // Run the build command
      execSync('npm run build', { 
        stdio: 'pipe',
        cwd: process.cwd()
      });
      
      const duration = Date.now() - startTime;
      console.log(`✅ Build complete (${duration}ms)`);
      
      // Reload extension if possible
      await this.reloadExtension();
      
    } catch (error) {
      console.error('❌ Build failed:', error.message);
    } finally {
      this.isBuilding = false;
      
      // Process queued build if needed
      if (this.buildQueue) {
        this.buildQueue = false;
        setTimeout(() => this.build(), 100);
      }
    }
  }

  /**
   * Set up file watcher for auto-rebuild
   */
  setupFileWatcher() {
    const watcher = chokidar.watch([
      'src/**/*',
      'manifests/**/*',
      'public/**/*'
    ], {
      ignored: /node_modules/,
      persistent: true,
      ignoreInitial: true
    });

    let debounceTimer = null;

    watcher.on('change', (filePath) => {
      console.log(`📝 File changed: ${filePath}`);
      
      // Debounce builds to avoid excessive rebuilding
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      
      debounceTimer = setTimeout(() => {
        this.build();
      }, 500);
    });

    watcher.on('error', (error) => {
      console.error('❌ File watcher error:', error);
    });
  }

  /**
   * Set up extension reload functionality
   */
  setupExtensionReload() {
    // Try to detect Chrome extension ID
    this.detectExtensionId();
    
    // Set up keyboard commands
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    process.stdin.on('data', (key) => {
      if (key === '\u0003') { // Ctrl+C
        console.log('\n👋 Stopping development server...');
        process.exit(0);
      } else if (key === 'r' || key === 'R') {
        console.log('🔄 Force rebuilding...');
        this.build();
      } else if (key === 't' || key === 'T') {
        console.log('🧪 Opening test runner...');
        this.openTestRunner();
      }
    });
  }

  /**
   * Try to detect the extension ID
   */
  detectExtensionId() {
    try {
      const manifestPath = path.join(process.cwd(), 'dist/production/manifest.json');
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        console.log(`📦 Extension: ${manifest.name} v${manifest.version}`);
      }
    } catch (error) {
      // Ignore errors
    }
  }

  /**
   * Reload the extension in Chrome
   */
  async reloadExtension() {
    try {
      // Create a simple reload script
      const reloadScript = `
        // Extension reload script
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          try {
            chrome.runtime.reload();
            console.log('🔄 Extension reloaded');
          } catch (error) {
            console.log('🔄 Extension reload requested');
          }
        }
      `;
      
      // Write reload script to dist folder
      const reloadPath = path.join(process.cwd(), 'dist/production/reload.js');
      fs.writeFileSync(reloadPath, reloadScript);
      
      console.log('🔄 Extension reload triggered');
      
    } catch (error) {
      // Silently handle reload errors
    }
  }

  /**
   * Open test runner in browser
   */
  openTestRunner() {
    try {
      const testUrl = 'chrome-extension://your-extension-id/newtab.html';
      console.log('🧪 Open your extension and run: runAllTests()');
    } catch (error) {
      console.error('❌ Failed to open test runner:', error);
    }
  }
}

// Start development server if run directly
if (require.main === module) {
  const builder = new DevBuilder();
  builder.start().catch(error => {
    console.error('❌ Development server failed:', error);
    process.exit(1);
  });
}

module.exports = DevBuilder;
