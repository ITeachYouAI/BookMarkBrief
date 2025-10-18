/**
 * BrainBrief - Database Test
 * 
 * Purpose: Validate SQLite database operations
 * Usage: node test-database.js
 * 
 * @module test-database
 */

const logger = require('./src/utils/logger');
const db = require('./src/db/database');

/**
 * Test database operations
 * 
 * @returns {Promise<boolean>} Success status
 */
async function testDatabase() {
  logger.info('='.repeat(60));
  logger.info('BRAINBRIEF - DATABASE TEST');
  logger.info('='.repeat(60));
  logger.info('');
  
  let allTestsPassed = true;
  
  // Test 1: Initialize database
  logger.info('Test 1: Initialize database', 'test');
  const initResult = await db.initDatabase();
  if (initResult.success) {
    logger.success('✅ Database initialized', 'test');
  } else {
    logger.error('❌ Database initialization failed', initResult.error, 'test');
    allTestsPassed = false;
  }
  
  // Test 2: Save a bookmark
  logger.info('');
  logger.info('Test 2: Save a bookmark', 'test');
  const testBookmark = {
    id: 'test_123456',
    author: 'TestUser',
    text: 'This is a test tweet for BrainBrief database validation',
    url: 'https://x.com/TestUser/status/test_123456',
    timestamp: new Date().toISOString(),
    scraped_at: new Date().toISOString()
  };
  
  const saveResult = await db.saveBookmark(testBookmark);
  if (saveResult.success) {
    logger.success('✅ Bookmark saved', 'test');
  } else {
    logger.error('❌ Failed to save bookmark', saveResult.error, 'test');
    allTestsPassed = false;
  }
  
  // Test 3: Get bookmark count
  logger.info('');
  logger.info('Test 3: Get bookmark count', 'test');
  const countResult = await db.getBookmarkCount();
  if (countResult.success) {
    logger.success(`✅ Bookmark count: ${countResult.data}`, 'test');
  } else {
    logger.error('❌ Failed to get count', countResult.error, 'test');
    allTestsPassed = false;
  }
  
  // Test 4: Check if bookmark exists
  logger.info('');
  logger.info('Test 4: Check if bookmark exists', 'test');
  const existsResult = await db.bookmarkExists('test_123456');
  if (existsResult.success && existsResult.data === true) {
    logger.success('✅ Bookmark exists in database', 'test');
  } else {
    logger.error('❌ Bookmark not found', existsResult.error, 'test');
    allTestsPassed = false;
  }
  
  // Test 5: Get bookmarks
  logger.info('');
  logger.info('Test 5: Get bookmarks', 'test');
  const getResult = await db.getBookmarks({ limit: 10 });
  if (getResult.success) {
    logger.success(`✅ Retrieved ${getResult.data.length} bookmarks`, 'test');
    if (getResult.data.length > 0) {
      logger.debug('Sample bookmark', getResult.data[0], 'test');
    }
  } else {
    logger.error('❌ Failed to get bookmarks', getResult.error, 'test');
    allTestsPassed = false;
  }
  
  // Test 6: Get stats
  logger.info('');
  logger.info('Test 6: Get database stats', 'test');
  const statsResult = await db.getStats();
  if (statsResult.success) {
    logger.success('✅ Database stats:', 'test');
    logger.info(`   Total bookmarks: ${statsResult.data.total_bookmarks}`, 'test');
    logger.info(`   Total lists: ${statsResult.data.total_lists}`, 'test');
    logger.info(`   Last sync: ${statsResult.data.last_sync || 'Never'}`, 'test');
  } else {
    logger.error('❌ Failed to get stats', statsResult.error, 'test');
    allTestsPassed = false;
  }
  
  // Summary
  logger.info('');
  logger.info('='.repeat(60));
  if (allTestsPassed) {
    logger.success('✅ ALL DATABASE TESTS PASSED');
  } else {
    logger.error('❌ SOME TESTS FAILED');
  }
  logger.info('='.repeat(60));
  
  return allTestsPassed;
}

// Run test
testDatabase()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    logger.error('Fatal test error', error);
    process.exit(1);
  });

