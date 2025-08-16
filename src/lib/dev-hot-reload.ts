/**
 * Development Hot Reload System
 * Automatically reloads and reinjects testing scripts during development
 */

export class DevHotReload {
  private static instance: DevHotReload;
  private reloadInterval: number | null = null;
  private lastModified: number = 0;
  private isEnabled = false;

  static getInstance(): DevHotReload {
    if (!DevHotReload.instance) {
      DevHotReload.instance = new DevHotReload();
    }
    return DevHotReload.instance;
  }

  /**
   * Enable hot reload for development
   */
  enable(): void {
    if (this.isEnabled) return;
    
    this.isEnabled = true;
    console.log('🔥 Hot reload enabled for development');
    
    // Check for updates every 2 seconds
    this.reloadInterval = window.setInterval(() => {
      this.checkForUpdates();
    }, 2000);

    // Expose global controls
    this.exposeGlobalControls();
  }

  /**
   * Disable hot reload
   */
  disable(): void {
    if (!this.isEnabled) return;
    
    this.isEnabled = false;
    if (this.reloadInterval) {
      clearInterval(this.reloadInterval);
      this.reloadInterval = null;
    }
    console.log('🔥 Hot reload disabled');
  }

  /**
   * Check for extension updates and reload if needed
   */
  private async checkForUpdates(): Promise<void> {
    try {
      // Check if extension context is still valid
      if (typeof chrome === 'undefined' || !chrome.runtime) {
        console.log('🔄 Extension context invalidated, reloading page...');
        window.location.reload();
        return;
      }

      // Check for manifest changes (simple timestamp check)
      const now = Date.now();
      if (now - this.lastModified > 10000) { // Check every 10 seconds
        this.lastModified = now;
        
        // Try to ping the extension
        try {
          await chrome.runtime.sendMessage({ type: 'PING' });
        } catch (error) {
          console.log('🔄 Extension updated, reloading page...');
          window.location.reload();
        }
      }
    } catch (error) {
      // Silently handle errors to avoid spam
    }
  }

  /**
   * Force reload the extension and page
   */
  async forceReload(): Promise<void> {
    console.log('🔄 Force reloading extension...');
    
    try {
      // Try to reload the extension
      await chrome.runtime.reload();
    } catch (error) {
      // If that fails, just reload the page
      window.location.reload();
    }
  }

  /**
   * Inject development scripts automatically
   */
  async injectDevScripts(): Promise<void> {
    console.log('💉 Injecting development scripts...');
    
    // Import and initialize the development testing module
    try {
      const { EnhancedDragDropDev } = await import('./enhanced-dragdrop-dev');
      const devSystem = EnhancedDragDropDev.getInstance();
      await devSystem.initialize();
      
      console.log('✅ Development scripts injected successfully');
    } catch (error) {
      console.error('❌ Failed to inject development scripts:', error);
    }
  }

  /**
   * Expose global controls for hot reload
   */
  private exposeGlobalControls(): void {
    if (typeof window !== 'undefined') {
      (window as any).hotReload = {
        enable: () => this.enable(),
        disable: () => this.disable(),
        forceReload: () => this.forceReload(),
        injectDevScripts: () => this.injectDevScripts(),
        status: () => ({ enabled: this.isEnabled })
      };
    }
  }
}

/**
 * Auto-initialize hot reload in development mode
 */
export function initDevMode(): void {
  // Only enable in development (check for localhost or unpacked extension)
  const isDev = window.location.hostname === 'localhost' || 
                window.location.protocol === 'chrome-extension:' ||
                process.env.NODE_ENV === 'development';

  if (isDev) {
    console.log('🔧 Development mode detected');
    
    const hotReload = DevHotReload.getInstance();
    hotReload.enable();
    
    // Auto-inject development scripts after a short delay
    setTimeout(() => {
      hotReload.injectDevScripts();
    }, 1000);
  }
}
