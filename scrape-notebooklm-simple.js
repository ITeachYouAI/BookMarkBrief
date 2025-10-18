/**
 * BrainBrief - NotebookLM Simple Scraper
 * 
 * Purpose: Scrape NotebookLM in one shot (manual workflow)
 * Usage: node scrape-notebooklm-simple.js
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const logger = require('./src/utils/logger');

const BROWSER_DATA_DIR = path.join(__dirname, 'browser-data/notebooklm');
const NOTEBOOKLM_URL = 'https://notebooklm.google.com';
const OUTPUT_FILE = path.join(__dirname, 'notebooklm-selectors.json');

async function scrapeNotebookLM() {
  logger.info('='.repeat(70));
  logger.info('NOTEBOOKLM UI SCRAPER (SIMPLIFIED)');
  logger.info('='.repeat(70));
  logger.info('');
  logger.info('INSTRUCTIONS:', 'scraper');
  logger.info('  1. Browser will open', 'scraper');
  logger.info('  2. Log in to NotebookLM', 'scraper');
  logger.info('  3. Open a notebook (or create one)', 'scraper');
  logger.info('  4. Click "Add sources" button', 'scraper');
  logger.info('  5. Keep upload dialog open', 'scraper');
  logger.info('  6. Browser will stay open for 2 minutes', 'scraper');
  logger.info('  7. Script will scrape automatically', 'scraper');
  logger.info('');
  logger.warn('Browser will stay open for 120 seconds, then auto-scrape', 'scraper');
  logger.info('');
  
  let context;
  
  try {
    context = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
      headless: false,
      viewport: { width: 1400, height: 1000 },
      args: ['--disable-blink-features=AutomationControlled']
    });
    
    const page = await context.newPage();
    
    logger.info('Opening NotebookLM...', 'scraper');
    await page.goto(NOTEBOOKLM_URL);
    await page.waitForLoadState('networkidle');
    
    logger.success('NotebookLM loaded', 'scraper');
    logger.info('');
    logger.info('YOU HAVE 120 SECONDS:', 'scraper');
    logger.info('  1. Log in if needed', 'scraper');
    logger.info('  2. Open/create a notebook', 'scraper');
    logger.info('  3. Click "Add sources" button', 'scraper');
    logger.info('  4. Keep dialog open', 'scraper');
    logger.info('');
    
    // Countdown
    for (let i = 120; i > 0; i -= 10) {
      logger.info(`Time remaining: ${i} seconds...`, 'scraper');
      await page.waitForTimeout(10000);
    }
    
    logger.info('');
    logger.info('Scraping UI now...', 'scraper');
    
    // Scrape everything
    const uiData = await page.evaluate(() => {
      const results = {
        url: window.location.href,
        timestamp: new Date().toISOString(),
        buttons: [],
        inputs: [],
        ariaElements: [],
        uploadRelated: []
      };
      
      // All visible buttons
      document.querySelectorAll('button').forEach((btn) => {
        if (btn.offsetParent !== null) {
          results.buttons.push({
            text: btn.innerText?.trim(),
            ariaLabel: btn.getAttribute('aria-label'),
            className: btn.className,
            id: btn.id
          });
        }
      });
      
      // All inputs
      document.querySelectorAll('input').forEach((input) => {
        results.inputs.push({
          type: input.type,
          accept: input.accept,
          ariaLabel: input.getAttribute('aria-label'),
          className: input.className,
          id: input.id,
          name: input.name,
          visible: input.offsetParent !== null
        });
      });
      
      // All aria-labeled elements
      document.querySelectorAll('[aria-label]').forEach((el) => {
        if (el.offsetParent !== null) {
          results.ariaElements.push({
            tag: el.tagName,
            ariaLabel: el.getAttribute('aria-label'),
            text: el.innerText?.trim().substring(0, 100),
            className: el.className
          });
        }
      });
      
      // Elements containing upload/source keywords
      const keywords = ['upload', 'source', 'add', 'file', 'import'];
      keywords.forEach(keyword => {
        document.querySelectorAll('*').forEach(el => {
          const text = el.innerText?.toLowerCase() || '';
          const aria = el.getAttribute('aria-label')?.toLowerCase() || '';
          
          if ((text.includes(keyword) || aria.includes(keyword)) && 
              el.offsetParent !== null &&
              el.children.length <= 2) {
            results.uploadRelated.push({
              keyword,
              tag: el.tagName,
              text: el.innerText?.trim().substring(0, 100),
              ariaLabel: el.getAttribute('aria-label'),
              className: el.className
            });
          }
        });
      });
      
      return results;
    });
    
    // Save results
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(uiData, null, 2));
    
    logger.success(`UI data saved to: ${OUTPUT_FILE}`, 'scraper');
    logger.info('');
    logger.info('SUMMARY:', 'scraper');
    logger.info(`  Buttons: ${uiData.buttons.length}`, 'scraper');
    logger.info(`  Inputs: ${uiData.inputs.length}`, 'scraper');
    logger.info(`  Aria elements: ${uiData.ariaElements.length}`, 'scraper');
    logger.info(`  Upload-related: ${uiData.uploadRelated.length}`, 'scraper');
    logger.info('');
    
    // Show file inputs
    const fileInputs = uiData.inputs.filter(i => i.type === 'file');
    if (fileInputs.length > 0) {
      logger.success('FILE INPUTS FOUND:', 'scraper');
      fileInputs.forEach(input => {
        logger.info(`  Type: ${input.type}`, 'scraper');
        logger.info(`  Accept: ${input.accept}`, 'scraper');
        logger.info(`  Aria-label: ${input.ariaLabel}`, 'scraper');
        logger.info(`  Visible: ${input.visible}`, 'scraper');
        logger.info('', 'scraper');
      });
    }
    
    // Show upload buttons
    const uploadButtons = uiData.buttons.filter(b => 
      b.text?.toLowerCase().includes('upload') || 
      b.text?.toLowerCase().includes('add') ||
      b.text?.toLowerCase().includes('source') ||
      b.ariaLabel?.toLowerCase().includes('upload') ||
      b.ariaLabel?.toLowerCase().includes('source')
    );
    
    if (uploadButtons.length > 0) {
      logger.success('UPLOAD-RELATED BUTTONS FOUND:', 'scraper');
      uploadButtons.slice(0, 5).forEach(btn => {
        logger.info(`  Text: "${btn.text}"`, 'scraper');
        logger.info(`  Aria-label: ${btn.ariaLabel}`, 'scraper');
        logger.info('', 'scraper');
      });
    }
    
    logger.info('Full data saved to: notebooklm-selectors.json', 'scraper');
    
    await context.close();
    
  } catch (error) {
    logger.error('Scraping failed', error, 'scraper');
    if (context) await context.close();
  }
}

scrapeNotebookLM();

