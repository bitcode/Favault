/**
 * Enhanced Favicon Utility
 * Provides robust favicon loading with multiple fallback strategies and proper error handling
 */

export interface FaviconConfig {
  size?: number;
  timeout?: number;
  fallbackToGeneric?: boolean;
  skipLocalUrls?: boolean;
  skipSpecialUrls?: boolean;
}

export class FaviconManager {
  private static cache = new Map<string, string>();
  private static failedUrls = new Set<string>();
  
  /**
   * Get favicon URL with intelligent fallback strategies
   */
  static getFaviconUrl(url: string, config: FaviconConfig = {}): string {
    const {
      size = 32,
      fallbackToGeneric = true,
      skipLocalUrls = true,
      skipSpecialUrls = true
    } = config;

    // Validate input URL
    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      return '';
    }

    // Check cache first
    if (this.cache.has(url)) {
      return this.cache.get(url)!;
    }

    // Check if this URL has already failed
    if (this.failedUrls.has(url)) {
      return '';
    }

    try {
      // More robust URL validation
      if (!this.isValidUrl(url)) {
        this.cache.set(url, '');
        return '';
      }

      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      
      // Skip special protocols
      if (skipSpecialUrls && this.isSpecialProtocol(url)) {
        this.cache.set(url, '');
        return '';
      }
      
      // Skip local URLs
      if (skipLocalUrls && this.isLocalUrl(domain)) {
        this.cache.set(url, '');
        return '';
      }
      
      // Skip URLs with problematic query parameters that can cause loading issues
      if (this.hasProblematicQueryParams(url)) {
        // Try to clean the URL for favicon generation
        const cleanedUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
        const faviconUrl = this.generateFaviconUrl(cleanedUrl, domain, size);
        this.cache.set(url, faviconUrl);
        return faviconUrl;
      }
      
      // Generate favicon URL based on environment
      const faviconUrl = this.generateFaviconUrl(url, domain, size);
      this.cache.set(url, faviconUrl);
      return faviconUrl;
      
    } catch (error) {
      // Silently fail for favicon URL issues - don't spam console
      this.cache.set(url, '');
      return '';
    }
  }

  /**
   * Handle favicon loading error with cascading fallbacks
   */
  static handleFaviconError(img: HTMLImageElement, originalUrl: string): boolean {
    const currentSrc = img.src;
    
    // Silently try fallback strategies in order (no console spam)
    const fallbacks = this.getFallbackStrategies(originalUrl, currentSrc);
    
    for (const fallback of fallbacks) {
      if (fallback && fallback !== currentSrc && !this.failedUrls.has(fallback)) {
        img.src = fallback;
        return true; // Give fallback a chance
      }
    }
    
    // All fallbacks exhausted - silently hide the image
    this.markUrlAsFailed(originalUrl);
    this.markUrlAsFailed(currentSrc);
    img.style.display = 'none';
    return false;
  }

  /**
   * Preload favicon to check if it exists - DISABLED FOR PERFORMANCE
   */
  static async preloadFavicon(url: string, config: FaviconConfig = {}): Promise<boolean> {
    // PERFORMANCE FIX: Disable preloading to reduce network overhead
    return false;
  }

  /**
   * Clear cache and failed URLs (for testing or reset)
   */
  static clearCache(): void {
    this.cache.clear();
    this.failedUrls.clear();
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { cached: number; failed: number } {
    return {
      cached: this.cache.size,
      failed: this.failedUrls.size
    };
  }

  private static isSpecialProtocol(url: string): boolean {
    return url.startsWith('chrome://') ||
           url.startsWith('chrome-extension://') ||
           url.startsWith('moz-extension://') ||
           url.startsWith('safari-web-extension://') ||
           url.startsWith('ms-browser-extension://') ||
           url.startsWith('file://') ||
           url.startsWith('data:') ||
           url.startsWith('javascript:') ||
           url.startsWith('blob:');
  }

  private static isLocalUrl(domain: string): boolean {
    return domain === 'localhost' ||
           domain.startsWith('127.') ||
           domain.startsWith('192.168.') ||
           domain.startsWith('10.') ||
           domain.endsWith('.local') ||
           domain === '::1' ||
           /^192\.168\.\d+\.\d+$/.test(domain) ||
           /^10\.\d+\.\d+\.\d+$/.test(domain);
  }

  /**
   * Validate if a URL is properly formatted and safe for favicon usage
   */
  private static isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      
      // Must have a valid hostname
      if (!urlObj.hostname || urlObj.hostname.length === 0) {
        return false;
      }
      
      // Must be http or https
      if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
        return false;
      }
      
      // Check for obviously malformed URLs
      if (url.includes('..') || url.includes('\n') || url.includes('\r')) {
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if URL has query parameters that might cause loading issues
   */
  private static hasProblematicQueryParams(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const params = urlObj.searchParams;
      
      // Check for problematic parameters
      const problematicParams = ['callback', 'jsonp', 'redirect', '_', 'cache_bust', 'timestamp'];
      
      for (const param of problematicParams) {
        if (params.has(param)) {
          return true;
        }
      }
      
      // Check if query string is excessively long (might indicate problems)
      if (urlObj.search && urlObj.search.length > 200) {
        return true;
      }
      
      return false;
    } catch {
      return false;
    }
  }

  private static generateFaviconUrl(originalUrl: string, domain: string, size: number): string {
    // Strategy 1: Use Chrome's built-in favicon API (most reliable in extensions)
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      return `chrome://favicon/${originalUrl}`;
    }
    
    // Strategy 2: Use Google's favicon service (reliable fallback)
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
  }

  private static getFallbackStrategies(originalUrl: string, currentSrc: string): string[] {
    const fallbacks: string[] = [];
    
    try {
      const domain = new URL(originalUrl).hostname;
      
      if (currentSrc.includes('chrome://favicon/')) {
        // If Chrome favicon failed, try Google's service
        fallbacks.push(`https://www.google.com/s2/favicons?domain=${domain}&sz=32`);
        fallbacks.push(`https://www.google.com/s2/favicons?domain=${domain}&sz=16`);
      } else if (currentSrc.includes('google.com/s2/favicons')) {
        // If Google's service failed, try direct favicon.ico
        fallbacks.push(`https://${domain}/favicon.ico`);
        fallbacks.push(`https://${domain}/apple-touch-icon.png`);
      } else if (currentSrc.includes('/favicon.ico')) {
        // If direct favicon.ico failed, try other common locations
        fallbacks.push(`https://${domain}/apple-touch-icon.png`);
        fallbacks.push(`https://${domain}/icon.png`);
      }
    } catch (error) {
      // Silently handle errors in fallback generation
    }
    
    return fallbacks.filter(Boolean);
  }

  private static markUrlAsFailed(url: string): void {
    this.failedUrls.add(url);
    
    // Prevent memory leaks by limiting failed URL cache size
    if (this.failedUrls.size > 1000) {
      const oldestUrls = Array.from(this.failedUrls).slice(0, 500);
      oldestUrls.forEach(oldUrl => this.failedUrls.delete(oldUrl));
    }
  }
}

/**
 * Enhanced error filtering for console logs
 */
export class FaviconErrorFilter {
  private static faviconErrorPatterns = [
    /Failed to load resource.*favicon/i,
    /favicon.*404/i,
    /net::ERR_.*favicon/i,
    /chrome:\/\/favicon\/.*404/i,
    /google\.com\/s2\/favicons.*404/i,
    /favicon\.ico.*404/i,
    /apple-touch-icon.*404/i
  ];

  /**
   * Check if an error message is favicon-related
   */
  static isFaviconError(message: string): boolean {
    return this.faviconErrorPatterns.some(pattern => pattern.test(message));
  }

  /**
   * Filter out favicon errors from error array
   */
  static filterFaviconErrors(errors: string[]): string[] {
    return errors.filter(error => !this.isFaviconError(error));
  }

  /**
   * Count favicon errors
   */
  static countFaviconErrors(errors: string[]): number {
    return errors.filter(error => this.isFaviconError(error)).length;
  }
}