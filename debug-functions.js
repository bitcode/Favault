// Debug script to check function availability
// Run this in the browser console to diagnose the issue

console.log('🔍 DEBUGGING FUNCTION AVAILABILITY');
console.log('=' .repeat(50));

// Check if we're on the extension page
console.log('📍 Current location:', window.location.href);
console.log('📍 Protocol:', window.location.protocol);

// Check for the main functions
const expectedFunctions = [
  'runAllTests',
  'testMove', 
  'showState',
  'getTestResults',
  'clearTestResults',
  'testEnhancedDragDrop',
  'quickTestDragDrop',
  'showDragDropDiagnostics'
];

console.log('\n🔍 Checking expected functions:');
expectedFunctions.forEach(funcName => {
  const func = window[funcName];
  const type = typeof func;
  const available = type === 'function';
  console.log(`${available ? '✅' : '❌'} ${funcName}: ${type}`);
  
  if (available) {
    console.log(`   └─ Function source: ${func.toString().substring(0, 100)}...`);
  }
});

// Check for objects
const expectedObjects = [
  'EnhancedDragDropManager',
  'EnhancedDragDropTester',
  'testAutomation',
  'hotReload',
  'devDragDrop'
];

console.log('\n🔍 Checking expected objects:');
expectedObjects.forEach(objName => {
  const obj = window[objName];
  const type = typeof obj;
  const available = type !== 'undefined';
  console.log(`${available ? '✅' : '❌'} ${objName}: ${type}`);
});

// Check for any functions that contain 'test' or 'drag'
console.log('\n🔍 Searching for any test/drag related functions:');
const allProps = Object.getOwnPropertyNames(window);
const testRelated = allProps.filter(prop => 
  prop.toLowerCase().includes('test') || 
  prop.toLowerCase().includes('drag') ||
  prop.toLowerCase().includes('enhanced')
);

if (testRelated.length > 0) {
  testRelated.forEach(prop => {
    console.log(`🔍 Found: ${prop} (${typeof window[prop]})`);
  });
} else {
  console.log('❌ No test/drag related properties found');
}

// Check if the extension is properly loaded
console.log('\n🔍 Extension status:');
console.log('Chrome API available:', typeof chrome !== 'undefined');
console.log('Chrome bookmarks API:', typeof chrome?.bookmarks !== 'undefined');
console.log('Extension context:', typeof chrome?.runtime !== 'undefined');

// Check DOM elements
console.log('\n🔍 DOM elements:');
const app = document.querySelector('.app');
const folders = document.querySelectorAll('.folder-container');
console.log('App element:', app ? '✅ Found' : '❌ Not found');
console.log('Folder containers:', folders.length, 'found');

// Check for initialization messages in console
console.log('\n🔍 Looking for initialization messages...');
console.log('Check the console above for messages starting with:');
console.log('  - "🔧 Initializing development environment..."');
console.log('  - "✅ Development environment ready"');
console.log('  - "🔧 Global test functions exposed:"');

// Manual function exposure attempt
console.log('\n🔧 MANUAL FUNCTION EXPOSURE ATTEMPT:');

try {
  // Try to manually expose a simple test function
  window.manualTest = function() {
    console.log('✅ Manual test function works!');
    return 'Manual function successful';
  };
  
  console.log('✅ Manual function exposure successful');
  console.log('🧪 Try running: manualTest()');
  
} catch (error) {
  console.error('❌ Manual function exposure failed:', error);
}

// Check if we can access the test automation class directly
console.log('\n🔧 DIRECT CLASS ACCESS ATTEMPT:');

try {
  // Try to access the minified class names from the built code
  if (typeof window.xe !== 'undefined') {
    console.log('✅ Found TestAutomation class (minified as xe)');
    window.directRunAllTests = () => {
      console.log('🧪 Running tests via direct class access...');
      return window.xe.getInstance().runComprehensiveTests();
    };
    console.log('🧪 Try running: directRunAllTests()');
  } else {
    console.log('❌ TestAutomation class not found');
  }
} catch (error) {
  console.error('❌ Direct class access failed:', error);
}

console.log('\n' + '=' .repeat(50));
console.log('🔧 TROUBLESHOOTING STEPS:');
console.log('1. Check if you see initialization messages above');
console.log('2. Try running: manualTest()');
console.log('3. Try running: directRunAllTests()');
console.log('4. If nothing works, reload the page and run this script again');
console.log('5. Check browser console for any error messages');

// Set up a delayed check
setTimeout(() => {
  console.log('\n⏰ DELAYED CHECK (after 3 seconds):');
  const runAllTestsNow = window.runAllTests;
  console.log('runAllTests after delay:', typeof runAllTestsNow);
  
  if (typeof runAllTestsNow === 'function') {
    console.log('✅ runAllTests is now available! Try running it.');
  } else {
    console.log('❌ runAllTests still not available after delay');
  }
}, 3000);

console.log('\n🎯 This debug script will check again in 3 seconds...');
