/**
 * BrainBrief - NotebookLM UI Discovery
 * 
 * Purpose: Explore NotebookLM UI to find upload selectors
 * Usage: node test-notebooklm-discover.js
 * 
 * This script will:
 * 1. Open NotebookLM
 * 2. Pause so you can explore the UI manually
 * 3. Help identify selectors for automation
 * 
 * @module test-notebooklm-discover
 */

const { chromium } = require('playwright');
const path = require('path');
const logger = require('./src/utils/logger');

const BROWSER_DATA_DIR = path.join(__dirname, 'browser-data/notebooklm');
const NOTEBOOKLM_URL = 'https://notebooklm.google.com';

async function discoverUI() {
  logger.info('='.repeat(70));
  logger.info('NOTEBOOKLM UI DISCOVERY');
  logger.info('='.repeat(70));
  logger.info('');
  logger.info('This script will:', 'discover');
  logger.info('  1. Open NotebookLM in browser', 'discover');
  logger.info('  2. Keep browser open for manual exploration', 'discover');
  logger.info('  3. Let you inspect UI elements', 'discover');
  logger.info('');
  logger.info('INSTRUCTIONS:', 'discover');
  logger.info('  - Use Chrome DevTools (Right-click → Inspect)', 'discover');
  logger.info('  - Find selectors for:', 'discover');
  logger.info('    * "Create new notebook" button', 'discover');
  logger.info('    * "Upload sources" button', 'discover');
  logger.info('    * File input element', 'discover');
  logger.info('    * "Processing" indicator', 'discover');
  logger.info('  - Document selectors in terminal or notes', 'discover');
  logger.info('');
  logger.warn('Browser will stay open. Press Ctrl+C when done.', 'discover');
  logger.info('');
  
  let context;
  
  try {
    // Launch browser
    logger.info('Launching browser...', 'discover');
    context = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
      headless: false,
      viewport: { width: 1400, height: 1000 },
      devtools: true, // Auto-open DevTools
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage'
      ]
    });
    
    const page = await context.newPage();
    
    logger.success('Browser launched', 'discover');
    logger.info('Navigating to NotebookLM...', 'discover');
    
    await page.goto(NOTEBOOKLM_URL);
    await page.waitForLoadState('networkidle');
    
    logger.success('NotebookLM loaded', 'discover');
    logger.info('');
    logger.info('='.repeat(70));
    logger.success('✅ READY FOR EXPLORATION');
    logger.info('='.repeat(70));
    logger.info('');
    logger.info('Manual steps:', 'discover');
    logger.info('  1. Log in to Google if needed', 'discover');
    logger.info('  2. Create a test notebook (or open existing)', 'discover');
    logger.info('  3. Click "Add sources" or "Upload"', 'discover');
    logger.info('  4. Right-click elements → Inspect', 'discover');
    logger.info('  5. Note the selectors:', 'discover');
    logger.info('     - Button aria-labels', 'discover');
    logger.info('     - Input type="file" selector', 'discover');
    logger.info('     - Processing/loading indicators', 'discover');
    logger.info('');
    logger.warn('Press Ctrl+C when you have the selectors', 'discover');
    logger.info('');
    
    // Keep browser open indefinitely
    await new Promise(() => {});
    
  } catch (error) {
    logger.error('Discovery failed', error, 'discover');
  } finally {
    if (context) {
      await context.close();
    }
  }
}

discoverUI();

