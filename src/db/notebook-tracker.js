/**
 * BrainBrief - NotebookLM Notebook Tracker
 * 
 * Purpose: Track NotebookLM notebooks and source counts to prevent overflow
 * Dependencies: database.js
 * 
 * @module notebook-tracker
 */

const logger = require('../utils/logger');
const db = require('./database');

// Configuration
const MAX_SOURCES_PER_NOTEBOOK = 300; // NotebookLM limit (CONFIRMED from UI: "0 / 300")

/**
 * Generate notebook name with current date
 * Format: "BrainBrief - Twitter Bookmarks - 2025-10-17"
 */
function generateNotebookName() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `BrainBrief - Twitter Bookmarks - ${year}-${month}-${day}`;
}

/**
 * Get active notebook (or create new one if needed)
 * 
 * @param {Array<Object>} bookmarks - Bookmarks being uploaded (for date extraction)
 * @returns {Promise<Object>} { success, data: { id, name, sourceCount }, error }
 */
async function getActiveNotebook(bookmarks = []) {
  try {
    const dbResult = await db.getDatabase();
    if (!dbResult.success) {
      return dbResult;
    }
    const database = dbResult.data;
    
    // Find active notebook
    const stmt = database.prepare(`
      SELECT * FROM notebooklm_notebooks 
      WHERE is_active = 1 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    stmt.step();
    const notebook = stmt.getAsObject();
    stmt.free();
    
    if (notebook && notebook.id) {
      // Check if it's full
      if (notebook.source_count >= MAX_SOURCES_PER_NOTEBOOK) {
        logger.warn(`Notebook "${notebook.notebook_name}" is full (${notebook.source_count}/${MAX_SOURCES_PER_NOTEBOOK})`, 'tracker');
        
        // Mark as inactive and create new one with bookmark dates
        await markNotebookInactive(notebook.id);
        return await createNewNotebook(bookmarks);
      }
      
      logger.info(`Active notebook: "${notebook.notebook_name}" (${notebook.source_count}/${MAX_SOURCES_PER_NOTEBOOK} sources)`, 'tracker');
      
      return {
        success: true,
        data: {
          id: notebook.id,
          name: notebook.notebook_name,
          sourceCount: notebook.source_count
        },
        error: null
      };
    } else {
      // No active notebook - create first one with bookmark dates
      logger.info('No active notebook found, creating first one', 'tracker');
      return await createNewNotebook(bookmarks);
    }
    
  } catch (error) {
    logger.error('Failed to get active notebook', error, 'tracker');
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

/**
 * Create new notebook record with date from bookmarks
 * 
 * @param {Array<Object>} bookmarks - Bookmarks being uploaded (to extract date)
 * @returns {Promise<Object>} { success, data: { id, name, sourceCount }, error }
 */
async function createNewNotebook(bookmarks = []) {
  try {
    const dbResult = await db.getDatabase();
    if (!dbResult.success) {
      return dbResult;
    }
    const database = dbResult.data;
    
    // Generate name based on most recent bookmark date (or today if no bookmarks)
    let notebookName;
    
    if (bookmarks.length > 0) {
      // Find the most recent bookmark
      const newestBookmark = bookmarks.reduce((latest, bookmark) => {
        const latestDate = new Date(latest.timestamp || latest.scraped_at);
        const currentDate = new Date(bookmark.timestamp || bookmark.scraped_at);
        return currentDate > latestDate ? bookmark : latest;
      });
      
      // Use the newest bookmark's date
      const bookmarkDate = new Date(newestBookmark.timestamp || newestBookmark.scraped_at);
      const year = bookmarkDate.getFullYear();
      const month = String(bookmarkDate.getMonth() + 1).padStart(2, '0');
      const day = String(bookmarkDate.getDate()).padStart(2, '0');
      
      notebookName = `BrainBrief - Twitter Bookmarks - ${year}-${month}-${day}`;
      logger.info(`Using date from newest bookmark: ${year}-${month}-${day}`, 'tracker');
    } else {
      // Fallback to today's date if no bookmarks provided
      notebookName = generateNotebookName();
      logger.warn('No bookmarks provided, using today\'s date', 'tracker');
    }
    
    logger.info(`Creating notebook record: "${notebookName}"`, 'tracker');
    
    // Insert new notebook
    const insertStmt = database.prepare(`
      INSERT INTO notebooklm_notebooks (notebook_name, source_count, is_active)
      VALUES (?, 0, 1)
    `);
    
    insertStmt.run([notebookName]);
    insertStmt.free();
    
    // Get the inserted notebook
    const selectStmt = database.prepare('SELECT * FROM notebooklm_notebooks WHERE notebook_name = ?');
    selectStmt.bind([notebookName]);
    selectStmt.step();
    const notebook = selectStmt.getAsObject();
    selectStmt.free();
    
    // Save to file
    const saveResult = await db.getDatabase();
    if (saveResult.success) {
      const data = saveResult.data.export();
      const fs = require('fs');
      const path = require('path');
      fs.writeFileSync(path.join(__dirname, '../../data/brainbrief.db'), Buffer.from(data));
    }
    
    logger.success(`Created notebook: "${notebookName}"`, 'tracker');
    
    return {
      success: true,
      data: {
        id: notebook.id,
        name: notebook.notebook_name,
        sourceCount: 0
      },
      error: null
    };
    
  } catch (error) {
    logger.error('Failed to create notebook', error, 'tracker');
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

/**
 * Mark notebook as inactive (full)
 * 
 * @param {number} notebookId - Notebook ID
 * @returns {Promise<Object>} { success, data: null, error }
 */
async function markNotebookInactive(notebookId) {
  try {
    const dbResult = await db.getDatabase();
    if (!dbResult.success) {
      return dbResult;
    }
    const database = dbResult.data;
    
    const stmt = database.prepare('UPDATE notebooklm_notebooks SET is_active = 0 WHERE id = ?');
    stmt.run([notebookId]);
    stmt.free();
    
    // Save to file
    const saveResult = await db.getDatabase();
    if (saveResult.success) {
      const data = saveResult.data.export();
      const fs = require('fs');
      const path = require('path');
      fs.writeFileSync(path.join(__dirname, '../../data/brainbrief.db'), Buffer.from(data));
    }
    
    logger.info(`Marked notebook ${notebookId} as inactive (full)`, 'tracker');
    
    return {
      success: true,
      data: null,
      error: null
    };
    
  } catch (error) {
    logger.error('Failed to mark notebook inactive', error, 'tracker');
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

/**
 * Record uploaded source
 * 
 * @param {number} notebookId - Notebook ID
 * @param {string} fileName - File name
 * @param {string} filePath - File path
 * @param {number} bookmarkCount - Number of bookmarks
 * @returns {Promise<Object>} { success, data: null, error }
 */
async function recordUploadedSource(notebookId, fileName, filePath, bookmarkCount) {
  try {
    const dbResult = await db.getDatabase();
    if (!dbResult.success) {
      return dbResult;
    }
    const database = dbResult.data;
    
    // Insert source record
    const insertStmt = database.prepare(`
      INSERT INTO uploaded_sources (notebook_id, file_name, file_path, bookmark_count)
      VALUES (?, ?, ?, ?)
    `);
    insertStmt.run([notebookId, fileName, filePath, bookmarkCount]);
    insertStmt.free();
    
    // Increment notebook source count
    const updateStmt = database.prepare(`
      UPDATE notebooklm_notebooks 
      SET source_count = source_count + 1,
          last_upload_at = datetime('now')
      WHERE id = ?
    `);
    updateStmt.run([notebookId]);
    updateStmt.free();
    
    // Save to file
    const saveResult = await db.getDatabase();
    if (saveResult.success) {
      const data = saveResult.data.export();
      const fs = require('fs');
      const path = require('path');
      fs.writeFileSync(path.join(__dirname, '../../data/brainbrief.db'), Buffer.from(data));
    }
    
    logger.success(`Recorded upload: ${fileName} (${bookmarkCount} bookmarks)`, 'tracker');
    
    return {
      success: true,
      data: null,
      error: null
    };
    
  } catch (error) {
    logger.error('Failed to record upload', error, 'tracker');
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

/**
 * Get upload history
 * 
 * @param {number} limit - Number of uploads to retrieve
 * @returns {Promise<Object>} { success, data: uploads[], error }
 */
async function getUploadHistory(limit = 10) {
  try {
    const dbResult = await db.getDatabase();
    if (!dbResult.success) {
      return dbResult;
    }
    const database = dbResult.data;
    
    const stmt = database.prepare(`
      SELECT 
        s.file_name,
        s.bookmark_count,
        s.uploaded_at,
        n.notebook_name
      FROM uploaded_sources s
      JOIN notebooklm_notebooks n ON s.notebook_id = n.id
      ORDER BY s.uploaded_at DESC
      LIMIT ?
    `);
    
    stmt.bind([limit]);
    
    const uploads = [];
    while (stmt.step()) {
      uploads.push(stmt.getAsObject());
    }
    stmt.free();
    
    return {
      success: true,
      data: uploads,
      error: null
    };
    
  } catch (error) {
    logger.error('Failed to get upload history', error, 'tracker');
    return {
      success: false,
      data: [],
      error: error.message
    };
  }
}

module.exports = {
  getActiveNotebook,
  createNewNotebook,
  markNotebookInactive,
  recordUploadedSource,
  getUploadHistory,
  MAX_SOURCES_PER_NOTEBOOK
};

