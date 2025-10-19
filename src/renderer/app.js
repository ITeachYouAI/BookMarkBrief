/**
 * BrainBrief - Renderer Process
 * Handles UI interactions and displays sync status
 */

const { ipcRenderer } = require('electron');

console.log('🎨 Renderer process loaded');

// DOM elements
const syncBookmarksBtn = document.getElementById('sync-bookmarks');
const syncListsBtn = document.getElementById('sync-lists');
const settingsBtn = document.getElementById('open-settings');
const notebooklmBtn = document.getElementById('open-notebooklm');
const viewLogsBtn = document.getElementById('view-logs');

// Stats elements
const lastSyncText = document.getElementById('last-sync-text');
const bookmarksCount = document.getElementById('bookmarks-count');
const listsCount = document.getElementById('lists-count');
const youtubeCount = document.getElementById('youtube-count');

// State
let isSyncing = false;

/**
 * Load and display database stats
 */
async function loadStats() {
  console.log('📊 Loading stats...');
  
  try {
    const result = await ipcRenderer.invoke('get-stats');
    
    if (result.success) {
      const stats = result.data;
      
      // Update counts
      bookmarksCount.textContent = stats.total_bookmarks || 0;
      listsCount.textContent = stats.total_lists || 0;
      youtubeCount.textContent = 0; // TODO: Track YouTube sources in DB
      
      // Update last sync time
      if (stats.last_sync) {
        const syncDate = new Date(stats.last_sync);
        const timeAgo = getTimeAgo(syncDate);
        lastSyncText.textContent = `Last sync: ${timeAgo}`;
      } else {
        lastSyncText.textContent = 'Last sync: Never';
      }
      
      console.log('✅ Stats loaded:', stats);
    } else {
      // Show detailed error
      console.error('❌ Failed to load stats:', result.error);
      lastSyncText.textContent = 'Last sync: Error';
      
      showNotification(
        'Database Error',
        `Failed to load stats: ${result.error}`,
        'error',
        { autoDismiss: false }
      );
    }
  } catch (error) {
    console.error('❌ Error loading stats:', error);
    lastSyncText.textContent = 'Last sync: Error';
    
    showNotification(
      'System Error',
      `Unexpected error loading database stats: ${error.message}`,
      'error',
      { autoDismiss: false }
    );
  }
}

/**
 * Sync bookmarks from Twitter
 */
async function syncBookmarks() {
  if (isSyncing) {
    console.log('⚠️  Sync already in progress');
    return;
  }
  
  isSyncing = true;
  syncBookmarksBtn.disabled = true;
  syncBookmarksBtn.textContent = 'Syncing...';
  
  console.log('🔄 Starting incremental sync...');
  
  try {
    // Use incremental sync (extracts only NEW bookmarks, stops at existing)
    // Limit: 500 max (but will stop early if hits existing bookmark)
    const result = await ipcRenderer.invoke('sync-bookmarks', { 
      limit: 500, 
      useIncremental: true 
    });
    
    if (result.success) {
      console.log('✅ Sync complete:', result.data);
      
      // Reload stats to show updated counts
      await loadStats();
      
      // Show success message
      showNotification('Success', `Synced ${result.data.count} bookmarks!`, 'success');
    } else {
      console.error('❌ Sync failed:', result.error);
      showNotification('Error', result.error, 'error');
    }
  } catch (error) {
    console.error('❌ Sync error:', error);
    showNotification('Error', error.message, 'error');
  } finally {
    isSyncing = false;
    syncBookmarksBtn.disabled = false;
    syncBookmarksBtn.textContent = '🔖 Sync Bookmarks';
  }
}

/**
 * Export bookmarks to NotebookLM format
 */
async function exportBookmarks() {
  console.log('📤 Exporting bookmarks...');
  
  try {
    const result = await ipcRenderer.invoke('export-bookmarks', { limit: 100 });
    
    if (result.success) {
      console.log('✅ Export complete:', result.data);
      showNotification('Export Complete', `File created: ${result.data}`, 'success');
    } else {
      console.error('❌ Export failed:', result.error);
      showNotification('Export Failed', result.error, 'error');
    }
  } catch (error) {
    console.error('❌ Export error:', error);
    showNotification('Error', error.message, 'error');
  }
}

/**
 * Show toast notification with detailed error info
 * 
 * @param {string} title - Notification title
 * @param {string} message - Detailed message
 * @param {string} type - Type: 'error', 'success', 'warning', 'info'
 * @param {Object} options - Additional options
 */
function showNotification(title, message, type = 'info', options = {}) {
  const { 
    autoDismiss = type !== 'error', // Errors stay until dismissed
    duration = 10000,
    showCopy = type === 'error',
    showDetails = true
  } = options;
  
  console.log(`${type.toUpperCase()}: ${title} - ${message}`);
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  // Icon based on type
  const icons = {
    error: '❌',
    success: '✅',
    warning: '⚠️',
    info: 'ℹ️'
  };
  const icon = icons[type] || 'ℹ️';
  
  // Build toast HTML
  let html = `
    <div class="toast-header">
      <div class="toast-title">
        <span class="toast-icon">${icon}</span>
        <span>${title}</span>
      </div>
      <button class="toast-close" aria-label="Close">×</button>
    </div>
  `;
  
  if (showDetails && message) {
    html += `<div class="toast-message">${escapeHtml(message)}</div>`;
  }
  
  html += `<div class="toast-timestamp">${new Date().toLocaleTimeString()}</div>`;
  
  if (showCopy && message) {
    html += `
      <div class="toast-actions">
        <button class="toast-action copy-error">Copy Error</button>
        <button class="toast-action view-logs">View Logs</button>
      </div>
    `;
  }
  
  toast.innerHTML = html;
  
  // Add to container
  const container = document.getElementById('toast-container');
  container.appendChild(toast);
  
  // Close button handler
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    removeToast(toast);
  });
  
  // Copy error handler
  if (showCopy) {
    const copyBtn = toast.querySelector('.copy-error');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        copyToClipboard(`${title}\n${message}\n${new Date().toISOString()}`);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.textContent = 'Copy Error';
        }, 2000);
      });
    }
    
    const viewLogsBtn = toast.querySelector('.view-logs');
    if (viewLogsBtn) {
      viewLogsBtn.addEventListener('click', () => {
        console.log('View logs clicked from toast');
        // TODO: Open logs folder
      });
    }
  }
  
  // Auto-dismiss
  if (autoDismiss) {
    setTimeout(() => {
      removeToast(toast);
    }, duration);
  }
  
  // Update last sync if success
  if (type === 'success' && title.includes('Success')) {
    lastSyncText.textContent = 'Last sync: Just now';
  }
}

/**
 * Remove toast with animation
 */
function removeToast(toast) {
  toast.style.animation = 'slideOut 0.3s ease';
  setTimeout(() => {
    toast.remove();
  }, 300);
}

/**
 * Copy text to clipboard
 */
function copyToClipboard(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format timestamp for display
 */
function formatTimestamp(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

// Alias for consistency
const getTimeAgo = formatTimestamp;

/**
 * Listen for sync status updates from main process
 */
ipcRenderer.on('sync-status', (event, data) => {
  console.log('📡 Sync status:', data);
  
  const { status, message } = data;
  
  // Update UI based on status
  if (status === 'extracting') {
    twitterStatus.textContent = 'Syncing...';
    twitterStatus.style.color = '#FFA500';
  } else if (status === 'saving') {
    twitterStatus.textContent = 'Saving...';
  } else if (status === 'complete') {
    twitterStatus.textContent = 'Connected';
    twitterStatus.style.color = '#1DA1F2';
  } else if (status === 'error') {
    twitterStatus.textContent = 'Error';
    twitterStatus.style.color = '#FF0000';
  }
});

/**
 * Event Listeners
 */
syncBookmarksBtn.addEventListener('click', () => {
  console.log('🔖 Sync Bookmarks clicked');
  syncBookmarks();
});

syncListsBtn.addEventListener('click', async () => {
  console.log('📋 Sync Lists clicked');
  
  try {
    syncListsBtn.disabled = true;
    syncListsBtn.textContent = 'Syncing Lists...';
    
    const result = await ipcRenderer.invoke('sync-lists');
    
    if (result.success) {
      showNotification('Lists Synced!', `${result.data.synced}/${result.data.total} lists uploaded`, 'success');
      loadStats();
    } else {
      showNotification('Sync Failed', result.error, 'error');
    }
  } catch (error) {
    console.error('❌ Sync Lists error:', error);
    showNotification('Error', error.message, 'error');
  } finally {
    syncListsBtn.disabled = false;
    syncListsBtn.textContent = '📋 Sync Lists';
  }
});

settingsBtn.addEventListener('click', () => {
  console.log('⚙️  Settings clicked');
  window.location.href = 'settings.html';
});

viewLogsBtn.addEventListener('click', (e) => {
  e.preventDefault();
  console.log('📋 View Logs clicked');
  // TODO: Open logs folder
  alert('Logs viewer coming soon!');
});

notebooklmBtn.addEventListener('click', () => {
  console.log('🔗 Opening NotebookLM...');
  require('electron').shell.openExternal('https://notebooklm.google.com');
});

/**
 * Initialize app on load
 */
window.addEventListener('DOMContentLoaded', () => {
  console.log('✅ DOM loaded, initializing app...');
  
  // Load initial stats
  loadStats();
  
  // Refresh stats every 30 seconds
  setInterval(loadStats, 30000);
  
  console.log('✅ Renderer ready');
});
