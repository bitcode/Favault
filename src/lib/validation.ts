// Validation utilities for bookmark editing

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface BookmarkValidationOptions {
  allowEmptyUrl?: boolean;
  maxTitleLength?: number;
  maxUrlLength?: number;
  checkUrlReachability?: boolean;
}

export class BookmarkValidator {
  private static readonly DEFAULT_OPTIONS: Required<BookmarkValidationOptions> = {
    allowEmptyUrl: true,
    maxTitleLength: 200,
    maxUrlLength: 2048,
    checkUrlReachability: false
  };

  /**
   * Validate bookmark title
   */
  static validateTitle(title: string, options: BookmarkValidationOptions = {}): ValidationResult {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if title is empty
    if (!title || !title.trim()) {
      errors.push('Title cannot be empty');
    }

    // Check title length
    if (title && title.length > opts.maxTitleLength) {
      errors.push(`Title cannot exceed ${opts.maxTitleLength} characters`);
    }

    // Check for potentially problematic characters
    if (title && /[<>\"'&]/.test(title)) {
      warnings.push('Title contains special characters that may cause display issues');
    }

    // Check for excessive whitespace
    if (title && title !== title.trim()) {
      warnings.push('Title has leading or trailing whitespace');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate bookmark URL
   */
  static validateUrl(url: string, options: BookmarkValidationOptions = {}): ValidationResult {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if URL is empty (may be allowed for folders)
    if (!url || !url.trim()) {
      if (!opts.allowEmptyUrl) {
        errors.push('URL cannot be empty');
      }
      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };
    }

    // Check URL length
    if (url.length > opts.maxUrlLength) {
      errors.push(`URL cannot exceed ${opts.maxUrlLength} characters`);
    }

    // Validate URL format
    try {
      const urlObj = new URL(url);
      
      // Check protocol
      if (!['http:', 'https:', 'ftp:', 'file:'].includes(urlObj.protocol)) {
        warnings.push(`Unusual protocol: ${urlObj.protocol}`);
      }

      // Check for localhost/private IPs
      if (urlObj.hostname === 'localhost' || 
          urlObj.hostname.startsWith('127.') ||
          urlObj.hostname.startsWith('192.168.') ||
          urlObj.hostname.startsWith('10.') ||
          /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(urlObj.hostname)) {
        warnings.push('URL points to a local/private address');
      }

      // Check for suspicious patterns
      if (urlObj.hostname.includes('..') || urlObj.pathname.includes('..')) {
        warnings.push('URL contains suspicious path traversal patterns');
      }

    } catch (error) {
      errors.push('Invalid URL format');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate complete bookmark data
   */
  static validateBookmark(
    title: string, 
    url: string, 
    options: BookmarkValidationOptions = {}
  ): ValidationResult {
    const titleResult = this.validateTitle(title, options);
    const urlResult = this.validateUrl(url, options);

    return {
      isValid: titleResult.isValid && urlResult.isValid,
      errors: [...titleResult.errors, ...urlResult.errors],
      warnings: [...titleResult.warnings, ...urlResult.warnings]
    };
  }

  /**
   * Check if URL is reachable (async validation)
   */
  static async checkUrlReachability(url: string, timeout: number = 5000): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!url || !url.trim()) {
      return { isValid: true, errors, warnings };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        mode: 'no-cors' // Avoid CORS issues
      });

      clearTimeout(timeoutId);

      if (!response.ok && response.status !== 0) { // status 0 is expected with no-cors
        warnings.push(`URL returned status ${response.status}`);
      }

    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          warnings.push('URL check timed out');
        } else {
          warnings.push('URL may not be reachable');
        }
      }
    }

    return {
      isValid: true, // Don't fail validation for reachability issues
      errors,
      warnings
    };
  }

  /**
   * Sanitize bookmark title
   */
  static sanitizeTitle(title: string): string {
    return title
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[<>\"'&]/g, '') // Remove problematic characters
      .substring(0, this.DEFAULT_OPTIONS.maxTitleLength);
  }

  /**
   * Sanitize bookmark URL
   */
  static sanitizeUrl(url: string): string {
    const trimmed = url.trim();
    
    if (!trimmed) return '';

    // Add protocol if missing
    if (!/^https?:\/\//i.test(trimmed)) {
      return `https://${trimmed}`;
    }

    return trimmed.substring(0, this.DEFAULT_OPTIONS.maxUrlLength);
  }

  /**
   * Get validation error message for display
   */
  static getErrorMessage(result: ValidationResult): string {
    if (result.isValid) return '';
    
    return result.errors.join('; ');
  }

  /**
   * Get validation warning message for display
   */
  static getWarningMessage(result: ValidationResult): string {
    if (result.warnings.length === 0) return '';
    
    return result.warnings.join('; ');
  }
}

// Utility function to create real-time validation
export function createRealTimeValidator(
  callback: (result: ValidationResult) => void,
  options: BookmarkValidationOptions = {}
) {
  let timeoutId: number | null = null;

  return {
    validateTitle: (title: string) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        const result = BookmarkValidator.validateTitle(title, options);
        callback(result);
      }, 300);
    },

    validateUrl: (url: string) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        const result = BookmarkValidator.validateUrl(url, options);
        callback(result);
      }, 300);
    },

    validateBookmark: (title: string, url: string) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        const result = BookmarkValidator.validateBookmark(title, url, options);
        callback(result);
      }, 300);
    },

    destroy: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    }
  };
}
