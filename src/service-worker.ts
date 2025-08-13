// Service worker for handling background tasks and commands
// Note: Using direct browser API calls instead of imports for service worker compatibility

// Cross-browser API compatibility
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

class ServiceWorker {
  constructor() {
    this.init();
  }

  private init(): void {
    // Listen for keyboard commands
    if (browserAPI.commands && browserAPI.commands.onCommand) {
      browserAPI.commands.onCommand.addListener((command: string) => {
        this.handleCommand(command);
      });
    }

    // Listen for messages from content scripts
    if (browserAPI.runtime && browserAPI.runtime.onMessage) {
      browserAPI.runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
        this.handleMessage(message, sender, sendResponse);
        return true; // Keep message channel open for async response
      });
    }

    console.log('FaVault service worker initialized');
  }

  private async handleCommand(command: string): Promise<void> {
    switch (command) {
      case 'toggle-search':
        await this.focusSearchInput();
        break;
      case 'toggle-edit-mode':
        await this.toggleEditMode();
        break;
      default:
        console.log('Unknown command:', command);
    }
  }

  private async focusSearchInput(): Promise<void> {
    try {
      // Get all tabs
      const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });

      if (tabs.length > 0) {
        const activeTab = tabs[0];

        // Check if the active tab is a new tab page
        if (activeTab.url === 'chrome://newtab/' || activeTab.url?.includes('newtab.html')) {
          // Send message to the new tab page to focus search
          await browserAPI.runtime.sendMessage({
            type: 'FOCUS_SEARCH'
          });
        }
      }
    } catch (error) {
      console.error('Failed to focus search input:', error);
    }
  }

  private async toggleEditMode(): Promise<void> {
    try {
      // Get all tabs
      const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });

      if (tabs.length > 0) {
        const activeTab = tabs[0];

        // Check if the active tab is a new tab page
        if (activeTab.url === 'chrome://newtab/' || activeTab.url?.includes('newtab.html')) {
          // Send message to the new tab page to toggle edit mode
          await browserAPI.runtime.sendMessage({
            type: 'TOGGLE_EDIT_MODE'
          });
        }
      }
    } catch (error) {
      console.error('Failed to toggle edit mode:', error);
    }
  }

  private handleMessage(message: any, sender: any, sendResponse: any): void {
    switch (message.type) {
      case 'GET_BOOKMARKS':
        this.handleGetBookmarks(sendResponse);
        return true; // Keep message channel open for async response
      
      case 'PING':
        sendResponse({ status: 'pong' });
        break;
        
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  private async handleGetBookmarks(sendResponse: any): Promise<void> {
    try {
      const bookmarks = await browserAPI.bookmarks.getTree();
      sendResponse({ success: true, data: bookmarks });
    } catch (error) {
      console.error('Failed to get bookmarks:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
}

// Initialize the service worker
new ServiceWorker();
