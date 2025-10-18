#!/usr/bin/env node
/**
 * Automated Twitter Lists Discovery
 * 
 * Automatically finds all your Twitter Lists and saves them to config
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BROWSER_DATA_DIR = path.join(__dirname, 'browser-data');
const CONFIG_FILE = path.join(__dirname, 'lists-config.json');

async function autoFindLists() {
  console.log('🔍 Auto-discovering your Twitter Lists...\n');
  
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
    
    // Step 1: Get username
    console.log('📱 Opening Twitter...');
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    console.log('🔍 Detecting your username...');
    const username = await page.evaluate(() => {
      // Try to get username from profile link
      const profileLink = document.querySelector('[data-testid="AppTabBar_Profile_Link"]');
      if (profileLink && profileLink.href) {
        const match = profileLink.href.match(/x\.com\/([^\/]+)/);
        if (match) return match[1];
      }
      return null;
    });
    
    if (!username) {
      console.log('⚠️  Could not detect username. Using default approach...');
    } else {
      console.log(`✅ Found username: @${username}\n`);
    }
    
    // Step 2: Navigate to Lists page
    const listsUrl = username 
      ? `https://x.com/${username}/lists`
      : 'https://x.com/i/lists';
    
    console.log(`📋 Navigating to: ${listsUrl}`);
    await page.goto(listsUrl, { waitUntil: 'domcontentloaded' });
    
    // Step 3: Wait for lists to load (React-rendered, takes time)
    console.log('⏳ Waiting for lists to load (React app)...');
    try {
      // Wait for at least one listCell to appear
      await page.waitForSelector('[data-testid="listCell"]', { timeout: 10000 });
      console.log('✅ Lists loaded!');
    } catch (error) {
      console.log('⚠️  Lists taking longer than expected, waiting 5 more seconds...');
      await page.waitForTimeout(5000);
    }
    
    // Step 4: Scroll to load all lists
    console.log('📜 Scrolling to load all lists...');
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(1500);
    }
    
    // Wait a bit more for lazy-loaded lists
    await page.waitForTimeout(2000);
    
    // Step 5: Extract lists
    console.log('🔎 Extracting lists...\n');
    
    // Set up console message listener to see browser console.log
    page.on('console', msg => {
      if (msg.type() === 'log') {
        console.log(`   [Browser]: ${msg.text()}`);
      }
    });
    
    const lists = await page.evaluate(() => {
      const results = [];
      const seenIds = new Set();
      
      // Find all list cells - data-testid="listCell"
      const listCells = document.querySelectorAll('[data-testid="listCell"]');
      
      console.log(`Found ${listCells.length} list cells`);
      
      listCells.forEach((cell, index) => {
        try {
          // The cell itself might be the clickable element with role="link"
          // Or there might be an <a> tag inside
          let link = cell.querySelector('a[href*="/i/lists/"]');
          let href = link ? link.href : null;
          
          // If no <a> tag, check if the cell itself has a link in aria-label or onclick
          if (!href && cell.role === 'link') {
            // Look for any element with a list ID in its attributes
            const allElements = cell.querySelectorAll('*');
            for (const el of allElements) {
              const dataHref = el.getAttribute('data-href') || el.getAttribute('href');
              if (dataHref && dataHref.includes('/i/lists/')) {
                href = dataHref.startsWith('http') ? dataHref : `https://x.com${dataHref}`;
                break;
              }
            }
          }
          
          // Last resort: look for list ID in the cell's HTML
          if (!href) {
            const cellHTML = cell.innerHTML;
            const match = cellHTML.match(/\/i\/lists\/(\d+)/);
            if (match) {
              const listId = match[1];
              href = `https://x.com/i/lists/${listId}`;
            }
          }
          
          if (!href) {
            console.log(`Cell ${index}: No href found`);
            return;
          }
          
          const match = href.match(/\/i\/lists\/(\d+)/);
          if (!match) {
            console.log(`Cell ${index}: No ID match for ${href}`);
            return;
          }
          
          const listId = match[1];
          if (seenIds.has(listId)) return;
          seenIds.add(listId);
          
          // Get all text content from the cell
          const allText = cell.innerText.split('\n').map(t => t.trim()).filter(Boolean);
          
          let name = allText[0] || 'Unnamed List';
          let memberCount = '';
          let creator = '';
          
          // Parse text lines
          allText.forEach(text => {
            if (text.match(/\d+\s*members?/i)) {
              memberCount = text;
            }
            if (text.startsWith('@') || (text.includes('@') && !text.includes('including'))) {
              creator = text;
            }
          });
          
          console.log(`Cell ${index}: ${name} -> ${href}`);
          
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
      console.log('❌ No lists found!\n');
      console.log('This could mean:');
      console.log('1. You don\'t have any Twitter Lists');
      console.log('2. The page didn\'t load correctly');
      console.log('3. Twitter changed their HTML structure\n');
      
      // Save screenshot for debugging
      await page.screenshot({ path: 'debug-lists-auto.png' });
      console.log('📸 Saved screenshot: debug-lists-auto.png');
      
      // Save HTML for debugging
      const html = await page.content();
      fs.writeFileSync('debug-lists-auto.html', html);
      console.log('💾 Saved HTML: debug-lists-auto.html\n');
      
      console.log('Keeping browser open for 10 seconds for inspection...');
      await page.waitForTimeout(10000);
      
    } else {
      console.log(`✅ Found ${lists.length} Twitter Lists:\n`);
      
      lists.forEach((list, i) => {
        console.log(`${i + 1}. ${list.name}`);
        console.log(`   URL: ${list.url}`);
        console.log(`   ID: ${list.listId}`);
        if (list.memberCount) {
          console.log(`   ${list.memberCount}`);
        }
        if (list.creator) {
          console.log(`   By: ${list.creator}`);
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
          memberCount: list.memberCount || '',
          creator: list.creator || ''
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
      console.log('✅ Next: Open the Electron app to select which lists to sync!');
      console.log('   Run: npm start\n');
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

autoFindLists();

