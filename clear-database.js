/**
 * BrainBrief - Clear Database
 * 
 * Purpose: Clear all data from database (for testing)
 * Usage: node clear-database.js
 */

const logger = require('./src/utils/logger');
const db = require('./src/db/database');

async function clearDatabase() {
  logger.info('='.repeat(70));
  logger.warn('CLEARING DATABASE');
  logger.info('='.repeat(70));
  logger.info('');
  logger.warn('This will DELETE ALL:', 'clear');
  logger.warn('  - Bookmarks', 'clear');
  logger.warn('  - Lists', 'clear');
  logger.warn('  - NotebookLM tracking data', 'clear');
  logger.warn('  - Upload history', 'clear');
  logger.info('');
  
  try {
    // Initialize database
    const dbResult = await db.initDatabase();
    if (!dbResult.success) {
      logger.error('Failed to init database', dbResult.error, 'clear');
      return false;
    }
    
    const database = dbResult.data;
    
    // Delete all data
    logger.info('Deleting bookmarks...', 'clear');
    database.exec('DELETE FROM bookmarks');
    
    logger.info('Deleting lists...', 'clear');
    database.exec('DELETE FROM lists');
    
    logger.info('Deleting NotebookLM notebooks...', 'clear');
    database.exec('DELETE FROM notebooklm_notebooks');
    
    logger.info('Deleting uploaded sources...', 'clear');
    database.exec('DELETE FROM uploaded_sources');
    
    // Reset auto-increment
    database.exec('DELETE FROM sqlite_sequence');
    
    // Save to file
    const fs = require('fs');
    const path = require('path');
    const data = database.export();
    fs.writeFileSync(path.join(__dirname, 'data/brainbrief.db'), Buffer.from(data));
    
    logger.success('✅ Database cleared', 'clear');
    logger.info('');
    logger.info('All data deleted:', 'clear');
    logger.info('  ✅ Bookmarks: 0', 'clear');
    logger.info('  ✅ Lists: 0', 'clear');
    logger.info('  ✅ Notebooks: 0', 'clear');
    logger.info('  ✅ Uploads: 0', 'clear');
    logger.info('');
    logger.success('Database is now empty - ready for fresh start!');
    
    return true;
    
  } catch (error) {
    logger.error('Failed to clear database', error, 'clear');
    return false;
  }
}

clearDatabase()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    logger.error('Fatal error', error);
    process.exit(1);
  });

