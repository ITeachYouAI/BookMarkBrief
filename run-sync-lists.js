#!/usr/bin/env node
/**
 * Sync Twitter Lists to NotebookLM
 * 
 * Uses the EXACT SAME pipeline as bookmarks:
 * 1. Extract tweets from each enabled list
 * 2. Upload to NotebookLM (separate notebook per list)
 */

const fs = require('fs');
const path = require('path');
const { extractListTweets } = require('./src/automation/twitter');
const { uploadListTweets } = require('./src/automation/notebooklm');
const logger = require('./src/utils/logger');

const CONFIG_FILE = path.join(__dirname, 'lists-config.json');

async function syncLists() {
  try {
    logger.info('='.repeat(70));
    logger.info('BRAINBRIEF - TWITTER LISTS SYNC');
    logger.info('='.repeat(70));
    logger.info('');
    
    // Load config
    if (!fs.existsSync(CONFIG_FILE)) {
      logger.error('lists-config.json not found!', null, 'sync');
      logger.info('Run: node click-lists.js to discover your lists', 'sync');
      process.exit(1);
    }
    
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    const enabledLists = config.lists.filter(l => l.enabled);
    
    if (enabledLists.length === 0) {
      logger.warn('No enabled lists in config!', 'sync');
      logger.info('Edit lists-config.json and set enabled: true', 'sync');
      process.exit(0);
    }
    
    logger.info(`Found ${enabledLists.length} enabled lists to sync`, 'sync');
    logger.info('');
    
    // Sync each list
    for (const [index, list] of enabledLists.entries()) {
      logger.info(`[${ index + 1}/${enabledLists.length}] Syncing list: "${list.name}"`, 'sync');
      logger.info('');
      
      // Step 1: Extract tweets
      const extractResult = await extractListTweets(list);
      
      if (!extractResult.success) {
        logger.error(`Failed to extract list "${list.name}"`, extractResult.error, 'sync');
        continue; // Skip to next list
      }
      
      const tweets = extractResult.data.tweets;
      logger.success(`Extracted ${tweets.length} tweets`, 'sync');
      logger.info('');
      
      if (tweets.length === 0) {
        logger.warn(`No tweets in list "${list.name}", skipping upload`, 'sync');
        logger.info('');
        continue;
      }
      
      // Step 2: Upload to NotebookLM
      const uploadResult = await uploadListTweets(tweets, {
        name: list.name,
        listId: list.listId,
        url: list.url
      });
      
      if (!uploadResult.success) {
        logger.error(`Failed to upload list "${list.name}"`, uploadResult.error, 'sync');
        continue;
      }
      
      logger.success(`✅ List "${list.name}" synced successfully!`, 'sync');
      logger.info('');
    }
    
    logger.success('='.repeat(70), 'sync');
    logger.success('✅ ALL LISTS SYNCED!', 'sync');
    logger.success('='.repeat(70), 'sync');
    logger.info('');
    
  } catch (error) {
    logger.error('Unexpected error during list sync', error, 'sync');
    process.exit(1);
  }
}

if (require.main === module) {
  syncLists().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { syncLists };

