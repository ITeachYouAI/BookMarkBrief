/**
 * BrainBrief - Full Pipeline Test (100 Bookmarks)
 * 
 * Purpose: Test complete flow with diverse content types
 * - Extract 100 bookmarks from Twitter
 * - Analyze content types (YouTube, PDFs, threads, etc)
 * - Upload to NotebookLM
 * - Verify ingestion
 * 
 * Usage: node test-full-pipeline.js
 */

const logger = require('./src/utils/logger');
const twitter = require('./src/automation/twitter');
const db = require('./src/db/database');
const notebooklm = require('./src/automation/notebooklm');
const fs = require('fs');

/**
 * Analyze content types in bookmarks
 */
function analyzeContentTypes(bookmarks) {
  const types = {
    youtube: [],
    pdf: [],
    googleDocs: [],
    threads: [],
    images: [],
    plainText: [],
    other: []
  };
  
  bookmarks.forEach(bookmark => {
    const url = bookmark.url.toLowerCase();
    const text = bookmark.text.toLowerCase();
    
    // YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      types.youtube.push(bookmark);
    }
    // PDF
    else if (url.includes('.pdf') || text.includes('pdf')) {
      types.pdf.push(bookmark);
    }
    // Google Docs
    else if (url.includes('docs.google.com') || url.includes('drive.google.com')) {
      types.googleDocs.push(bookmark);
    }
    // Threads (multiple tweets)
    else if (text.includes('thread') || text.includes('🧵')) {
      types.threads.push(bookmark);
    }
    // Images (no text)
    else if (!bookmark.text || bookmark.text.trim().length === 0) {
      types.images.push(bookmark);
    }
    // Plain text
    else if (bookmark.text && bookmark.text.length > 0) {
      types.plainText.push(bookmark);
    }
    // Other
    else {
      types.other.push(bookmark);
    }
  });
  
  return types;
}

/**
 * Main test
 */
async function testFullPipeline() {
  logger.info('='.repeat(70));
  logger.info('BRAINBRIEF - FULL PIPELINE TEST (100 BOOKMARKS)');
  logger.info('='.repeat(70));
  logger.info('');
  logger.info('This comprehensive test will:', 'test');
  logger.info('  1. Extract 100 bookmarks from Twitter', 'test');
  logger.info('  2. Analyze content types (YouTube, PDFs, etc)', 'test');
  logger.info('  3. Save to database', 'test');
  logger.info('  4. Upload to NotebookLM', 'test');
  logger.info('  5. Verify ingestion', 'test');
  logger.info('');
  logger.warn('This will take ~5 minutes. Browser will open.', 'test');
  logger.info('');
  
  const startTime = Date.now();
  const results = {
    extracted: 0,
    saved: 0,
    uploaded: false,
    contentTypes: {},
    duration: 0
  };
  
  try {
    // STEP 1: Extract 100 bookmarks
    logger.info('=== STEP 1: EXTRACT 100 BOOKMARKS ===', 'test');
    logger.info('');
    
    const extractResult = await twitter.extractBookmarks({ limit: 100 });
    
    if (!extractResult.success) {
      logger.error('Extraction failed', extractResult.error, 'test');
      return false;
    }
    
    const bookmarks = extractResult.data.bookmarks;
    results.extracted = bookmarks.length;
    
    logger.success(`Extracted ${bookmarks.length} bookmarks`, 'test');
    logger.info('');
    
    // STEP 2: Analyze content types
    logger.info('=== STEP 2: ANALYZE CONTENT TYPES ===', 'test');
    logger.info('');
    
    const types = analyzeContentTypes(bookmarks);
    results.contentTypes = {
      youtube: types.youtube.length,
      pdf: types.pdf.length,
      googleDocs: types.googleDocs.length,
      threads: types.threads.length,
      images: types.images.length,
      plainText: types.plainText.length,
      other: types.other.length
    };
    
    logger.info('Content type breakdown:', 'test');
    logger.info(`  YouTube videos: ${types.youtube.length}`, 'test');
    logger.info(`  PDFs: ${types.pdf.length}`, 'test');
    logger.info(`  Google Docs: ${types.googleDocs.length}`, 'test');
    logger.info(`  Threads: ${types.threads.length}`, 'test');
    logger.info(`  Images only: ${types.images.length}`, 'test');
    logger.info(`  Plain text: ${types.plainText.length}`, 'test');
    logger.info(`  Other: ${types.other.length}`, 'test');
    logger.info('');
    
    // Show samples
    if (types.youtube.length > 0) {
      logger.info('Sample YouTube:', 'test');
      logger.info(`  ${types.youtube[0].url}`, 'test');
    }
    
    if (types.threads.length > 0) {
      logger.info('Sample Thread:', 'test');
      logger.info(`  ${types.threads[0].text.substring(0, 100)}...`, 'test');
    }
    
    logger.info('');
    
    // STEP 3: Save to database
    logger.info('=== STEP 3: SAVE TO DATABASE ===', 'test');
    logger.info('');
    
    await db.initDatabase();
    const saveResult = await db.saveBookmarks(bookmarks);
    
    if (!saveResult.success) {
      logger.error('Save failed', saveResult.error, 'test');
      return false;
    }
    
    results.saved = saveResult.data.saved;
    logger.success(`Saved ${saveResult.data.saved} bookmarks`, 'test');
    logger.info('');
    
    // STEP 4: Upload to NotebookLM
    logger.info('=== STEP 4: UPLOAD TO NOTEBOOKLM ===', 'test');
    logger.info('');
    logger.info('Browser will open and automatically:', 'test');
    logger.info('  - Navigate to NotebookLM', 'test');
    logger.info('  - Create/open dated notebook', 'test');
    logger.info('  - Upload all 100 bookmarks', 'test');
    logger.info('  - Rename notebook', 'test');
    logger.info('');
    
    const uploadResult = await notebooklm.uploadBookmarks(bookmarks, {
      notebookName: 'BrainBrief Test - Full Pipeline'
    });
    
    if (!uploadResult.success) {
      logger.error('Upload failed', uploadResult.error, 'test');
      return false;
    }
    
    results.uploaded = true;
    logger.success('Upload complete!', 'test');
    logger.info(`Notebook: ${uploadResult.data.notebookName}`, 'test');
    logger.info(`File: ${uploadResult.data.filePath}`, 'test');
    logger.info('');
    
    // STEP 5: Verification instructions
    logger.info('=== STEP 5: MANUAL VERIFICATION REQUIRED ===', 'test');
    logger.info('');
    logger.info('Go to NotebookLM and verify:', 'test');
    logger.info(`  1. Notebook exists: "${uploadResult.data.notebookName}"`, 'test');
    logger.info('  2. Source file appears in sources list', 'test');
    logger.info('  3. Test these queries:', 'test');
    logger.info('     - "Show me YouTube videos"', 'test');
    logger.info('     - "What PDFs are included?"', 'test');
    logger.info('     - "Summarize the threads"', 'test');
    logger.info('     - "What images were bookmarked?"', 'test');
    logger.info('');
    logger.info('Verify NotebookLM can:', 'test');
    logger.info('  ✓ Find YouTube URLs', 'test');
    logger.info('  ✓ Understand thread context', 'test');
    logger.info('  ✓ Extract PDF links', 'test');
    logger.info('  ✓ Handle image-only tweets', 'test');
    logger.info('');
    
    // SUMMARY
    results.duration = Date.now() - startTime;
    
    logger.info('='.repeat(70));
    logger.info('TEST SUMMARY');
    logger.info('='.repeat(70));
    logger.info('');
    
    logger.info(`Duration: ${(results.duration / 1000).toFixed(1)} seconds`, 'test');
    logger.info(`Extracted: ${results.extracted} bookmarks`, 'test');
    logger.info(`Saved: ${results.saved} bookmarks`, 'test');
    logger.info(`Uploaded: ${results.uploaded ? 'Yes' : 'No'}`, 'test');
    logger.info('');
    
    logger.info('Content Types:', 'test');
    Object.entries(results.contentTypes).forEach(([type, count]) => {
      if (count > 0) {
        const percentage = ((count / results.extracted) * 100).toFixed(1);
        logger.info(`  ${type}: ${count} (${percentage}%)`, 'test');
      }
    });
    logger.info('');
    
    if (results.uploaded) {
      logger.success('✅ FULL PIPELINE TEST PASSED');
      logger.info('');
      logger.info('Next: Manually verify in NotebookLM', 'test');
      return true;
    } else {
      logger.error('❌ Upload step failed');
      return false;
    }
    
  } catch (error) {
    logger.error('Test crashed', error, 'test');
    return false;
  }
}

testFullPipeline()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    logger.error('Fatal error', error);
    process.exit(1);
  });

