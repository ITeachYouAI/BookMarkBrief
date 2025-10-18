#!/usr/bin/env node
/**
 * Simple approach: Click the Lists nav button to access lists
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BROWSER_DATA_DIR = path.join(__dirname, 'browser-data');

async function clickLists() {
  console.log('🔍 Clicking Lists in sidebar...\n');
  
  let context = null;
  
  try {
    context = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
      headless: false,
      viewport: { width: 1280, height: 900 }
    });
    
    const page = await context.newPage();
    
    // Go to home
    console.log('📱 Opening Twitter home...');
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    // Click Lists in sidebar
    console.log('🖱️  Clicking "Lists" in sidebar...');
    try {
      // Look for Lists link in sidebar
      await page.click('a[href*="/lists"]', { timeout: 5000 });
      await page.waitForTimeout(5000); // Wait for Lists page to load
      
      console.log(`✅ Navigated to: ${page.url()}\n`);
      
      // Now extract lists with full details
      const lists = await page.evaluate(() => {
        const cells = document.querySelectorAll('[data-testid="listCell"]');
        console.log(`Found ${cells.length} listCells`);
        
        const results = [];
        const seenIds = new Set();
        
        cells.forEach((cell, i) => {
          try {
            // Get all text lines
            const allText = cell.innerText.split('\n').map(t => t.trim()).filter(Boolean);
            const name = allText[0] || 'Unnamed List';
            
            // Find member count
            let memberCount = '';
            allText.forEach(text => {
              if (text.match(/^\d+\s*members?$/i)) {
                memberCount = text;
              }
            });
            
            // Extract list ID from onclick or cell HTML
            const cellHTML = cell.innerHTML;
            const match = cellHTML.match(/\/i\/lists\/(\d+)/);
            
            if (match) {
              const listId = match[1];
              if (!seenIds.has(listId)) {
                seenIds.add(listId);
                results.push({
                  name,
                  listId,
                  url: `https://x.com/i/lists/${listId}`,
                  memberCount
                });
                console.log(`Cell ${i}: ${name} -> ${listId}`);
              }
            } else {
              console.log(`Cell ${i}: No ID found for "${name}"`);
            }
          } catch (error) {
            console.error(`Error processing cell ${i}:`, error);
          }
        });
        return results;
      });
      
      console.log(`\n✅ Extracted ${lists.length} lists:\n`);
      lists.forEach((list, i) => {
        console.log(`${i + 1}. ${list.name}`);
        console.log(`   URL: ${list.url}`);
        console.log(`   ${list.memberCount || 'Unknown members'}`);
        console.log('');
      });
      
      // Save to config
      const config = {
        lists: lists.map(list => ({
          name: list.name,
          url: list.url,
          listId: list.listId,
          enabled: true,
          maxTweets: 50,
          memberCount: list.memberCount
        })),
        settings: {
          syncEnabled: true,
          createSeparateNotebooks: true,
          notebookNameFormat: "BrainBrief - {listName} - {date}"
        }
      };
      
      fs.writeFileSync('lists-config.json', JSON.stringify(config, null, 2));
      console.log('💾 Saved to lists-config.json\n');
      
    } catch (error) {
      console.log('❌ Could not find Lists link:', error.message);
    }
    
    console.log('\nKeeping browser open for 30 seconds...');
    await page.waitForTimeout(30000);
    
    await context.close();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (context) {
      await context.close().catch(() => {});
    }
  }
}

clickLists();

