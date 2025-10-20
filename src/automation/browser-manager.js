/**
 * BrainBrief - Browser Manager
 * 
 * Manages persistent browser instances that stay open in background
 * This solves session persistence issues (Twitter/Google login)
 * 
 * @module browser-manager
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// Browser configuration
const BROWSER_DATA_DIR = path.join(__dirname, '../../browser-data');

// Singleton browser instance
let twitterBrowser = null;
let notebooklmBrowser = null;

/**
 * Get or create persistent Twitter browser
 * Browser stays open until app quits
 * 
 * @returns {Promise<BrowserContext>} Playwright browser context
 */
async function getTwitterBrowser() {
  if (twitterBrowser) {
    // Check if still alive
    try {
      const pages = twitterBrowser.pages();
      if (pages.length > 0) {
        logger.debug('Reusing existing Twitter browser', null, 'browser-manager');
        return twitterBrowser;
      }
    } catch (error) {
      logger.warn('Existing Twitter browser is dead, creating new one', 'browser-manager');
      twitterBrowser = null;
    }
  }
  
  // Create new persistent browser
  logger.info('Starting persistent Twitter browser...', 'browser-manager');
  
  // Create browser-data directory if needed
  if (!fs.existsSync(BROWSER_DATA_DIR)) {
    fs.mkdirSync(BROWSER_DATA_DIR, { recursive: true });
  }
  
  twitterBrowser = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--no-sandbox'
    ]
  });
  
  logger.success('Twitter browser started (will stay open)', 'browser-manager');
  
  return twitterBrowser;
}

/**
 * Get or create persistent NotebookLM browser
 * Separate from Twitter browser to avoid conflicts
 * 
 * @returns {Promise<BrowserContext>} Playwright browser context
 */
async function getNotebookLMBrowser() {
  if (notebooklmBrowser) {
    // Check if still alive
    try {
      const pages = notebooklmBrowser.pages();
      if (pages.length > 0) {
        logger.debug('Reusing existing NotebookLM browser', null, 'browser-manager');
        return notebooklmBrowser;
      }
    } catch (error) {
      logger.warn('Existing NotebookLM browser is dead, creating new one', 'browser-manager');
      notebooklmBrowser = null;
    }
  }
  
  // Create new persistent browser (separate profile)
  logger.info('Starting persistent NotebookLM browser...', 'browser-manager');
  
  const notebooklmDataDir = path.join(BROWSER_DATA_DIR, 'notebooklm');
  if (!fs.existsSync(notebooklmDataDir)) {
    fs.mkdirSync(notebooklmDataDir, { recursive: true });
  }
  
  notebooklmBrowser = await chromium.launchPersistentContext(notebooklmDataDir, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox'
    ]
  });
  
  logger.success('NotebookLM browser started (will stay open)', 'browser-manager');
  
  return notebooklmBrowser;
}

/**
 * Close all persistent browsers
 * Called when app quits
 */
async function closeAllBrowsers() {
  logger.info('Closing all persistent browsers...', 'browser-manager');
  
  if (twitterBrowser) {
    try {
      await twitterBrowser.close();
      logger.success('Twitter browser closed', 'browser-manager');
    } catch (error) {
      logger.warn('Failed to close Twitter browser', 'browser-manager');
    }
    twitterBrowser = null;
  }
  
  if (notebooklmBrowser) {
    try {
      await notebooklmBrowser.close();
      logger.success('NotebookLM browser closed', 'browser-manager');
    } catch (error) {
      logger.warn('Failed to close NotebookLM browser', 'browser-manager');
    }
    notebooklmBrowser = null;
  }
}

/**
 * Get new page from Twitter browser
 * Reuses existing browser, creates new page
 * 
 * @returns {Promise<Page>} New page in existing browser
 */
async function getTwitterPage() {
  const browser = await getTwitterBrowser();
  const page = await browser.newPage();
  return page;
}

/**
 * Get new page from NotebookLM browser
 * 
 * @returns {Promise<Page>} New page in existing browser
 */
async function getNotebookLMPage() {
  const browser = await getNotebookLMBrowser();
  const page = await browser.newPage();
  return page;
}

module.exports = {
  getTwitterBrowser,
  getNotebookLMBrowser,
  getTwitterPage,
  getNotebookLMPage,
  closeAllBrowsers
};

