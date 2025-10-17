/**
 * BrainBrief - Main Process
 * Handles Electron app lifecycle, system tray, and window management
 */

const { app, BrowserWindow, Tray, Menu } = require('electron');
const path = require('path');

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

