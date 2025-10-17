/**
 * BrainBrief - Main Process
 * Handles Electron app lifecycle, system tray, and window management
 */

const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron');
const path = require('path');
const logger = require('../utils/logger');
const twitter = require('../automation/twitter');
const db = require('../db/database');
const notebooklm = require('../automation/notebooklm');

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
      click: () => {
        console.log('Manual sync triggered');
        // TODO: Call sync function
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
 * App lifecycle: Ready
 */
app.whenReady().then(() => {
  console.log('🚀 BrainBrief starting...');
  createWindow();
  createTray();
  
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
    const { limit = 10 } = options;
    logger.info(`UI triggered sync (limit: ${limit})`, 'main');
    
    // Send status update to renderer
    event.sender.send('sync-status', { status: 'extracting', message: 'Extracting bookmarks from Twitter...' });
    
    // Extract from Twitter
    const twitterResult = await twitter.extractBookmarks({ limit });
    if (!twitterResult.success) {
      event.sender.send('sync-status', { status: 'error', message: `Twitter extraction failed: ${twitterResult.error}` });
      return twitterResult;
    }
    
    const bookmarks = twitterResult.data.bookmarks;
    event.sender.send('sync-status', { status: 'saving', message: `Saving ${bookmarks.length} bookmarks to database...` });
    
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

