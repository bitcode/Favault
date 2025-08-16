#!/usr/bin/env node

/**
 * Basic Playwright demo to show browser automation is working
 * This will open a browser and navigate to a simple page
 */

import { chromium } from '@playwright/test';

async function runBasicPlaywrightDemo() {
  console.log('🚀 Basic Playwright Browser Automation Demo');
  console.log('==========================================');
  
  let browser = null;
  
  try {
    console.log('🌐 Launching Chrome browser...');
    
    // Launch browser in headed mode so you can see it
    browser = await chromium.launch({
      headless: false, // Show the browser!
      slowMo: 1000     // Slow down actions so you can see them
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('✅ Browser launched successfully');

    console.log('🧪 Test 1: Navigate to Google...');
    await page.goto('https://www.google.com');
    await page.waitForLoadState('networkidle');
    console.log('✅ Google loaded');

    console.log('🧪 Test 2: Search for "Playwright"...');
    await page.fill('textarea[name="q"]', 'Playwright browser automation');
    await page.press('textarea[name="q"]', 'Enter');
    await page.waitForLoadState('networkidle');
    console.log('✅ Search completed');

    console.log('🧪 Test 3: Check search results...');
    const results = await page.locator('h3').count();
    console.log(`✅ Found ${results} search result headings`);

    console.log('🔍 Browser will stay open for 10 seconds so you can see it working...');
    await page.waitForTimeout(10000);

    console.log('📊 Demo Results:');
    console.log('================');
    console.log('Status: ✅ PASSED');
    console.log('Tests: 3/3 passed');
    console.log('- Browser launch: ✅');
    console.log('- Page navigation: ✅');
    console.log('- Element interaction: ✅');

    return {
      success: true,
      tests: 3,
      passed: 3,
      failed: 0
    };

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 Browser closed');
    }
  }
}

// Run the demo
runBasicPlaywrightDemo()
  .then(results => {
    console.log('\n🎉 Playwright browser automation demo completed!');
    console.log('This proves Playwright can control browsers programmatically.');
    process.exit(results.success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Demo crashed:', error);
    process.exit(1);
  });
