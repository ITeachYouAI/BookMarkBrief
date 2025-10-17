/**
 * BrainBrief - Integration Test
 * 
 * Purpose: Test full stack (Twitter → Database → Verify)
 * Usage: node test-integration.js
 * 
 * @module test-integration
 */

const logger = require('./src/utils/logger');
const twitter = require('./src/automation/twitter');
const db = require('./src/db/database');

/**
 * Run integration test
 * 
 * @returns {Promise<boolean>} Success status
 */
async function testIntegration() {
  logger.info('='.repeat(60));
  logger.info('BRAINBRIEF - INTEGRATION TEST');
  logger.info('='.repeat(60));
  logger.info('Testing: Twitter → Database → Verify');
  logger.info('');
  
  try {
    // Step 1: Initialize database
    logger.info('Step 1: Initialize database', 'integration');
    const dbInit = db.initDatabase();
    if (!dbInit.success) {
      logger.error('Failed to initialize database', dbInit.error, 'integration');
      return false;
    }
    logger.success('✅ Database initialized', 'integration');
    
    // Step 2: Extract 1 bookmark from Twitter
    logger.info('');
    logger.info('Step 2: Extract bookmark from Twitter', 'integration');
    logger.info('(Browser will open, login if needed)', 'integration');
    logger.info('');
    
    const twitterResult = await twitter.extractBookmarks({ limit: 1 });
    
    if (!twitterResult.success) {
      logger.error('Failed to extract bookmark', twitterResult.error, 'integration');
      return false;
    }
    
    if (twitterResult.data.count === 0) {
      logger.warn('No bookmarks extracted', 'integration');
      return false;
    }
    
    logger.success(`✅ Extracted ${twitterResult.data.count} bookmark(s)`, 'integration');
    
    const bookmark = twitterResult.data.bookmarks[0];
    logger.info(`Bookmark: ${bookmark.author} - ${bookmark.url}`, 'integration');
    
    // Step 3: Save to database
    logger.info('');
    logger.info('Step 3: Save bookmark to database', 'integration');
    
    const saveResult = db.saveBookmark(bookmark);
    if (!saveResult.success) {
      logger.error('Failed to save bookmark', saveResult.error, 'integration');
      return false;
    }
    
    logger.success('✅ Bookmark saved to database', 'integration');
    
    // Step 4: Verify it's saved
    logger.info('');
    logger.info('Step 4: Verify bookmark in database', 'integration');
    
    const existsResult = db.bookmarkExists(bookmark.id);
    if (!existsResult.success || !existsResult.data) {
      logger.error('Bookmark not found in database', 'integration');
      return false;
    }
    
    logger.success('✅ Bookmark verified in database', 'integration');
    
    // Step 5: Get stats
    logger.info('');
    logger.info('Step 5: Get database stats', 'integration');
    
    const statsResult = db.getStats();
    if (!statsResult.success) {
      logger.error('Failed to get stats', statsResult.error, 'integration');
      return false;
    }
    
    logger.success('✅ Database stats:', 'integration');
    logger.info(`   Total bookmarks: ${statsResult.data.total_bookmarks}`, 'integration');
    logger.info(`   Last sync: ${statsResult.data.last_sync}`, 'integration');
    
    // Success!
    logger.info('');
    logger.info('='.repeat(60));
    logger.success('✅ INTEGRATION TEST PASSED');
    logger.info('='.repeat(60));
    logger.info('');
    logger.success('Full stack validated:');
    logger.info('  ✅ Twitter extraction working', 'integration');
    logger.info('  ✅ Database saving working', 'integration');
    logger.info('  ✅ Data persistence working', 'integration');
    logger.info('');
    
    return true;
    
  } catch (error) {
    logger.error('Integration test failed', error, 'integration');
    return false;
  }
}

// Run test
testIntegration()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    logger.error('Fatal test error', error);
    process.exit(1);
  });

