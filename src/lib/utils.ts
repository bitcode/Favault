// Utility functions for the extension

/**
 * Debounce function to limit the rate of function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Generate a consistent color for a given string
 */
export function generateColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 75%)`;
}

/**
 * Extract domain from URL
 */
export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

/**
 * Generate favicon URL for a given website URL
 */
export function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return '';
  }
}

/**
 * Format date for display
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Truncate text to specified length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Check if user prefers dark mode
 */
export function prefersDarkMode(): boolean {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as any;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as any;
  if (typeof obj === 'object') {
    const clonedObj = {} as any;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
  return obj;
}

/**
 * Get browser information for error reporting
 */
export function getBrowserInfo(): {
  userAgent: string;
  vendor: string;
  platform: string;
  language: string;
  cookieEnabled: boolean;
  onLine: boolean;
  chrome?: any;
  brave?: any;
} {
  return {
    userAgent: navigator.userAgent,
    vendor: navigator.vendor,
    platform: navigator.platform,
    language: navigator.language,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    chrome: typeof chrome !== 'undefined' ? {
      runtime: !!chrome.runtime,
      bookmarks: !!chrome.bookmarks,
      storage: !!chrome.storage,
      version: chrome.runtime?.getManifest?.()?.version
    } : undefined,
    brave: typeof (navigator as any).brave !== 'undefined' ? {
      isBrave: typeof (navigator as any).brave.isBrave === 'function'
    } : undefined
  };
}

/**
 * Get extension context information
 */
export function getExtensionContext(): {
  url: string;
  protocol: string;
  isExtensionContext: boolean;
  extensionId?: string;
  manifestVersion?: number;
} {
  const url = window.location.href;
  const protocol = window.location.protocol;
  const isExtensionContext = protocol === 'chrome-extension:' || protocol === 'moz-extension:';

  let extensionId: string | undefined;
  let manifestVersion: number | undefined;

  if (isExtensionContext && typeof chrome !== 'undefined' && chrome.runtime) {
    try {
      extensionId = chrome.runtime.id;
      manifestVersion = chrome.runtime.getManifest?.()?.manifest_version;
    } catch (e) {
      // Ignore errors when getting extension info
    }
  }

  return {
    url,
    protocol,
    isExtensionContext,
    extensionId,
    manifestVersion
  };
}
