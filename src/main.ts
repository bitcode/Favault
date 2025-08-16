import App from './App.svelte';

console.log('🦁 FaVault extension starting with enhanced drag-drop...');

const app = new App({
  target: document.getElementById('app')!,
});

// Expose debug function immediately
(window as any).debugGlobalScope = () => {
  console.log('🔍 Debugging Global Scope for Enhanced Drag-Drop...');

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
    const obj = (window as any)[objName];
    const type = typeof obj;
    const available = type !== 'undefined';

    console.log(`${available ? '✅' : '❌'} ${objName}: ${type}`);
  });

  const appElement = document.querySelector('.app');
  const folderContainers = document.querySelectorAll('.folder-container');

  console.log(`App element: ${appElement ? '✅ Found' : '❌ Not found'}`);
  console.log(`Folder containers: ${folderContainers.length} found`);
};

console.log('🔧 Debug function available: debugGlobalScope()');

export default app;
