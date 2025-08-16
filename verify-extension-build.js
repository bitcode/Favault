#!/usr/bin/env node

/**
 * Verify extension build and provide specific recommendations
 */

import fs from 'fs';
import path from 'path';

function verifyExtensionBuild() {
  console.log('🔍 Verifying FaVault Extension Build');
  console.log('====================================');

  const extensionPath = path.resolve('./dist/chrome');
  const results = {
    timestamp: new Date().toISOString(),
    buildValid: true,
    issues: [],
    files: {},
    recommendations: []
  };

  // Check if extension directory exists
  if (!fs.existsSync(extensionPath)) {
    results.buildValid = false;
    results.issues.push({
      type: 'missing_directory',
      severity: 'critical',
      message: 'Extension build directory not found',
      fix: 'Run "npm run build:chrome" to build the extension'
    });
    console.log('❌ Extension build directory not found');
    return results;
  }

  console.log('✅ Extension build directory found');

  // Check required files
  const requiredFiles = [
    'manifest.json',
    'newtab.html',
    'newtab.js',
    'newtab.css',
    'service-worker.js'
  ];

  console.log('\n📁 Checking required files:');
  requiredFiles.forEach(file => {
    const filePath = path.join(extensionPath, file);
    const exists = fs.existsSync(filePath);
    
    results.files[file] = {
      exists,
      path: filePath,
      size: exists ? fs.statSync(filePath).size : 0
    };
    
    console.log(`  ${exists ? '✅' : '❌'} ${file} ${exists ? `(${results.files[file].size} bytes)` : '(missing)'}`);
    
    if (!exists) {
      results.buildValid = false;
      results.issues.push({
        type: 'missing_file',
        severity: 'critical',
        message: `Required file missing: ${file}`,
        fix: 'Rebuild the extension with "npm run build:chrome"'
      });
    }
  });

  // Check icon files
  const iconFiles = ['icon16.png', 'icon32.png', 'icon48.png', 'icon128.png'];
  console.log('\n🎨 Checking icon files:');
  
  iconFiles.forEach(icon => {
    const iconPath = path.join(extensionPath, 'icons', icon);
    const exists = fs.existsSync(iconPath);
    
    results.files[`icons/${icon}`] = {
      exists,
      path: iconPath,
      size: exists ? fs.statSync(iconPath).size : 0
    };
    
    console.log(`  ${exists ? '✅' : '❌'} icons/${icon} ${exists ? `(${results.files[`icons/${icon}`].size} bytes)` : '(missing)'}`);
    
    if (!exists) {
      results.issues.push({
        type: 'missing_icon',
        severity: 'medium',
        message: `Icon file missing: ${icon}`,
        fix: 'Ensure icon files are copied during build process'
      });
    }
  });

  // Validate manifest.json
  console.log('\n📋 Validating manifest.json:');
  try {
    const manifestPath = path.join(extensionPath, 'manifest.json');
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);
    
    // Check required manifest fields
    const requiredFields = ['manifest_version', 'name', 'version', 'permissions'];
    requiredFields.forEach(field => {
      if (manifest[field]) {
        console.log(`  ✅ ${field}: ${Array.isArray(manifest[field]) ? manifest[field].join(', ') : manifest[field]}`);
      } else {
        console.log(`  ❌ ${field}: missing`);
        results.buildValid = false;
        results.issues.push({
          type: 'invalid_manifest',
          severity: 'critical',
          message: `Manifest missing required field: ${field}`,
          fix: 'Fix manifest.json structure'
        });
      }
    });
    
    // Check chrome_url_overrides
    if (manifest.chrome_url_overrides && manifest.chrome_url_overrides.newtab) {
      console.log(`  ✅ chrome_url_overrides.newtab: ${manifest.chrome_url_overrides.newtab}`);
    } else {
      console.log('  ❌ chrome_url_overrides.newtab: missing');
      results.buildValid = false;
      results.issues.push({
        type: 'invalid_manifest',
        severity: 'critical',
        message: 'Manifest missing chrome_url_overrides.newtab',
        fix: 'Add chrome_url_overrides.newtab to manifest.json'
      });
    }
    
    // Check background service worker
    if (manifest.background && manifest.background.service_worker) {
      console.log(`  ✅ background.service_worker: ${manifest.background.service_worker}`);
    } else {
      console.log('  ❌ background.service_worker: missing');
      results.issues.push({
        type: 'invalid_manifest',
        severity: 'medium',
        message: 'Manifest missing background.service_worker',
        fix: 'Add background.service_worker to manifest.json'
      });
    }
    
  } catch (error) {
    console.log(`  ❌ Manifest validation failed: ${error.message}`);
    results.buildValid = false;
    results.issues.push({
      type: 'invalid_manifest',
      severity: 'critical',
      message: `Manifest JSON parsing failed: ${error.message}`,
      fix: 'Fix JSON syntax in manifest.json'
    });
  }

  // Check newtab.html structure
  console.log('\n🌐 Validating newtab.html:');
  try {
    const htmlPath = path.join(extensionPath, 'newtab.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    
    // Check for required elements
    const hasAppDiv = htmlContent.includes('id="app"');
    const hasNewtabJs = htmlContent.includes('newtab.js');
    const hasNewtabCss = htmlContent.includes('newtab.css');
    
    console.log(`  ${hasAppDiv ? '✅' : '❌'} App container div (id="app")`);
    console.log(`  ${hasNewtabJs ? '✅' : '❌'} newtab.js script reference`);
    console.log(`  ${hasNewtabCss ? '✅' : '❌'} newtab.css stylesheet reference`);
    
    if (!hasAppDiv) {
      results.issues.push({
        type: 'invalid_html',
        severity: 'high',
        message: 'newtab.html missing app container div with id="app"',
        fix: 'Add <div id="app"></div> to newtab.html'
      });
    }
    
    if (!hasNewtabJs) {
      results.issues.push({
        type: 'invalid_html',
        severity: 'critical',
        message: 'newtab.html missing newtab.js script reference',
        fix: 'Add <script type="module" src="newtab.js"></script> to newtab.html'
      });
    }
    
  } catch (error) {
    console.log(`  ❌ HTML validation failed: ${error.message}`);
    results.issues.push({
      type: 'invalid_html',
      severity: 'critical',
      message: `newtab.html reading failed: ${error.message}`,
      fix: 'Ensure newtab.html exists and is readable'
    });
  }

  // Check JavaScript files
  console.log('\n📜 Checking JavaScript files:');
  const jsFiles = ['newtab.js', 'service-worker.js'];
  
  jsFiles.forEach(jsFile => {
    try {
      const jsPath = path.join(extensionPath, jsFile);
      const jsContent = fs.readFileSync(jsPath, 'utf8');
      const hasContent = jsContent.trim().length > 0;
      const isMinified = jsContent.includes('function') || jsContent.length > 100;
      
      console.log(`  ${hasContent ? '✅' : '❌'} ${jsFile} ${hasContent ? `(${jsContent.length} chars, ${isMinified ? 'minified' : 'source'})` : '(empty)'}`);
      
      if (!hasContent) {
        results.issues.push({
          type: 'empty_js',
          severity: 'critical',
          message: `JavaScript file is empty: ${jsFile}`,
          fix: 'Rebuild the extension to generate proper JavaScript files'
        });
      }
      
    } catch (error) {
      console.log(`  ❌ ${jsFile}: ${error.message}`);
      results.issues.push({
        type: 'invalid_js',
        severity: 'critical',
        message: `JavaScript file error: ${jsFile} - ${error.message}`,
        fix: 'Rebuild the extension to fix JavaScript files'
      });
    }
  });

  // Generate recommendations
  console.log('\n💡 Generating recommendations:');
  
  if (results.buildValid) {
    console.log('✅ Extension build appears valid');
    results.recommendations.push({
      priority: 'info',
      action: 'Extension build is valid and ready for testing',
      details: 'All required files are present and appear to be correctly structured'
    });
  } else {
    const criticalIssues = results.issues.filter(i => i.severity === 'critical');
    const highIssues = results.issues.filter(i => i.severity === 'high');
    
    if (criticalIssues.length > 0) {
      results.recommendations.push({
        priority: 'critical',
        action: 'Fix critical build issues immediately',
        details: criticalIssues.map(i => i.message),
        fixes: criticalIssues.map(i => i.fix)
      });
    }
    
    if (highIssues.length > 0) {
      results.recommendations.push({
        priority: 'high',
        action: 'Address high priority issues',
        details: highIssues.map(i => i.message),
        fixes: highIssues.map(i => i.fix)
      });
    }
  }

  // Display summary
  console.log('\n📊 Build Verification Summary:');
  console.log('==============================');
  console.log(`Status: ${results.buildValid ? '✅ VALID' : '❌ INVALID'}`);
  console.log(`Issues: ${results.issues.length}`);
  console.log(`Critical: ${results.issues.filter(i => i.severity === 'critical').length}`);
  console.log(`High: ${results.issues.filter(i => i.severity === 'high').length}`);
  console.log(`Medium: ${results.issues.filter(i => i.severity === 'medium').length}`);

  if (results.issues.length > 0) {
    console.log('\n🔧 Recommended Actions:');
    results.recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. [${rec.priority.toUpperCase()}] ${rec.action}`);
      if (rec.fixes) {
        rec.fixes.forEach(fix => {
          console.log(`   - ${fix}`);
        });
      }
    });
  }

  // Save results
  const resultsFile = path.join('./test-results', 'build-verification.json');
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`\n📄 Results saved: ${resultsFile}`);

  return results;
}

// Run verification
const results = verifyExtensionBuild();

if (results.buildValid) {
  console.log('\n🎉 Extension build verification completed successfully!');
  console.log('The extension is ready for testing and deployment.');
} else {
  console.log('\n⚠️ Extension build has issues that need to be addressed.');
  console.log('Please fix the identified issues and rebuild the extension.');
}

process.exit(results.buildValid ? 0 : 1);
