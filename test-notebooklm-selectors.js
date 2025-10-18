/**
 * BrainBrief - NotebookLM Selector Testing
 * 
 * Purpose: Test NotebookLM UI selectors step by step
 * Usage: node test-notebooklm-selectors.js
 */

const { chromium } = require('playwright');
const path = require('path');
const logger = require('./src/utils/logger');

const BROWSER_DATA_DIR = path.join(__dirname, 'browser-data/notebooklm');
const NOTEBOOKLM_URL = 'https://notebooklm.google.com';

async function testSelectors() {
  logger.info('='.repeat(70));
  logger.info('NOTEBOOKLM SELECTOR TESTING');
  logger.info('='.repeat(70));
  
  let context;
  
  try {
    context = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
      headless: false,
      viewport: { width: 1400, height: 1000 },
      args: ['--disable-blink-features=AutomationControlled']
    });
    
    const page = await context.newPage();
    
    logger.info('Navigating to NotebookLM...', 'test');
    await page.goto(NOTEBOOKLM_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    logger.success('Loaded NotebookLM', 'test');
    logger.info('');
    
    // Test 1: Find "Create new notebook" button
    logger.info('Test 1: Looking for "Create new notebook" button...', 'test');
    
    const createButtonSelectors = [
      'text=Create new notebook',
      '.mat-title-large:has-text("Create new notebook")',
      'span:has-text("Create new notebook")',
      '[class*="create-new"]:has-text("Create new notebook")'
    ];
    
    let createButton = null;
    for (const selector of createButtonSelectors) {
      try {
        createButton = await page.locator(selector).first();
        const isVisible = await createButton.isVisible({ timeout: 2000 });
        if (isVisible) {
          logger.success(`✅ Found with selector: ${selector}`, 'test');
          break;
        }
      } catch (e) {
        logger.debug(`Selector failed: ${selector}`, null, 'test');
      }
    }
    
    if (!createButton) {
      logger.warn('Could not find "Create new notebook" button', 'test');
      logger.info('You may already have notebooks. Try opening one.', 'test');
    }
    
    logger.info('');
    logger.info('NEXT STEPS:', 'test');
    logger.info('  1. Manually create or open a notebook in the browser', 'test');
    logger.info('  2. Look for "Add sources" or "Upload" button', 'test');
    logger.info('  3. Right-click the upload button → Inspect', 'test');
    logger.info('  4. Copy the selector (aria-label, class, etc)', 'test');
    logger.info('');
    logger.info('Common selectors to look for:', 'test');
    logger.info('  - button[aria-label="Add source"]', 'test');
    logger.info('  - button[aria-label="Upload files"]', 'test');
    logger.info('  - text=Add source', 'test');
    logger.info('  - input[type="file"]', 'test');
    logger.info('');
    logger.warn('Browser will stay open. Press Ctrl+C when done.', 'test');
    
    // Keep browser open
    await new Promise(() => {});
    
  } catch (error) {
    logger.error('Discovery failed', error, 'test');
  }
}

testSelectors();

