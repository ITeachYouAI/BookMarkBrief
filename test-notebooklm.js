/**
 * BrainBrief - NotebookLM Test
 * 
 * Purpose: Test NotebookLM file creation and upload process
 * Usage: node test-notebooklm.js
 * 
 * @module test-notebooklm
 */

const logger = require('./src/utils/logger');
const db = require('./src/db/database');
const notebooklm = require('./src/automation/notebooklm');

/**
 * Run NotebookLM test
 * 
 * @returns {Promise<boolean>} Success status
 */
async function testNotebookLM() {
  logger.info('='.repeat(60));
  logger.info('BRAINBRIEF - NOTEBOOKLM TEST');
  logger.info('='.repeat(60));
  logger.info('');
  
  try {
    // Step 1: Get bookmarks from database
    logger.info('Step 1: Get bookmarks from database', 'test');
    
    const dbInit = db.initDatabase();
    if (!dbInit.success) {
      logger.error('Failed to initialize database', dbInit.error, 'test');
      return false;
    }
    
    const bookmarksResult = db.getBookmarks({ limit: 10 });
    if (!bookmarksResult.success) {
      logger.error('Failed to get bookmarks', bookmarksResult.error, 'test');
      return false;
    }
    
    if (bookmarksResult.data.length === 0) {
      logger.warn('No bookmarks in database. Run test-integration.js first', 'test');
      return false;
    }
    
    logger.success(`✅ Retrieved ${bookmarksResult.data.length} bookmarks`, 'test');
    
    // Convert database format to bookmark format
    const bookmarks = bookmarksResult.data.map(b => ({
      id: b.tweet_id,
      author: b.author,
      text: b.text,
      url: b.url,
      timestamp: b.timestamp,
      scraped_at: b.scraped_at
    }));
    
    // Step 2: Create bookmark file
    logger.info('');
    logger.info('Step 2: Create bookmark file for NotebookLM', 'test');
    
    const fileResult = notebooklm.testFileCreation(bookmarks);
    if (!fileResult.success) {
      logger.error('Failed to create file', fileResult.error, 'test');
      return false;
    }
    
    logger.success(`✅ File created: ${fileResult.data}`, 'test');
    logger.info('');
    logger.info('File contains:', 'test');
    logger.info(`  - ${bookmarks.length} bookmarks`, 'test');
    logger.info(`  - Formatted in markdown`, 'test');
    logger.info(`  - Ready for NotebookLM upload`, 'test');
    
    // Step 3: Explain next steps
    logger.info('');
    logger.info('='.repeat(60));
    logger.success('✅ FILE CREATION TEST PASSED');
    logger.info('='.repeat(60));
    logger.info('');
    logger.info('Next steps for full NotebookLM integration:', 'test');
    logger.info('  1. Open NotebookLM in browser', 'test');
    logger.info('  2. Create or select a notebook', 'test');
    logger.info('  3. Upload the generated file', 'test');
    logger.info('  4. Query bookmarks with NotebookLM AI', 'test');
    logger.info('');
    logger.info('For now, file is ready for manual upload', 'test');
    logger.info('');
    
    return true;
    
  } catch (error) {
    logger.error('Test failed', error, 'test');
    return false;
  }
}

// Run test
testNotebookLM()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    logger.error('Fatal test error', error);
    process.exit(1);
  });

