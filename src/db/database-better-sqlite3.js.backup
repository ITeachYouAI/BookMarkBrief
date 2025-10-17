/**
 * BrainBrief - Database Module
 * 
 * Purpose: SQLite database operations for storing bookmarks and lists locally
 * Dependencies: better-sqlite3, fs, path
 * 
 * @module database
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// Configuration
const DB_DIR = path.join(__dirname, '../../data');
const DB_FILE = path.join(DB_DIR, 'brainbrief.db');
const SCHEMA_FILE = path.join(__dirname, 'schema.sql');

// Singleton database instance
let db = null;

/**
 * Initialize database and create tables
 * 
 * @returns {Object} { success, data: db, error }
 */
function initDatabase() {
  try {
    logger.info('Initializing database', 'db');
    
    // Create data directory if it doesn't exist
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
      logger.debug('Created data directory', DB_DIR, 'db');
    }
    
    // Open database connection
    db = new Database(DB_FILE);
    db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better performance
    
    logger.success(`Database opened: ${DB_FILE}`, 'db');
    
    // Read and execute schema
    const schema = fs.readFileSync(SCHEMA_FILE, 'utf-8');
    db.exec(schema);
    
    logger.success('Database schema initialized', 'db');
    
    return {
      success: true,
      data: db,
      error: null
    };
    
  } catch (error) {
    logger.error('Failed to initialize database', error, 'db');
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

/**
 * Get database instance (initialize if not exists)
 * 
 * @returns {Object} { success, data: db, error }
 */
function getDatabase() {
  try {
    if (!db) {
      const result = initDatabase();
      if (!result.success) {
        return result;
      }
    }
    
    return {
      success: true,
      data: db,
      error: null
    };
    
  } catch (error) {
    logger.error('Failed to get database', error, 'db');
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

/**
 * Save a bookmark to database
 * 
 * @param {Object} bookmark - Bookmark data
 * @param {string} bookmark.id - Tweet ID
 * @param {string} bookmark.author - Author username
 * @param {string} bookmark.text - Tweet text
 * @param {string} bookmark.url - Tweet URL
 * @param {string} bookmark.timestamp - Tweet timestamp
 * @param {string} bookmark.scraped_at - Scrape timestamp
 * @returns {Object} { success, data: insertedId, error }
 */
function saveBookmark(bookmark) {
  try {
    const dbResult = getDatabase();
    if (!dbResult.success) {
      return dbResult;
    }
    const db = dbResult.data;
    
    // Insert or replace bookmark (upsert)
    const stmt = db.prepare(`
      INSERT INTO bookmarks (tweet_id, author, text, url, timestamp, scraped_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(tweet_id) DO UPDATE SET
        author = excluded.author,
        text = excluded.text,
        url = excluded.url,
        timestamp = excluded.timestamp,
        scraped_at = excluded.scraped_at
    `);
    
    const result = stmt.run(
      bookmark.id,
      bookmark.author,
      bookmark.text,
      bookmark.url,
      bookmark.timestamp,
      bookmark.scraped_at
    );
    
    logger.debug(`Saved bookmark: ${bookmark.id}`, null, 'db');
    
    return {
      success: true,
      data: result.lastInsertRowid,
      error: null
    };
    
  } catch (error) {
    logger.error('Failed to save bookmark', error, 'db');
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

/**
 * Save multiple bookmarks (batch insert)
 * 
 * @param {Array<Object>} bookmarks - Array of bookmark objects
 * @returns {Object} { success, data: { saved, failed }, error }
 */
function saveBookmarks(bookmarks) {
  try {
    const dbResult = getDatabase();
    if (!dbResult.success) {
      return dbResult;
    }
    
    logger.info(`Saving ${bookmarks.length} bookmarks to database`, 'db');
    
    let saved = 0;
    let failed = 0;
    
    // Use transaction for batch insert
    const saveAll = db.transaction(() => {
      for (const bookmark of bookmarks) {
        const result = saveBookmark(bookmark);
        if (result.success) {
          saved++;
        } else {
          failed++;
          logger.warn(`Failed to save bookmark ${bookmark.id}`, 'db');
        }
      }
    });
    
    saveAll();
    
    logger.success(`Saved ${saved} bookmarks (${failed} failed)`, 'db');
    
    return {
      success: true,
      data: { saved, failed },
      error: null
    };
    
  } catch (error) {
    logger.error('Failed to save bookmarks', error, 'db');
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

/**
 * Get bookmarks from database
 * 
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum bookmarks to return
 * @param {number} options.offset - Offset for pagination
 * @returns {Object} { success, data: bookmarks[], error }
 */
function getBookmarks(options = {}) {
  try {
    const { limit = 100, offset = 0 } = options;
    
    const dbResult = getDatabase();
    if (!dbResult.success) {
      return dbResult;
    }
    const db = dbResult.data;
    
    const stmt = db.prepare(`
      SELECT * FROM bookmarks
      ORDER BY scraped_at DESC
      LIMIT ? OFFSET ?
    `);
    
    const bookmarks = stmt.all(limit, offset);
    
    logger.debug(`Retrieved ${bookmarks.length} bookmarks`, null, 'db');
    
    return {
      success: true,
      data: bookmarks,
      error: null
    };
    
  } catch (error) {
    logger.error('Failed to get bookmarks', error, 'db');
    return {
      success: false,
      data: [],
      error: error.message
    };
  }
}

/**
 * Get bookmark count
 * 
 * @returns {Object} { success, data: count, error }
 */
function getBookmarkCount() {
  try {
    const dbResult = getDatabase();
    if (!dbResult.success) {
      return dbResult;
    }
    const db = dbResult.data;
    
    const stmt = db.prepare('SELECT COUNT(*) as count FROM bookmarks');
    const result = stmt.get();
    
    logger.debug(`Total bookmarks: ${result.count}`, null, 'db');
    
    return {
      success: true,
      data: result.count,
      error: null
    };
    
  } catch (error) {
    logger.error('Failed to get bookmark count', error, 'db');
    return {
      success: false,
      data: 0,
      error: error.message
    };
  }
}

/**
 * Get database stats (for UI display)
 * 
 * @returns {Object} { success, data: { total_bookmarks, total_lists, last_sync }, error }
 */
function getStats() {
  try {
    const dbResult = getDatabase();
    if (!dbResult.success) {
      return dbResult;
    }
    const db = dbResult.data;
    
    const stmt = db.prepare('SELECT * FROM bookmark_stats');
    const stats = stmt.get();
    
    return {
      success: true,
      data: stats || { total_bookmarks: 0, total_lists: 0, last_sync: null },
      error: null
    };
    
  } catch (error) {
    logger.error('Failed to get stats', error, 'db');
    return {
      success: false,
      data: { total_bookmarks: 0, total_lists: 0, last_sync: null },
      error: error.message
    };
  }
}

/**
 * Check if bookmark exists
 * 
 * @param {string} tweetId - Tweet ID to check
 * @returns {Object} { success, data: exists (boolean), error }
 */
function bookmarkExists(tweetId) {
  try {
    const dbResult = getDatabase();
    if (!dbResult.success) {
      return dbResult;
    }
    const db = dbResult.data;
    
    const stmt = db.prepare('SELECT COUNT(*) as count FROM bookmarks WHERE tweet_id = ?');
    const result = stmt.get(tweetId);
    
    return {
      success: true,
      data: result.count > 0,
      error: null
    };
    
  } catch (error) {
    logger.error('Failed to check bookmark existence', error, 'db');
    return {
      success: false,
      data: false,
      error: error.message
    };
  }
}

/**
 * Close database connection
 * 
 * @returns {Object} { success, data: null, error }
 */
function closeDatabase() {
  try {
    if (db) {
      db.close();
      db = null;
      logger.info('Database connection closed', 'db');
    }
    
    return {
      success: true,
      data: null,
      error: null
    };
    
  } catch (error) {
    logger.error('Failed to close database', error, 'db');
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

module.exports = {
  initDatabase,
  getDatabase,
  saveBookmark,
  saveBookmarks,
  getBookmarks,
  getBookmarkCount,
  getStats,
  bookmarkExists,
  closeDatabase
};

