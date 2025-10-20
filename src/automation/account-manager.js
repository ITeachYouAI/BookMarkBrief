/**
 * BrainBrief - Account Manager
 * 
 * Manages Google account detection and switching for NotebookLM
 * 
 * @module account-manager
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const BROWSER_DATA_DIR = path.join(__dirname, '../../browser-data');
const NOTEBOOKLM_URL = 'https://notebooklm.google.com';

/**
 * Detect which Google account is logged in to NotebookLM
 * 
 * @returns {Object} { success, data: { email, name }, error }
 */
async function detectGoogleAccount() {
  let context = null;
  
  try {
    // Check if browser data exists
    if (!fs.existsSync(BROWSER_DATA_DIR)) {
      return {
        success: true,
        data: { email: null, name: null, status: 'not-logged-in' },
        error: null
      };
    }
    
    // Launch browser with saved session
    context = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
      headless: true,
      timeout: 30000
    });
    
    const page = await context.newPage();
    
    // Navigate to NotebookLM
    await page.goto(NOTEBOOKLM_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Try to extract Google account info
    const accountInfo = await page.evaluate(() => {
      // Strategy 1: Look for account button/profile
      const profileButton = document.querySelector('[aria-label*="Account"], [aria-label*="Profile"]');
      if (profileButton) {
        const ariaLabel = profileButton.getAttribute('aria-label');
        // Extract email from aria-label if present
        const emailMatch = ariaLabel?.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
        if (emailMatch) {
          return { email: emailMatch[1], name: null };
        }
      }
      
      // Strategy 2: Check if logged in at all
      const loggedIn = document.body.innerText.includes('New notebook') || 
                       document.body.innerText.includes('Recent notebooks');
      
      if (loggedIn) {
        return { email: 'logged-in', name: null, status: 'connected' };
      }
      
      return { email: null, name: null, status: 'not-logged-in' };
    });
    
    await context.close();
    
    return {
      success: true,
      data: accountInfo,
      error: null
    };
    
  } catch (error) {
    logger.error('Failed to detect Google account', error, 'account');
    
    if (context) {
      await context.close().catch(() => {});
    }
    
    return {
      success: false,
      data: { email: null, name: null, status: 'error' },
      error: error.message
    };
  }
}

/**
 * Clear browser session (logout)
 * This forces re-login on next sync, allowing account switching
 * 
 * @returns {Object} { success, data, error }
 */
async function clearBrowserSession() {
  try {
    if (fs.existsSync(BROWSER_DATA_DIR)) {
      // Delete browser data folder
      fs.rmSync(BROWSER_DATA_DIR, { recursive: true, force: true });
      logger.success('Browser session cleared', 'account');
      
      return {
        success: true,
        data: { message: 'Logged out. Next sync will ask you to log in again.' },
        error: null
      };
    } else {
      return {
        success: true,
        data: { message: 'No session to clear.' },
        error: null
      };
    }
    
  } catch (error) {
    logger.error('Failed to clear browser session', error, 'account');
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

/**
 * Reset database (clears sync history)
 * Use when NotebookLM notebooks were deleted manually
 * 
 * @returns {Object} { success, data, error }
 */
async function resetDatabase() {
  try {
    const dbPath = path.join(__dirname, '../../data/brainbrief.db');
    
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      logger.success('Database reset', 'account');
    }
    
    // Also delete backup files
    const backupFiles = fs.readdirSync(path.join(__dirname, '../../data'))
      .filter(f => f.startsWith('brainbrief.db'));
    
    backupFiles.forEach(file => {
      fs.unlinkSync(path.join(__dirname, '../../data', file));
    });
    
    return {
      success: true,
      data: { message: 'Database reset. All sync history cleared.' },
      error: null
    };
    
  } catch (error) {
    logger.error('Failed to reset database', error, 'account');
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

module.exports = {
  detectGoogleAccount,
  clearBrowserSession,
  resetDatabase
};

