// Service Worker Manager for handling lifecycle and reactivation
import { ExtensionAPI } from './api';

export interface ServiceWorkerStatus {
  isActive: boolean;
  lastPing: number;
  consecutiveFailures: number;
  lastError?: string;
  lifecycle?: any;
}

export class ServiceWorkerManager {
  private static instance: ServiceWorkerManager;
  private status: ServiceWorkerStatus = {
    isActive: false,
    lastPing: 0,
    consecutiveFailures: 0
  };
  
  private pingInterval: number | null = null;
  private reactivationAttempts = 0;
  private maxReactivationAttempts = 5;
  private listeners: Array<(status: ServiceWorkerStatus) => void> = [];

  private constructor() {
    this.startMonitoring();
    this.setupMessageListener();
  }

  public static getInstance(): ServiceWorkerManager {
    if (!ServiceWorkerManager.instance) {
      ServiceWorkerManager.instance = new ServiceWorkerManager();
    }
    return ServiceWorkerManager.instance;
  }

  /**
   * Start monitoring the service worker
   */
  private startMonitoring(): void {
    // Clear any existing interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Ping every 30 seconds to check service worker status
    this.pingInterval = setInterval(() => {
      this.checkServiceWorkerStatus();
    }, 30000) as unknown as number;

    // Initial check
    this.checkServiceWorkerStatus();
    
    console.log('🔍 Service worker monitoring started');
  }

  /**
   * Setup message listener for service worker pings
   */
  private setupMessageListener(): void {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'SERVICE_WORKER_PING') {
          console.log('💓 Received service worker ping');
          this.status.lastPing = Date.now();
          this.status.isActive = true;
          this.status.consecutiveFailures = 0;
          this.notifyListeners();
        }
      });
    }
  }

  /**
   * Check service worker status with ping
   */
  private async checkServiceWorkerStatus(): Promise<void> {
    try {
      console.log('🔍 Checking service worker status...');
      
      const response = await this.pingServiceWorker();
      
      if (response && response.status === 'pong') {
        this.status.isActive = true;
        this.status.lastPing = Date.now();
        this.status.consecutiveFailures = 0;
        this.status.lifecycle = response.lifecycle;
        this.reactivationAttempts = 0;
        
        console.log('✅ Service worker is active and responding');
      } else {
        this.handleInactiveServiceWorker();
      }
    } catch (error) {
      console.warn('⚠️ Service worker ping failed:', error);
      this.handleInactiveServiceWorker();
    }
    
    this.notifyListeners();
  }

  /**
   * Handle inactive service worker
   */
  private handleInactiveServiceWorker(): void {
    this.status.isActive = false;
    this.status.consecutiveFailures++;
    
    console.warn(`⚠️ Service worker appears inactive (${this.status.consecutiveFailures} consecutive failures)`);
    
    // Attempt reactivation if we haven't exceeded max attempts
    if (this.reactivationAttempts < this.maxReactivationAttempts) {
      this.attemptReactivation();
    } else {
      console.error('❌ Max reactivation attempts reached. Service worker may need manual intervention.');
      this.status.lastError = 'Max reactivation attempts exceeded';
    }
  }

  /**
   * Attempt to reactivate the service worker
   */
  private async attemptReactivation(): Promise<void> {
    this.reactivationAttempts++;
    
    console.log(`🔄 Attempting service worker reactivation (attempt ${this.reactivationAttempts}/${this.maxReactivationAttempts})`);
    
    try {
      // Try multiple reactivation strategies
      await this.performReactivationStrategies();
      
      // Wait a moment then check status
      setTimeout(() => {
        this.checkServiceWorkerStatus();
      }, 2000);
      
    } catch (error) {
      console.error('❌ Service worker reactivation failed:', error);
      this.status.lastError = error instanceof Error ? error.message : String(error);
    }
  }

  /**
   * Perform various reactivation strategies
   */
  private async performReactivationStrategies(): Promise<void> {
    const strategies = [
      () => this.pingServiceWorker(),
      () => this.triggerServiceWorkerWithBookmarkRequest(),
      () => this.sendWakeupMessage(),
      () => this.performDummyOperation()
    ];

    for (const strategy of strategies) {
      try {
        await strategy();
        console.log('✅ Reactivation strategy succeeded');
        break;
      } catch (error) {
        console.warn('⚠️ Reactivation strategy failed:', error);
        // Continue to next strategy
      }
    }
  }

  /**
   * Ping the service worker
   */
  private async pingServiceWorker(): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!chrome?.runtime) {
        reject(new Error('Chrome runtime not available'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Service worker ping timeout'));
      }, 5000);

      chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
        clearTimeout(timeout);
        
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Trigger service worker with bookmark request
   */
  private async triggerServiceWorkerWithBookmarkRequest(): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!chrome?.runtime) {
        reject(new Error('Chrome runtime not available'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Bookmark request timeout'));
      }, 10000);

      chrome.runtime.sendMessage({ type: 'GET_BOOKMARKS' }, (response) => {
        clearTimeout(timeout);
        
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Send wakeup message
   */
  private async sendWakeupMessage(): Promise<void> {
    if (chrome?.runtime) {
      chrome.runtime.sendMessage({ 
        type: 'WAKEUP', 
        timestamp: Date.now() 
      });
    }
  }

  /**
   * Perform dummy operation to wake service worker
   */
  private async performDummyOperation(): Promise<void> {
    try {
      // Try to access chrome.bookmarks to wake the service worker
      if (chrome?.bookmarks) {
        await chrome.bookmarks.getTree();
      }
    } catch (error) {
      // Ignore errors, this is just to wake the service worker
    }
  }

  /**
   * Get current service worker status
   */
  public getStatus(): ServiceWorkerStatus {
    return { ...this.status };
  }

  /**
   * Force a status check
   */
  public async forceStatusCheck(): Promise<ServiceWorkerStatus> {
    await this.checkServiceWorkerStatus();
    return this.getStatus();
  }

  /**
   * Add status change listener
   */
  public addStatusListener(listener: (status: ServiceWorkerStatus) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove status change listener
   */
  public removeStatusListener(listener: (status: ServiceWorkerStatus) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Notify all listeners of status changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.status);
      } catch (error) {
        console.error('Error in service worker status listener:', error);
      }
    });
  }

  /**
   * Ensure service worker is active before performing operation
   */
  public async ensureActive(): Promise<boolean> {
    if (this.status.isActive) {
      return true;
    }

    console.log('🔄 Service worker inactive, attempting to reactivate...');
    
    try {
      await this.attemptReactivation();
      
      // Wait for reactivation
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check status again
      await this.checkServiceWorkerStatus();
      
      return this.status.isActive;
    } catch (error) {
      console.error('❌ Failed to ensure service worker is active:', error);
      return false;
    }
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    this.listeners = [];
    console.log('🧹 Service worker manager cleanup completed');
  }
}

// Export singleton instance
export const serviceWorkerManager = ServiceWorkerManager.getInstance();
