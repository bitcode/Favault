// Debug script to check what's available in global scope
// Run this in the browser console to see what's actually loaded

console.log('🔍 Debugging Global Scope for Enhanced Drag-Drop...');
console.log('');

// Check if any enhanced drag-drop related objects exist
const checkObjects = [
  'EnhancedDragDropManager',
  'EnhancedDragDropTester', 
  'testEnhancedDragDrop',
  'quickTestDragDrop',
  'showDragDropDiagnostics',
  'initEnhancedDragDrop',
  'enableEnhancedEditMode',
  'disableEnhancedEditMode'
];

console.log('📊 Checking Global Objects:');
checkObjects.forEach(objName => {
  const obj = window[objName];
  const type = typeof obj;
  const available = type !== 'undefined';
  
  console.log(`${available ? '✅' : '❌'} ${objName}: ${type}`);
});

console.log('');
console.log('🔍 Checking for any drag-drop related objects:');
const allWindowProps = Object.getOwnPropertyNames(window);
const dragDropProps = allWindowProps.filter(prop => 
  prop.toLowerCase().includes('drag') || 
  prop.toLowerCase().includes('drop') ||
  prop.toLowerCase().includes('enhanced')
);

if (dragDropProps.length > 0) {
  console.log('Found drag-drop related properties:');
  dragDropProps.forEach(prop => {
    console.log(`  - ${prop}: ${typeof window[prop]}`);
  });
} else {
  console.log('❌ No drag-drop related properties found in global scope');
}

console.log('');
console.log('🔍 Checking for FaVault app elements:');
const appElement = document.querySelector('.app');
const folderContainers = document.querySelectorAll('.folder-container');
const editModeElements = document.querySelectorAll('[class*="edit"]');

console.log(`App element: ${appElement ? '✅ Found' : '❌ Not found'}`);
console.log(`Folder containers: ${folderContainers.length} found`);
console.log(`Edit mode elements: ${editModeElements.length} found`);

console.log('');
console.log('🔍 Checking console for initialization messages:');
console.log('Look for messages starting with "🦁" in the console above');

console.log('');
console.log('🔧 Manual Recovery Options:');
console.log('If the enhanced system is not loaded, you can try:');
console.log('1. Reload the extension page');
console.log('2. Check the browser console for error messages');
console.log('3. Try running the original console script from console-script-test.js');
