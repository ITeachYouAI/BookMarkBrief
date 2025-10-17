/**
 * BrainBrief - NotebookLM Automation
 * 
 * Purpose: Upload bookmarks to Google NotebookLM using browser automation
 * Dependencies: playwright, fs, path
 * 
 * @module notebooklm
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// Browser configuration
const BROWSER_HEADLESS = false;
const BROWSER_WIDTH = 1280;
const BROWSER_HEIGHT = 900;
const BROWSER_DATA_DIR = path.join(__dirname, '../../browser-data/notebooklm');

// Timeouts
const PAGE_LOAD_TIMEOUT_MS = 60000;
const UPLOAD_TIMEOUT_MS = 30000;
const PROCESSING_CHECK_INTERVAL_MS = 2000;
const MAX_PROCESSING_WAIT_SEC = 300; // 5 minutes

// URLs
const NOTEBOOKLM_BASE_URL = 'https://notebooklm.google.com';

// Selectors (will need to be discovered)
const SELECTOR_NEW_NOTEBOOK = '[aria-label="New notebook"]';
const SELECTOR_UPLOAD_BUTTON = '[aria-label="Upload"]';
const SELECTOR_FILE_INPUT = 'input[type="file"]';

/**
 * Initialize browser with persistent context for NotebookLM
 * 
 * @returns {Object} { success, data: context, error }
 */
async function initBrowser() {
  try {
    logger.info('Launching browser for NotebookLM', 'notebooklm');
    
    // Create browser-data directory if it doesn't exist
    if (!fs.existsSync(BROWSER_DATA_DIR)) {
      fs.mkdirSync(BROWSER_DATA_DIR, { recursive: true });
      logger.debug('Created browser data directory', BROWSER_DATA_DIR, 'notebooklm');
    }
    
    // Launch browser with persistent context
    const context = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
      headless: BROWSER_HEADLESS,
      viewport: { width: BROWSER_WIDTH, height: BROWSER_HEIGHT },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage'
      ]
    });
    
    logger.success('Browser launched for NotebookLM', 'notebooklm');
    
    return {
      success: true,
      data: context,
      error: null
    };
    
  } catch (error) {
    logger.error('Failed to launch browser', error, 'notebooklm');
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

/**
 * Check if user is logged into Google
 * 
 * @param {Page} page - Playwright page object
 * @returns {Promise<boolean>} True if logged in
 */
async function _isLoggedIn(page) {
  try {
    // Look for Google account avatar or profile button
    const loggedIn = await page.locator('[aria-label*="Google Account"]').isVisible({ timeout: 3000 })
      .catch(() => page.locator('[aria-label*="Profile"]').isVisible({ timeout: 3000 }))
      .catch(() => false);
    return loggedIn;
  } catch (error) {
    return false;
  }
}

/**
 * Navigate to NotebookLM and handle login
 * 
 * @param {BrowserContext} context - Playwright browser context
 * @returns {Object} { success, data: page, error }
 */
async function navigateToNotebookLM(context) {
  try {
    const page = await context.newPage();
    
    logger.info('Navigating to NotebookLM', 'notebooklm');
    await page.goto(NOTEBOOKLM_BASE_URL, { 
      waitUntil: 'domcontentloaded', 
      timeout: PAGE_LOAD_TIMEOUT_MS 
    });
    
    // Wait for page to settle
    await page.waitForTimeout(3000);
    
    // Check if logged in
    const loggedIn = await _isLoggedIn(page);
    
    if (!loggedIn) {
      logger.warn('Not logged in to Google', 'notebooklm');
      logger.info('Please log in to Google/NotebookLM in the browser window', 'notebooklm');
      logger.info('Waiting up to 120 seconds for login...', 'notebooklm');
      
      // Wait for user to log in manually
      let attempts = 0;
      const maxAttempts = 60; // 2 minutes
      
      while (attempts < maxAttempts) {
        await page.waitForTimeout(2000);
        
        const nowLoggedIn = await _isLoggedIn(page);
        if (nowLoggedIn) {
          logger.success('Successfully logged in to Google', 'notebooklm');
          // Navigate again after login
          await page.goto(NOTEBOOKLM_BASE_URL, { 
            waitUntil: 'domcontentloaded', 
            timeout: PAGE_LOAD_TIMEOUT_MS 
          });
          await page.waitForTimeout(3000);
          break;
        }
        
        attempts++;
      }
      
      if (attempts >= maxAttempts) {
        throw new Error('Login timeout: Please try again');
      }
    } else {
      logger.success('Already logged in to NotebookLM', 'notebooklm');
    }
    
    return {
      success: true,
      data: page,
      error: null
    };
    
  } catch (error) {
    logger.error('Failed to navigate to NotebookLM', error, 'notebooklm');
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

/**
 * Create bookmark text file for upload
 * 
 * @param {Array<Object>} bookmarks - Array of bookmark objects
 * @param {string} outputPath - Output file path
 * @returns {Object} { success, data: filePath, error }
 */
function createBookmarkFile(bookmarks, outputPath) {
  try {
    logger.info(`Creating bookmark file with ${bookmarks.length} bookmarks`, 'notebooklm');
    
    let content = '# Twitter Bookmarks\n\n';
    content += `Exported: ${new Date().toISOString()}\n`;
    content += `Total bookmarks: ${bookmarks.length}\n\n`;
    content += '---\n\n';
    
    bookmarks.forEach((bookmark, index) => {
      content += `## Bookmark ${index + 1}\n\n`;
      content += `**Author:** ${bookmark.author}\n`;
      content += `**URL:** ${bookmark.url}\n`;
      content += `**Date:** ${bookmark.timestamp}\n\n`;
      
      if (bookmark.text) {
        content += `**Content:**\n${bookmark.text}\n\n`;
      }
      
      content += '---\n\n';
    });
    
    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write file
    fs.writeFileSync(outputPath, content, 'utf-8');
    
    logger.success(`Created bookmark file: ${outputPath}`, 'notebooklm');
    
    return {
      success: true,
      data: outputPath,
      error: null
    };
    
  } catch (error) {
    logger.error('Failed to create bookmark file', error, 'notebooklm');
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

/**
 * Upload file to NotebookLM (placeholder - needs UI discovery)
 * 
 * @param {Page} page - Playwright page object
 * @param {string} filePath - Path to file to upload
 * @returns {Object} { success, data: null, error }
 */
async function uploadFile(page, filePath) {
  try {
    logger.info('Uploading file to NotebookLM', 'notebooklm');
    logger.warn('NotebookLM upload automation is experimental', 'notebooklm');
    logger.info('You may need to upload manually in the browser window', 'notebooklm');
    
    // TODO(v1.0): Discover NotebookLM UI selectors
    // For now, just keep browser open so user can upload manually
    logger.info('Browser will stay open for manual upload', 'notebooklm');
    logger.info(`File ready at: ${filePath}`, 'notebooklm');
    logger.info('Press Ctrl+C when done uploading', 'notebooklm');
    
    // Keep browser open
    await new Promise(resolve => {
      // Wait indefinitely (user will Ctrl+C)
    });
    
    return {
      success: true,
      data: null,
      error: null
    };
    
  } catch (error) {
    logger.error('Upload process interrupted', error, 'notebooklm');
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

/**
 * Upload bookmarks to NotebookLM (main function)
 * 
 * @param {Array<Object>} bookmarks - Array of bookmark objects
 * @param {Object} options - Upload options
 * @param {string} options.notebookName - Notebook name
 * @returns {Object} { success, data: { uploaded, filePath }, error }
 */
async function uploadBookmarks(bookmarks, options = {}) {
  const { notebookName = 'Twitter Bookmarks' } = options;
  
  let context = null;
  
  try {
    logger.info('Starting NotebookLM upload process', 'notebooklm');
    logger.info(`Notebook: ${notebookName}`, 'notebooklm');
    logger.info(`Bookmarks to upload: ${bookmarks.length}`, 'notebooklm');
    
    // Create bookmark file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `twitter-bookmarks-${timestamp}.txt`;
    const filePath = path.join(__dirname, '../../data/exports', filename);
    
    const fileResult = createBookmarkFile(bookmarks, filePath);
    if (!fileResult.success) {
      return {
        success: false,
        data: { uploaded: false, filePath: null },
        error: fileResult.error
      };
    }
    
    // Initialize browser
    const browserResult = await initBrowser();
    if (!browserResult.success) {
      return {
        success: false,
        data: { uploaded: false, filePath: filePath },
        error: browserResult.error
      };
    }
    context = browserResult.data;
    
    // Navigate to NotebookLM
    const navResult = await navigateToNotebookLM(context);
    if (!navResult.success) {
      return {
        success: false,
        data: { uploaded: false, filePath: filePath },
        error: navResult.error
      };
    }
    const page = navResult.data;
    
    // Upload file (manual for now)
    const uploadResult = await uploadFile(page, filePath);
    
    return {
      success: uploadResult.success,
      data: {
        uploaded: uploadResult.success,
        filePath: filePath
      },
      error: uploadResult.error
    };
    
  } catch (error) {
    logger.error('NotebookLM upload failed', error, 'notebooklm');
    return {
      success: false,
      data: { uploaded: false, filePath: null },
      error: error.message
    };
    
  } finally {
    // Don't close browser (user needs to upload manually)
    logger.info('Browser will remain open', 'notebooklm');
  }
}

/**
 * Test upload (create file only, no browser)
 * 
 * @param {Array<Object>} bookmarks - Array of bookmark objects
 * @returns {Object} { success, data: filePath, error }
 */
function testFileCreation(bookmarks) {
  logger.info('Testing file creation (no upload)', 'notebooklm');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `test-bookmarks-${timestamp}.txt`;
  const filePath = path.join(__dirname, '../../data/exports', filename);
  
  return createBookmarkFile(bookmarks, filePath);
}

module.exports = {
  uploadBookmarks,
  testFileCreation,
  createBookmarkFile
};

