/**
 * BrainBrief - Twitter Extraction Test
 * 
 * Purpose: Validate Twitter scraping functionality
 * Usage: node test-twitter.js
 * 
 * @module test-twitter
 */

const { testExtraction } = require('./src/automation/twitter');
const logger = require('./src/utils/logger');

/**
 * Run Twitter extraction test
 * 
 * @returns {Promise<void>}
 */
async function main() {
  logger.info('='.repeat(60));
  logger.info('BRAINBRIEF - TWITTER EXTRACTION TEST');
  logger.info('='.repeat(60));
  logger.info('');
  
  // Run test extraction (1 bookmark)
  const result = await testExtraction();
  
  logger.info('');
  logger.info('='.repeat(60));
  
  if (result.success) {
    logger.success(`Test passed: Extracted ${result.data.count} bookmark(s)`);
    
    if (result.data.bookmarks && result.data.bookmarks.length > 0) {
      logger.info('Sample bookmark:');
      console.log(JSON.stringify(result.data.bookmarks[0], null, 2));
    }
    
    logger.info('');
    logger.success('✅ Twitter extraction is working correctly');
    process.exit(0);
    
  } else {
    logger.error(`Test failed: ${result.error}`);
    logger.info('');
    logger.error('❌ Twitter extraction test failed');
    process.exit(1);
  }
}

// Run test
main().catch(error => {
  logger.error('Fatal test error', error);
  process.exit(1);
});
