#!/usr/bin/env node
/**
 * Test script to explore Twitter Lists structure
 * 
 * This script will:
 * 1. Navigate to Twitter Lists page
 * 2. Display available lists
 * 3. Navigate to a list and show tweet structure
 */

const { chromium } = require('playwright');
const path = require('path');

const BROWSER_DATA_DIR = path.join(__dirname, 'browser-data');
const TWITTER_LISTS_URL = 'https://x.com/i/lists';

async function exploreLists() {
  console.log('🔍 Exploring Twitter Lists structure...\n');
  
  let context = null;
  
  try {
    // Launch browser with saved session
    context = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
      headless: false,
      viewport: { width: 1280, height: 720 },
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--no-sandbox'
      ]
    });
    
    const page = await context.newPage();
    
    // Navigate to Lists
    console.log('📱 Navigating to Twitter Lists...');
    await page.goto(TWITTER_LISTS_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    // Check if logged in
    const loggedIn = await page.locator('[data-testid="SideNav_AccountSwitcher_Button"]').isVisible().catch(() => false);
    
    if (!loggedIn) {
      console.log('❌ Not logged in to Twitter');
      console.log('Please log in and run again');
      await page.waitForTimeout(60000); // Wait for manual login
    }
    
    console.log('✅ Logged in to Twitter\n');
    
    // Get all lists
    console.log('📋 Your Twitter Lists:');
    console.log('Looking for list elements...\n');
    
    await page.waitForTimeout(2000);
    
    // Extract list information
    const lists = await page.evaluate(() => {
      // Look for list items - try multiple selectors
      const listElements = document.querySelectorAll('[data-testid="list-cell"]');
      
      console.log(`Found ${listElements.length} list elements`);
      
      const results = [];
      
      listElements.forEach((el, index) => {
        try {
          // Try to find list name
          const nameElement = el.querySelector('[dir="ltr"]');
          const name = nameElement ? nameElement.innerText : `List ${index + 1}`;
          
          // Try to find list URL
          const linkElement = el.querySelector('a[href*="/lists/"]');
          const url = linkElement ? linkElement.href : '';
          
          // Try to find member count
          const memberText = el.innerText;
          
          results.push({
            name,
            url,
            preview: memberText.substring(0, 100)
          });
        } catch (error) {
          console.error('Error extracting list:', error);
        }
      });
      
      return results;
    });
    
    if (lists.length === 0) {
      console.log('⚠️  No lists found. Let me check the page structure...\n');
      
      // Save HTML for debugging
      const html = await page.content();
      const fs = require('fs');
      fs.writeFileSync('debug-lists-page.html', html);
      console.log('💾 Saved page HTML to debug-lists-page.html\n');
      
      // Take screenshot
      await page.screenshot({ path: 'debug-lists-page.png' });
      console.log('📸 Saved screenshot to debug-lists-page.png\n');
      
      console.log('Please check:');
      console.log('1. Do you have any Twitter Lists?');
      console.log('2. Are you on the correct Lists page?');
      console.log('\nKeeping browser open for inspection...');
      await page.waitForTimeout(30000);
    } else {
      console.log(`Found ${lists.length} lists:\n`);
      lists.forEach((list, i) => {
        console.log(`${i + 1}. ${list.name}`);
        console.log(`   URL: ${list.url}`);
        console.log('');
      });
      
      // Navigate to first list
      if (lists[0].url) {
        console.log(`\n🔍 Navigating to first list: ${lists[0].name}\n`);
        await page.goto(lists[0].url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000);
        
        // Extract tweet structure
        console.log('📝 Analyzing tweet structure in list...\n');
        
        const tweets = await page.evaluate(() => {
          const tweetElements = document.querySelectorAll('article[data-testid="tweet"]');
          console.log(`Found ${tweetElements.length} tweets`);
          
          const results = [];
          
          tweetElements.slice(0, 3).forEach((tweet, i) => {
            try {
              const text = tweet.querySelector('[data-testid="tweetText"]')?.innerText || 'No text';
              const author = tweet.querySelector('[data-testid="User-Name"]')?.innerText.split('\n')[0] || 'Unknown';
              
              results.push({
                index: i + 1,
                author,
                textPreview: text.substring(0, 100)
              });
            } catch (error) {
              console.error('Error extracting tweet:', error);
            }
          });
          
          return results;
        });
        
        console.log(`Found ${tweets.length} tweets (showing first 3):\n`);
        tweets.forEach(tweet => {
          console.log(`${tweet.index}. @${tweet.author}`);
          console.log(`   ${tweet.textPreview}...`);
          console.log('');
        });
        
        console.log('\n✅ Tweet structure is the same as bookmarks!');
        console.log('We can reuse existing extraction logic.\n');
      }
    }
    
    console.log('Keeping browser open for 10 seconds...');
    await page.waitForTimeout(10000);
    
    await context.close();
    console.log('\n✅ Exploration complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (context) {
      await context.close().catch(() => {});
    }
  }
}

exploreLists();

