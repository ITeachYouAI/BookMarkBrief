#!/usr/bin/env node
/**
 * Interactive Twitter Lists Finder
 * 
 * This script:
 * 1. Opens Twitter
 * 2. Waits for YOU to navigate to your Lists page
 * 3. Extracts ALL visible lists
 * 4. Saves to lists-config.json
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BROWSER_DATA_DIR = path.join(__dirname, 'browser-data');
const CONFIG_FILE = path.join(__dirname, 'lists-config.json');

async function findLists() {
  console.log('🔍 Interactive Twitter Lists Finder\n');
  
  let context = null;
  
  try {
    context = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
      headless: false,
      viewport: { width: 1280, height: 900 },
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--no-sandbox'
      ]
    });
    
    const page = await context.newPage();
    
    console.log('📱 Opening Twitter...\n');
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    console.log('👉 MANUAL STEPS:');
    console.log('1. Navigate to your Lists page (click on Lists in sidebar)');
    console.log('2. Make sure all your lists are visible (scroll if needed)');
    console.log('3. Come back to terminal and press ENTER\n');
    
    // Wait for user to navigate
    await new Promise((resolve) => {
      process.stdin.once('data', () => {
        console.log('\n✅ Extracting lists from current page...\n');
        resolve();
      });
    });
    
    // Extract lists from whatever page they're on
    const lists = await page.evaluate(() => {
      const results = [];
      const seenIds = new Set();
      
      // Find all list cells - data-testid="listCell"
      const listCells = document.querySelectorAll('[data-testid="listCell"]');
      
      console.log(`Found ${listCells.length} list cells`);
      
      listCells.forEach((cell, index) => {
        try {
          // Find the link inside this cell
          const link = cell.querySelector('a[href*="/i/lists/"]');
          if (!link) {
            console.log(`Cell ${index}: No link found`);
            return;
          }
          
          const href = link.href;
          const match = href.match(/\/i\/lists\/(\d+)/);
          if (!match) {
            console.log(`Cell ${index}: No match for ${href}`);
            return;
          }
          
          const listId = match[1];
          if (seenIds.has(listId)) {
            console.log(`Cell ${index}: Duplicate ${listId}`);
            return;
          }
          seenIds.add(listId);
          
          // Get all text content from the cell
          const allText = cell.innerText.split('\n').map(t => t.trim()).filter(Boolean);
          
          let name = allText[0] || 'Unnamed List';
          let memberCount = '';
          let creator = '';
          
          // Parse text lines
          allText.forEach(text => {
            // Member count: "X members"
            if (text.match(/\d+\s*members?/i)) {
              memberCount = text;
            }
            // Creator: usually has @ or verified badge
            if (text.startsWith('@') || (text.includes('@') && !text.includes('including'))) {
              creator = text;
            }
          });
          
          console.log(`Cell ${index}: ${name} (${listId})`);
          
          results.push({
            name,
            url: href,
            listId,
            memberCount,
            creator
          });
        } catch (error) {
          console.error(`Error processing cell ${index}:`, error);
        }
      });
      
      return results;
    });
    
    if (lists.length === 0) {
      console.log('❌ No lists found on this page.\n');
      console.log('Make sure you:');
      console.log('1. Navigated to your Lists page');
      console.log('2. Can see your lists on screen');
      console.log('3. Scrolled to load all lists\n');
      
      console.log('Current page URL:', page.url());
      console.log('\nKeeping browser open for 30 seconds...');
      await page.waitForTimeout(30000);
      
    } else {
      console.log(`✅ Found ${lists.length} Twitter Lists:\n`);
      
      lists.forEach((list, i) => {
        console.log(`${i + 1}. ${list.name}`);
        console.log(`   URL: ${list.url}`);
        console.log(`   ID: ${list.listId}`);
        if (list.memberCount) {
          console.log(`   Members: ${list.memberCount}`);
        }
        if (list.description && list.description !== list.name) {
          console.log(`   Description: ${list.description}`);
        }
        console.log('');
      });
      
      // Generate config
      const config = {
        lists: lists.map(list => ({
          name: list.name,
          url: list.url,
          listId: list.listId,
          enabled: true,
          maxTweets: 50,
          description: list.description || '',
          memberCount: list.memberCount || ''
        })),
        settings: {
          syncEnabled: true,
          createSeparateNotebooks: true,
          notebookNameFormat: "BrainBrief - {listName} - {date}"
        }
      };
      
      // Save config
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
      
      console.log('💾 Saved to lists-config.json\n');
      console.log('Next: Open the Electron app to select which lists to sync!');
      console.log('Run: npm start\n');
    }
    
    await context.close();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (context) {
      await context.close().catch(() => {});
    }
    process.exit(1);
  }
}

findLists();

