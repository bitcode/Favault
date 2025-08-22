// Extension Loading Diagnostics - Specialized tools for Chrome extension loading issues
// Provides actionable solutions for common extension loading problems

import { reportLoadingError, reportInitializationError, reportPermissionError } from './error-reporter';
import { getBrowserInfo, getExtensionContext } from './utils';

export interface LoadingDiagnostic {
  issue: string;
  detected: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  solutions: string[];
  technicalDetails?: any;
}

export interface LoadingDiagnosticsReport {
  timestamp: string;
  overallStatus: 'healthy' | 'issues' | 'critical';
  issues: LoadingDiagnostic[];
  quickFixes: string[];
  detailedSolutions: string[];
  systemInfo: {
    browser: ReturnType<typeof getBrowserInfo>;
    extension: ReturnType<typeof getExtensionContext>;
  };
}

export class ExtensionLoadingDiagnostics {
  /**
   * Run comprehensive loading diagnostics
   */
  static async runLoadingDiagnostics(): Promise<LoadingDiagnosticsReport> {
    console.log('🔍 Running Extension Loading Diagnostics...');
    
    const issues: LoadingDiagnostic[] = [];
    
    // Check for common loading issues
    issues.push(await this.checkExtensionContext());
    issues.push(await this.checkManifestIssues());
    issues.push(await this.checkPermissionIssues());
    issues.push(await this.checkFileLoadingIssues());
    issues.push(await this.checkAPIAvailability());
    issues.push(await this.checkServiceWorkerIssues());
    issues.push(await this.checkContentSecurityPolicy());
    issues.push(await this.checkBrowserCompatibility());
    
    // Determine overall status
    const criticalIssues = issues.filter(i => i.detected && i.severity === 'critical');
    const highIssues = issues.filter(i => i.detected && i.severity === 'high');
    
    let overallStatus: LoadingDiagnosticsReport['overallStatus'] = 'healthy';
    if (criticalIssues.length > 0) {
      overallStatus = 'critical';
    } else if (highIssues.length > 0 || issues.filter(i => i.detected).length > 2) {
      overallStatus = 'issues';
    }
    
    // Generate quick fixes and detailed solutions
    const detectedIssues = issues.filter(i => i.detected);
    const quickFixes = this.generateQuickFixes(detectedIssues);
    const detailedSolutions = this.generateDetailedSolutions(detectedIssues);
    
    return {
      timestamp: new Date().toISOString(),
      overallStatus,
      issues,
      quickFixes,
      detailedSolutions,
      systemInfo: {
        browser: getBrowserInfo(),
        extension: getExtensionContext()
      }
    };
  }

  /**
   * Check if extension is running in proper context
   */
  private static async checkExtensionContext(): Promise<LoadingDiagnostic> {
    const context = getExtensionContext();
    const detected = !context.isExtensionContext;
    
    if (detected) {
      reportLoadingError('Extension not running in proper context', {
        url: context.url,
        protocol: context.protocol
      });
    }
    
    return {
      issue: 'Extension Context',
      detected,
      severity: 'critical',
      description: detected 
        ? 'Extension is not running in a proper Chrome extension context'
        : 'Extension is running in proper Chrome extension context',
      solutions: detected ? [
        'Load the extension through chrome://extensions/',
        'Ensure the extension is properly installed',
        'Check if the extension files are in the correct location',
        'Verify the extension is enabled in Chrome'
      ] : [],
      technicalDetails: {
        url: context.url,
        protocol: context.protocol,
        extensionId: context.extensionId
      }
    };
  }

  /**
   * Check for manifest-related issues
   */
  private static async checkManifestIssues(): Promise<LoadingDiagnostic> {
    let detected = false;
    let technicalDetails: any = {};
    
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime) {
        detected = true;
        technicalDetails.error = 'Chrome runtime not available';
      } else {
        const manifest = chrome.runtime.getManifest();
        if (!manifest) {
          detected = true;
          technicalDetails.error = 'Manifest not accessible';
        } else {
          // Check for common manifest issues
          const requiredFields = ['name', 'version', 'manifest_version'];
          const missingFields = requiredFields.filter(field => !manifest[field]);
          
          if (missingFields.length > 0) {
            detected = true;
            technicalDetails.missingFields = missingFields;
          }
          
          // Check manifest version compatibility
          if (manifest.manifest_version !== 3 && manifest.manifest_version !== 2) {
            detected = true;
            technicalDetails.invalidManifestVersion = manifest.manifest_version;
          }
          
          technicalDetails.manifest = manifest;
        }
      }
    } catch (error) {
      detected = true;
      technicalDetails.error = error.message;
      
      reportLoadingError('Manifest access failed', { error: error.message });
    }
    
    return {
      issue: 'Manifest Issues',
      detected,
      severity: 'critical',
      description: detected 
        ? 'Problems detected with extension manifest'
        : 'Extension manifest is valid and accessible',
      solutions: detected ? [
        'Check manifest.json syntax and structure',
        'Ensure all required fields are present (name, version, manifest_version)',
        'Validate manifest.json using a JSON validator',
        'Check for proper manifest version (2 or 3)',
        'Reload the extension after fixing manifest issues'
      ] : [],
      technicalDetails
    };
  }

  /**
   * Check for permission-related issues
   */
  private static async checkPermissionIssues(): Promise<LoadingDiagnostic> {
    let detected = false;
    let technicalDetails: any = {};
    
    try {
      if (chrome?.runtime) {
        const manifest = chrome.runtime.getManifest();
        const declaredPermissions = manifest.permissions || [];
        
        // Check if required permissions are declared
        const requiredPermissions = ['bookmarks', 'storage'];
        const missingPermissions = requiredPermissions.filter(perm => 
          !declaredPermissions.includes(perm)
        );
        
        if (missingPermissions.length > 0) {
          detected = true;
          technicalDetails.missingPermissions = missingPermissions;
          
          missingPermissions.forEach(perm => {
            reportPermissionError(`Required permission not declared: ${perm}`, perm);
          });
        }
        
        // Check if APIs are actually available
        const apiTests = [
          { name: 'bookmarks', available: !!chrome.bookmarks },
          { name: 'storage', available: !!chrome.storage }
        ];
        
        const unavailableAPIs = apiTests.filter(test => 
          declaredPermissions.includes(test.name) && !test.available
        );
        
        if (unavailableAPIs.length > 0) {
          detected = true;
          technicalDetails.unavailableAPIs = unavailableAPIs.map(api => api.name);
        }
        
        technicalDetails.declaredPermissions = declaredPermissions;
        technicalDetails.apiAvailability = apiTests;
      }
    } catch (error) {
      detected = true;
      technicalDetails.error = error.message;
    }
    
    return {
      issue: 'Permission Issues',
      detected,
      severity: 'high',
      description: detected 
        ? 'Permission-related problems detected'
        : 'All required permissions are properly configured',
      solutions: detected ? [
        'Add missing permissions to manifest.json',
        'Ensure bookmarks and storage permissions are declared',
        'Reload the extension after updating permissions',
        'Check if user has granted required permissions',
        'Verify permissions in chrome://extensions/ details page'
      ] : [],
      technicalDetails
    };
  }

  /**
   * Check for file loading issues
   */
  private static async checkFileLoadingIssues(): Promise<LoadingDiagnostic> {
    let detected = false;
    let technicalDetails: any = {};
    
    try {
      // Check if critical files are accessible
      const criticalFiles = [
        'newtab.html',
        'service-worker.js'
      ];
      
      const fileTests = await Promise.allSettled(
        criticalFiles.map(async (file) => {
          try {
            const response = await fetch(chrome.runtime.getURL(file));
            return {
              file,
              status: response.status,
              accessible: response.ok
            };
          } catch (error) {
            return {
              file,
              status: 0,
              accessible: false,
              error: error.message
            };
          }
        })
      );
      
      const failedFiles = fileTests
        .map((result, index) => {
          if (result.status === 'fulfilled') {
            return result.value.accessible ? null : result.value;
          } else {
            return {
              file: criticalFiles[index],
              status: 0,
              accessible: false,
              error: result.reason?.message || 'Unknown error'
            };
          }
        })
        .filter(Boolean);
      
      if (failedFiles.length > 0) {
        detected = true;
        technicalDetails.failedFiles = failedFiles;
        
        reportLoadingError('Critical extension files not accessible', {
          failedFiles: failedFiles.map(f => f.file)
        });
      }
      
      technicalDetails.fileTests = fileTests.map(result => 
        result.status === 'fulfilled' ? result.value : { error: result.reason?.message }
      );
      
    } catch (error) {
      detected = true;
      technicalDetails.error = error.message;
    }
    
    return {
      issue: 'File Loading Issues',
      detected,
      severity: 'high',
      description: detected 
        ? 'Problems loading critical extension files'
        : 'All critical extension files are accessible',
      solutions: detected ? [
        'Check if all extension files are present in the build directory',
        'Verify file paths in manifest.json are correct',
        'Ensure files have proper permissions',
        'Check for build process errors',
        'Try rebuilding the extension'
      ] : [],
      technicalDetails
    };
  }

  /**
   * Check Chrome API availability
   */
  private static async checkAPIAvailability(): Promise<LoadingDiagnostic> {
    let detected = false;
    let technicalDetails: any = {};

    const requiredAPIs = [
      { name: 'chrome', api: typeof chrome !== 'undefined' },
      { name: 'chrome.runtime', api: !!chrome?.runtime },
      { name: 'chrome.bookmarks', api: !!chrome?.bookmarks },
      { name: 'chrome.storage', api: !!chrome?.storage }
    ];

    const unavailableAPIs = requiredAPIs.filter(api => !api.api);

    if (unavailableAPIs.length > 0) {
      detected = true;
      technicalDetails.unavailableAPIs = unavailableAPIs.map(api => api.name);

      unavailableAPIs.forEach(api => {
        reportLoadingError(`Chrome API not available: ${api.name}`, { api: api.name });
      });
    }

    technicalDetails.apiAvailability = requiredAPIs;

    return {
      issue: 'Chrome API Availability',
      detected,
      severity: 'critical',
      description: detected
        ? 'Required Chrome APIs are not available'
        : 'All required Chrome APIs are available',
      solutions: detected ? [
        'Ensure extension is running in Chrome browser',
        'Check if extension context is properly initialized',
        'Verify manifest permissions include required APIs',
        'Try reloading the extension',
        'Check Chrome version compatibility'
      ] : [],
      technicalDetails
    };
  }

  /**
   * Check service worker issues
   */
  private static async checkServiceWorkerIssues(): Promise<LoadingDiagnostic> {
    let detected = false;
    let technicalDetails: any = {};

    try {
      if (chrome?.runtime) {
        // Try to ping the service worker
        const response = await new Promise((resolve) => {
          const timeout = setTimeout(() => resolve(null), 5000);

          chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
            clearTimeout(timeout);
            resolve(response);
          });
        });

        if (!response) {
          detected = true;
          technicalDetails.issue = 'Service worker not responding';

          reportInitializationError('Service worker not responding to ping', {
            timeout: 5000
          });
        } else {
          technicalDetails.response = response;
        }
      } else {
        detected = true;
        technicalDetails.issue = 'Chrome runtime not available';
      }
    } catch (error) {
      detected = true;
      technicalDetails.error = error.message;

      reportInitializationError('Service worker communication failed', {
        error: error.message
      });
    }

    return {
      issue: 'Service Worker Issues',
      detected,
      severity: 'high',
      description: detected
        ? 'Service worker is not responding or has issues'
        : 'Service worker is active and responding',
      solutions: detected ? [
        'Check service worker console for errors in chrome://extensions/',
        'Verify service-worker.js file exists and is valid',
        'Try reloading the extension',
        'Check if service worker is registered in manifest.json',
        'Look for JavaScript errors in service worker'
      ] : [],
      technicalDetails
    };
  }

  /**
   * Check Content Security Policy issues
   */
  private static async checkContentSecurityPolicy(): Promise<LoadingDiagnostic> {
    let detected = false;
    let technicalDetails: any = {};

    try {
      // Check if we can create and execute dynamic content
      const testElement = document.createElement('div');
      testElement.innerHTML = '<span>CSP Test</span>';

      // Try to add inline styles (often blocked by CSP)
      try {
        testElement.style.cssText = 'color: red; display: none;';
        document.body.appendChild(testElement);
        document.body.removeChild(testElement);

        technicalDetails.inlineStylesAllowed = true;
      } catch (error) {
        detected = true;
        technicalDetails.inlineStylesBlocked = true;
        technicalDetails.inlineStylesError = error.message;
      }

      // Check if eval is available (often blocked by CSP)
      try {
        eval('1 + 1');
        technicalDetails.evalAllowed = true;
      } catch (error) {
        // This is actually good for security, but might indicate CSP restrictions
        technicalDetails.evalBlocked = true;
      }

      // Check manifest CSP settings
      if (chrome?.runtime) {
        const manifest = chrome.runtime.getManifest();
        if (manifest.content_security_policy) {
          technicalDetails.csp = manifest.content_security_policy;

          // Check for overly restrictive CSP
          const cspString = typeof manifest.content_security_policy === 'string'
            ? manifest.content_security_policy
            : JSON.stringify(manifest.content_security_policy);

          if (cspString.includes("'none'") && !cspString.includes("'unsafe-inline'")) {
            detected = true;
            technicalDetails.restrictiveCSP = true;
          }
        }
      }

    } catch (error) {
      detected = true;
      technicalDetails.error = error.message;
    }

    return {
      issue: 'Content Security Policy',
      detected,
      severity: 'medium',
      description: detected
        ? 'Content Security Policy may be causing issues'
        : 'Content Security Policy is properly configured',
      solutions: detected ? [
        'Review Content Security Policy in manifest.json',
        'Allow necessary script sources and styles',
        'Check browser console for CSP violation errors',
        'Consider using \'unsafe-inline\' for styles if needed',
        'Ensure all resources are loaded from allowed sources'
      ] : [],
      technicalDetails
    };
  }

  /**
   * Check browser compatibility
   */
  private static async checkBrowserCompatibility(): Promise<LoadingDiagnostic> {
    let detected = false;
    let technicalDetails: any = {};

    const browserInfo = getBrowserInfo();
    technicalDetails.browserInfo = browserInfo;

    // Check if running in Chrome
    const isChrome = browserInfo.userAgent.includes('Chrome') && !browserInfo.userAgent.includes('Edg');
    const isBrave = browserInfo.brave?.isBrave;
    const isEdge = browserInfo.userAgent.includes('Edg');

    if (!isChrome && !isBrave && !isEdge) {
      detected = true;
      technicalDetails.unsupportedBrowser = true;
      technicalDetails.detectedBrowser = browserInfo.userAgent;

      reportLoadingError('Extension running in unsupported browser', {
        userAgent: browserInfo.userAgent
      });
    }

    // Check Chrome version if available
    const chromeVersionMatch = browserInfo.userAgent.match(/Chrome\/(\d+)/);
    if (chromeVersionMatch) {
      const chromeVersion = parseInt(chromeVersionMatch[1]);
      technicalDetails.chromeVersion = chromeVersion;

      // Check if Chrome version is too old (minimum Chrome 88 for Manifest V3)
      if (chromeVersion < 88) {
        detected = true;
        technicalDetails.outdatedChrome = true;

        reportLoadingError('Chrome version too old for extension', {
          version: chromeVersion,
          minimumRequired: 88
        });
      }
    }

    return {
      issue: 'Browser Compatibility',
      detected,
      severity: detected && technicalDetails.unsupportedBrowser ? 'critical' : 'medium',
      description: detected
        ? 'Browser compatibility issues detected'
        : 'Browser is compatible with extension',
      solutions: detected ? [
        'Use Google Chrome, Microsoft Edge, or Brave browser',
        'Update Chrome to the latest version',
        'Check if browser supports Chrome extensions',
        'Verify manifest version compatibility with browser',
        'Consider using Manifest V2 for older browsers'
      ] : [],
      technicalDetails
    };
  }

  /**
   * Generate quick fixes based on detected issues
   */
  private static generateQuickFixes(issues: LoadingDiagnostic[]): string[] {
    const fixes: string[] = [];

    issues.forEach(issue => {
      switch (issue.issue) {
        case 'Extension Context':
          if (issue.detected) {
            fixes.push('🔄 Reload the extension in chrome://extensions/');
          }
          break;
        case 'Manifest Issues':
          if (issue.detected) {
            fixes.push('📝 Check and fix manifest.json syntax');
          }
          break;
        case 'Permission Issues':
          if (issue.detected) {
            fixes.push('🔐 Grant required permissions in extension settings');
          }
          break;
        case 'Service Worker Issues':
          if (issue.detected) {
            fixes.push('🔧 Check service worker console for errors');
          }
          break;
        case 'Chrome API Availability':
          if (issue.detected) {
            fixes.push('🌐 Ensure running in supported Chrome browser');
          }
          break;
      }
    });

    if (fixes.length === 0) {
      fixes.push('✅ No immediate fixes needed - extension appears healthy');
    }

    return fixes;
  }

  /**
   * Generate detailed solutions based on detected issues
   */
  private static generateDetailedSolutions(issues: LoadingDiagnostic[]): string[] {
    const solutions: string[] = [];

    const criticalIssues = issues.filter(i => i.severity === 'critical');
    const highIssues = issues.filter(i => i.severity === 'high');

    if (criticalIssues.length > 0) {
      solutions.push('🚨 CRITICAL ISSUES DETECTED - Address these immediately:');
      criticalIssues.forEach(issue => {
        solutions.push(`   • ${issue.issue}: ${issue.description}`);
        issue.solutions.forEach(solution => {
          solutions.push(`     - ${solution}`);
        });
      });
    }

    if (highIssues.length > 0) {
      solutions.push('⚠️ HIGH PRIORITY ISSUES - Address these soon:');
      highIssues.forEach(issue => {
        solutions.push(`   • ${issue.issue}: ${issue.description}`);
        issue.solutions.forEach(solution => {
          solutions.push(`     - ${solution}`);
        });
      });
    }

    // General troubleshooting steps
    solutions.push('🔧 GENERAL TROUBLESHOOTING STEPS:');
    solutions.push('   • Open chrome://extensions/ and check for error messages');
    solutions.push('   • Click "Errors" button next to the extension if available');
    solutions.push('   • Check browser console (F12) for JavaScript errors');
    solutions.push('   • Try disabling and re-enabling the extension');
    solutions.push('   • Clear browser cache and reload the extension');
    solutions.push('   • Check if extension works in incognito mode');

    return solutions;
  }

  /**
   * Export diagnostics report as formatted text
   */
  static async exportDiagnosticsReport(): Promise<string> {
    const report = await this.runLoadingDiagnostics();

    let output = `FaVault Extension Loading Diagnostics Report
Generated: ${new Date(report.timestamp).toLocaleString()}
Overall Status: ${report.overallStatus.toUpperCase()}
========================================

QUICK FIXES
-----------
${report.quickFixes.map(fix => fix).join('\n')}

DETECTED ISSUES
--------------
`;

    const detectedIssues = report.issues.filter(i => i.detected);
    if (detectedIssues.length === 0) {
      output += 'No issues detected - extension loading appears healthy!\n';
    } else {
      detectedIssues.forEach((issue, index) => {
        output += `
${index + 1}. ${issue.issue} [${issue.severity.toUpperCase()}]
   Description: ${issue.description}
   Solutions:
   ${issue.solutions.map(s => `   • ${s}`).join('\n')}

   Technical Details:
   ${JSON.stringify(issue.technicalDetails, null, 2).split('\n').map(line => `   ${line}`).join('\n')}
`;
      });
    }

    output += `

DETAILED SOLUTIONS
==================
${report.detailedSolutions.join('\n')}

SYSTEM INFORMATION
==================
Browser: ${report.systemInfo.browser.userAgent}
Platform: ${report.systemInfo.browser.platform}
Extension ID: ${report.systemInfo.extension.extensionId || 'N/A'}
Extension URL: ${report.systemInfo.extension.url}
Chrome APIs Available: ${JSON.stringify(report.systemInfo.browser.chrome, null, 2)}
`;

    return output;
  }
}
