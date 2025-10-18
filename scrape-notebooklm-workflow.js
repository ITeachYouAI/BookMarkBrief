/**
 * BrainBrief - NotebookLM Workflow Scraper
 * 
 * Purpose: Scrape UI selectors for each stage of NotebookLM workflow
 * Usage: node scrape-notebooklm-workflow.js
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const logger = require('./src/utils/logger');
const readline = require('readline');

const BROWSER_DATA_DIR = path.join(__dirname, 'browser-data/notebooklm');
const NOTEBOOKLM_URL = 'https://notebooklm.google.com';
const OUTPUT_DIR = path.join(__dirname, 'notebooklm-scraped');

// Create readline interface for user prompts
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise(resolve => {
    rl.question(question, answer => resolve(answer));
  });
}

/**
 * Scrape current page UI
 */
async function scrapePage(page, stageName) {
  logger.info(`Scraping ${stageName}...`, 'scraper');
  
  const uiData = await page.evaluate(() => {
    const results = {
      url: window.location.href,
      title: document.title,
      buttons: [],
      inputs: [],
      textElements: [],
      ariaElements: []
    };
    
    // All buttons
    document.querySelectorAll('button').forEach((btn, idx) => {
      if (btn.offsetParent !== null) { // Only visible
        results.buttons.push({
          index: idx,
          text: btn.innerText?.trim(),
          ariaLabel: btn.getAttribute('aria-label'),
          ariaDescribedBy: btn.getAttribute('aria-describedby'),
          className: btn.className,
          id: btn.id,
          type: btn.type,
          disabled: btn.disabled
        });
      }
    });
    
    // All inputs
    document.querySelectorAll('input').forEach((input, idx) => {
      results.inputs.push({
        index: idx,
        type: input.type,
        accept: input.accept,
        ariaLabel: input.getAttribute('aria-label'),
        placeholder: input.placeholder,
        className: input.className,
        id: input.id,
        name: input.name,
        visible: input.offsetParent !== null
      });
    });
    
    // Elements with aria-labels (most reliable)
    document.querySelectorAll('[aria-label]').forEach((el, idx) => {
      if (el.offsetParent !== null) {
        results.ariaElements.push({
          index: idx,
          tagName: el.tagName,
          ariaLabel: el.getAttribute('aria-label'),
          text: el.innerText?.trim().substring(0, 100),
          className: el.className,
          id: el.id
        });
      }
    });
    
    // Search for key terms
    const keywords = ['upload', 'add', 'source', 'file', 'create', 'notebook', 'processing', 'import'];
    keywords.forEach(keyword => {
      const elements = Array.from(document.querySelectorAll('*'))
        .filter(el => {
          const text = el.innerText?.toLowerCase() || '';
          const aria = el.getAttribute('aria-label')?.toLowerCase() || '';
          return (text.includes(keyword) || aria.includes(keyword)) && 
                 el.offsetParent !== null &&
                 el.children.length === 0; // Leaf nodes only
        })
        .slice(0, 5); // Max 5 per keyword
      
      elements.forEach(el => {
        results.textElements.push({
          keyword: keyword,
          tagName: el.tagName,
          text: el.innerText?.trim(),
          ariaLabel: el.getAttribute('aria-label'),
          className: el.className,
          id: el.id
        });
      });
    });
    
    return results;
  });
  
  // Save stage data
  const filename = `${stageName.toLowerCase().replace(/\s+/g, '-')}.json`;
  const filepath = path.join(OUTPUT_DIR, filename);
  
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  fs.writeFileSync(filepath, JSON.stringify(uiData, null, 2));
  
  logger.success(`Saved ${stageName} UI data: ${filename}`, 'scraper');
  logger.info(`  Buttons: ${uiData.buttons.length}`, 'scraper');
  logger.info(`  Inputs: ${uiData.inputs.length}`, 'scraper');
  logger.info(`  Aria elements: ${uiData.ariaElements.length}`, 'scraper');
  logger.info(`  Text elements: ${uiData.textElements.length}`, 'scraper');
  
  return uiData;
}

/**
 * Main workflow scraper
 */
async function scrapeWorkflow() {
  logger.info('='.repeat(70));
  logger.info('NOTEBOOKLM WORKFLOW SCRAPER');
  logger.info('='.repeat(70));
  logger.info('');
  logger.info('This will scrape UI selectors for each stage:', 'scraper');
  logger.info('  1. Landing page (notebook list)', 'scraper');
  logger.info('  2. Inside notebook (add sources)', 'scraper');
  logger.info('  3. Upload modal (file picker)', 'scraper');
  logger.info('  4. Processing state (after upload)', 'scraper');
  logger.info('');
  
  let context;
  
  try {
    context = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
      headless: false,
      viewport: { width: 1400, height: 1000 },
      args: ['--disable-blink-features=AutomationControlled']
    });
    
    const page = await context.newPage();
    
    // Stage 1: Landing page
    logger.info('');
    logger.info('='.repeat(70));
    logger.info('STAGE 1: LANDING PAGE (Notebook List)');
    logger.info('='.repeat(70));
    logger.info('');
    logger.info('What you should see:', 'scraper');
    logger.info('  ✓ NotebookLM home page loaded', 'scraper');
    logger.info('  ✓ List of your notebooks (or "Create new notebook" card)', 'scraper');
    logger.info('  ✓ No notebook is open yet', 'scraper');
    logger.info('');
    
    await page.goto(NOTEBOOKLM_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    logger.success('Browser loaded NotebookLM', 'scraper');
    logger.info('');
    logger.warn('ACTION REQUIRED:', 'scraper');
    logger.info('  1. Log in to Google if prompted', 'scraper');
    logger.info('  2. Wait for notebook list to appear', 'scraper');
    logger.info('  3. DO NOT open any notebook yet', 'scraper');
    logger.info('  4. Press Enter when you see the notebook list/grid', 'scraper');
    logger.info('');
    
    await prompt('>>> Press Enter when Stage 1 is ready (notebook list visible): ');
    
    const landingData = await scrapePage(page, 'stage-1-landing');
    logger.success('✅ Stage 1 scraped!', 'scraper');
    
    // Stage 2: Inside notebook
    logger.info('');
    logger.info('='.repeat(70));
    logger.info('STAGE 2: INSIDE NOTEBOOK (Sources Page)');
    logger.info('='.repeat(70));
    logger.info('');
    logger.info('What you should see:', 'scraper');
    logger.info('  ✓ Notebook is open (title at top)', 'scraper');
    logger.info('  ✓ Sources section visible', 'scraper');
    logger.info('  ✓ "Add sources" or "Upload" button somewhere', 'scraper');
    logger.info('  ✓ DO NOT click anything yet', 'scraper');
    logger.info('');
    logger.warn('ACTION REQUIRED:', 'scraper');
    logger.info('  1. Click to open an existing notebook', 'scraper');
    logger.info('     OR create a new notebook (name it "BrainBrief Test")', 'scraper');
    logger.info('  2. Wait for notebook to fully load', 'scraper');
    logger.info('  3. Look for "Add sources" or upload area', 'scraper');
    logger.info('  4. DO NOT click upload yet', 'scraper');
    logger.info('  5. Press Enter when you see the sources/upload area', 'scraper');
    logger.info('');
    
    await prompt('>>> Press Enter when Stage 2 is ready (inside notebook, upload button visible): ');
    
    await page.waitForTimeout(2000);
    const notebookData = await scrapePage(page, 'stage-2-notebook');
    logger.success('✅ Stage 2 scraped!', 'scraper');
    
    // Stage 3: Upload modal
    logger.info('');
    logger.info('='.repeat(70));
    logger.info('STAGE 3: UPLOAD MODAL/DIALOG');
    logger.info('='.repeat(70));
    logger.info('');
    logger.info('What you should see:', 'scraper');
    logger.info('  ✓ Upload dialog or modal is open', 'scraper');
    logger.info('  ✓ File picker OR drag-drop area', 'scraper');
    logger.info('  ✓ Options: "Upload from computer", "From Google Drive", etc.', 'scraper');
    logger.info('  ✓ DO NOT upload a file yet', 'scraper');
    logger.info('');
    logger.warn('ACTION REQUIRED:', 'scraper');
    logger.info('  1. Click the "Add sources" or "Upload" button', 'scraper');
    logger.info('  2. Wait for upload dialog/modal to appear', 'scraper');
    logger.info('  3. DO NOT select a file yet', 'scraper');
    logger.info('  4. Press Enter when dialog is fully visible', 'scraper');
    logger.info('');
    
    await prompt('>>> Press Enter when Stage 3 is ready (upload dialog visible): ');
    
    await page.waitForTimeout(1000);
    const uploadModalData = await scrapePage(page, 'stage-3-upload-modal');
    logger.success('✅ Stage 3 scraped!', 'scraper');
    
    // Stage 4: Processing (optional)
    logger.info('');
    logger.info('='.repeat(70));
    logger.info('STAGE 4: PROCESSING (Optional but Recommended)');
    logger.info('='.repeat(70));
    logger.info('');
    const doProcessing = await prompt('Upload a test file to capture processing indicators? (y/n): ');
    
    if (doProcessing.toLowerCase() === 'y') {
      logger.info('');
      logger.info('What you should see after uploading:', 'scraper');
      logger.info('  ✓ File uploading...', 'scraper');
      logger.info('  ✓ "Processing..." message or spinner', 'scraper');
      logger.info('  ✓ Progress indicator', 'scraper');
      logger.info('');
      logger.warn('ACTION REQUIRED:', 'scraper');
      logger.info('  1. Select and upload a small text file (any .txt)', 'scraper');
      logger.info('  2. Watch for "Processing..." indicator', 'scraper');
      logger.info('  3. Press Enter when you see processing/loading', 'scraper');
      logger.info('');
      
      await prompt('>>> Press Enter when Stage 4 is ready (file processing): ');
      
      await page.waitForTimeout(1000);
      const processingData = await scrapePage(page, 'stage-4-processing');
      logger.success('✅ Stage 4 scraped!', 'scraper');
      
      // Stage 5: Complete
      logger.info('');
      logger.info('='.repeat(70));
      logger.info('STAGE 5: UPLOAD COMPLETE');
      logger.info('='.repeat(70));
      logger.info('');
      logger.info('What you should see:', 'scraper');
      logger.info('  ✓ File appears in sources list', 'scraper');
      logger.info('  ✓ "Ready" or checkmark indicator', 'scraper');
      logger.info('  ✓ No more "Processing..." message', 'scraper');
      logger.info('');
      logger.warn('ACTION REQUIRED:', 'scraper');
      logger.info('  1. Wait for upload to complete', 'scraper');
      logger.info('  2. Verify file appears in sources', 'scraper');
      logger.info('  3. Press Enter when complete', 'scraper');
      logger.info('');
      
      await prompt('>>> Press Enter when Stage 5 is ready (upload complete): ');
      
      await page.waitForTimeout(1000);
      const completeData = await scrapePage(page, 'stage-5-complete');
      logger.success('✅ Stage 5 scraped!', 'scraper');
    }
    
    // Summary
    logger.info('');
    logger.info('='.repeat(70));
    logger.success('✅ WORKFLOW SCRAPING COMPLETE');
    logger.info('='.repeat(70));
    logger.info('');
    logger.info(`All UI data saved to: ${OUTPUT_DIR}/`, 'scraper');
    logger.info('');
    logger.info('Files created:', 'scraper');
    const files = fs.readdirSync(OUTPUT_DIR);
    files.forEach(file => {
      logger.info(`  - ${file}`, 'scraper');
    });
    logger.info('');
    logger.info('NEXT STEPS:', 'scraper');
    logger.info('  1. Review JSON files for upload button selector', 'scraper');
    logger.info('  2. Find file input selector', 'scraper');
    logger.info('  3. Find processing indicator', 'scraper');
    logger.info('  4. I will build automation with those selectors', 'scraper');
    
    rl.close();
    await context.close();
    
  } catch (error) {
    logger.error('Workflow scraping failed', error, 'scraper');
    rl.close();
    if (context) await context.close();
  }
}

scrapeWorkflow();

