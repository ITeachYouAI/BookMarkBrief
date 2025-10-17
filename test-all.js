/**
 * BrainBrief - Comprehensive Test Suite
 * 
 * Purpose: Validate ALL features are working
 * Usage: node test-all.js
 * 
 * @module test-all
 */

const logger = require('./src/utils/logger');
const twitter = require('./src/automation/twitter');
const db = require('./src/db/database');
const notebooklm = require('./src/automation/notebooklm');
const scheduler = require('./src/main/scheduler');
const fs = require('fs');
const path = require('path');

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

/**
 * Run a test and track result
 */
async function runTest(name, testFn) {
  logger.info(`Running: ${name}`, 'test');
  
  try {
    await testFn();
    results.passed++;
    results.tests.push({ name, status: 'PASS' });
    logger.success(`✅ PASS: ${name}`, 'test');
    return true;
  } catch (error) {
    results.failed++;
    results.tests.push({ name, status: 'FAIL', error: error.message });
    logger.error(`❌ FAIL: ${name}`, error, 'test');
    return false;
  }
}

/**
 * Assert helper
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Main test suite
 */
async function runAllTests() {
  logger.info('='.repeat(70));
  logger.info('BRAINBRIEF - COMPREHENSIVE TEST SUITE');
  logger.info('='.repeat(70));
  logger.info('');
  
  // =====================================
  // MODULE 1: Database Tests
  // =====================================
  logger.info('');
  logger.info('═══ MODULE 1: DATABASE ═══', 'test');
  logger.info('');
  
  await runTest('Database: Initialize', async () => {
    const result = await db.initDatabase();
    assert(result.success, `Init failed: ${result.error}`);
  });
  
  await runTest('Database: Save bookmark', async () => {
    const bookmark = {
      id: 'test_' + Date.now(),
      author: 'TestUser',
      text: 'Test tweet',
      url: 'https://x.com/test/123',
      timestamp: new Date().toISOString(),
      scraped_at: new Date().toISOString()
    };
    
    const result = await db.saveBookmark(bookmark);
    assert(result.success, `Save failed: ${result.error}`);
  });
  
  await runTest('Database: Get bookmark count', async () => {
    const result = await db.getBookmarkCount();
    assert(result.success, `Count failed: ${result.error}`);
    assert(result.data > 0, `No bookmarks found: ${result.data}`);
    logger.info(`  Count: ${result.data}`, 'test');
  });
  
  await runTest('Database: Get bookmarks', async () => {
    const result = await db.getBookmarks({ limit: 5 });
    assert(result.success, `Get failed: ${result.error}`);
    assert(Array.isArray(result.data), 'Result is not array');
    logger.info(`  Retrieved: ${result.data.length} bookmarks`, 'test');
  });
  
  await runTest('Database: Get stats', async () => {
    const result = await db.getStats();
    assert(result.success, `Stats failed: ${result.error}`);
    assert(result.data.total_bookmarks !== undefined, 'Stats missing total_bookmarks');
    logger.info(`  Stats: ${result.data.total_bookmarks} bookmarks, ${result.data.total_lists} lists`, 'test');
  });
  
  // =====================================
  // MODULE 2: Twitter Extraction Tests
  // =====================================
  logger.info('');
  logger.info('═══ MODULE 2: TWITTER EXTRACTION ═══', 'test');
  logger.info('');
  
  await runTest('Twitter: Extract 1 bookmark (requires login)', async () => {
    logger.warn('Browser will open - login to Twitter if prompted', 'test');
    const result = await twitter.extractBookmarks({ limit: 1 });
    assert(result.success, `Extraction failed: ${result.error}`);
    assert(result.data.count > 0, `No bookmarks extracted`);
    logger.info(`  Extracted: ${result.data.count} bookmark`, 'test');
    logger.info(`  Author: ${result.data.bookmarks[0].author}`, 'test');
  });
  
  // =====================================
  // MODULE 3: NotebookLM Export Tests
  // =====================================
  logger.info('');
  logger.info('═══ MODULE 3: NOTEBOOKLM EXPORT ═══', 'test');
  logger.info('');
  
  await runTest('NotebookLM: Create export file', async () => {
    const bookmarksResult = await db.getBookmarks({ limit: 5 });
    assert(bookmarksResult.success, 'Failed to get bookmarks for export');
    
    const bookmarks = bookmarksResult.data.map(b => ({
      id: b.tweet_id,
      author: b.author,
      text: b.text,
      url: b.url,
      timestamp: b.timestamp,
      scraped_at: b.scraped_at
    }));
    
    const result = notebooklm.testFileCreation(bookmarks);
    assert(result.success, `Export failed: ${result.error}`);
    assert(fs.existsSync(result.data), 'Export file not created');
    
    const fileSize = fs.statSync(result.data).size;
    logger.info(`  File: ${result.data}`, 'test');
    logger.info(`  Size: ${fileSize} bytes`, 'test');
  });
  
  // =====================================
  // MODULE 4: Scheduler Tests
  // =====================================
  logger.info('');
  logger.info('═══ MODULE 4: SCHEDULER ═══', 'test');
  logger.info('');
  
  await runTest('Scheduler: Start schedule', async () => {
    const result = scheduler.startSchedule({ 
      cronExpression: '*/5 * * * *', // Every 5 minutes for testing
      limit: 5 
    });
    assert(result.success, `Start failed: ${result.error}`);
    assert(result.data.enabled === true, 'Schedule not enabled');
    logger.info(`  Next run: ${result.data.nextRun}`, 'test');
  });
  
  await runTest('Scheduler: Get status', async () => {
    const result = scheduler.getScheduleStatus();
    assert(result.success, `Status failed: ${result.error}`);
    assert(result.data.enabled === true, 'Schedule should be enabled');
    logger.info(`  Enabled: ${result.data.enabled}`, 'test');
    logger.info(`  Next run: ${result.data.nextRun}`, 'test');
  });
  
  await runTest('Scheduler: Stop schedule', async () => {
    const result = scheduler.stopSchedule();
    assert(result.success, `Stop failed: ${result.error}`);
    
    const status = scheduler.getScheduleStatus();
    assert(status.data.enabled === false, 'Schedule should be disabled');
  });
  
  // =====================================
  // INTEGRATION TESTS
  // =====================================
  logger.info('');
  logger.info('═══ INTEGRATION TESTS ═══', 'test');
  logger.info('');
  
  await runTest('Integration: Full sync pipeline', async () => {
    logger.info('  Testing: Twitter → Database → Export', 'test');
    
    // Extract
    const extractResult = await twitter.extractBookmarks({ limit: 1 });
    assert(extractResult.success, `Extract failed: ${extractResult.error}`);
    
    // Save
    const saveResult = await db.saveBookmarks(extractResult.data.bookmarks);
    assert(saveResult.success, `Save failed: ${saveResult.error}`);
    
    // Verify saved
    const count = await db.getBookmarkCount();
    assert(count.success && count.data > 0, 'Nothing saved to database');
    
    logger.info(`  ✅ Full pipeline working`, 'test');
  });
  
  // =====================================
  // FILE SYSTEM TESTS
  // =====================================
  logger.info('');
  logger.info('═══ FILE SYSTEM VALIDATION ═══', 'test');
  logger.info('');
  
  await runTest('Files: Database file exists', async () => {
    const dbPath = path.join(__dirname, 'data/brainbrief.db');
    assert(fs.existsSync(dbPath), 'Database file not found');
    
    const stats = fs.statSync(dbPath);
    logger.info(`  Size: ${stats.size} bytes`, 'test');
  });
  
  await runTest('Files: Export directory exists', async () => {
    const exportDir = path.join(__dirname, 'data/exports');
    assert(fs.existsSync(exportDir), 'Export directory not found');
    
    const files = fs.readdirSync(exportDir);
    logger.info(`  Export files: ${files.length}`, 'test');
  });
  
  await runTest('Files: Browser data persisted', async () => {
    const browserDataDir = path.join(__dirname, 'browser-data');
    assert(fs.existsSync(browserDataDir), 'Browser data not found');
    logger.info(`  Browser data directory exists`, 'test');
  });
  
  // =====================================
  // SUMMARY
  // =====================================
  logger.info('');
  logger.info('='.repeat(70));
  logger.info('TEST SUMMARY');
  logger.info('='.repeat(70));
  logger.info('');
  
  results.tests.forEach(test => {
    const icon = test.status === 'PASS' ? '✅' : '❌';
    const msg = test.status === 'PASS' ? test.name : `${test.name} - ${test.error}`;
    logger.info(`${icon} ${msg}`, 'test');
  });
  
  logger.info('');
  logger.info(`Total: ${results.tests.length} tests`, 'test');
  logger.success(`Passed: ${results.passed}`, 'test');
  if (results.failed > 0) {
    logger.error(`Failed: ${results.failed}`, 'test');
  }
  logger.info('');
  
  if (results.failed === 0) {
    logger.success('🎉 ALL TESTS PASSED - BRAINBRIEF IS FULLY FUNCTIONAL 🎉');
  } else {
    logger.error(`❌ ${results.failed} TEST(S) FAILED`);
  }
  
  logger.info('='.repeat(70));
  
  return results.failed === 0;
}

// Run all tests
runAllTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    logger.error('Fatal test error', error);
    process.exit(1);
  });

