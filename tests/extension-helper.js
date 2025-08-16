// Extension testing helper utilities
import { expect } from '@playwright/test';

export class ExtensionHelper {
  constructor(page, context) {
    this.page = page;
    this.context = context;
    this.extensionId = null;
  }

  async getExtensionId() {
    if (this.extensionId) return this.extensionId;
    
    // Get extension ID from service worker
    const serviceWorker = this.context.serviceWorkers()[0];
    if (serviceWorker) {
      const url = serviceWorker.url();
      this.extensionId = url.split('/')[2];
    }
    
    if (!this.extensionId) {
      // Fallback: get from chrome://extensions page
      const extensionsPage = await this.context.newPage();
      await extensionsPage.goto('chrome://extensions/');
      await extensionsPage.waitForTimeout(1000);
      
      const extensionCards = await extensionsPage.$$('extensions-item');
      if (extensionCards.length > 0) {
        this.extensionId = await extensionCards[0].getAttribute('id');
      }
      
      await extensionsPage.close();
    }
    
    return this.extensionId;
  }

  async navigateToExtension() {
    const extensionId = await this.getExtensionId();
    if (!extensionId) {
      throw new Error('Extension ID not found');
    }
    
    const extensionUrl = `chrome-extension://${extensionId}/newtab.html`;
    await this.page.goto(extensionUrl);
    await this.page.waitForLoadState('networkidle');
    
    return extensionUrl;
  }

  async waitForExtensionReady() {
    // Wait for enhanced drag-drop manager to be available
    await this.page.waitForFunction(() => {
      return typeof window.EnhancedDragDropManager !== 'undefined';
    }, { timeout: 10000 });
    
    // Wait for folders to load
    await this.page.waitForSelector('.folder-container', { timeout: 10000 });
  }

  async enableEditMode() {
    const editToggle = await this.page.locator('[data-testid="edit-mode-toggle"], .edit-mode-toggle, button:has-text("Edit")').first();
    
    if (await editToggle.isVisible()) {
      const isEditMode = await this.page.evaluate(() => {
        return document.body.classList.contains('edit-mode') || 
               document.querySelector('.app')?.classList.contains('edit-mode');
      });
      
      if (!isEditMode) {
        await editToggle.click();
        await this.page.waitForTimeout(1000);
      }
    }
    
    // Initialize enhanced drag-drop
    await this.page.evaluate(async () => {
      if (typeof window.EnhancedDragDropManager !== 'undefined') {
        const initResult = await window.EnhancedDragDropManager.initialize();
        if (initResult.success) {
          await window.EnhancedDragDropManager.enableEditMode();
        }
        return initResult;
      }
      return { success: false, error: 'EnhancedDragDropManager not found' };
    });
  }

  async getFolderOrder() {
    return await this.page.evaluate(() => {
      const folders = Array.from(document.querySelectorAll('.folder-container'));
      return folders.map(folder => {
        const title = folder.querySelector('.folder-title, h3, .folder-name')?.textContent;
        return title?.trim();
      }).filter(Boolean);
    });
  }

  async moveFolderToPosition(fromIndex, toIndex) {
    const startTime = Date.now();
    
    const result = await this.page.evaluate(async ({ fromIndex, toIndex }) => {
      if (typeof window.EnhancedDragDropManager === 'undefined') {
        return { success: false, error: 'EnhancedDragDropManager not available' };
      }
      
      try {
        const moveResult = await window.EnhancedDragDropManager.moveFolderToPosition(fromIndex, toIndex);
        return moveResult;
      } catch (error) {
        return { success: false, error: error.message };
      }
    }, { fromIndex, toIndex });
    
    if (result.success) {
      // Wait for UI update
      await this.page.waitForTimeout(1500);
    }
    
    const endTime = Date.now();
    result.executionTime = endTime - startTime;
    
    return result;
  }

  async captureConsoleErrors() {
    const errors = [];
    
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push({
          type: 'error',
          text: msg.text(),
          location: msg.location()
        });
      }
    });
    
    this.page.on('pageerror', error => {
      errors.push({
        type: 'pageerror',
        message: error.message,
        stack: error.stack
      });
    });
    
    return () => errors;
  }

  async detectBrowser() {
    return await this.page.evaluate(() => {
      const isChrome = !!(window.chrome) && !(navigator.brave);
      const isBrave = !!(navigator.brave);
      const isEdge = navigator.userAgent.includes('Edg/');
      
      return {
        isChrome,
        isBrave,
        isEdge,
        name: isChrome ? 'Chrome' : isBrave ? 'Brave' : isEdge ? 'Edge' : 'Unknown',
        userAgent: navigator.userAgent
      };
    });
  }

  async getInsertionPointCount() {
    return await this.page.locator('.insertion-point').count();
  }

  async simulateDragDrop(fromSelector, toSelector) {
    const startTime = Date.now();
    
    try {
      await this.page.dragAndDrop(fromSelector, toSelector, {
        force: true,
        timeout: 5000
      });
      
      await this.page.waitForTimeout(1000);
      
      return {
        success: true,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime
      };
    }
  }
}
