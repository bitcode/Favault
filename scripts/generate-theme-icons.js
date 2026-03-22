/**
 * Generates theme-specific PNG icons for all 6 color schemes.
 * Output: icons/icon-{themeId}-{size}.png  (16, 32, 48, 128)
 * Also writes icons/icon-{size}.png (JM Dark, used as the default).
 *
 * Requires Playwright (already a dev dependency).
 * Run with: node scripts/generate-theme-icons.js
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const SIZES = [16, 32, 48, 128];

/**
 * Icon color palette per theme.
 * outer   — outermost circle (the "frame")
 * ring    — middle ring between outer and inner
 * inner   — inner filled circle (background of the dial)
 * mech    — spokes, dial border, tick strokes (the mechanism color)
 * center  — center dial base fill
 * knob    — inner knob fill
 * shadow  — drop shadow flood-color
 */
const ICON_PALETTES = {
  'jm-dark': {
    outer:  '#05254E',
    ring:   '#D1E3F3',
    inner:  '#468FCD',
    mech:   '#05254E',
    center: '#F1F5F9',
    knob:   '#CBD5E1',
    shadow: '#020D1C',
  },
  'jm-light': {
    outer:  '#05254E',
    ring:   '#E2E8F0',
    inner:  '#F8FAFC',
    mech:   '#05254E',
    center: '#FFFFFF',
    knob:   '#94A3B8',
    shadow: '#05254E',
  },
  'ayu-dark-mode': {
    outer:  '#0F1419',
    ring:   '#253340',
    inner:  '#36A3D9',
    mech:   '#0F1419',
    center: '#1C2B38',
    knob:   '#5C6773',
    shadow: '#07090C',
  },
  'ayu-light-mode': {
    outer:  '#5C6773',
    ring:   '#FAFAFA',
    inner:  '#F0EEE4',
    mech:   '#5C6773',
    center: '#FFFFFF',
    knob:   '#ABB0B6',
    shadow: '#3A4550',
  },
  'gruvbox-dark': {
    outer:  '#1d2021',
    ring:   '#504945',
    inner:  '#458588',
    mech:   '#1d2021',
    center: '#32302f',
    knob:   '#7c6f64',
    shadow: '#0d0f0f',
  },
  'gruvbox-light': {
    outer:  '#3c3836',
    ring:   '#fbf1c7',
    inner:  '#f2e5bc',
    mech:   '#3c3836',
    center: '#fdf4c1',
    knob:   '#a89984',
    shadow: '#1d1d1b',
  },
};

function buildSVG(p, size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">
  <defs>
    <filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="1.5" dy="2.5" stdDeviation="1.5" flood-color="${p.shadow}" flood-opacity="0.28" />
    </filter>
  </defs>
  <circle cx="50" cy="50" r="49" fill="${p.outer}" />
  <circle cx="50" cy="50" r="44" fill="${p.ring}" />
  <circle cx="50" cy="50" r="33" fill="${p.inner}" />
  <g filter="url(#sh)">
    <g stroke="${p.mech}" stroke-width="5.5" stroke-linecap="round">
      <line x1="50" y1="50" x2="50" y2="10" />
      <line x1="50" y1="50" x2="50" y2="10" transform="rotate(90 50 50)" />
      <line x1="50" y1="50" x2="50" y2="10" transform="rotate(180 50 50)" />
      <line x1="50" y1="50" x2="50" y2="10" transform="rotate(270 50 50)" />
      <line x1="50" y1="50" x2="50" y2="22" transform="rotate(45 50 50)" />
      <line x1="50" y1="50" x2="50" y2="22" transform="rotate(135 50 50)" />
      <line x1="50" y1="50" x2="50" y2="22" transform="rotate(225 50 50)" />
      <line x1="50" y1="50" x2="50" y2="22" transform="rotate(315 50 50)" />
    </g>
    <circle cx="50" cy="50" r="18" fill="${p.center}" stroke="${p.mech}" stroke-width="2.5" />
    <g stroke="${p.mech}" stroke-width="1.5" stroke-linecap="round">
      <line x1="50" y1="33.5" x2="50" y2="36.5" transform="rotate(-60 50 50)" />
      <line x1="50" y1="33.5" x2="50" y2="36.5" transform="rotate(-45 50 50)" />
      <line x1="50" y1="33.5" x2="50" y2="36.5" transform="rotate(-30 50 50)" />
      <line x1="50" y1="33.5" x2="50" y2="36.5" transform="rotate(-15 50 50)" />
      <line x1="50" y1="33.5" x2="50" y2="36.5" transform="rotate(0 50 50)" />
      <line x1="50" y1="33.5" x2="50" y2="36.5" transform="rotate(15 50 50)" />
      <line x1="50" y1="33.5" x2="50" y2="36.5" transform="rotate(30 50 50)" />
      <line x1="50" y1="33.5" x2="50" y2="36.5" transform="rotate(45 50 50)" />
      <line x1="50" y1="33.5" x2="50" y2="36.5" transform="rotate(60 50 50)" />
    </g>
    <circle cx="50" cy="50" r="8.5" fill="${p.knob}" stroke="${p.mech}" stroke-width="2" />
  </g>
</svg>`;
}

const browser = await chromium.launch();

for (const [themeId, palette] of Object.entries(ICON_PALETTES)) {
  for (const size of SIZES) {
    const svg = buildSVG(palette, size);
    const page = await browser.newPage();
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<!DOCTYPE html><html><head><style>*{margin:0;padding:0;background:transparent}</style></head><body>${svg}</body></html>`
    );
    const buf = await page.screenshot({
      type: 'png',
      omitBackground: true,
      clip: { x: 0, y: 0, width: size, height: size },
    });
    const dest = `icons/icon-${themeId}-${size}.png`;
    writeFileSync(dest, buf);
    console.log(`  ✓ ${dest} (${buf.length}b)`);
    await page.close();
  }
}

// Also write the jm-dark variants as the default icon{size}.png
for (const size of SIZES) {
  const src = `icons/icon-jm-dark-${size}.png`;
  const dest = `icons/icon${size}.png`;
  const { readFileSync } = await import('fs');
  writeFileSync(dest, readFileSync(src));
  console.log(`  ✓ ${dest} (default, aliased from jm-dark)`);
}

await browser.close();
console.log('\nDone — all theme icons generated.');
