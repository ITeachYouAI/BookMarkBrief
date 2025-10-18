/**
 * BrainBrief - NotebookLM Upload Test (AUTOMATED)
 * 
 * Purpose: Test full automated upload to NotebookLM
 * Usage: node test-notebooklm-upload.js
 * 
 * @module test-notebooklm-upload
 */

const logger = require('./src/utils/logger');
const db = require('./src/db/database');
const notebooklm = require('./src/automation/notebooklm');

async function testAutomatedUpload() {
  logger.info('='.repeat(70));
  logger.info('NOTEBOOKLM AUTOMATED UPLOAD TEST');
  logger.info('='.repeat(70));
  logger.info('');
  logger.info('This test will:', 'test');
  logger.info('  1. Get 5 bookmarks from database', 'test');
  logger.info('  2. Create markdown file', 'test');
  logger.info('  3. Open NotebookLM (browser visible)', 'test');
  logger.info('  4. Navigate to notebook', 'test');
  logger.info('  5. Upload file automatically', 'test');
  logger.info('  6. Wait for processing', 'test');
  logger.info('');
  logger.warn('Browser will open. You may need to log in to Google.', 'test');
  logger.info('');
  
  try {
    // Step 1: Get bookmarks from database
    logger.info('Step 1: Getting bookmarks from database...', 'test');
    
    await db.initDatabase();
    const bookmarksResult = await db.getBookmarks({ limit: 5 });
    
    if (!bookmarksResult.success || bookmarksResult.data.length === 0) {
      logger.error('No bookmarks in database. Run test-integration.js first', 'test');
      return false;
    }
    
    const bookmarks = bookmarksResult.data.map(b => ({
      id: b.tweet_id,
      author: b.author,
      text: b.text,
      url: b.url,
      timestamp: b.timestamp,
      scraped_at: b.scraped_at
    }));
    
    logger.success(`Retrieved ${bookmarks.length} bookmarks`, 'test');
    
    // Step 2: Upload to NotebookLM (AUTOMATED)
    logger.info('');
    logger.info('Step 2: Uploading to NotebookLM (AUTOMATED)...', 'test');
    logger.info('Watch the browser - it will:', 'test');
    logger.info('  1. Navigate to NotebookLM', 'test');
    logger.info('  2. Select/create "BrainBrief Test" notebook', 'test');
    logger.info('  3. Click "Add sources"', 'test');
    logger.info('  4. Upload the file', 'test');
    logger.info('  5. Wait for processing', 'test');
    logger.info('');
    
    const result = await notebooklm.uploadBookmarks(bookmarks, {
      notebookName: 'BrainBrief Test'
    });
    
    logger.info('');
    logger.info('='.repeat(70));
    
    if (result.success) {
      logger.success('✅ AUTOMATED UPLOAD TEST PASSED');
      logger.info('='.repeat(70));
      logger.info('');
      logger.success(`Uploaded ${result.data.count} bookmarks`, 'test');
      logger.info(`File: ${result.data.filePath}`, 'test');
      logger.info(`Notebook: ${result.data.notebookName}`, 'test');
      logger.info('');
      logger.success('Go to NotebookLM and verify:', 'test');
      logger.info('  1. Notebook exists: "BrainBrief Test"', 'test');
      logger.info('  2. Source file appears in sources', 'test');
      logger.info('  3. You can query the bookmarks with AI', 'test');
      logger.info('');
      return true;
    } else {
      logger.error('❌ AUTOMATED UPLOAD TEST FAILED');
      logger.info('='.repeat(70));
      logger.info('');
      logger.error(`Error: ${result.error}`, 'test');
      logger.info('');
      logger.info('Troubleshooting:', 'test');
      logger.info('  - Check if you were logged in to Google', 'test');
      logger.info('  - Check if "Add sources" button appeared', 'test');
      logger.info('  - Check terminal logs for specific error', 'test');
      logger.info('  - File was created: Check data/exports/ folder', 'test');
      logger.info('');
      return false;
    }
    
  } catch (error) {
    logger.error('Test crashed', error, 'test');
    return false;
  }
}

testAutomatedUpload()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    logger.error('Fatal test error', error);
    process.exit(1);
  });

