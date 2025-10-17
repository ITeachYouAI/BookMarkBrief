/**
 * BrainBrief - Twitter Automation
 * 
 * Purpose: Scrape Twitter bookmarks and lists using Playwright with persistent sessions
 * Dependencies: playwright, fs, path
 * 
 * @module twitter
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// Browser configuration
const BROWSER_HEADLESS = false;
const BROWSER_WIDTH = 1280;
const BROWSER_HEIGHT = 900;
const BROWSER_DATA_DIR = path.join(__dirname, '../../browser-data');

// Rate limiting
const SCROLL_DELAY_MS = 2000;
const LOGIN_CHECK_INTERVAL_MS = 2000;
const LOGIN_TIMEOUT_SEC = 120;

// URLs
const TWITTER_BASE_URL = 'https://twitter.com';
const TWITTER_BOOKMARKS_URL = `${TWITTER_BASE_URL}/i/bookmarks`;
const TWITTER_LISTS_URL = `${TWITTER_BASE_URL}/i/lists`;

// Selectors
const SELECTOR_ACCOUNT_SWITCHER = '[data-testid="SideNav_AccountSwitcher_Button"]';
const SELECTOR_TWEET = 'article[data-testid="tweet"]';
const SELECTOR_TWEET_TEXT = '[data-testid="tweetText"]';
const SELECTOR_USER_NAME = '[data-testid="User-Name"]';
const SELECTOR_TIMESTAMP = 'time';

/**
 * Initialize browser with persistent context
 * 
 * @returns {Object} { success, data: context, error }
 */
async function initBrowser() {
  try {
    logger.info('Launching browser with persistent context', 'twitter');
    
    // Create browser-data directory if it doesn't exist
    if (!fs.existsSync(BROWSER_DATA_DIR)) {
      fs.mkdirSync(BROWSER_DATA_DIR, { recursive: true });
      logger.debug('Created browser data directory', BROWSER_DATA_DIR, 'twitter');
    }
    
    // Launch browser with persistent context (saves login session)
    // Add args to reduce bot detection
    const context = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
      headless: BROWSER_HEADLESS,
      viewport: { width: BROWSER_WIDTH, height: BROWSER_HEIGHT },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      args: [
        '--disable-blink-features=AutomationControlled', // Hide automation
        '--disable-dev-shm-usage',
        '--disable-web-security', // Allow cross-origin (for OAuth)
        '--no-sandbox'
      ]
    });
    
    logger.success('Browser launched successfully', 'twitter');
    
    return {
      success: true,
      data: context,
      error: null
    };
    
  } catch (error) {
    logger.error('Failed to launch browser', error, 'twitter');
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

/**
 * Check if user is logged into Twitter
 * 
 * @param {Page} page - Playwright page object
 * @returns {Promise<boolean>} True if logged in
 */
async function _isLoggedIn(page) {
  try {
    const loggedIn = await page.locator(SELECTOR_ACCOUNT_SWITCHER).isVisible({ timeout: 3000 });
    return loggedIn;
  } catch (error) {
    return false;
  }
}

/**
 * Wait for user to log into Twitter
 * 
 * @param {Page} page - Playwright page object
 * @returns {Object} { success, data: null, error }
 */
async function _waitForLogin(page) {
  try {
    logger.warn('Not logged in to Twitter', 'twitter');
    logger.info('Please log in to Twitter in the browser window', 'twitter');
    logger.info(`Waiting up to ${LOGIN_TIMEOUT_SEC} seconds for login...`, 'twitter');
    
    const maxAttempts = Math.floor((LOGIN_TIMEOUT_SEC * 1000) / LOGIN_CHECK_INTERVAL_MS);
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      await page.waitForTimeout(LOGIN_CHECK_INTERVAL_MS);
      
      const nowLoggedIn = await _isLoggedIn(page);
      if (nowLoggedIn) {
        logger.success('Successfully logged in to Twitter', 'twitter');
        return {
          success: true,
          data: null,
          error: null
        };
      }
      
      attempts++;
    }
    
    throw new Error(`Login timeout after ${LOGIN_TIMEOUT_SEC} seconds`);
    
  } catch (error) {
    logger.error('Login failed', error, 'twitter');
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

/**
 * Navigate to Twitter bookmarks page
 * 
 * @param {BrowserContext} context - Playwright browser context
 * @returns {Object} { success, data: page, error }
 */
async function navigateToBookmarks(context) {
  try {
    const page = await context.newPage();
    
    // IMPORTANT: Go to Twitter home first (not bookmarks directly)
    // This avoids OAuth redirect issues with automated browsers
    logger.info('Navigating to Twitter (will check login)', 'twitter');
    await page.goto(TWITTER_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Wait a moment for page to settle
    await page.waitForTimeout(2000);
    
    // Check if logged in
    const loggedIn = await _isLoggedIn(page);
    
    if (!loggedIn) {
      logger.warn('Not logged in to Twitter', 'twitter');
      logger.info('Please log in to Twitter in the browser window', 'twitter');
      logger.info('(You can use Email/Password OR click "Sign in with Google" manually)', 'twitter');
      logger.info(`Waiting up to ${LOGIN_TIMEOUT_SEC} seconds for login...`, 'twitter');
      
      // Wait for user to log in manually
      const loginResult = await _waitForLogin(page);
      if (!loginResult.success) {
        return loginResult;
      }
    } else {
      logger.success('Already logged in to Twitter', 'twitter');
    }
    
    // Now navigate to bookmarks (after confirming login)
    logger.info('Navigating to Twitter bookmarks', 'twitter');
    await page.goto(TWITTER_BOOKMARKS_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000); // Let page settle
    
    return {
      success: true,
      data: page,
      error: null
    };
    
  } catch (error) {
    logger.error('Failed to navigate to bookmarks', error, 'twitter');
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

/**
 * Extract tweet data from DOM element (runs in browser context)
 * 
 * @param {Element} tweetElement - Tweet DOM element
 * @param {number} index - Tweet index
 * @returns {Object|null} Tweet data or null if extraction failed
 */
function _extractTweetData(tweetElement, index) {
  try {
    // Extract text content
    const textElement = tweetElement.querySelector('[data-testid="tweetText"]');
    const text = textElement ? textElement.innerText : '';
    
    // Extract author
    const authorElement = tweetElement.querySelector('[data-testid="User-Name"]');
    const author = authorElement ? authorElement.innerText.split('\n')[0] : 'Unknown';
    
    // Extract tweet URL
    const timeElement = tweetElement.querySelector('time');
    let url = '';
    if (timeElement && timeElement.parentElement) {
      url = timeElement.parentElement.href || '';
    }
    
    // Extract timestamp
    const timestamp = timeElement ? timeElement.getAttribute('datetime') : new Date().toISOString();
    
    // Generate tweet ID from URL or fallback to index
    const tweetId = url ? url.split('/').pop() : `bookmark_${index}`;
    
    return {
      id: tweetId,
      author: author,
      text: text,
      url: url,
      timestamp: timestamp,
      scraped_at: new Date().toISOString()
    };
  } catch (error) {
    return null;
  }
}

/**
 * Scrape bookmarks from current page
 * 
 * @param {Page} page - Playwright page object
 * @param {number} limit - Maximum number of bookmarks to extract
 * @returns {Object} { success, data: bookmarks[], error }
 */
async function scrapeBookmarks(page, limit = 10) {
  try {
    logger.info(`Extracting up to ${limit} bookmarks`, 'twitter');
    
    const bookmarks = [];
    let previousCount = 0;
    let noNewTweetsCount = 0;
    const maxNoNewAttempts = 3;
    
    while (bookmarks.length < limit && noNewTweetsCount < maxNoNewAttempts) {
      // Extract all currently visible tweets
      const tweets = await page.evaluate((extractFn) => {
        const tweetElements = document.querySelectorAll('article[data-testid="tweet"]');
        const results = [];
        
        tweetElements.forEach((tweet, index) => {
          const data = eval(`(${extractFn})`)(tweet, index);
          if (data) {
            results.push(data);
          }
        });
        
        return results;
      }, _extractTweetData.toString());
      
      // Add new tweets (avoid duplicates)
      const existingIds = new Set(bookmarks.map(b => b.id));
      const newTweets = tweets.filter(t => !existingIds.has(t.id));
      bookmarks.push(...newTweets);
      
      logger.debug(`Extracted ${bookmarks.length} bookmarks so far`, null, 'twitter');
      
      // Check if we got new tweets
      if (bookmarks.length === previousCount) {
        noNewTweetsCount++;
      } else {
        noNewTweetsCount = 0;
      }
      previousCount = bookmarks.length;
      
      // Scroll down to load more
      if (bookmarks.length < limit) {
        await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight);
        });
        
        // Rate limiting delay
        await page.waitForTimeout(SCROLL_DELAY_MS);
      }
    }
    
    // Return only the requested limit
    const finalBookmarks = bookmarks.slice(0, limit);
    
    logger.success(`Extracted ${finalBookmarks.length} bookmarks`, 'twitter');
    
    return {
      success: true,
      data: finalBookmarks,
      error: null
    };
    
  } catch (error) {
    logger.error('Failed to scrape bookmarks', error, 'twitter');
    return {
      success: false,
      data: [],
      error: error.message
    };
  }
}

/**
 * Extract Twitter bookmarks (main function)
 * 
 * @param {Object} options - Extraction options
 * @param {number} options.limit - Maximum bookmarks to extract
 * @returns {Object} { success, data: { count, bookmarks }, error }
 */
async function extractBookmarks(options = {}) {
  const { limit = 10 } = options;
  
  let context = null;
  
  try {
    logger.info('Starting Twitter bookmark extraction', 'twitter');
    logger.info(`Target: ${limit} bookmarks`, 'twitter');
    
    // Initialize browser
    const browserResult = await initBrowser();
    if (!browserResult.success) {
      return {
        success: false,
        data: { count: 0, bookmarks: [] },
        error: browserResult.error
      };
    }
    context = browserResult.data;
    
    // Navigate to bookmarks
    const navResult = await navigateToBookmarks(context);
    if (!navResult.success) {
      return {
        success: false,
        data: { count: 0, bookmarks: [] },
        error: navResult.error
      };
    }
    const page = navResult.data;
    
    // Scrape bookmarks
    const scrapeResult = await scrapeBookmarks(page, limit);
    if (!scrapeResult.success) {
      return {
        success: false,
        data: { count: 0, bookmarks: [] },
        error: scrapeResult.error
      };
    }
    
    const bookmarks = scrapeResult.data;
    
    // Log example bookmark
    if (bookmarks.length > 0) {
      logger.info('Example bookmark:', 'twitter');
      logger.debug('Author', bookmarks[0].author, 'twitter');
      logger.debug('Text', bookmarks[0].text.substring(0, 100), 'twitter');
      logger.debug('URL', bookmarks[0].url, 'twitter');
    }
    
    logger.success('Bookmark extraction complete', 'twitter');
    
    return {
      success: true,
      data: {
        count: bookmarks.length,
        bookmarks: bookmarks
      },
      error: null
    };
    
  } catch (error) {
    logger.error('Bookmark extraction failed', error, 'twitter');
    return {
      success: false,
      data: { count: 0, bookmarks: [] },
      error: error.message
    };
    
  } finally {
    // Always close browser
    if (context) {
      await context.close();
      logger.info('Browser closed (session saved)', 'twitter');
    }
  }
}

/**
 * Test extraction (extract 1 bookmark for validation)
 * 
 * @returns {Object} { success, data, error }
 */
async function testExtraction() {
  logger.info('Running test extraction (1 bookmark)', 'twitter');
  return await extractBookmarks({ limit: 1 });
}

module.exports = {
  extractBookmarks,
  testExtraction
};
