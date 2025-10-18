/**
 * BrainBrief - Database Module (sql.js version)
 * 
 * Purpose: SQLite database operations using sql.js (pure JavaScript, no native compilation)
 * Dependencies: sql.js, fs, path
 * 
 * @module database
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// Configuration
const DB_DIR = path.join(__dirname, '../../data');
const DB_FILE = path.join(DB_DIR, 'brainbrief.db');
const SCHEMA_FILE = path.join(__dirname, 'schema.sql');

// Singleton database instance
let SQL = null;
let db = null;

/**
 * Initialize sql.js engine
 * 
 * @returns {Promise<Object>} { success, data: SQL, error }
 */
async function initEngine() {
  try {
    if (!SQL) {
      SQL = await initSqlJs();
      logger.debug('sql.js engine initialized', null, 'db');
    }
    
    return {
      success: true,
      data: SQL,
      error: null
    };
    
  } catch (error) {
    logger.error('Failed to initialize sql.js engine', error, 'db');
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

/**
 * Save database to disk
 * 
 * @returns {Object} { success, data: null, error }
 */
function saveToFile() {
  try {
    if (!db) {
      return { success: false, data: null, error: 'Database not initialized' };
    }
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    
    // Export database to file
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
    
    return {
      success: true,
      data: null,
      error: null
    };
    
  } catch (error) {
    logger.error('Failed to save database to file', error, 'db');
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

/**
 * Initialize database and create tables
 * 
 * @returns {Promise<Object>} { success, data: db, error }
 */
async function initDatabase() {
  try {
    logger.info('Initializing database (sql.js)', 'db');
    
    // Initialize sql.js engine (simplified - no wrapper)
    if (!SQL) {
      SQL = await initSqlJs();
      logger.debug('sql.js engine initialized', null, 'db');
    }
    
    // Create data directory if it doesn't exist
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
      logger.debug('Created data directory', DB_DIR, 'db');
    }
    
    // Load existing database or create new one
    if (fs.existsSync(DB_FILE)) {
      const buffer = fs.readFileSync(DB_FILE);
      db = new SQL.Database(buffer);
      logger.success(`Database loaded: ${DB_FILE}`, 'db');
    } else {
      db = new SQL.Database();
      logger.success('New database created', 'db');
    }
    
    // Read and execute schema
    const schema = fs.readFileSync(SCHEMA_FILE, 'utf-8');
    db.exec(schema);
    
    // Save to file
    saveToFile();
    
    logger.success('Database schema initialized', 'db');
    
    return {
      success: true,
      data: db,
      error: null
    };
    
  } catch (error) {
    logger.error('Failed to initialize database', error, 'db');
    logger.error('Error details:', error.stack, 'db');
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
 * @returns {Promise<Object>} { success, data: db, error }
 */
async function getDatabase() {
  try {
    if (!db) {
      const result = await initDatabase();
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
 * @returns {Promise<Object>} { success, data: insertedId, error }
 */
async function saveBookmark(bookmark) {
  try {
    const dbResult = await getDatabase();
    if (!dbResult.success) {
      return dbResult;
    }
    const database = dbResult.data;
    
    // Insert or replace bookmark (upsert)
    const stmt = database.prepare(`
      INSERT INTO bookmarks (tweet_id, author, text, url, timestamp, scraped_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(tweet_id) DO UPDATE SET
        author = excluded.author,
        text = excluded.text,
        url = excluded.url,
        timestamp = excluded.timestamp,
        scraped_at = excluded.scraped_at
    `);
    
    stmt.run([
      bookmark.id,
      bookmark.author,
      bookmark.text,
      bookmark.url,
      bookmark.timestamp,
      bookmark.scraped_at
    ]);
    
    stmt.free();
    
    // Save to file after every insert
    saveToFile();
    
    logger.debug(`Saved bookmark: ${bookmark.id}`, null, 'db');
    
    return {
      success: true,
      data: 1, // sql.js doesn't return lastInsertRowid easily, just return 1
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
 * @returns {Promise<Object>} { success, data: { saved, failed }, error }
 */
async function saveBookmarks(bookmarks) {
  try {
    const dbResult = await getDatabase();
    if (!dbResult.success) {
      return dbResult;
    }
    
    logger.info(`Saving ${bookmarks.length} bookmarks to database`, 'db');
    
    let saved = 0;
    let failed = 0;
    
    for (const bookmark of bookmarks) {
      const result = await saveBookmark(bookmark);
      if (result.success) {
        saved++;
      } else {
        failed++;
        logger.warn(`Failed to save bookmark ${bookmark.id}`, 'db');
      }
    }
    
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
 * @returns {Promise<Object>} { success, data: bookmarks[], error }
 */
async function getBookmarks(options = {}) {
  try {
    const { limit = 100, offset = 0 } = options;
    
    const dbResult = await getDatabase();
    if (!dbResult.success) {
      return dbResult;
    }
    const database = dbResult.data;
    
    const stmt = database.prepare(`
      SELECT * FROM bookmarks
      ORDER BY scraped_at DESC
      LIMIT ? OFFSET ?
    `);
    
    stmt.bind([limit, offset]);
    
    const bookmarks = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      bookmarks.push(row);
    }
    stmt.free();
    
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
 * @returns {Promise<Object>} { success, data: count, error }
 */
async function getBookmarkCount() {
  try {
    const dbResult = await getDatabase();
    if (!dbResult.success) {
      return dbResult;
    }
    const database = dbResult.data;
    
    const stmt = database.prepare('SELECT COUNT(*) as count FROM bookmarks');
    stmt.step();
    const result = stmt.getAsObject();
    stmt.free();
    
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
 * @returns {Promise<Object>} { success, data: stats, error }
 */
async function getStats() {
  try {
    const dbResult = await getDatabase();
    if (!dbResult.success) {
      return dbResult;
    }
    const database = dbResult.data;
    
    const stmt = database.prepare('SELECT * FROM bookmark_stats');
    stmt.step();
    const stats = stmt.getAsObject();
    stmt.free();
    
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
 * @returns {Promise<Object>} { success, data: exists (boolean), error }
 */
async function bookmarkExists(tweetId) {
  try {
    const dbResult = await getDatabase();
    if (!dbResult.success) {
      return dbResult;
    }
    const database = dbResult.data;
    
    const stmt = database.prepare('SELECT COUNT(*) as count FROM bookmarks WHERE tweet_id = ?');
    stmt.bind([tweetId]);
    stmt.step();
    const result = stmt.getAsObject();
    stmt.free();
    
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
 * @returns {Promise<Object>} { success, data: null, error }
 */
async function closeDatabase() {
  try {
    if (db) {
      // Save to file before closing
      saveToFile();
      
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

