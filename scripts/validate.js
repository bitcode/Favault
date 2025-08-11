import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Validation script to check project structure and files
function validateProject() {
  console.log('🔍 Validating FaVault Extension Project...\n');
  
  let errors = 0;
  let warnings = 0;
  
  // Required files
  const requiredFiles = [
    'package.json',
    'vite.config.js',
    'tsconfig.json',
    'svelte.config.js',
    'src/App.svelte',
    'src/main.ts',
    'src/newtab.html',
    'src/service-worker.ts',
    'src/lib/api.ts',
    'src/lib/bookmarks.ts',
    'src/lib/stores.ts',
    'src/lib/SearchBar.svelte',
    'src/lib/BookmarkFolder.svelte',
    'src/lib/BookmarkItem.svelte'
  ];
  
  // Required manifest files
  const manifestFiles = [
    'manifests/manifest-chrome.json',
    'manifests/manifest-firefox.json',
    'manifests/manifest-safari.json',
    'manifests/manifest-edge.json'
  ];
  
  // Required icon files
  const iconFiles = [
    'icons/icon16.png',
    'icons/icon32.png',
    'icons/icon48.png',
    'icons/icon128.png'
  ];
  
  // Check required files
  console.log('📁 Checking required files...');
  requiredFiles.forEach(file => {
    if (existsSync(file)) {
      console.log(`✅ ${file}`);
    } else {
      console.log(`❌ Missing: ${file}`);
      errors++;
    }
  });
  
  // Check manifest files
  console.log('\n📋 Checking manifest files...');
  manifestFiles.forEach(file => {
    if (existsSync(file)) {
      console.log(`✅ ${file}`);
      
      // Validate manifest structure
      try {
        const manifest = JSON.parse(readFileSync(file, 'utf8'));
        
        // Check required fields
        const requiredFields = ['name', 'version', 'description', 'permissions', 'chrome_url_overrides'];
        const missingFields = requiredFields.filter(field => !manifest[field]);
        
        if (missingFields.length > 0) {
          console.log(`⚠️  ${file} missing fields: ${missingFields.join(', ')}`);
          warnings++;
        }
        
        // Check permissions
        if (!manifest.permissions || !manifest.permissions.includes('bookmarks')) {
          console.log(`⚠️  ${file} missing 'bookmarks' permission`);
          warnings++;
        }
        
        // Check new tab override
        if (!manifest.chrome_url_overrides || !manifest.chrome_url_overrides.newtab) {
          console.log(`⚠️  ${file} missing new tab override`);
          warnings++;
        }
        
      } catch (error) {
        console.log(`❌ ${file} is not valid JSON: ${error.message}`);
        errors++;
      }
    } else {
      console.log(`❌ Missing: ${file}`);
      errors++;
    }
  });
  
  // Check icon files
  console.log('\n🎨 Checking icon files...');
  iconFiles.forEach(file => {
    if (existsSync(file)) {
      console.log(`✅ ${file}`);
    } else {
      console.log(`⚠️  Missing: ${file} (run 'npm run create-icons')`);
      warnings++;
    }
  });
  
  // Check package.json structure
  console.log('\n📦 Checking package.json...');
  if (existsSync('package.json')) {
    try {
      const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
      
      // Check dependencies
      const requiredDeps = ['webextension-polyfill'];
      const requiredDevDeps = ['@svelte/vite-plugin-svelte', 'svelte', 'typescript', 'vite'];
      
      requiredDeps.forEach(dep => {
        if (!pkg.dependencies || !pkg.dependencies[dep]) {
          console.log(`⚠️  Missing dependency: ${dep}`);
          warnings++;
        } else {
          console.log(`✅ Dependency: ${dep}`);
        }
      });
      
      requiredDevDeps.forEach(dep => {
        if (!pkg.devDependencies || !pkg.devDependencies[dep]) {
          console.log(`⚠️  Missing dev dependency: ${dep}`);
          warnings++;
        } else {
          console.log(`✅ Dev dependency: ${dep}`);
        }
      });
      
      // Check scripts
      const requiredScripts = ['build:chrome', 'build:firefox', 'build:safari', 'build:edge'];
      requiredScripts.forEach(script => {
        if (!pkg.scripts || !pkg.scripts[script]) {
          console.log(`⚠️  Missing script: ${script}`);
          warnings++;
        } else {
          console.log(`✅ Script: ${script}`);
        }
      });
      
    } catch (error) {
      console.log(`❌ package.json is not valid JSON: ${error.message}`);
      errors++;
    }
  }
  
  // Summary
  console.log('\n📊 Validation Summary:');
  console.log(`✅ Errors: ${errors}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  
  if (errors === 0 && warnings === 0) {
    console.log('\n🎉 Project validation passed! Ready for development.');
  } else if (errors === 0) {
    console.log('\n✨ Project structure is valid with minor warnings.');
  } else {
    console.log('\n🚨 Project has errors that need to be fixed.');
    process.exit(1);
  }
}

validateProject();
