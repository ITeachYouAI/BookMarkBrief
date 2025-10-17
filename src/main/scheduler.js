/**
 * BrainBrief - Background Scheduler
 * 
 * Purpose: Handle scheduled background syncs using node-schedule
 * Dependencies: node-schedule
 * 
 * @module scheduler
 */

const schedule = require('node-schedule');
const logger = require('../utils/logger');
const twitter = require('../automation/twitter');
const db = require('../db/database');

// Configuration
const DEFAULT_SCHEDULE = '0 8 * * *'; // Daily at 8 AM
const DEFAULT_LIMIT = 50; // Sync 50 bookmarks by default

// State
let syncJob = null;
let lastSyncResult = null;
let isScheduleEnabled = false;

/**
 * Run sync process (used by both manual and scheduled syncs)
 * 
 * @param {Object} options - Sync options
 * @param {number} options.limit - Number of bookmarks to extract
 * @param {Function} options.onProgress - Progress callback
 * @returns {Promise<Object>} { success, data, error }
 */
async function runSync(options = {}) {
  const { limit = DEFAULT_LIMIT, onProgress = null } = options;
  
  try {
    logger.info(`Starting scheduled sync (limit: ${limit})`, 'scheduler');
    
    if (onProgress) {
      onProgress({ status: 'extracting', message: 'Extracting bookmarks from Twitter...' });
    }
    
    // Extract from Twitter
    const twitterResult = await twitter.extractBookmarks({ limit });
    if (!twitterResult.success) {
      logger.error('Twitter extraction failed', twitterResult.error, 'scheduler');
      return twitterResult;
    }
    
    const bookmarks = twitterResult.data.bookmarks;
    logger.info(`Extracted ${bookmarks.length} bookmarks`, 'scheduler');
    
    if (onProgress) {
      onProgress({ status: 'saving', message: `Saving ${bookmarks.length} bookmarks to database...` });
    }
    
    // Save to database
    const saveResult = await db.saveBookmarks(bookmarks);
    if (!saveResult.success) {
      logger.error('Database save failed', saveResult.error, 'scheduler');
      return saveResult;
    }
    
    logger.success(`Sync complete: ${bookmarks.length} bookmarks saved`, 'scheduler');
    
    lastSyncResult = {
      timestamp: new Date().toISOString(),
      count: bookmarks.length,
      success: true
    };
    
    if (onProgress) {
      onProgress({ status: 'complete', message: `Synced ${bookmarks.length} bookmarks!` });
    }
    
    return {
      success: true,
      data: {
        count: bookmarks.length,
        saved: saveResult.data.saved,
        failed: saveResult.data.failed,
        timestamp: lastSyncResult.timestamp
      },
      error: null
    };
    
  } catch (error) {
    logger.error('Sync failed', error, 'scheduler');
    
    lastSyncResult = {
      timestamp: new Date().toISOString(),
      count: 0,
      success: false,
      error: error.message
    };
    
    if (onProgress) {
      onProgress({ status: 'error', message: error.message });
    }
    
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

/**
 * Start scheduled sync
 * 
 * @param {Object} config - Schedule configuration
 * @param {string} config.cronExpression - Cron expression (e.g., '0 8 * * *')
 * @param {number} config.limit - Number of bookmarks to sync
 * @returns {Object} { success, data: jobInfo, error }
 */
function startSchedule(config = {}) {
  try {
    const { cronExpression = DEFAULT_SCHEDULE, limit = DEFAULT_LIMIT } = config;
    
    // Cancel existing job if any
    if (syncJob) {
      syncJob.cancel();
      logger.info('Cancelled existing schedule', 'scheduler');
    }
    
    logger.info(`Starting schedule: ${cronExpression}`, 'scheduler');
    
    // Create new scheduled job
    syncJob = schedule.scheduleJob(cronExpression, async () => {
      logger.info('Scheduled sync triggered', 'scheduler');
      await runSync({ limit });
    });
    
    isScheduleEnabled = true;
    
    // Get next scheduled run
    const nextRun = syncJob.nextInvocation();
    logger.success(`Schedule started. Next run: ${nextRun}`, 'scheduler');
    
    return {
      success: true,
      data: {
        cronExpression,
        limit,
        nextRun: nextRun ? nextRun.toISOString() : null,
        enabled: true
      },
      error: null
    };
    
  } catch (error) {
    logger.error('Failed to start schedule', error, 'scheduler');
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

/**
 * Stop scheduled sync
 * 
 * @returns {Object} { success, data: null, error }
 */
function stopSchedule() {
  try {
    if (syncJob) {
      syncJob.cancel();
      syncJob = null;
      isScheduleEnabled = false;
      logger.success('Schedule stopped', 'scheduler');
    } else {
      logger.warn('No active schedule to stop', 'scheduler');
    }
    
    return {
      success: true,
      data: null,
      error: null
    };
    
  } catch (error) {
    logger.error('Failed to stop schedule', error, 'scheduler');
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

/**
 * Get schedule status
 * 
 * @returns {Object} { success, data: status, error }
 */
function getScheduleStatus() {
  try {
    const status = {
      enabled: isScheduleEnabled,
      nextRun: syncJob ? syncJob.nextInvocation()?.toISOString() : null,
      lastSync: lastSyncResult
    };
    
    return {
      success: true,
      data: status,
      error: null
    };
    
  } catch (error) {
    logger.error('Failed to get schedule status', error, 'scheduler');
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

/**
 * Get last sync result
 * 
 * @returns {Object} { success, data: lastSyncResult, error }
 */
function getLastSyncResult() {
  return {
    success: true,
    data: lastSyncResult,
    error: null
  };
}

module.exports = {
  runSync,
  startSchedule,
  stopSchedule,
  getScheduleStatus,
  getLastSyncResult
};

