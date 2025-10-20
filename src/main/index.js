/**
 * BrainBrief - Main Process
 * Handles Electron app lifecycle, system tray, and window management
 */

const { app, BrowserWindow, Tray, Menu, ipcMain, Notification } = require('electron');
const path = require('path');
const logger = require('../utils/logger');
const twitter = require('../automation/twitter');
const db = require('../db/database');
const notebooklm = require('../automation/notebooklm');
const scheduler = require('./scheduler');

let mainWindow = null;
let tray = null;

/**
 * Create the main application window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false // For simplicity in v1.0, will improve security later
    },
    show: false // Start hidden, show after tray setup
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    if (process.argv.includes('--show')) {
      mainWindow.show();
    }
  });

  // Don't close app when window closes, just hide it
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

/**
 * Create system tray icon
 */
function createTray() {
  const { nativeImage } = require('electron');
  
  // Try to load custom icon, fall back to template icon if not found
  const iconPath = path.join(__dirname, '../../assets/tray-icon.png');
  const fs = require('fs');
  
  let trayIcon;
  if (fs.existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath);
  } else {
    // Use a simple template icon (works on Mac, Windows will show default)
    trayIcon = nativeImage.createEmpty();
    console.log('⚠️  No tray icon found, using default');
  }
  
  tray = new Tray(trayIcon);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        mainWindow.show();
      }
    },
    {
      label: 'Sync Bookmarks',
      click: async () => {
        logger.info('Manual bookmark sync from tray menu', 'main');
        const result = await scheduler.runSync({ limit: 50 });
        
        if (result.success) {
          showSystemNotification('Sync Complete', `Synced ${result.data.count} bookmarks`);
        } else {
          showSystemNotification('Sync Failed', result.error);
        }
        
        updateTrayMenu();
      }
    },
    {
      label: 'Sync Lists',
      click: async () => {
        logger.info('Manual list sync from tray menu', 'main');
        
        const fs = require('fs');
        const path = require('path');
        const { extractListTweets } = require('../automation/twitter');
        const { uploadListTweets } = require('../automation/notebooklm');
        
        try {
          // Load lists config
          const configPath = path.join(__dirname, '../../lists-config.json');
          if (!fs.existsSync(configPath)) {
            showSystemNotification('No Lists Config', 'Run discovery first');
            return;
          }
          
          const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          const enabledLists = config.lists.filter(l => l.enabled);
          
          if (enabledLists.length === 0) {
            showSystemNotification('No Lists Enabled', 'Enable lists in config');
            return;
          }
          
          showSystemNotification('Syncing Lists', `${enabledLists.length} lists...`);
          
          let synced = 0;
          for (const list of enabledLists) {
            const extractResult = await extractListTweets(list);
            if (extractResult.success && extractResult.data.tweets.length > 0) {
              const uploadResult = await uploadListTweets(extractResult.data.tweets, {
                name: list.name,
                listId: list.listId,
                url: list.url
              });
              if (uploadResult.success) synced++;
            }
          }
          
          showSystemNotification('Lists Synced', `${synced}/${enabledLists.length} lists uploaded`);
          
        } catch (error) {
          logger.error('List sync failed', error, 'main');
          showSystemNotification('List Sync Failed', error.message);
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Schedule: Not Active',
      id: 'schedule-status',
      enabled: false
    },
    {
      label: 'Enable Daily Sync (8 AM)',
      id: 'enable-schedule',
      click: () => {
        const result = scheduler.startSchedule({ 
          cronExpression: '0 8 * * *',
          limit: 50 
        });
        
        if (result.success) {
          logger.success('Schedule enabled', 'main');
          showSystemNotification('Schedule Enabled', 'Daily sync at 8 AM');
        } else {
          logger.error('Failed to enable schedule', result.error, 'main');
        }
        
        updateTrayMenu();
      }
    },
    {
      label: 'Disable Schedule',
      id: 'disable-schedule',
      click: () => {
        scheduler.stopSchedule();
        logger.info('Schedule disabled', 'main');
        showSystemNotification('Schedule Disabled', 'Automatic sync stopped');
        updateTrayMenu();
      }
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        mainWindow.show();
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('BrainBrief - Twitter to NotebookLM');
  tray.setContextMenu(contextMenu);

  // Double-click to show window
  tray.on('double-click', () => {
    mainWindow.show();
  });
}

/**
 * Update tray menu based on schedule status
 */
function updateTrayMenu() {
  if (!tray) return;
  
  // Just rebuild the menu - getContextMenu() doesn't exist in Electron
  // For now, do nothing (menu is static and works fine)
  // TODO: Implement dynamic menu rebuild if schedule status needs to update
}

/**
 * Show system notification (macOS notification center / Windows toast)
 */
function showSystemNotification(title, message) {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: `BrainBrief - ${title}`,
      body: message,
      icon: path.join(__dirname, '../../assets/tray-icon.png') // Will use default if missing
    });
    
    notification.show();
    logger.debug(`Notification: ${title} - ${message}`, null, 'main');
  }
}

/**
 * App lifecycle: Ready
 */
app.whenReady().then(() => {
  console.log('🚀 BrainBrief starting...');
  createWindow();
  createTray();
  
  // Initialize tray menu with current schedule status
  updateTrayMenu();
  
  console.log('✅ App ready. Check system tray for icon.');
  console.log('📁 User data directory:', app.getPath('userData'));
});

/**
 * App lifecycle: All windows closed
 */
app.on('window-all-closed', () => {
  // On macOS, apps typically stay open until Cmd+Q
  // But for a background tool, we want it to keep running
  console.log('All windows closed. App remains in tray.');
});

/**
 * App lifecycle: Activate (macOS)
 */
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

/**
 * App lifecycle: Before quit
 */
app.on('before-quit', () => {
  console.log('👋 BrainBrief shutting down...');
  app.isQuitting = true;
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  // TODO: Log to file
});

/**
 * IPC Handlers - Communication between renderer and main process
 */

// Get database stats
ipcMain.handle('get-stats', async () => {
  try {
    logger.info('UI requested stats', 'main');
    const dbInit = await db.initDatabase();
    if (!dbInit.success) {
      return { success: false, error: dbInit.error };
    }
    
    const statsResult = await db.getStats();
    return statsResult;
  } catch (error) {
    logger.error('Failed to get stats', error, 'main');
    return { success: false, error: error.message };
  }
});

// Sync bookmarks from Twitter
ipcMain.handle('sync-bookmarks', async (event, options = {}) => {
  try {
    const { limit = 50, useIncremental = true } = options;
    const syncType = useIncremental ? 'incremental' : 'full';
    logger.info(`UI triggered ${syncType} sync (max: ${limit})`, 'main');
    
    // Send status update to renderer
    event.sender.send('sync-status', { status: 'extracting', message: 'Extracting NEW bookmarks from Twitter...' });
    
    // Extract from Twitter (incremental by default - stops at existing)
    const twitterResult = useIncremental
      ? await twitter.extractNewBookmarks({ maxNew: limit })
      : await twitter.extractBookmarks({ limit });
      
    if (!twitterResult.success) {
      event.sender.send('sync-status', { status: 'error', message: `Twitter extraction failed: ${twitterResult.error}` });
      return twitterResult;
    }
    
    const bookmarks = twitterResult.data.bookmarks;
    
    // Show if incremental sync worked
    if (useIncremental && twitterResult.metadata) {
      const meta = twitterResult.metadata;
      logger.info(`Incremental sync: ${meta.newBookmarks} new, ${meta.duplicatesSkipped} duplicates`, 'main');
    }
    
    event.sender.send('sync-status', { status: 'saving', message: `Saving ${bookmarks.length} NEW bookmarks to database...` });
    
    // Save to database
    const saveResult = await db.saveBookmarks(bookmarks);
    if (!saveResult.success) {
      event.sender.send('sync-status', { status: 'error', message: `Database save failed: ${saveResult.error}` });
      return saveResult;
    }
    
    event.sender.send('sync-status', { status: 'complete', message: `Synced ${bookmarks.length} bookmarks!` });
    
    logger.success(`Sync complete: ${bookmarks.length} bookmarks`, 'main');
    return {
      success: true,
      data: {
        count: bookmarks.length,
        saved: saveResult.data.saved,
        failed: saveResult.data.failed
      },
      error: null
    };
    
  } catch (error) {
    logger.error('Sync failed', error, 'main');
    event.sender.send('sync-status', { status: 'error', message: error.message });
    return { success: false, error: error.message };
  }
});

// Export bookmarks to NotebookLM format
ipcMain.handle('export-bookmarks', async (event, options = {}) => {
  try {
    const { limit = 100 } = options;
    logger.info('UI requested export', 'main');
    
    // Get bookmarks from database
    const bookmarksResult = await db.getBookmarks({ limit });
    if (!bookmarksResult.success) {
      return bookmarksResult;
    }
    
    const bookmarks = bookmarksResult.data.map(b => ({
      id: b.tweet_id,
      author: b.author,
      text: b.text,
      url: b.url,
      timestamp: b.timestamp,
      scraped_at: b.scraped_at
    }));
    
    // Create export file
    const fileResult = notebooklm.testFileCreation(bookmarks);
    
    if (fileResult.success) {
      logger.success(`Exported ${bookmarks.length} bookmarks`, 'main');
    }
    
    return fileResult;
    
  } catch (error) {
    logger.error('Export failed', error, 'main');
    return { success: false, error: error.message };
  }
});

// Get schedule status
ipcMain.handle('get-schedule-status', async () => {
  try {
    return scheduler.getScheduleStatus();
  } catch (error) {
    logger.error('Failed to get schedule status', error, 'main');
    return { success: false, error: error.message };
  }
});

// Enable schedule
ipcMain.handle('enable-schedule', async (event, options = {}) => {
  try {
    const { cronExpression = '0 8 * * *', limit = 50 } = options;
    logger.info(`UI requested schedule enable: ${cronExpression}`, 'main');
    
    const result = scheduler.startSchedule({ cronExpression, limit });
    
    if (result.success) {
      updateTrayMenu();
      showSystemNotification('Schedule Enabled', `Daily sync at 8 AM`);
    }
    
    return result;
  } catch (error) {
    logger.error('Failed to enable schedule', error, 'main');
    return { success: false, error: error.message };
  }
});

// Disable schedule
ipcMain.handle('disable-schedule', async () => {
  try {
    logger.info('UI requested schedule disable', 'main');
    
    const result = scheduler.stopSchedule();
    
    if (result.success) {
      updateTrayMenu();
      showSystemNotification('Schedule Disabled', 'Automatic sync stopped');
    }
    
    return result;
  } catch (error) {
    logger.error('Failed to disable schedule', error, 'main');
    return { success: false, error: error.message };
  }
});

// Get Google account info
ipcMain.handle('get-google-account', async () => {
  try {
    const accountManager = require('../automation/account-manager');
    const result = await accountManager.detectGoogleAccount();
    return result;
  } catch (error) {
    logger.error('Failed to get Google account', error, 'main');
    return { success: false, data: null, error: error.message };
  }
});

// Switch Google account (logout)
ipcMain.handle('switch-account', async () => {
  try {
    logger.info('UI requested account switch', 'main');
    const accountManager = require('../automation/account-manager');
    const result = await accountManager.clearBrowserSession();
    
    if (result.success) {
      showSystemNotification('Logged Out', 'Next sync will ask you to log in');
    }
    
    return result;
  } catch (error) {
    logger.error('Failed to switch account', error, 'main');
    return { success: false, data: null, error: error.message };
  }
});

// Reset database
ipcMain.handle('reset-database', async () => {
  try {
    logger.info('UI requested database reset', 'main');
    const accountManager = require('../automation/account-manager');
    const result = await accountManager.resetDatabase();
    
    if (result.success) {
      showSystemNotification('Database Reset', 'Sync history cleared');
    }
    
    return result;
  } catch (error) {
    logger.error('Failed to reset database', error, 'main');
    return { success: false, data: null, error: error.message };
  }
});

// Check if first run (for onboarding)
ipcMain.handle('is-first-run', async () => {
  const fs = require('fs');
  const path = require('path');
  
  const dbPath = path.join(__dirname, '../../data/brainbrief.db');
  const browserDataPath = path.join(__dirname, '../../browser-data');
  const onboardingCompletePath = path.join(__dirname, '../../data/.onboarding-complete');
  
  // First run if no database AND no onboarding-complete marker
  const isFirstRun = !fs.existsSync(onboardingCompletePath);
  
  return {
    success: true,
    data: { isFirstRun },
    error: null
  };
});

// Mark onboarding as complete
ipcMain.handle('complete-onboarding', async () => {
  const fs = require('fs');
  const path = require('path');
  
  const dataDir = path.join(__dirname, '../../data');
  const markerFile = path.join(dataDir, '.onboarding-complete');
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  fs.writeFileSync(markerFile, new Date().toISOString());
  logger.info('Onboarding marked as complete', 'main');
  
  return { success: true, data: null, error: null };
});

// Test Twitter connection
ipcMain.handle('test-twitter-connection', async () => {
  try {
    const twitter = require('../automation/twitter');
    
    // Try to extract 1 bookmark (will prompt login if needed)
    const result = await twitter.testExtraction();
    
    return result;
  } catch (error) {
    return { success: false, data: null, error: error.message };
  }
});

// Test NotebookLM connection
ipcMain.handle('test-notebooklm-connection', async () => {
  try {
    const accountManager = require('../automation/account-manager');
    
    // Detect if logged in to NotebookLM
    const result = await accountManager.detectGoogleAccount();
    
    return result;
  } catch (error) {
    return { success: false, data: null, error: error.message };
  }
});

// Check if Twitter connected
ipcMain.handle('check-twitter-connected', async () => {
  const fs = require('fs');
  const path = require('path');
  
  const browserDataPath = path.join(__dirname, '../../browser-data');
  const connected = fs.existsSync(browserDataPath);
  
  return { success: true, data: { connected }, error: null };
});

// Check if NotebookLM connected
ipcMain.handle('check-notebooklm-connected', async () => {
  const fs = require('fs');
  const path = require('path');
  
  const browserDataPath = path.join(__dirname, '../../browser-data');
  const connected = fs.existsSync(browserDataPath);
  
  return { success: true, data: { connected }, error: null };
});

// Get lists config
ipcMain.handle('get-lists-config', async () => {
  try {
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(__dirname, '../../lists-config.json');
    
    if (!fs.existsSync(configPath)) {
      return { success: false, data: null, error: 'No lists config found' };
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return { success: true, data: config, error: null };
    
  } catch (error) {
    logger.error('Failed to get lists config', error, 'main');
    return { success: false, data: null, error: error.message };
  }
});

// Save lists config
ipcMain.handle('save-lists-config', async (event, { lists }) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(__dirname, '../../lists-config.json');
    
    // Load existing config or create new
    let config = { lists: [], settings: {} };
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
    
    config.lists = lists;
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    logger.success(`Saved ${lists.length} lists to config`, 'main');
    
    return { success: true, data: null, error: null };
    
  } catch (error) {
    logger.error('Failed to save lists config', error, 'main');
    return { success: false, data: null, error: error.message };
  }
});

// Discover lists
ipcMain.handle('discover-lists', async () => {
  try {
    logger.info('UI requested list discovery', 'main');
    
    // Run the discovery script
    const { exec } = require('child_process');
    const path = require('path');
    const scriptPath = path.join(__dirname, '../../click-and-extract-lists.js');
    
    return new Promise((resolve) => {
      exec(`node "${scriptPath}"`, (error, stdout, stderr) => {
        if (error) {
          logger.error('Discovery failed', error, 'main');
          resolve({ success: false, data: null, error: error.message });
          return;
        }
        
        // Parse output to count lists
        const match = stdout.match(/Extracted (\d+) lists/);
        const count = match ? parseInt(match[1]) : 0;
        
        logger.success(`Discovered ${count} lists`, 'main');
        resolve({ success: true, data: { count }, error: null });
      });
    });
    
  } catch (error) {
    logger.error('Failed to discover lists', error, 'main');
    return { success: false, data: null, error: error.message };
  }
});

// Sync single list
ipcMain.handle('sync-single-list', async (event, { listIndex }) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const { extractListTweets } = require('../automation/twitter');
    const { uploadListTweets } = require('../automation/notebooklm');
    
    logger.info(`UI requested sync for list index ${listIndex}`, 'main');
    
    // Load config
    const configPath = path.join(__dirname, '../../lists-config.json');
    if (!fs.existsSync(configPath)) {
      return { success: false, data: null, error: 'No lists config found.' };
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const list = config.lists[listIndex];
    
    if (!list) {
      return { success: false, data: null, error: 'List not found.' };
    }
    
    logger.info(`Syncing list: "${list.name}"`, 'main');
    
    // Extract tweets
    const extractResult = await extractListTweets(list);
    if (!extractResult.success) {
      return { success: false, data: null, error: extractResult.error };
    }
    
    if (extractResult.data.tweets.length === 0) {
      return { success: false, data: null, error: 'No tweets found in list.' };
    }
    
    // Upload to NotebookLM
    const uploadResult = await uploadListTweets(extractResult.data.tweets, {
      name: list.name,
      listId: list.listId,
      url: list.url
    });
    
    if (!uploadResult.success) {
      return { success: false, data: null, error: uploadResult.error };
    }
    
    // Update last synced time in config
    config.lists[listIndex].lastSynced = new Date().toISOString();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    return {
      success: true,
      data: { count: extractResult.data.tweets.length },
      error: null
    };
    
  } catch (error) {
    logger.error('Single list sync failed', error, 'main');
    return { success: false, data: null, error: error.message };
  }
});

// Sync all enabled lists
ipcMain.handle('sync-lists', async () => {
  try {
    const fs = require('fs');
    const path = require('path');
    const { extractListTweets } = require('../automation/twitter');
    const { uploadListTweets } = require('../automation/notebooklm');
    
    logger.info('UI requested list sync', 'main');
    
    // Load config
    const configPath = path.join(__dirname, '../../lists-config.json');
    if (!fs.existsSync(configPath)) {
      return { success: false, data: null, error: 'No lists config found. Run discovery first.' };
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const enabledLists = config.lists.filter(l => l.enabled);
    
    if (enabledLists.length === 0) {
      return { success: false, data: null, error: 'No lists enabled. Go to Settings to enable lists.' };
    }
    
    logger.info(`Syncing ${enabledLists.length} enabled lists`, 'main');
    
    let synced = 0;
    for (const list of enabledLists) {
      try {
        const extractResult = await extractListTweets(list);
        if (extractResult.success && extractResult.data.tweets.length > 0) {
          const uploadResult = await uploadListTweets(extractResult.data.tweets, {
            name: list.name,
            listId: list.listId,
            url: list.url
          });
          if (uploadResult.success) synced++;
        }
      } catch (error) {
        logger.error(`Failed to sync list "${list.name}"`, error, 'main');
      }
    }
    
    return { 
      success: true, 
      data: { synced, total: enabledLists.length }, 
      error: null 
    };
    
  } catch (error) {
    logger.error('List sync failed', error, 'main');
    return { success: false, data: null, error: error.message };
  }
});

