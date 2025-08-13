// Direct debug injection script for Brave browser testing
// This script can be copy-pasted directly into the browser console

console.log('🦁 Injecting Brave Debug Functions...');

// Brave detection function
function detectBrave() {
  const braveAPI = navigator.brave;
  let isBraveResult = false;
  
  // Try to call the isBrave function
  if (braveAPI && typeof braveAPI.isBrave === 'function') {
    try {
      isBraveResult = braveAPI.isBrave();
    } catch (e) {
      console.log('Error calling brave.isBrave():', e);
    }
  }

  const details = {
    userAgent: navigator.userAgent,
    braveAPI: !!braveAPI,
    braveIsBraveFunction: !!(braveAPI && typeof braveAPI.isBrave === 'function'),
    braveIsBraveResult: isBraveResult,
    windowBrave: 'brave' in window,
    userAgentContainsBrave: navigator.userAgent.includes('Brave'),
    chromeVersion: navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || null
  };

  let confidence = 0;
  
  // Check various indicators with proper scoring
  if (details.braveAPI) confidence += 30;
  if (details.braveIsBraveFunction) confidence += 20;
  if (details.braveIsBraveResult) confidence += 40;
  if (details.windowBrave) confidence += 10;
  if (details.userAgentContainsBrave) confidence += 20;

  const isBrave = confidence >= 40;

  return { isBrave, confidence, details };
}

// Test drag-drop function
function testBraveDrag() {
  console.log('🦁 Testing Brave Drag-Drop...');
  const detection = detectBrave();
  console.log('🦁 Brave Detection Result:', detection);
  
  if (detection.isBrave) {
    console.log('🦁 Brave browser confirmed! Drag-drop should use Brave-specific manager.');
  } else {
    console.log('🦁 Not Brave browser. Using standard drag-drop manager.');
  }
  
  // Test draggable attribute
  const testDiv = document.createElement('div');
  testDiv.style.position = 'absolute';
  testDiv.style.top = '-1000px';
  testDiv.textContent = 'Test';
  document.body.appendChild(testDiv);
  
  console.log('🦁 Testing draggable attribute...');
  console.log('Initial draggable:', testDiv.draggable);
  
  testDiv.draggable = true;
  console.log('After setting draggable=true:', testDiv.draggable);
  console.log('Has draggable attribute:', testDiv.hasAttribute('draggable'));
  console.log('Draggable attribute value:', testDiv.getAttribute('draggable'));
  
  document.body.removeChild(testDiv);
  
  return detection;
}

// Show debug overlay function
function showBraveDebug() {
  const detection = detectBrave();
  
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

  overlay.innerHTML = `
    <h3>🦁 Brave Debug Info</h3>
    <p><strong>Browser:</strong> ${detection.isBrave ? 'Brave' : 'Other'} (${detection.confidence}% confidence)</p>
    <p><strong>Brave API:</strong> ${detection.details.braveAPI ? '✅' : '❌'}</p>
    <p><strong>isBrave Function:</strong> ${detection.details.braveIsBraveFunction ? '✅' : '❌'}</p>
    <p><strong>isBrave Result:</strong> ${detection.details.braveIsBraveResult ? '✅' : '❌'}</p>
    <p><strong>User Agent:</strong> ${detection.details.userAgentContainsBrave ? '✅ Contains Brave' : '❌ No Brave'}</p>
    <p><strong>Chrome Version:</strong> ${detection.details.chromeVersion || 'Unknown'}</p>
    <div style="margin-top: 10px;">
      <strong>Edit Mode Elements:</strong><br>
      <span>Edit mode active: ${document.body.classList.contains('drag-enabled') ? '✅' : '❌'}</span><br>
      <span>App edit mode: ${document.querySelector('.app.edit-mode') ? '✅' : '❌'}</span><br>
      <span>Draggable items: ${document.querySelectorAll('[draggable="true"]').length}</span>
    </div>
    <button onclick="this.parentElement.remove()" style="margin-top: 10px; padding: 5px 10px; background: #333; color: white; border: 1px solid #666; border-radius: 4px; cursor: pointer;">Close</button>
  `;

  // Remove existing overlay if present
  const existing = document.getElementById('brave-debug-overlay');
  if (existing) existing.remove();

  document.body.appendChild(overlay);
  return overlay;
}

// Test edit mode function
function testEditMode() {
  console.log('🦁 Testing Edit Mode...');
  
  const editModeActive = document.body.classList.contains('drag-enabled') || 
                        document.querySelector('.app.edit-mode') !== null;
  
  console.log('Edit mode active:', editModeActive);
  console.log('Body classes:', document.body.className);
  console.log('App element classes:', document.querySelector('.app')?.className || 'App not found');
  console.log('Draggable elements:', document.querySelectorAll('[draggable="true"]').length);
  console.log('Elements with draggable-item class:', document.querySelectorAll('.draggable-item').length);
  
  if (!editModeActive) {
    console.log('🦁 Edit mode not active. Try pressing Ctrl+E or clicking the Edit button.');
  }
  
  return {
    editModeActive,
    bodyClasses: document.body.className,
    appClasses: document.querySelector('.app')?.className,
    draggableElements: document.querySelectorAll('[draggable="true"]').length,
    draggableItems: document.querySelectorAll('.draggable-item').length
  };
}

// Expose functions globally
window.testBraveDrag = testBraveDrag;
window.showBraveDebug = showBraveDebug;
window.testEditMode = testEditMode;
window.detectBrave = detectBrave;

console.log('🦁 Debug functions injected successfully!');
console.log('🦁 Available functions:');
console.log('  - testBraveDrag() - Test Brave detection and drag-drop');
console.log('  - showBraveDebug() - Show debug overlay');
console.log('  - testEditMode() - Test edit mode state');
console.log('  - detectBrave() - Run Brave detection only');

// Auto-run basic test
console.log('🦁 Running automatic Brave detection...');
const autoDetection = detectBrave();
console.log('🦁 Auto-detection result:', autoDetection.isBrave ? 'BRAVE DETECTED' : 'NOT BRAVE');
