/**
 * Test script for logging functionality
 * 
 * Usage in browser console:
 *   import('./lib/logging/test-logging.js').then(m => m.testLogging())
 * 
 * Or add to main.ts temporarily:
 *   import { testLogging } from './lib/logging/test-logging';
 *   testLogging();
 */

import Logger from './index';

export async function testLogging(): Promise<void> {
  console.log('🧪 Starting logging test...\n');

  // Test 1: Check logger status
  console.log('Test 1: Checking logger status');
  const status = Logger.getStatus();
  console.log('Status:', status);
  
  if (!status.initialized) {
    console.warn('⚠️ Logger not initialized. Initializing now...');
    await Logger.getInstance().init();
    console.log('✅ Logger initialized');
  } else {
    console.log('✅ Logger already initialized');
  }

  // Test 2: Generate test logs
  console.log('\nTest 2: Generating test logs');
  console.log('This is an INFO log');
  console.warn('This is a WARN log');
  console.error('This is an ERROR log');
  console.debug('This is a DEBUG log');
  console.log('✅ Test logs generated');

  // Test 3: Wait a bit for logs to be stored
  console.log('\nTest 3: Waiting for logs to be stored...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('✅ Wait complete');

  // Test 4: Retrieve logs
  console.log('\nTest 4: Retrieving logs');
  try {
    const logs = await Logger.retrieveLogs();
    console.log(`✅ Retrieved ${logs.length} log entries`);
    
    if (logs.length > 0) {
      console.log('\nSample log entries (last 5):');
      logs.slice(-5).forEach((log, i) => {
        console.log(`  ${i + 1}.`, {
          level: log.level,
          message: log.message,
          timestamp: log.timestamp
        });
      });
    } else {
      console.warn('⚠️ No logs found in storage');
    }
  } catch (error) {
    console.error('❌ Failed to retrieve logs:', error);
  }

  // Test 5: Test log level filtering
  console.log('\nTest 5: Testing log level filtering');
  const originalLevel = Logger.getLogLevel();
  console.log(`Original log level: ${originalLevel}`);
  
  Logger.setLogLevel('ERROR');
  console.log('Set log level to ERROR');
  console.log('This INFO log should NOT be stored');
  console.error('This ERROR log SHOULD be stored');
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  Logger.setLogLevel(originalLevel);
  console.log(`✅ Restored log level to ${originalLevel}`);

  // Test 6: Download logs
  console.log('\nTest 6: Testing log download');
  console.log('You can download logs by running:');
  console.log('  await FavaultLogger.downloadLogs()');

  console.log('\n🎉 Logging test complete!');
  console.log('\nNext steps:');
  console.log('1. Check DevTools → Application → IndexedDB → FavaultLogDB');
  console.log('2. Run: await FavaultLogger.retrieveLogs()');
  console.log('3. Run: await FavaultLogger.downloadLogs()');
}

// Auto-run if this file is imported with a query parameter
if (typeof window !== 'undefined' && window.location?.search?.includes('test-logging')) {
  testLogging().catch(console.error);
}

