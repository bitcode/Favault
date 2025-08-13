// Brave browser debugging utilities for drag-and-drop functionality

export class BraveDebugger {
  /**
   * Comprehensive Brave browser detection
   */
  static detectBrave(): { isBrave: boolean; confidence: number; details: any } {
    const braveAPI = (navigator as any).brave;
    let isBraveResult = false;

    // Try to call the isBrave function
    if (braveAPI && typeof braveAPI.isBrave === 'function') {
      try {
        isBraveResult = braveAPI.isBrave();
      } catch (e) {
        console.log('Error calling brave.isBrave():', e);
      }
    }

    const details: any = {
      userAgent: navigator.userAgent,
      braveAPI: !!braveAPI,
      braveIsBraveFunction: !!(braveAPI && typeof braveAPI.isBrave === 'function'),
      braveIsBraveResult: isBraveResult,
      windowBrave: 'brave' in window,
      userAgentContainsBrave: navigator.userAgent.includes('Brave'),
      chromeVersion: this.getChromeVersion(),
      features: this.getBraveFeatures()
    };

    let confidence = 0;
    let isBrave = false;

    // Check various indicators with proper scoring
    if (details.braveAPI) confidence += 30;
    if (details.braveIsBraveFunction) confidence += 20;
    if (details.braveIsBraveResult) confidence += 40;
    if (details.windowBrave) confidence += 10;
    if (details.userAgentContainsBrave) confidence += 20;

    isBrave = confidence >= 40;

    return { isBrave, confidence, details };
  }

  /**
   * Get Chrome version from user agent
   */
  private static getChromeVersion(): string | null {
    const match = navigator.userAgent.match(/Chrome\/(\d+)/);
    return match ? match[1] : null;
  }

  /**
   * Check for Brave-specific features
   */
  private static getBraveFeatures(): any {
    return {
      shieldsAPI: !!(window as any).chrome?.braveShields,
      rewardsAPI: !!(window as any).chrome?.braveRewards,
      walletAPI: !!(window as any).chrome?.braveWallet,
      themeAPI: !!(window as any).chrome?.braveTheme,
      adblockAPI: !!(window as any).chrome?.adblock
    };
  }

  /**
   * Test drag-and-drop API availability
   */
  static testDragDropAPI(): any {
    const results = {
      dragEvents: {
        dragstart: 'ondragstart' in document.createElement('div'),
        dragend: 'ondragend' in document.createElement('div'),
        dragover: 'ondragover' in document.createElement('div'),
        drop: 'ondrop' in document.createElement('div')
      },
      dataTransfer: {
        available: typeof DataTransfer !== 'undefined',
        constructor: DataTransfer ? true : false,
        setData: DataTransfer ? 'setData' in DataTransfer.prototype : false,
        getData: DataTransfer ? 'getData' in DataTransfer.prototype : false
      },
      fileAPI: {
        available: typeof File !== 'undefined',
        fileList: typeof FileList !== 'undefined',
        fileReader: typeof FileReader !== 'undefined'
      },
      permissions: this.checkPermissions()
    };

    return results;
  }

  /**
   * Check extension permissions
   */
  private static checkPermissions(): any {
    const chrome = (window as any).chrome;
    if (!chrome || !chrome.runtime) {
      return { available: false, error: 'Chrome runtime not available' };
    }

    return {
      available: true,
      manifest: chrome.runtime.getManifest ? chrome.runtime.getManifest() : null,
      id: chrome.runtime.id || null
    };
  }

  /**
   * Test element draggable attribute behavior
   */
  static testDraggableBehavior(): any {
    const testElement = document.createElement('div');
    testElement.style.position = 'absolute';
    testElement.style.top = '-1000px';
    testElement.style.left = '-1000px';
    testElement.textContent = 'Test';
    document.body.appendChild(testElement);

    const results = {
      initialDraggable: testElement.draggable,
      canSetDraggable: false,
      draggableAfterSet: false,
      hasAttribute: false,
      attributeValue: null
    };

    try {
      // Test setting draggable
      testElement.draggable = true;
      results.canSetDraggable = true;
      results.draggableAfterSet = testElement.draggable;
      results.hasAttribute = testElement.hasAttribute('draggable');
      results.attributeValue = testElement.getAttribute('draggable');
    } catch (error) {
      results.canSetDraggable = false;
    }

    document.body.removeChild(testElement);
    return results;
  }

  /**
   * Test event listener attachment
   */
  static testEventListeners(): any {
    const testElement = document.createElement('div');
    const results = {
      addEventListener: false,
      dragstartListener: false,
      dragendListener: false,
      capturePhase: false,
      bubblePhase: false
    };

    try {
      // Test basic addEventListener
      const testHandler = () => {};
      testElement.addEventListener('click', testHandler);
      testElement.removeEventListener('click', testHandler);
      results.addEventListener = true;

      // Test drag event listeners
      testElement.addEventListener('dragstart', testHandler);
      testElement.removeEventListener('dragstart', testHandler);
      results.dragstartListener = true;

      testElement.addEventListener('dragend', testHandler);
      testElement.removeEventListener('dragend', testHandler);
      results.dragendListener = true;

      // Test capture phase
      testElement.addEventListener('dragstart', testHandler, true);
      testElement.removeEventListener('dragstart', testHandler, true);
      results.capturePhase = true;

      // Test bubble phase
      testElement.addEventListener('dragstart', testHandler, false);
      testElement.removeEventListener('dragstart', testHandler, false);
      results.bubblePhase = true;

    } catch (error) {
      console.error('Event listener test failed:', error);
    }

    return results;
  }

  /**
   * Test CSP restrictions
   */
  static testCSPRestrictions(): any {
    const results = {
      inlineStyles: false,
      inlineScripts: false,
      dynamicStyles: false,
      dataURIs: false
    };

    try {
      // Test inline styles
      const testDiv = document.createElement('div');
      testDiv.style.color = 'red';
      results.inlineStyles = testDiv.style.color === 'red';

      // Test dynamic style creation
      const style = document.createElement('style');
      style.textContent = '.test { color: blue; }';
      document.head.appendChild(style);
      results.dynamicStyles = true;
      document.head.removeChild(style);

    } catch (error) {
      console.error('CSP test failed:', error);
    }

    return results;
  }

  /**
   * Run comprehensive diagnostic
   */
  static runDiagnostic(): any {
    console.log('🦁 Running Brave Browser Drag-Drop Diagnostic...');

    const diagnostic = {
      timestamp: new Date().toISOString(),
      browser: this.detectBrave(),
      dragDropAPI: this.testDragDropAPI(),
      draggableBehavior: this.testDraggableBehavior(),
      eventListeners: this.testEventListeners(),
      cspRestrictions: this.testCSPRestrictions(),
      recommendations: []
    };

    // Generate recommendations
    if (diagnostic.browser.isBrave) {
      diagnostic.recommendations.push('🦁 Brave browser detected - using Brave-specific workarounds');
      
      if (!diagnostic.draggableBehavior.canSetDraggable) {
        diagnostic.recommendations.push('⚠️ Cannot set draggable attribute - may need user interaction');
      }
      
      if (!diagnostic.eventListeners.capturePhase) {
        diagnostic.recommendations.push('⚠️ Capture phase events not working - try bubble phase');
      }
      
      if (!diagnostic.cspRestrictions.dynamicStyles) {
        diagnostic.recommendations.push('⚠️ Dynamic styles blocked - use predefined CSS');
      }
    }

    console.log('🦁 Diagnostic Results:', diagnostic);
    return diagnostic;
  }

  /**
   * Create debug overlay
   */
  static createDebugOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.id = 'brave-debug-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 15px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      z-index: 10000;
      max-width: 400px;
      max-height: 300px;
      overflow-y: auto;
    `;

    const diagnostic = this.runDiagnostic();
    
    overlay.innerHTML = `
      <h3>🦁 Brave Debug Info</h3>
      <p><strong>Browser:</strong> ${diagnostic.browser.isBrave ? 'Brave' : 'Other'} (${diagnostic.browser.confidence}% confidence)</p>
      <p><strong>Draggable:</strong> ${diagnostic.draggableBehavior.canSetDraggable ? '✅' : '❌'}</p>
      <p><strong>Events:</strong> ${diagnostic.eventListeners.dragstartListener ? '✅' : '❌'}</p>
      <p><strong>CSP:</strong> ${diagnostic.cspRestrictions.dynamicStyles ? '✅' : '❌'}</p>
      <div style="margin-top: 10px;">
        <strong>Recommendations:</strong>
        ${diagnostic.recommendations.map(rec => `<div>• ${rec}</div>`).join('')}
      </div>
      <button onclick="this.parentElement.remove()" style="margin-top: 10px; padding: 5px 10px;">Close</button>
    `;

    document.body.appendChild(overlay);
    return overlay;
  }
}

// Expose BraveDebugger globally for console access
if (typeof window !== 'undefined') {
  (window as any).BraveDebugger = BraveDebugger;

  // Add simple test functions to window for easy console access
  (window as any).testBraveDrag = () => {
    console.log('🦁 Testing Brave Drag-Drop...');
    const detection = BraveDebugger.detectBrave();
    console.log('🦁 Brave Detection Result:', detection);

    if (detection.isBrave) {
      console.log('🦁 Brave browser confirmed! Drag-drop should use Brave-specific manager.');
    } else {
      console.log('🦁 Not Brave browser. Using standard drag-drop manager.');
    }

    return detection;
  };

  (window as any).showBraveDebug = () => {
    return BraveDebugger.createDebugOverlay();
  };

  // Auto-run diagnostic if in development mode
  if (window.location.hostname === 'localhost') {
    setTimeout(() => {
      console.log('🦁 Auto-running Brave diagnostic...');
      BraveDebugger.runDiagnostic();
      console.log('🦁 Use testBraveDrag() or showBraveDebug() in console for manual testing');
    }, 1000);
  }
}
