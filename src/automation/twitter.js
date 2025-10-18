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
const SCROLL_DELAY_VARIANCE_MS = 1000; // Random variance to avoid detection
const LOGIN_CHECK_INTERVAL_MS = 2000;
const LOGIN_TIMEOUT_SEC = 120;
const MAX_SCROLL_ATTEMPTS_NO_NEW = 5; // Stop after 5 scrolls with no new tweets

// Error recovery
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;
const PAGE_LOAD_TIMEOUT_MS = 60000;

// Incremental sync
const BATCH_SIZE = 20; // Extract 20 tweets at a time, then check database
const MAX_NEW_BOOKMARKS = 500; // Safety limit per sync

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
 * NOW EXTRACTS: Text + YouTube URLs + Images + Quote tweets
 * 
 * @param {Element} tweetElement - Tweet DOM element
 * @param {number} index - Tweet index
 * @returns {Object|null} Tweet data or null if extraction failed
 */
function _extractTweetData(tweetElement, index) {
  try {
    // Extract text content (may be empty for media-only tweets)
    const textElement = tweetElement.querySelector('[data-testid="tweetText"]');
    const text = textElement ? textElement.innerText.trim() : '';
    
    // Extract author
    const authorElement = tweetElement.querySelector('[data-testid="User-Name"]');
    const author = authorElement ? authorElement.innerText.split('\n')[0].trim() : 'Unknown';
    
    // Extract tweet URL
    const timeElement = tweetElement.querySelector('time');
    let url = '';
    if (timeElement && timeElement.parentElement) {
      url = timeElement.parentElement.href || '';
    }
    
    // If no URL found, this might be a deleted/unavailable tweet - skip it
    if (!url || url.length === 0) {
      console.log('⚠️  Skipping tweet with no URL (possibly deleted)');
      return null;
    }
    
    // Extract timestamp
    const timestamp = timeElement ? timeElement.getAttribute('datetime') : new Date().toISOString();
    
    // Generate tweet ID from URL
    const tweetId = url.split('/').pop();
    
    // Validate tweet ID
    if (!tweetId || tweetId === 'status' || tweetId.length < 5) {
      console.log('⚠️  Skipping tweet with invalid ID');
      return null;
    }
    
    // Check for "unavailable" or "deleted" indicators
    const unavailableText = tweetElement.textContent.toLowerCase();
    if (unavailableText.includes('this post is unavailable') || 
        unavailableText.includes('this tweet was deleted')) {
      console.log('⚠️  Skipping deleted/unavailable tweet');
      return null;
    }
    
    // ============================================
    // NEW: EXTRACT EMBEDDED CONTENT
    // ============================================
    
    const embeddedContent = {
      youtubeUrls: [],
      imageUrls: [],
      videoUrls: [],
      quotedTweet: null
    };
    
    // Extract YouTube URLs (from links AND text)
    const links = tweetElement.querySelectorAll('a[href*="youtube.com"], a[href*="youtu.be"]');
    links.forEach(link => {
      const href = link.href;
      if (href && !embeddedContent.youtubeUrls.includes(href)) {
        embeddedContent.youtubeUrls.push(href);
      }
    });
    
    // Also check text for YouTube URLs (in case not linked)
    if (text) {
      const youtubeRegex = /(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtu\.be\/)[\w-]+/gi;
      const matches = text.match(youtubeRegex);
      if (matches) {
        matches.forEach(match => {
          // Ensure it's a full URL
          let url = match;
          if (!url.startsWith('http')) {
            url = 'https://' + url;
          }
          if (!embeddedContent.youtubeUrls.includes(url)) {
            embeddedContent.youtubeUrls.push(url);
          }
        });
      }
    }
    
    // Extract image URLs (EXCLUDE profile images, only tweet media)
    const images = tweetElement.querySelectorAll(
      'img[src*="pbs.twimg.com/media"], ' +
      'img[src*="pbs.twimg.com/card_img"], ' +
      'img[src*="pbs.twimg.com/amplify_video_thumb"]'
    );
    images.forEach(img => {
      let src = img.src;
      // Get original quality image (remove size params)
      if (src) {
        src = src.split('&name=')[0] + '&name=orig'; // Original quality
        if (!embeddedContent.imageUrls.includes(src)) {
          embeddedContent.imageUrls.push(src);
        }
      }
    });
    
    // Extract video URLs (from video tags or media containers)
    const videos = tweetElement.querySelectorAll('video[src], div[data-testid="videoPlayer"]');
    videos.forEach(video => {
      const src = video.src || video.getAttribute('poster');
      if (src && !embeddedContent.videoUrls.includes(src)) {
        embeddedContent.videoUrls.push(src);
      }
    });
    
    // Extract quoted tweet (if exists)
    const quotedTweetElement = tweetElement.querySelector('div[role="link"][data-testid="quoteTweet"]');
    if (quotedTweetElement) {
      const quotedText = quotedTweetElement.querySelector('[data-testid="tweetText"]');
      const quotedAuthor = quotedTweetElement.querySelector('[data-testid="User-Name"]');
      
      if (quotedText || quotedAuthor) {
        embeddedContent.quotedTweet = {
          author: quotedAuthor ? quotedAuthor.innerText.split('\n')[0].trim() : 'Unknown',
          text: quotedText ? quotedText.innerText.trim() : ''
        };
      }
    }
    
    // ============================================
    
    return {
      id: tweetId,
      author: author,
      text: text,
      url: url,
      timestamp: timestamp,
      scraped_at: new Date().toISOString(),
      // NEW: Include embedded content
      embedded: embeddedContent
    };
  } catch (error) {
    console.error('Error extracting tweet:', error);
    return null;
  }
}

/**
 * Scrape bookmarks from current page (improved with edge case handling)
 * 
 * @param {Page} page - Playwright page object
 * @param {number} limit - Maximum number of bookmarks to extract
 * @returns {Object} { success, data: bookmarks[], error, skipped }
 */
async function scrapeBookmarks(page, limit = 10) {
  try {
    logger.info(`Extracting up to ${limit} bookmarks`, 'twitter');
    
    const bookmarks = [];
    let previousCount = 0;
    let noNewTweetsCount = 0;
    let scrollAttempts = 0;
    let skippedCount = 0;
    
    while (bookmarks.length < limit && noNewTweetsCount < MAX_SCROLL_ATTEMPTS_NO_NEW) {
      // Extract all currently visible tweets
      const extractionResult = await page.evaluate((extractFn) => {
        const tweetElements = document.querySelectorAll('article[data-testid="tweet"]');
        const results = [];
        let skipped = 0;
        
        tweetElements.forEach((tweet, index) => {
          try {
            const data = eval(`(${extractFn})`)(tweet, index);
            if (data) {
              results.push(data);
            } else {
              skipped++;
            }
          } catch (error) {
            console.error('Failed to extract tweet:', error);
            skipped++;
          }
        });
        
        return { tweets: results, skipped };
      }, _extractTweetData.toString());
      
      const tweets = extractionResult.tweets;
      skippedCount += extractionResult.skipped;
      
      // Add new tweets (avoid duplicates)
      const existingIds = new Set(bookmarks.map(b => b.id));
      const newTweets = tweets.filter(t => !existingIds.has(t.id));
      bookmarks.push(...newTweets);
      
      const progress = Math.min((bookmarks.length / limit * 100), 100).toFixed(0);
      logger.debug(`Progress: ${progress}% (${bookmarks.length}/${limit})`, null, 'twitter');
      
      // Check if we got new tweets
      if (bookmarks.length === previousCount) {
        noNewTweetsCount++;
        logger.debug(`No new tweets (attempt ${noNewTweetsCount}/${MAX_SCROLL_ATTEMPTS_NO_NEW})`, null, 'twitter');
      } else {
        noNewTweetsCount = 0;
      }
      previousCount = bookmarks.length;
      
      // Scroll down to load more
      if (bookmarks.length < limit && noNewTweetsCount < MAX_SCROLL_ATTEMPTS_NO_NEW) {
        scrollAttempts++;
        
        await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight);
        });
        
        // Rate limiting with random variance (avoid detection)
        const delay = SCROLL_DELAY_MS + Math.random() * SCROLL_DELAY_VARIANCE_MS;
        await page.waitForTimeout(delay);
      }
    }
    
    // Return only the requested limit
    const finalBookmarks = bookmarks.slice(0, limit);
    
    logger.success(`Extracted ${finalBookmarks.length} bookmarks`, 'twitter');
    if (skippedCount > 0) {
      logger.warn(`Skipped ${skippedCount} tweets (deleted/unavailable)`, 'twitter');
    }
    logger.info(`Scroll attempts: ${scrollAttempts}`, 'twitter');
    
    return {
      success: true,
      data: finalBookmarks,
      error: null,
      metadata: {
        skipped: skippedCount,
        scrolls: scrollAttempts,
        extracted: finalBookmarks.length,
        target: limit
      }
    };
    
  } catch (error) {
    logger.error('Failed to scrape bookmarks', error, 'twitter');
    return {
      success: false,
      data: [],
      error: error.message,
      metadata: {
        skipped: 0,
        scrolls: 0,
        extracted: 0,
        target: limit
      }
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
 * Extract only NEW bookmarks (incremental sync - stops at existing)
 * 
 * This is the SMART sync method:
 * - Twitter shows newest bookmarks first
 * - Extract in batches
 * - Check each batch against database
 * - Stop when we hit a bookmark we already have
 * 
 * Benefits:
 * - Day 1: Extracts all 800 bookmarks
 * - Day 2: Extracts only 5 new, stops (not 50!)
 * - Day 3: Extracts 0 new, stops immediately
 * 
 * @param {Object} options - Extraction options
 * @param {number} options.maxNew - Maximum new bookmarks to extract
 * @returns {Object} { success, data: { count, bookmarks, isIncremental }, error }
 */
async function extractNewBookmarks(options = {}) {
  const { maxNew = MAX_NEW_BOOKMARKS } = options;
  const db = require('../db/database'); // Import here to avoid circular dependency
  
  let context = null;
  
  try {
    logger.info('Starting INCREMENTAL bookmark extraction', 'twitter');
    logger.info(`Max new bookmarks: ${maxNew}`, 'twitter');
    
    // Initialize browser
    const browserResult = await initBrowser();
    if (!browserResult.success) {
      return {
        success: false,
        data: { count: 0, bookmarks: [], isIncremental: true },
        error: browserResult.error
      };
    }
    context = browserResult.data;
    
    // Navigate to bookmarks
    const navResult = await navigateToBookmarks(context);
    if (!navResult.success) {
      return {
        success: false,
        data: { count: 0, bookmarks: [], isIncremental: true },
        error: navResult.error
      };
    }
    const page = navResult.data;
    
    // Incremental extraction
    const newBookmarks = [];
    let foundExisting = false;
    let scrollAttempts = 0;
    let totalExtracted = 0;
    let skippedDuplicates = 0;
    
    while (!foundExisting && newBookmarks.length < maxNew) {
      // Extract current batch
      const batchResult = await page.evaluate(({ extractFn, batchSize }) => {
        const tweetElements = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
        const results = [];
        let skipped = 0;
        
        tweetElements.slice(0, batchSize + 10).forEach((tweet, index) => {
          try {
            const data = eval(`(${extractFn})`)(tweet, index);
            if (data) {
              results.push(data);
            } else {
              skipped++;
            }
          } catch (error) {
            skipped++;
          }
        });
        
        return { tweets: results, skipped };
      }, { extractFn: _extractTweetData.toString(), batchSize: BATCH_SIZE });
      
      const batch = batchResult.tweets;
      totalExtracted += batch.length;
      
      logger.debug(`Extracted batch of ${batch.length} tweets (checking for duplicates...)`, null, 'twitter');
      
      // Check each tweet against database
      for (const bookmark of batch) {
        // Skip if we already have this one in newBookmarks (within-session duplicate)
        if (newBookmarks.find(b => b.id === bookmark.id)) {
          continue;
        }
        
        // Check database
        const existsResult = await db.bookmarkExists(bookmark.id);
        
        if (existsResult.success && existsResult.data === true) {
          // Found existing bookmark - stop extraction
          logger.info(`Found existing bookmark (${bookmark.id}), stopping extraction`, 'twitter');
          logger.info(`This bookmark was synced previously - we've caught up!`, 'twitter');
          foundExisting = true;
          skippedDuplicates++;
          break;
        }
        
        // New bookmark - add it
        newBookmarks.push(bookmark);
        
        if (newBookmarks.length >= maxNew) {
          logger.warn(`Reached max limit (${maxNew}), stopping`, 'twitter');
          break;
        }
      }
      
      if (foundExisting || newBookmarks.length >= maxNew) {
        break;
      }
      
      // Scroll for more
      scrollAttempts++;
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      
      const delay = SCROLL_DELAY_MS + Math.random() * SCROLL_DELAY_VARIANCE_MS;
      await page.waitForTimeout(delay);
      
      logger.debug(`Scroll ${scrollAttempts}: ${newBookmarks.length} new bookmarks so far`, null, 'twitter');
    }
    
    logger.success(`Incremental extraction complete: ${newBookmarks.length} NEW bookmarks`, 'twitter');
    logger.info(`Total extracted: ${totalExtracted}, New: ${newBookmarks.length}, Duplicates: ${skippedDuplicates}`, 'twitter');
    
    // Close browser
    await context.close();
    logger.info('Browser closed (session saved)', 'twitter');
    
    return {
      success: true,
      data: {
        count: newBookmarks.length,
        bookmarks: newBookmarks,
        isIncremental: true
      },
      error: null,
      metadata: {
        totalExtracted: totalExtracted,
        newBookmarks: newBookmarks.length,
        duplicatesSkipped: skippedDuplicates,
        scrolls: scrollAttempts,
        stoppedReason: foundExisting ? 'found existing' : 'reached limit'
      }
    };
    
  } catch (error) {
    logger.error('Incremental extraction failed', error, 'twitter');
    
    if (context) {
      await context.close().catch(() => {});
    }
    
    return {
      success: false,
      data: { count: 0, bookmarks: [], isIncremental: true },
      error: error.message
    };
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

/**
 * Extract tweets from a specific Twitter List
 * Reuses the same extraction logic as bookmarks
 * 
 * @param {Object} listConfig - List configuration
 * @param {string} listConfig.name - List name
 * @param {string} listConfig.url - List URL
 * @param {string} listConfig.listId - List ID
 * @param {number} listConfig.maxTweets - Max tweets to extract
 * @returns {Object} { success, data: { tweets, listInfo }, error }
 */
async function extractListTweets(listConfig) {
  const { name, url, listId, maxTweets = 50 } = listConfig;
  
  let context = null;
  
  try {
    logger.info(`Extracting tweets from list: "${name}"`, 'twitter');
    logger.info(`Max tweets: ${maxTweets}`, 'twitter');
    
    // Initialize browser
    const browserResult = await initBrowser();
    if (!browserResult.success) {
      return browserResult;
    }
    context = browserResult.data;
    
    const page = await context.newPage();
    
    // Navigate to list
    logger.info(`Navigating to list URL: ${url}`, 'twitter');
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    // Wait for tweets to load
    await page.waitForTimeout(3000);
    
    // Wait for tweets
    try {
      await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });
      logger.success('List tweets loaded', 'twitter');
    } catch (error) {
      logger.warn('No tweets found or timeout', 'twitter');
    }
    
    // Extract tweets using the SAME logic as bookmarks
    logger.info(`Extracting up to ${maxTweets} tweets from list`, 'twitter');
    
    const tweets = [];
    let scrollAttempts = 0;
    let noNewTweetsCount = 0;
    
    while (tweets.length < maxTweets && noNewTweetsCount < MAX_SCROLL_ATTEMPTS_NO_NEW) {
      // Extract all currently visible tweets (REUSING _extractTweetData)
      const extractionResult = await page.evaluate((extractFn) => {
        const tweetElements = document.querySelectorAll('article[data-testid="tweet"]');
        const results = [];
        let skipped = 0;
        
        tweetElements.forEach((tweet, index) => {
          try {
            const data = eval(`(${extractFn})`)(tweet, index);
            if (data) {
              results.push(data);
            } else {
              skipped++;
            }
          } catch (error) {
            console.error('Failed to extract tweet:', error);
            skipped++;
          }
        });
        
        return { tweets: results, skipped };
      }, _extractTweetData.toString());
      
      const extractedTweets = extractionResult.tweets;
      
      // Add new tweets (avoid duplicates)
      const existingIds = new Set(tweets.map(t => t.id));
      const newTweets = extractedTweets.filter(t => !existingIds.has(t.id));
      
      if (newTweets.length === 0) {
        noNewTweetsCount++;
        logger.debug(`No new tweets (attempt ${noNewTweetsCount}/${MAX_SCROLL_ATTEMPTS_NO_NEW})`, null, 'twitter');
      } else {
        tweets.push(...newTweets.slice(0, maxTweets - tweets.length));
        noNewTweetsCount = 0;
        
        const progress = Math.round((tweets.length / maxTweets) * 100);
        logger.debug(`Progress: ${progress}% (${tweets.length}/${maxTweets})`, null, 'twitter');
      }
      
      if (tweets.length >= maxTweets) {
        break;
      }
      
      // Scroll for more
      scrollAttempts++;
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
      
      const delay = SCROLL_DELAY_MS + Math.random() * SCROLL_DELAY_VARIANCE_MS;
      await page.waitForTimeout(delay);
    }
    
    logger.success(`Extracted ${tweets.length} tweets from list "${name}"`, 'twitter');
    logger.info(`Scroll attempts: ${scrollAttempts}`, 'twitter');
    
    // Close browser
    await context.close();
    logger.info('Browser closed (session saved)', 'twitter');
    
    return {
      success: true,
      data: {
        tweets: tweets,
        listInfo: {
          name,
          listId,
          url,
          tweetCount: tweets.length
        }
      },
      error: null
    };
    
  } catch (error) {
    logger.error(`Failed to extract list "${name}"`, error, 'twitter');
    
    if (context) {
      await context.close().catch(() => {});
    }
    
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

module.exports = {
  extractBookmarks,
  extractNewBookmarks,
  extractListTweets,
  testExtraction
};
