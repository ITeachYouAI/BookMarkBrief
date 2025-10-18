#!/usr/bin/env node
/**
 * Click-based List Discovery
 * 
 * Strategy: Click each listCell, grab URL, go back, repeat
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BROWSER_DATA_DIR = path.join(__dirname, 'browser-data');

async function clickAndExtract() {
  console.log('🔍 Clicking each list to extract URLs...\n');
  
  let context = null;
  
  try {
    context = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
      headless: false,
      viewport: { width: 1280, height: 900 }
    });
    
    const page = await context.newPage();
    
    // Go to home
    console.log('📱 Opening Twitter...');
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Click Lists
    console.log('🖱️  Clicking Lists in sidebar...');
    await page.click('a[href*="/lists"]');
    await page.waitForTimeout(5000);
    
    console.log(`✅ On Lists page: ${page.url()}\n`);
    
    // Get count of lists
    const listCount = await page.locator('[data-testid="listCell"]').count();
    console.log(`Found ${listCount} lists\n`);
    
    const lists = [];
    
    // Click each list one by one
    for (let i = 0; i < listCount; i++) {
      try {
        console.log(`[${i + 1}/${listCount}] Clicking list ${i}...`);
        
        // Get list name BEFORE clicking
        const listCells = await page.locator('[data-testid="listCell"]').all();
        const name = await listCells[i].innerText().then(text => text.split('\n')[0]);
        
        console.log(`   Name: ${name}`);
        
        // Click the list
        await listCells[i].click();
        await page.waitForTimeout(3000); // Wait for navigation
        
        // Get URL
        const url = page.url();
        console.log(`   URL: ${url}`);
        
        // Extract list ID
        const match = url.match(/\/i\/lists\/(\d+)/);
        if (match) {
          const listId = match[1];
          console.log(`   ID: ${listId} ✓\n`);
          
          lists.push({
            name,
            url,
            listId,
            enabled: true,
            maxTweets: 50,
            daysBack: 1  // Only last 24 hours
          });
        } else {
          console.log(`   ⚠️  No ID in URL\n`);
        }
        
        // Go back to Lists page
        await page.goBack();
        await page.waitForTimeout(2000);
        
      } catch (error) {
        console.error(`   ❌ Error on list ${i}:`, error.message);
      }
    }
    
    console.log(`\n✅ Extracted ${lists.length} lists!\n`);
    
    lists.forEach((list, i) => {
      console.log(`${i + 1}. ${list.name}`);
      console.log(`   ${list.url}`);
    });
    
    // Save config
    const config = {
      lists,
      settings: {
        syncEnabled: true,
        createSeparateNotebooks: true,
        notebookNameFormat: "BrainBrief - {listName} - {date}",
        defaultDaysBack: 1,
        defaultMaxTweets: 50
      }
    };
    
    fs.writeFileSync('lists-config.json', JSON.stringify(config, null, 2));
    console.log('\n💾 Saved to lists-config.json');
    console.log('\n✅ Ready to sync! Run: npm start → "Sync Lists"\n');
    
    await context.close();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (context) {
      await context.close().catch(() => {});
    }
  }
}

clickAndExtract();

