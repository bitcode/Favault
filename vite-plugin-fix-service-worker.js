// Vite plugin to fix service worker compatibility issues
// Wraps window references in checks to prevent errors in service worker context

export function fixServiceWorkerPlugin() {
  return {
    name: 'fix-service-worker',
    generateBundle(options, bundle) {
      // Find and fix the index.js file (logger module)
      for (const fileName in bundle) {
        const file = bundle[fileName];
        
        if (fileName === 'index.js' && file.type === 'chunk') {
          // Wrap window.dispatchEvent in a check
          file.code = file.code.replace(
            /window\.dispatchEvent\(([^)]+)\)/g,
            '(typeof window !== "undefined" && window.dispatchEvent($1))'
          );
          
          console.log('✅ Fixed window references in index.js for service worker compatibility');
        }
      }
    }
  };
}

