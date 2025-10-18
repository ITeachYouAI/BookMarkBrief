/**
 * BrainBrief - NotebookLM UI Scraper
 * 
 * Purpose: Automatically extract NotebookLM UI structure and selectors
 * Usage: node scrape-notebooklm-ui.js
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const logger = require('./src/utils/logger');

const BROWSER_DATA_DIR = path.join(__dirname, 'browser-data/notebooklm');
const NOTEBOOKLM_URL = 'https://notebooklm.google.com';
const OUTPUT_FILE = path.join(__dirname, 'notebooklm-ui-analysis.json');

async function scrapeUI() {
  logger.info('='.repeat(70));
  logger.info('NOTEBOOKLM UI AUTOMATIC SCRAPER');
  logger.info('='.repeat(70));
  
  let context;
  
  try {
    context = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
      headless: false,
      viewport: { width: 1400, height: 1000 },
      args: ['--disable-blink-features=AutomationControlled']
    });
    
    const page = await context.newPage();
    
    logger.info('Navigating to NotebookLM...', 'scraper');
    await page.goto(NOTEBOOKLM_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000); // Let page fully load
    
    logger.success('Page loaded', 'scraper');
    logger.info('');
    logger.info('Please manually:', 'scraper');
    logger.info('  1. Log in if needed', 'scraper');
    logger.info('  2. Create or open a notebook', 'scraper');
    logger.info('  3. Wait for notebook to fully load', 'scraper');
    logger.info('');
    logger.warn('Press Enter when ready to scrape UI...', 'scraper');
    
    // Wait for user to press Enter
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });
    
    logger.info('');
    logger.info('Scraping UI elements...', 'scraper');
    
    // Extract UI structure
    const uiData = await page.evaluate(() => {
      const results = {
        buttons: [],
        inputs: [],
        links: [],
        icons: [],
        textElements: []
      };
      
      // Find all buttons
      document.querySelectorAll('button').forEach((btn, idx) => {
        results.buttons.push({
          index: idx,
          text: btn.innerText?.trim().substring(0, 50),
          ariaLabel: btn.getAttribute('aria-label'),
          classes: btn.className,
          id: btn.id,
          visible: btn.offsetParent !== null
        });
      });
      
      // Find all inputs
      document.querySelectorAll('input').forEach((input, idx) => {
        results.inputs.push({
          index: idx,
          type: input.type,
          accept: input.accept,
          ariaLabel: input.getAttribute('aria-label'),
          classes: input.className,
          id: input.id,
          visible: input.offsetParent !== null
        });
      });
      
      // Find all links
      document.querySelectorAll('a').forEach((link, idx) => {
        results.links.push({
          index: idx,
          text: link.innerText?.trim().substring(0, 50),
          href: link.href,
          ariaLabel: link.getAttribute('aria-label'),
          classes: link.className
        });
      });
      
      // Find mat-icons (Material UI icons)
      document.querySelectorAll('mat-icon').forEach((icon, idx) => {
        results.icons.push({
          index: idx,
          text: icon.innerText?.trim(),
          ariaLabel: icon.getAttribute('aria-label'),
          role: icon.getAttribute('role')
        });
      });
      
      // Find elements with specific text
      const searchTerms = ['upload', 'add', 'source', 'file', 'create', 'notebook', 'processing'];
      searchTerms.forEach(term => {
        const xpath = `//*[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${term}')]`;
        const iterator = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
        let node = iterator.iterateNext();
        let count = 0;
        
        while (node && count < 10) {
          if (node.nodeType === 1 && node.offsetParent !== null) { // Element and visible
            results.textElements.push({
              term: term,
              tagName: node.tagName,
              text: node.innerText?.trim().substring(0, 100),
              ariaLabel: node.getAttribute('aria-label'),
              classes: node.className,
              id: node.id
            });
          }
          node = iterator.iterateNext();
          count++;
        }
      });
      
      return results;
    });
    
    // Save to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(uiData, null, 2));
    
    logger.success(`UI data saved to: ${OUTPUT_FILE}`, 'scraper');
    logger.info('');
    logger.info('='.repeat(70));
    logger.info('RESULTS SUMMARY');
    logger.info('='.repeat(70));
    logger.info('');
    
    // Show key findings
    logger.info(`Buttons found: ${uiData.buttons.length}`, 'scraper');
    logger.info(`Inputs found: ${uiData.inputs.length}`, 'scraper');
    logger.info(`Links found: ${uiData.links.length}`, 'scraper');
    logger.info('');
    
    // Show visible buttons with text
    logger.info('Visible buttons with text:', 'scraper');
    uiData.buttons
      .filter(b => b.visible && b.text)
      .slice(0, 10)
      .forEach(b => {
        logger.info(`  - "${b.text}" (aria-label: ${b.ariaLabel || 'none'})`, 'scraper');
      });
    
    logger.info('');
    
    // Show file inputs
    logger.info('File inputs:', 'scraper');
    const fileInputs = uiData.inputs.filter(i => i.type === 'file');
    if (fileInputs.length > 0) {
      fileInputs.forEach(input => {
        logger.success(`  Found file input: accept="${input.accept}"`, 'scraper');
        logger.info(`    aria-label: ${input.ariaLabel}`, 'scraper');
        logger.info(`    classes: ${input.classes}`, 'scraper');
      });
    } else {
      logger.warn('  No file inputs found (may appear after clicking upload)', 'scraper');
    }
    
    logger.info('');
    logger.info('Full UI data saved to: notebooklm-ui-analysis.json', 'scraper');
    logger.info('Search that file for "upload", "source", "add" keywords', 'scraper');
    logger.info('');
    
    await context.close();
    
  } catch (error) {
    logger.error('Scraping failed', error, 'scraper');
    if (context) await context.close();
  }
}

scrapeUI();

