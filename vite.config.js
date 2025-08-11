import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath, URL } from 'node:url';

// Plugin to copy manifest, icons, and fix HTML location
function copyExtensionAssets(mode) {
  return {
    name: 'copy-extension-assets',
    writeBundle() {
      const outDir = `dist/${mode || 'chrome'}`;

      // Ensure output directory exists
      if (!existsSync(outDir)) {
        mkdirSync(outDir, { recursive: true });
      }

      // Copy appropriate manifest
      const manifestSrc = `manifests/manifest-${mode || 'chrome'}.json`;
      const manifestDest = `${outDir}/manifest.json`;

      try {
        copyFileSync(manifestSrc, manifestDest);
        console.log(`Copied ${manifestSrc} to ${manifestDest}`);
      } catch (error) {
        console.error(`Failed to copy manifest: ${error.message}`);
      }

      // Move HTML file from src/ to root and fix script references
      try {
        const htmlSrc = `${outDir}/src/newtab.html`;
        const htmlDest = `${outDir}/newtab.html`;
        if (existsSync(htmlSrc)) {
          // Read the HTML file and fix script references
          let htmlContent = readFileSync(htmlSrc, 'utf8');

          // Replace absolute paths with relative paths for extension compatibility
          htmlContent = htmlContent.replace(
            /src="\/newtab\.js"/g,
            'src="./newtab.js"'
          );
          htmlContent = htmlContent.replace(
            /href="\/newtab\.css"/g,
            'href="./newtab.css"'
          );

          // Move webextension-polyfill script to head (before main script)
          const polyfillScript = '<script src="./browser-polyfill.min.js"></script>';
          htmlContent = htmlContent.replace(polyfillScript, '');
          htmlContent = htmlContent.replace(
            '</head>',
            `  ${polyfillScript}\n</head>`
          );

          // Write the fixed HTML to the root directory
          writeFileSync(htmlDest, htmlContent);
          console.log(`Moved newtab.html to root directory and fixed script references`);
        }
      } catch (error) {
        console.warn(`Failed to move HTML file: ${error.message}`);
      }

      // Copy webextension-polyfill
      try {
        const polyfillSrc = 'node_modules/webextension-polyfill/dist/browser-polyfill.min.js';
        const polyfillDest = `${outDir}/browser-polyfill.min.js`;
        if (existsSync(polyfillSrc)) {
          copyFileSync(polyfillSrc, polyfillDest);
          console.log(`Copied webextension-polyfill to ${polyfillDest}`);
        }
      } catch (error) {
        console.warn(`Failed to copy webextension-polyfill: ${error.message}`);
      }

      // Copy icons directory if it exists
      try {
        if (existsSync('icons')) {
          if (!existsSync(`${outDir}/icons`)) {
            mkdirSync(`${outDir}/icons`, { recursive: true });
          }
          // Copy icon files
          const iconSizes = ['16', '32', '48', '128'];
          iconSizes.forEach(size => {
            const iconSrc = `icons/icon${size}.png`;
            const iconDest = `${outDir}/icons/icon${size}.png`;
            if (existsSync(iconSrc)) {
              copyFileSync(iconSrc, iconDest);
            }
          });
        }
      } catch (error) {
        console.warn(`Failed to copy icons: ${error.message}`);
      }
    }
  };
}

export default defineConfig(({ mode }) => {
  return {
    plugins: [
      svelte(),
      copyExtensionAssets(mode)
    ],
    build: {
      outDir: `dist/${mode || 'chrome'}`,
      emptyOutDir: true,
      rollupOptions: {
        input: {
          newtab: fileURLToPath(new URL('./src/newtab.html', import.meta.url)),
          'service-worker': fileURLToPath(new URL('./src/service-worker.ts', import.meta.url))
        },

        output: {
          entryFileNames: (chunkInfo) => {
            if (chunkInfo.name === 'service-worker') {
              return 'service-worker.js';
            }
            return '[name].js';
          },
          chunkFileNames: '[name].js',
          assetFileNames: (assetInfo) => {
            // Put HTML files in the root directory
            if (assetInfo.name && assetInfo.name.endsWith('.html')) {
              return '[name].[ext]';
            }
            return '[name].[ext]';
          }
        }
      }
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    }
  };
});
