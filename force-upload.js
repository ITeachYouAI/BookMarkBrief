#!/usr/bin/env node
/**
 * Force upload ALL bookmarks to NotebookLM
 * Use this for first-time upload or if notebooks are missing
 */

const { getBookmarks } = require('./src/db/database');
const { uploadBookmarks } = require('./src/automation/notebooklm');
const logger = require('./src/utils/logger');

async function forceUpload() {
  console.log('\n🚀 FORCE UPLOAD - Upload ALL bookmarks to NotebookLM\n');
  
  try {
    // Get ALL bookmarks from database
    logger.info('Loading ALL bookmarks from database...', 'upload');
    const result = await getBookmarks();
    
    if (!result.success) {
      logger.error('Failed to load bookmarks', result.error, 'upload');
      process.exit(1);
    }
    
    const bookmarks = result.data;
    logger.success(`Loaded ${bookmarks.length} bookmarks`, 'upload');
    
    if (bookmarks.length === 0) {
      logger.warn('No bookmarks in database! Run sync first.', 'upload');
      process.exit(0);
    }
    
    // Upload to NotebookLM
    logger.info(`Uploading ${bookmarks.length} bookmarks to NotebookLM...`, 'upload');
    logger.warn('Browser will open - watch it work!', 'upload');
    
    const uploadResult = await uploadBookmarks(bookmarks);
    
    if (uploadResult.success) {
      logger.success('✅ Upload complete!', 'upload');
      logger.info(`Notebook: ${uploadResult.data.notebookName}`, 'upload');
      logger.info(`Sources: ${uploadResult.data.sourceCount}`, 'upload');
      logger.info(`YouTube videos: ${uploadResult.data.youtubeSourcesAdded || 0}`, 'upload');
    } else {
      logger.error('Upload failed', uploadResult.error, 'upload');
      process.exit(1);
    }
    
  } catch (error) {
    logger.error('Force upload failed', error, 'upload');
    process.exit(1);
  }
}

forceUpload();

