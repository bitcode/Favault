import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

// Create placeholder SVG icons and convert to PNG if needed
function createPlaceholderIcons() {
  const iconSizes = [16, 32, 48, 128];

  if (!existsSync('icons')) {
    mkdirSync('icons', { recursive: true });
  }

  // Create a simple SVG icon
  const svgIcon = `
    <svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="20" fill="url(#grad)"/>
      <text x="64" y="80" font-family="Arial, sans-serif" font-size="48" font-weight="bold"
            text-anchor="middle" fill="white">FV</text>
    </svg>
  `;

  // Save SVG version
  writeFileSync('icons/icon.svg', svgIcon.trim());
  console.log('Created SVG icon template');

  // For now, just create a note about icons
  const iconNote = `
# Icon Placeholder Files

This extension needs icon files in PNG format:
${iconSizes.map(size => `- icon${size}.png (${size}x${size} pixels)`).join('\n')}

The SVG template (icon.svg) can be converted to PNG files using tools like:
- Online converters
- ImageMagick: convert icon.svg -resize 16x16 icon16.png
- Inkscape: inkscape icon.svg --export-png=icon16.png --export-width=16

For production, replace with professionally designed icons.
  `;

  writeFileSync('icons/ICONS_NEEDED.txt', iconNote.trim());
}

// Build for specific browser
function buildForBrowser(browser) {
  console.log(`Building for ${browser}...`);
  
  try {
    execSync(`npm run build:${browser}`, { stdio: 'inherit' });
    console.log(`✅ Build completed for ${browser}`);
  } catch (error) {
    console.error(`❌ Build failed for ${browser}:`, error.message);
    process.exit(1);
  }
}

// Main build process
function main() {
  const browsers = process.argv.slice(2);
  
  if (browsers.length === 0) {
    console.log('Usage: node scripts/build.js [chrome|firefox|safari|edge|all]');
    process.exit(1);
  }
  
  // Create placeholder icons
  try {
    createPlaceholderIcons();
  } catch (error) {
    console.warn('Could not create placeholder icons:', error.message);
    console.log('Please create icon files manually in the icons/ directory');
  }
  
  if (browsers.includes('all')) {
    ['chrome', 'firefox', 'safari', 'edge', 'brave'].forEach(buildForBrowser);
  } else {
    browsers.forEach(buildForBrowser);
  }
  
  console.log('🎉 All builds completed successfully!');
}

main();
