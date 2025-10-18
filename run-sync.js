#!/usr/bin/env node
/**
 * BrainBrief - CLI Runner
 * 
 * Runs the Twitter -> NotebookLM sync pipeline from command line
 * (No Electron GUI required)
 */

const { extractNewBookmarks } = require('./src/automation/twitter');
const { uploadBookmarks } = require('./src/automation/notebooklm');
const { getBookmarks, saveBookmark } = require('./src/db/database');
const logger = require('./src/utils/logger');

async function main() {
  try {
    logger.info('='.repeat(70));
    logger.info('BRAINBRIEF - AUTOMATED SYNC');
    logger.info('='.repeat(70));
    logger.info('');

    // Step 1: Extract new bookmarks from Twitter
    logger.info('STEP 1: Extracting new bookmarks from Twitter', 'sync');
    logger.info('');
    
    const extractResult = await extractNewBookmarks();
    
    if (!extractResult.success) {
      logger.error('Failed to extract bookmarks', extractResult.error, 'sync');
      process.exit(1);
    }

    const newBookmarks = extractResult.data.bookmarks;
    logger.success(`Extracted ${newBookmarks.length} new bookmarks`, 'sync');
    logger.info('');

    if (newBookmarks.length === 0) {
      logger.success('✅ No new bookmarks to sync!', 'sync');
      logger.info('Your NotebookLM is up to date.', 'sync');
      logger.info('');
      return;
    }

    // Step 2: Save new bookmarks to database
    logger.info('STEP 2: Saving new bookmarks to database', 'sync');
    
    let savedCount = 0;
    for (const bookmark of newBookmarks) {
      const saveResult = await saveBookmark(bookmark);
      if (saveResult.success) {
        savedCount++;
      } else {
        logger.warn(`Failed to save bookmark ${bookmark.id}`, 'sync');
      }
    }
    
    logger.success(`Saved ${savedCount}/${newBookmarks.length} bookmarks`, 'sync');
    logger.info('');

    // Step 3: Get all bookmarks for upload (including previously synced)
    logger.info('STEP 3: Preparing bookmarks for NotebookLM', 'sync');
    
    const dbResult = await getBookmarks();
    if (!dbResult.success) {
      logger.error('Failed to get bookmarks from database', dbResult.error, 'sync');
      process.exit(1);
    }

    const allBookmarks = dbResult.data;
    logger.info(`Total bookmarks in database: ${allBookmarks.length}`, 'sync');
    logger.info('');

    // Step 4: Upload to NotebookLM
    logger.info('STEP 4: Uploading to NotebookLM', 'sync');
    logger.info('Browser will open automatically...', 'sync');
    logger.info('');

    const uploadResult = await uploadBookmarks(newBookmarks);

    if (!uploadResult.success) {
      logger.error('Failed to upload to NotebookLM', uploadResult.error, 'sync');
      process.exit(1);
    }

    logger.info('');
    logger.success('='.repeat(70), 'sync');
    logger.success('✅ SYNC COMPLETE!', 'sync');
    logger.success('='.repeat(70), 'sync');
    logger.info('');
    logger.info(`✓ Extracted: ${newBookmarks.length} new bookmarks`, 'sync');
    logger.info(`✓ Uploaded to NotebookLM successfully`, 'sync');
    logger.info('');
    logger.info('Next sync will only extract NEW bookmarks (incremental)', 'sync');
    logger.info('');

  } catch (error) {
    logger.error('Unexpected error during sync', error, 'sync');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { main };

