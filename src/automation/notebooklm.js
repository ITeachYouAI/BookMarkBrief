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
const notebookTracker = require('../db/notebook-tracker');

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
 * NOW INCLUDES: Embedded YouTube, images, quoted tweets
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
      
      // NEW: Include embedded content
      if (bookmark.embedded) {
        const emb = bookmark.embedded;
        
        // YouTube videos
        if (emb.youtubeUrls && emb.youtubeUrls.length > 0) {
          content += `**YouTube Videos:**\n`;
          emb.youtubeUrls.forEach(url => {
            content += `- ${url}\n`;
          });
          content += '\n';
        }
        
        // Images
        if (emb.imageUrls && emb.imageUrls.length > 0) {
          content += `**Images:**\n`;
          emb.imageUrls.forEach((url, i) => {
            content += `- Image ${i + 1}: ${url}\n`;
          });
          content += '\n';
        }
        
        // Videos
        if (emb.videoUrls && emb.videoUrls.length > 0) {
          content += `**Videos:**\n`;
          emb.videoUrls.forEach((url, i) => {
            content += `- Video ${i + 1}: ${url}\n`;
          });
          content += '\n';
        }
        
        // Quoted tweet
        if (emb.quotedTweet) {
          content += `**Quoted Tweet:**\n`;
          content += `> Author: ${emb.quotedTweet.author}\n`;
          if (emb.quotedTweet.text) {
            content += `> ${emb.quotedTweet.text}\n`;
          }
          content += '\n';
        }
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
    
    // Log embedded content summary
    const totalYoutube = bookmarks.reduce((sum, b) => sum + (b.embedded?.youtubeUrls?.length || 0), 0);
    const totalImages = bookmarks.reduce((sum, b) => sum + (b.embedded?.imageUrls?.length || 0), 0);
    const totalQuoted = bookmarks.filter(b => b.embedded?.quotedTweet).length;
    
    if (totalYoutube > 0) logger.info(`  Included ${totalYoutube} YouTube URLs`, 'notebooklm');
    if (totalImages > 0) logger.info(`  Included ${totalImages} image URLs`, 'notebooklm');
    if (totalQuoted > 0) logger.info(`  Included ${totalQuoted} quoted tweets`, 'notebooklm');
    
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
 * Select a notebook (open existing or create new)
 * 
 * IMPORTANT: This ensures we use ONE notebook for all syncs
 * - First sync: Creates "BrainBrief - Twitter Bookmarks"
 * - Future syncs: Opens same notebook, adds new sources
 * - Result: All bookmarks accumulate in one place
 * 
 * @param {Page} page - Playwright page object
 * @param {string} notebookName - Notebook name to find/create
 * @returns {Object} { success, data: { existed }, error }
 */
async function selectNotebook(page, notebookName) {
  try {
    logger.info(`Looking for notebook: "${notebookName}"`, 'notebooklm');
    
    // Wait for notebooks to load
    await page.waitForTimeout(2000);
    
    // Strategy: Look for notebook card with matching name
    // Notebooks appear as cards with titles
    const existingNotebook = page.locator(`text="${notebookName}"`).first();
    const exists = await existingNotebook.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (exists) {
      // EXISTING NOTEBOOK - Open it
      logger.success(`Found existing notebook: "${notebookName}"`, 'notebooklm');
      logger.info('Opening to add new source...', 'notebooklm');
      
      await existingNotebook.click();
      await page.waitForTimeout(3000);
      
      // Wait for Sources panel (confirms notebook opened)
      await page.waitForSelector('text=Sources', { timeout: 10000 });
      
      logger.success('Existing notebook opened (will add source to it)', 'notebooklm');
      
      return {
        success: true,
        data: { existed: true },
        error: null
      };
      
    } else {
      // NEW NOTEBOOK - Create it
      logger.info(`Notebook "${notebookName}" not found`, 'notebooklm');
      logger.info('Creating new notebook...', 'notebooklm');
      
      // Click "New notebook" button (top right)
      const newNotebookBtn = page.locator('button:has-text("New notebook")').first();
      await newNotebookBtn.click();
      await page.waitForTimeout(3000);
      
      // Notebook created with "Untitled notebook" as default name
      // Wait for Sources panel
      await page.waitForSelector('text=Sources', { timeout: 10000 });
      
      logger.success('New notebook created (upload modal should be open)', 'notebooklm');
      logger.info('Will rename AFTER uploading file', 'notebooklm');
      
      return {
        success: true,
        data: { existed: false },
        error: null
      };
    }
    
  } catch (error) {
    logger.error('Failed to select notebook', error, 'notebooklm');
    return {
      success: false,
      data: { existed: false },
      error: error.message
    };
  }
}

/**
 * Rename notebook (WHILE INSIDE notebook, click title at top)
 * 
 * From HTML inspection:
 * - Element: <editable-project-title>
 * - Contains: <span class="title-label-inner"> with current title
 * - And: <input class="title-input"> for editing
 * 
 * Strategy:
 * 1. Click the title element (makes it editable)
 * 2. Input appears
 * 3. Type new name
 * 4. Press Enter
 * 5. Done!
 * 
 * @param {Page} page - Playwright page object (already inside notebook)
 * @param {string} newName - Desired notebook name
 * @returns {Object} { success, data: null, error }
 */
async function renameNotebook(page, newName) {
  try {
    logger.info(`Renaming notebook to "${newName}"...`, 'notebooklm');
    
    // The title input already exists and is visible!
    // From HTML: <input class="title-input mat-title-large">
    logger.info('Finding title input...', 'notebooklm');
    
    const titleInput = page.locator('input.title-input').first();
    
    // Click input to focus it
    await titleInput.click();
    await page.waitForTimeout(300);
    
    logger.success('Focused title input', 'notebooklm');
    
    // Select all existing text and replace
    await page.keyboard.press('Meta+A'); // Cmd+A (Mac) selects all
    await page.keyboard.type(newName);
    
    // Press Enter or click away to save
    await page.keyboard.press('Enter');
    
    await page.waitForTimeout(1000);
    
    logger.success(`✅ Typed "${newName}" into title`, 'notebooklm');
    
    // Verify it worked by checking if the title displays our name
    const titleNow = await page.locator('editable-project-title').innerText().catch(() => '');
    
    if (titleNow.includes(newName)) {
      logger.success(`✅ VERIFIED: Title is now "${newName}"`, 'notebooklm');
    } else {
      logger.warn(`Title shows: "${titleNow}" (expected "${newName}")`, 'notebooklm');
    }
    
    return {
      success: true,
      data: null,
      error: null
    };
    
  } catch (error) {
    logger.error('Rename failed', error, 'notebooklm');
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

/**
 * Upload file to NotebookLM
 * 
 * IMPORTANT: Different flow for new vs existing notebooks
 * - NEW: Upload modal auto-opens, just upload file
 * - EXISTING: Must click "+ Add" first, then upload
 * 
 * @param {Page} page - Playwright page object
 * @param {string} filePath - Path to file to upload
 * @param {boolean} isNewNotebook - True if notebook was just created
 * @returns {Object} { success, data: null, error }
 */
async function uploadFile(page, filePath, isNewNotebook = false) {
  try {
    logger.info('Starting upload automation', 'notebooklm');
    logger.info(`File: ${path.basename(filePath)}`, 'notebooklm');
    logger.info(`Notebook type: ${isNewNotebook ? 'NEW (overlay auto-opens)' : 'EXISTING (must click Add)'}`, 'notebooklm');
    
    if (isNewNotebook) {
      // NEW NOTEBOOK: Upload modal automatically appears after creation
      logger.info('New notebook - upload modal should be open already', 'notebooklm');
      
      // Wait for modal to be visible
      await page.waitForSelector('text=Upload sources', { timeout: 5000 });
      logger.success('Upload modal ready (auto-opened)', 'notebooklm');
      
    } else {
      // EXISTING NOTEBOOK: Need to click "+ Add" to open modal
      logger.info('Existing notebook - clicking "+ Add" to open modal...', 'notebooklm');
      
      // Use aria-label (from error log)
      const addButton = page.locator('[aria-label="Add source"]').first();
      
      try {
        await addButton.click({ timeout: 5000 });
        logger.success('Clicked "+ Add" button', 'notebooklm');
      } catch (e) {
        // Fallback: Try force click
        logger.warn('Normal click failed, trying force click...', 'notebooklm');
        await addButton.click({ force: true });
        logger.success('Force-clicked "+ Add" button', 'notebooklm');
      }
      
      await page.waitForTimeout(2000);
      
      // Wait for modal to open
      await page.waitForSelector('text=Upload sources', { timeout: 5000 });
      logger.success('Upload modal opened', 'notebooklm');
    }
    
    // Step 2: Upload file to file input
    // From screenshot: "Drag & drop or choose file to upload"
    // The file input might be hidden - Playwright can still use it
    logger.info('Looking for file input...', 'notebooklm');
    
    // Option 1: Try to find file input directly (even if hidden)
    let fileInput = page.locator('input[type="file"]');
    let inputExists = await fileInput.count() > 0;
    
    if (!inputExists) {
      // Option 2: Click "choose file" link to trigger input
      logger.info('File input not found, clicking "choose file" link...', 'notebooklm');
      const chooseFileLink = page.locator('text=choose file').first();
      const linkVisible = await chooseFileLink.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (linkVisible) {
        await chooseFileLink.click();
        await page.waitForTimeout(500);
      }
    }
    
    // Now upload to file input
    logger.info('Uploading file to input...', 'notebooklm');
    fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(filePath, { timeout: 10000 });
    
    logger.success('File uploaded to NotebookLM', 'notebooklm');
    
    // Step 4: Wait for source to appear in list
    logger.info('Waiting for upload to complete...', 'notebooklm');
    
    // Wait for "1 source" or filename to appear in sources list
    const fileName = path.basename(filePath);
    
    try {
      // Wait for filename to appear in sources list (left panel)
      await page.waitForSelector(`text=${fileName}`, { timeout: 60000 });
      logger.success(`File "${fileName}" appeared in sources`, 'notebooklm');
    } catch (e) {
      // Fallback: Wait for "1 source" indicator
      await page.waitForSelector('text=1 source', { timeout: 60000 });
      logger.success('Source count updated (upload complete)', 'notebooklm');
    }
    
    await page.waitForTimeout(2000);
    
    logger.success('✅ Upload complete!', 'notebooklm');
    
    return {
      success: true,
      data: null,
      error: null
    };
    
  } catch (error) {
    logger.error('Upload automation failed', error, 'notebooklm');
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

/**
 * Upload bookmarks to NotebookLM (main function - FULLY AUTOMATED)
 * 
 * FLOW EXPLANATION:
 * 
 * First Sync (Day 1):
 *   1. Create file: twitter-bookmarks-2025-10-17.txt
 *   2. Create notebook: "BrainBrief - Twitter Bookmarks"
 *   3. Upload file as first source
 *   Result: Notebook has 1 source (50 bookmarks)
 * 
 * Second Sync (Day 2):
 *   1. Create file: twitter-bookmarks-2025-10-18.txt
 *   2. OPEN EXISTING notebook: "BrainBrief - Twitter Bookmarks"
 *   3. ADD file as second source
 *   Result: Notebook has 2 sources (100 bookmarks total)
 * 
 * Future Syncs:
 *   - Keep adding sources to SAME notebook
 *   - All bookmarks queryable in one place
 *   - Sources accumulate: Day 7 = 7 sources = 350 bookmarks
 * 
 * @param {Array<Object>} bookmarks - Array of bookmark objects
 * @param {Object} options - Upload options
 * @param {string} options.notebookName - Notebook name to find/create
 * @returns {Object} { success, data: { uploaded, filePath, notebookName, existed }, error }
 */
async function uploadBookmarks(bookmarks, options = {}) {
  const { notebookName: customNotebookName = null } = options;
  
  let context = null;
  let finalNotebookName = customNotebookName || 'BrainBrief - Twitter Bookmarks';
  
  try {
    logger.info('Starting AUTOMATED NotebookLM upload', 'notebooklm');
    logger.info(`Bookmarks to upload: ${bookmarks.length}`, 'notebooklm');
    
    let targetNotebook;
    
    // Step 1: Get notebook name
    if (customNotebookName) {
      // Custom notebook name provided (for Lists)
      logger.info(`Using custom notebook name: "${customNotebookName}"`, 'notebooklm');
      targetNotebook = { 
        id: null, 
        name: customNotebookName, 
        sourceCount: 0 
      };
      finalNotebookName = customNotebookName;
    } else {
      // Use tracker for bookmarks (handles rotation)
      const activeNotebookResult = await notebookTracker.getActiveNotebook(bookmarks);
      if (!activeNotebookResult.success) {
        logger.error('Failed to get active notebook', activeNotebookResult.error, 'notebooklm');
        targetNotebook = { 
          id: null, 
          name: 'BrainBrief - Twitter Bookmarks', 
          sourceCount: 0 
        };
        finalNotebookName = 'BrainBrief - Twitter Bookmarks';
      } else {
        targetNotebook = activeNotebookResult.data;
        finalNotebookName = targetNotebook.name;
      }
    }
    
    logger.info(`Target notebook: "${targetNotebook.name}"`, 'notebooklm');
    logger.info(`Current sources: ${targetNotebook.sourceCount}/${notebookTracker.MAX_SOURCES_PER_NOTEBOOK}`, 'notebooklm');
    
    // Step 2: Create bookmark file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `twitter-bookmarks-${timestamp}.txt`;
    const filePath = path.join(__dirname, '../../data/exports', filename);
    
    const fileResult = createBookmarkFile(bookmarks, filePath);
    if (!fileResult.success) {
      return {
        success: false,
        data: { uploaded: false, filePath: null, notebookName: targetNotebook.name },
        error: fileResult.error
      };
    }
    
    logger.success(`File created: ${filename}`, 'notebooklm');
    
    // Step 2: Initialize browser
    const browserResult = await initBrowser();
    if (!browserResult.success) {
      return {
        success: false,
        data: { uploaded: false, filePath: filePath, notebookName },
        error: browserResult.error
      };
    }
    context = browserResult.data;
    
    // Step 3: Navigate to NotebookLM
    const navResult = await navigateToNotebookLM(context);
    if (!navResult.success) {
      return {
        success: false,
        data: { uploaded: false, filePath: filePath, notebookName },
        error: navResult.error
      };
    }
    const page = navResult.data;
    
    // Step 4: Select/create notebook
    // This finds existing notebook OR creates new one
    const notebookResult = await selectNotebook(page, targetNotebook.name);
    if (!notebookResult.success) {
      return {
        success: false,
        data: { uploaded: false, filePath: filePath, notebookName: targetNotebook.name },
        error: notebookResult.error
      };
    }
    
    const notebookExisted = notebookResult.data.existed;
    
    if (notebookExisted) {
      logger.info('Adding source to EXISTING notebook (accumulating)', 'notebooklm');
    } else {
      logger.info('Adding source to NEW notebook (first sync)', 'notebooklm');
    }
    
    // Step 5: Upload file (pass isNewNotebook flag for correct flow)
    const isNewNotebook = !notebookExisted;
    const uploadResult = await uploadFile(page, filePath, isNewNotebook);
    if (!uploadResult.success) {
      return {
        success: false,
        data: { uploaded: false, filePath: filePath, notebookName: targetNotebook.name, existed: notebookExisted },
        error: uploadResult.error
      };
    }
    
    // Step 5.5: Rename notebook if it was just created
    // We're already INSIDE the notebook (just uploaded file)
    // Click the title at the top to rename it
    if (isNewNotebook) {
      logger.info('Upload complete, now renaming notebook...', 'notebooklm');
      logger.info('We are inside the notebook, clicking title to edit', 'notebooklm');
      
      const renameResult = await renameNotebook(page, targetNotebook.name);
      
      if (renameResult.success) {
        logger.success('Notebook renamed successfully', 'notebooklm');
        
        // VERIFY: Check if title actually changed
        await page.waitForTimeout(2000);
        const titleNow = await page.locator('editable-project-title').innerText().catch(() => 'unknown');
        logger.info(`Final notebook title: "${titleNow}"`, 'notebooklm');
        
        if (titleNow.includes(targetNotebook.name)) {
          logger.success(`✅ VERIFIED: Notebook is named "${targetNotebook.name}"`, 'notebooklm');
        } else {
          logger.warn(`⚠️  Title is "${titleNow}" not "${targetNotebook.name}" - rename may not have saved`, 'notebooklm');
        }
      } else {
        logger.warn('Rename failed, but upload succeeded', 'notebooklm');
        logger.warn('Notebook will have auto-generated name', 'notebooklm');
      }
      
      // Keep browser open for 5 seconds so you can see the result
      logger.info('Keeping browser open for 5 seconds (verify results)...', 'notebooklm');
      await page.waitForTimeout(5000);
    }
    
    // Step 6: Record upload in database
    if (targetNotebook.id) {
      await notebookTracker.recordUploadedSource(
        targetNotebook.id,
        filename,
        filePath,
        bookmarks.length
      );
      logger.success('Upload recorded in database', 'notebooklm');
    }
    
    logger.success(`✅ Successfully uploaded ${bookmarks.length} bookmarks to NotebookLM!`, 'notebooklm');
    
    // Step 7: Extract and upload YouTube/PDF URLs as separate sources
    logger.info('Checking for YouTube videos and PDFs to add as sources...', 'notebooklm');
    
    const youtubeUrls = new Set();
    const pdfUrls = new Set();
    
    bookmarks.forEach(bookmark => {
      // Collect YouTube URLs
      if (bookmark.embedded?.youtubeUrls) {
        bookmark.embedded.youtubeUrls.forEach(url => youtubeUrls.add(url));
      }
      
      // Collect PDF URLs (check text for .pdf links)
      if (bookmark.text) {
        const pdfMatches = bookmark.text.match(/https?:\/\/[^\s]+\.pdf/gi);
        if (pdfMatches) {
          pdfMatches.forEach(url => pdfUrls.add(url));
        }
      }
    });
    
    logger.info(`Found ${youtubeUrls.size} unique YouTube videos, ${pdfUrls.size} unique PDFs`, 'notebooklm');
    
    // Filter out already-uploaded URLs (check database)
    const db = require('../db/database');
    const notebookName = targetNotebook.name;
    
    const youtubeArray = Array.from(youtubeUrls);
    const pdfArray = Array.from(pdfUrls);
    
    // Check which URLs are already uploaded (simple approach: try-catch on insert)
    // For now, add all and let database UNIQUE constraint handle duplicates
    
    // Check if we have room for additional sources
    const currentSources = targetNotebook.sourceCount + 1; // +1 for markdown file just uploaded
    const availableSlots = notebookTracker.MAX_SOURCES_PER_NOTEBOOK - currentSources;
    
    if (availableSlots <= 0) {
      logger.warn('Notebook is full, skipping YouTube/PDF sources', 'notebooklm');
      youtubeUrls.clear();
      pdfUrls.clear();
    } else if (youtubeUrls.size + pdfUrls.size > availableSlots) {
      logger.warn(`Only ${availableSlots} slots available, will add what fits`, 'notebooklm');
    }
    
    let sourcesAdded = 0;
    
    // Add YouTube sources (up to available slots)
    for (const url of youtubeUrls) {
      if (sourcesAdded >= availableSlots) {
        logger.warn('Reached source limit, stopping', 'notebooklm');
        break;
      }
      
      try {
        const result = await uploadURL(page, url, 'youtube');
        if (result.success) {
          sourcesAdded++;
          logger.success(`Added YouTube source ${sourcesAdded}`, 'notebooklm');
        }
      } catch (error) {
        logger.warn(`Failed to add YouTube: ${url}`, 'notebooklm');
        // Continue with other sources
      }
    }
    
    // Add PDF sources (up to available slots)
    for (const url of pdfUrls) {
      if (sourcesAdded >= availableSlots) {
        logger.warn('Reached source limit, stopping', 'notebooklm');
        break;
      }
      
      try {
        const result = await uploadURL(page, url, 'pdf');
        if (result.success) {
          sourcesAdded++;
          logger.success(`Added PDF source ${sourcesAdded}`, 'notebooklm');
        }
      } catch (error) {
        logger.warn(`Failed to add PDF: ${url}`, 'notebooklm');
        // Continue with other sources
      }
    }
    
    if (sourcesAdded > 0) {
      logger.success(`✅ Added ${sourcesAdded} additional sources (YouTube + PDFs)`, 'notebooklm');
    }
    
    if (notebookExisted) {
      const totalSources = targetNotebook.sourceCount + 1 + sourcesAdded;
      logger.info(`Sources in notebook: ${totalSources}/${notebookTracker.MAX_SOURCES_PER_NOTEBOOK}`, 'notebooklm');
    } else {
      logger.info(`First sync complete! Notebook has ${1 + sourcesAdded} sources.`, 'notebooklm');
    }
    
    logger.info('Closing browser in 3 seconds...', 'notebooklm');
    await page.waitForTimeout(3000);
    
    // Close browser
    await context.close();
    
    return {
      success: true,
      data: {
        uploaded: true,
        filePath: filePath,
        notebookName: targetNotebook.name,
        count: bookmarks.length,
        existed: notebookExisted,
        sourceCount: targetNotebook.sourceCount + 1 + sourcesAdded,
        youtubeSourcesAdded: youtubeUrls.size,
        pdfSourcesAdded: pdfUrls.size,
        totalSourcesAdded: sourcesAdded,
        message: notebookExisted 
          ? `Added ${1 + sourcesAdded} sources to notebook`
          : `Created notebook with ${1 + sourcesAdded} sources`
      },
      error: null
    };
    
  } catch (error) {
    logger.error('NotebookLM upload failed', error, 'notebooklm');
    
    if (context) {
      await context.close().catch(() => {});
    }
    
    return {
      success: false,
      data: { uploaded: false, filePath: null, notebookName: finalNotebookName },
      error: error.message
    };
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

/**
 * Upload a URL (YouTube, PDF, etc.) as a source to NotebookLM
 * 
 * @param {Page} page - Playwright page (must be inside notebook)
 * @param {string} url - URL to add as source
 * @param {string} sourceType - Type: 'youtube', 'pdf', 'website'
 * @returns {Object} { success, data, error }
 */
async function uploadURL(page, url, sourceType = 'youtube') {
  try {
    logger.info(`Adding ${sourceType} URL as source: ${url}`, 'notebooklm');
    
    // Click "+ Add" button to open modal
    const addButton = page.locator('[aria-label="Add source"]').first();
    await addButton.click({ timeout: 5000 });
    await page.waitForTimeout(1000);
    
    // Wait for upload modal
    await page.waitForSelector('text=Upload sources', { timeout: 5000 });
    
    // Click "Insert URL" tab (should be visible in modal)
    try {
      await page.click('text=Insert URL', { timeout: 3000 });
      logger.info('Clicked "Insert URL" tab', 'notebooklm');
    } catch (e) {
      // Tab might be called "URL" or "Link"
      await page.click('text=URL', { timeout: 3000 }).catch(() => {
        return page.click('text=Link', { timeout: 3000 });
      });
    }
    
    await page.waitForTimeout(500);
    
    // Find URL input field and paste URL
    const urlInput = page.locator('input[type="url"], input[placeholder*="URL"], input[placeholder*="url"]').first();
    await urlInput.fill(url);
    logger.info(`Pasted URL: ${url}`, 'notebooklm');
    
    await page.waitForTimeout(500);
    
    // Click Insert/Add button
    await page.click('button:has-text("Insert"), button:has-text("Add")');
    logger.success(`URL source added: ${url}`, 'notebooklm');
    
    // Wait for source to appear
    await page.waitForTimeout(3000);
    
    return {
      success: true,
      data: { url, type: sourceType },
      error: null
    };
    
  } catch (error) {
    logger.error('Failed to upload URL', error, 'notebooklm');
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

/**
 * Upload tweets from a Twitter List to NotebookLM
 * Creates a list-specific notebook: "BrainBrief - {listName} - {date}"
 * 
 * @param {Array<Object>} tweets - Array of tweet objects (same format as bookmarks)
 * @param {Object} listInfo - List metadata
 * @param {string} listInfo.name - List name
 * @param {string} listInfo.listId - List ID
 * @param {string} listInfo.url - List URL
 * @returns {Object} { success, data, error }
 */
async function uploadListTweets(tweets, listInfo) {
  try {
    logger.info(`Uploading ${tweets.length} tweets from list: "${listInfo.name}"`, 'notebooklm');
    
    // Generate list-specific notebook name with date
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const notebookName = `BrainBrief - ${listInfo.name} - ${today}`;
    
    logger.info(`Notebook name: "${notebookName}"`, 'notebooklm');
    
    // Use existing uploadBookmarks function with custom notebook name
    const result = await uploadBookmarks(tweets, { notebookName });
    
    return result;
    
  } catch (error) {
    logger.error('Failed to upload list tweets', error, 'notebooklm');
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

module.exports = {
  uploadBookmarks,
  uploadListTweets,
  uploadURL,
  testFileCreation,
  createBookmarkFile,
  selectNotebook,
  uploadFile,
  renameNotebook
};

