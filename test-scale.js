/**
 * BrainBrief - Scale Test
 * 
 * Purpose: Test extraction at realistic scale (100+ bookmarks)
 * Usage: node test-scale.js [limit]
 * 
 * @module test-scale
 */

const logger = require('./src/utils/logger');
const twitter = require('./src/automation/twitter');
const db = require('./src/db/database');

/**
 * Run scale test
 * 
 * @param {number} limit - Number of bookmarks to extract
 * @returns {Promise<Object>} Test results
 */
async function testScale(limit = 100) {
  logger.info('='.repeat(70));
  logger.info(`BRAINBRIEF - SCALE TEST (${limit} bookmarks)`);
  logger.info('='.repeat(70));
  logger.info('');
  logger.info('This test will:', 'test');
  logger.info(`  1. Extract ${limit} bookmarks from Twitter`, 'test');
  logger.info('  2. Save all to database', 'test');
  logger.info('  3. Measure performance and success rate', 'test');
  logger.info('  4. Identify any failures or edge cases', 'test');
  logger.info('');
  logger.warn('This may take 5-10 minutes. Browser will open.', 'test');
  logger.info('');
  
  const startTime = Date.now();
  const metrics = {
    targetCount: limit,
    extractedCount: 0,
    savedCount: 0,
    failedCount: 0,
    duration: 0,
    successRate: 0,
    errors: []
  };
  
  try {
    // Step 1: Extract bookmarks
    logger.info('Step 1: Extracting bookmarks from Twitter...', 'test');
    
    const extractResult = await twitter.extractBookmarks({ limit });
    
    if (!extractResult.success) {
      logger.error('Extraction failed completely', extractResult.error, 'test');
      metrics.errors.push({ stage: 'extraction', error: extractResult.error });
      return metrics;
    }
    
    metrics.extractedCount = extractResult.data.count;
    logger.success(`Extracted ${metrics.extractedCount} bookmarks`, 'test');
    
    // Analyze extracted bookmarks
    const bookmarks = extractResult.data.bookmarks;
    const withText = bookmarks.filter(b => b.text && b.text.length > 0).length;
    const withoutText = bookmarks.filter(b => !b.text || b.text.length === 0).length;
    
    logger.info('Bookmark analysis:', 'test');
    logger.info(`  With text: ${withText}`, 'test');
    logger.info(`  Without text (images/videos only): ${withoutText}`, 'test');
    
    // Step 2: Save to database
    logger.info('');
    logger.info('Step 2: Saving to database...', 'test');
    
    const dbInit = await db.initDatabase();
    if (!dbInit.success) {
      logger.error('Database init failed', dbInit.error, 'test');
      metrics.errors.push({ stage: 'database', error: dbInit.error });
      return metrics;
    }
    
    const saveResult = await db.saveBookmarks(bookmarks);
    
    if (!saveResult.success) {
      logger.error('Save failed completely', saveResult.error, 'test');
      metrics.errors.push({ stage: 'save', error: saveResult.error });
      return metrics;
    }
    
    metrics.savedCount = saveResult.data.saved;
    metrics.failedCount = saveResult.data.failed;
    
    logger.success(`Saved ${metrics.savedCount} bookmarks`, 'test');
    if (metrics.failedCount > 0) {
      logger.warn(`Failed to save ${metrics.failedCount} bookmarks`, 'test');
    }
    
    // Step 3: Calculate metrics
    metrics.duration = Date.now() - startTime;
    metrics.successRate = (metrics.extractedCount / metrics.targetCount * 100).toFixed(1);
    
    // Step 4: Performance analysis
    logger.info('');
    logger.info('='.repeat(70));
    logger.info('SCALE TEST RESULTS');
    logger.info('='.repeat(70));
    logger.info('');
    
    logger.info('Performance:', 'test');
    logger.info(`  Duration: ${(metrics.duration / 1000).toFixed(1)} seconds`, 'test');
    logger.info(`  Speed: ${(metrics.extractedCount / (metrics.duration / 1000)).toFixed(1)} bookmarks/sec`, 'test');
    
    logger.info('');
    logger.info('Success Rate:', 'test');
    logger.info(`  Target: ${metrics.targetCount}`, 'test');
    logger.info(`  Extracted: ${metrics.extractedCount}`, 'test');
    logger.info(`  Saved: ${metrics.savedCount}`, 'test');
    logger.info(`  Failed: ${metrics.failedCount}`, 'test');
    logger.info(`  Success Rate: ${metrics.successRate}%`, 'test');
    
    logger.info('');
    
    // Verdict
    const passThreshold = 95; // 95% success rate required
    
    if (parseFloat(metrics.successRate) >= passThreshold) {
      logger.success(`✅ SCALE TEST PASSED (${metrics.successRate}% ≥ ${passThreshold}%)`);
      logger.success('BrainBrief handles scale correctly!');
    } else {
      logger.error(`❌ SCALE TEST FAILED (${metrics.successRate}% < ${passThreshold}%)`);
      logger.error('Need to improve extraction reliability');
    }
    
    logger.info('='.repeat(70));
    
    return metrics;
    
  } catch (error) {
    logger.error('Scale test crashed', error, 'test');
    metrics.errors.push({ stage: 'crash', error: error.message });
    return metrics;
  }
}

// Parse command line argument
const limit = parseInt(process.argv[2]) || 100;

// Run test
testScale(limit)
  .then(metrics => {
    const success = parseFloat(metrics.successRate) >= 95;
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    logger.error('Fatal error', error);
    process.exit(1);
  });

