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
      label: 'Sync Now',
      click: async () => {
        logger.info('Manual sync from tray menu', 'main');
        const result = await scheduler.runSync({ limit: 50 });
        
        if (result.success) {
          showSystemNotification('Sync Complete', `Synced ${result.data.count} bookmarks`);
        } else {
          showSystemNotification('Sync Failed', result.error);
        }
        
        // Refresh tray menu to update schedule status
        updateTrayMenu();
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
  
  const status = scheduler.getScheduleStatus();
  const contextMenu = tray.getContextMenu();
  
  if (status.success && status.data.enabled) {
    // Schedule is active
    const scheduleStatusItem = contextMenu.getMenuItemById('schedule-status');
    const nextRun = status.data.nextRun ? new Date(status.data.nextRun).toLocaleString() : 'Unknown';
    scheduleStatusItem.label = `Next Sync: ${nextRun}`;
    
    const enableItem = contextMenu.getMenuItemById('enable-schedule');
    const disableItem = contextMenu.getMenuItemById('disable-schedule');
    enableItem.visible = false;
    disableItem.visible = true;
  } else {
    // Schedule is inactive
    const scheduleStatusItem = contextMenu.getMenuItemById('schedule-status');
    scheduleStatusItem.label = 'Schedule: Not Active';
    
    const enableItem = contextMenu.getMenuItemById('enable-schedule');
    const disableItem = contextMenu.getMenuItemById('disable-schedule');
    enableItem.visible = true;
    disableItem.visible = false;
  }
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

