#!/usr/bin/env node
/**
 * Twitter Lists Discovery Tool
 * 
 * This script helps you find your Twitter Lists and generates
 * a lists-config.json file with all your lists.
 * 
 * Usage: node discover-lists.js
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BROWSER_DATA_DIR = path.join(__dirname, 'browser-data');
const TWITTER_HOME = 'https://x.com/home';
const CONFIG_FILE = path.join(__dirname, 'lists-config.json');

async function discoverLists() {
  console.log('🔍 Discovering your Twitter Lists...\n');
  
  let context = null;
  
  try {
    // Launch browser with saved session
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
    
    // Navigate to Twitter home first
    console.log('📱 Navigating to Twitter home...');
    await page.goto(TWITTER_HOME, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    // Check if logged in
    const loggedIn = await page.locator('[data-testid="SideNav_AccountSwitcher_Button"]').isVisible().catch(() => false);
    
    if (!loggedIn) {
      console.log('❌ Not logged in to Twitter');
      console.log('⏳ Waiting 60 seconds for you to log in...\n');
      await page.waitForTimeout(60000);
    } else {
      console.log('✅ Logged in to Twitter\n');
    }
    
    // Get username from profile
    console.log('🔍 Finding your username...');
    let username = await page.evaluate(() => {
      // Strategy 1: From account switcher button
      const profileLink = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
      if (profileLink) {
        const usernameElement = profileLink.querySelector('[dir="ltr"]');
        if (usernameElement) {
          const text = usernameElement.innerText;
          const match = text.match(/@(\w+)/);
          if (match) return match[1];
        }
      }
      
      // Strategy 2: From URL when navigating to profile
      const profileNavLink = document.querySelector('[data-testid="AppTabBar_Profile_Link"]');
      if (profileNavLink && profileNavLink.href) {
        const match = profileNavLink.href.match(/x\.com\/([^\/]+)/);
        if (match) return match[1];
      }
      
      // Strategy 3: From page URL
      const urlMatch = window.location.href.match(/x\.com\/([^\/]+)/);
      if (urlMatch && urlMatch[1] !== 'home' && urlMatch[1] !== 'i') {
        return urlMatch[1];
      }
      
      return null;
    });
    
    // Fallback: Click profile to get username
    if (!username) {
      console.log('🔄 Trying alternate method to get username...');
      try {
        await page.click('[data-testid="AppTabBar_Profile_Link"]');
        await page.waitForTimeout(2000);
        
        const currentUrl = page.url();
        const match = currentUrl.match(/x\.com\/([^\/]+)/);
        if (match && match[1] !== 'home' && match[1] !== 'i') {
          username = match[1];
        }
        
        // Go back to home
        await page.goto(TWITTER_HOME, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);
      } catch (error) {
        console.log('Could not auto-detect username');
      }
    }
    
    if (!username) {
      console.log('⚠️  Could not detect username.');
      console.log('Please provide your username as argument: node discover-lists.js YOUR_USERNAME\n');
      console.log('Or check the browser - manually navigate to your lists page');
      console.log('and I\'ll extract the lists from there.\n');
      
      // Check if username provided as CLI argument
      const cliUsername = process.argv[2];
      if (cliUsername) {
        username = cliUsername.replace('@', '');
        console.log(`✅ Using provided username: @${username}\n`);
      }
    } else {
      console.log(`✅ Username: @${username}\n`);
    }
    
    // Navigate to Lists page (use username-specific URL)
    const listsUrl = username 
      ? `https://x.com/${username}/lists`
      : 'https://x.com/i/lists';
    
    console.log(`📋 Navigating to Lists: ${listsUrl}`);
    await page.goto(listsUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    // Scroll to load all lists
    console.log('📜 Scrolling to load all lists...');
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(1000);
    }
    
    console.log('🔎 Searching for lists on page...\n');
    
    // Extract lists with multiple strategies
    const lists = await page.evaluate(() => {
      const results = [];
      const seenUrls = new Set();
      
      // Strategy 1: Look for links with /lists/ in href
      const listLinks = document.querySelectorAll('a[href*="/lists/"]');
      
      listLinks.forEach(link => {
        const href = link.href;
        
        // Skip non-list URLs (like /i/lists)
        if (href.includes('/i/lists') || !href.match(/\/lists\/\d+/)) {
          return;
        }
        
        if (seenUrls.has(href)) {
          return;
        }
        seenUrls.add(href);
        
        // Try to find list name (look in parent elements)
        let name = 'Unnamed List';
        let description = '';
        
        // Find the containing article or div
        let container = link.closest('div[role="link"], article, div[data-testid*="list"]');
        if (!container) {
          container = link.parentElement;
        }
        
        // Look for text content
        if (container) {
          const textElements = container.querySelectorAll('[dir="ltr"]');
          if (textElements.length > 0) {
            // First one is usually the name
            name = textElements[0].innerText.trim();
            
            // Second one might be description
            if (textElements.length > 1) {
              description = textElements[1].innerText.trim();
            }
          }
        }
        
        results.push({
          name: name || 'Unnamed List',
          url: href,
          description: description
        });
      });
      
      return results;
    });
    
    if (lists.length === 0) {
      console.log('⚠️  No Twitter Lists found!\n');
      console.log('This could mean:');
      console.log('1. You don\'t have any Twitter Lists yet');
      console.log('2. You need to create lists on Twitter first\n');
      console.log('To create a list:');
      console.log('1. Go to https://x.com/i/lists');
      console.log('2. Click "Create a new List"');
      console.log('3. Add a name and members');
      console.log('4. Run this script again\n');
      
      console.log('Keeping browser open for 30 seconds so you can create lists...');
      await page.waitForTimeout(30000);
    } else {
      console.log(`✅ Found ${lists.length} Twitter Lists:\n`);
      
      lists.forEach((list, i) => {
        console.log(`${i + 1}. ${list.name}`);
        console.log(`   URL: ${list.url}`);
        if (list.description) {
          console.log(`   Description: ${list.description}`);
        }
        console.log('');
      });
      
      // Generate config
      const config = {
        lists: lists.map(list => ({
          name: list.name,
          url: list.url,
          enabled: true,
          maxTweets: 50,
          description: list.description || ''
        })),
        settings: {
          syncEnabled: true,
          createSeparateNotebooks: true,
          notebookNameFormat: "BrainBrief - {listName} - {date}"
        }
      };
      
      // Save config
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
      
      console.log('💾 Generated lists-config.json\n');
      console.log('Next steps:');
      console.log('1. Edit lists-config.json to enable/disable lists');
      console.log('2. Adjust maxTweets per list');
      console.log('3. Run: npm run sync:lists\n');
    }
    
    await context.close();
    console.log('✅ Discovery complete!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (context) {
      await context.close().catch(() => {});
    }
    process.exit(1);
  }
}

discoverLists();

