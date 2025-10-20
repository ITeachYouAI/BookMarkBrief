/**
 * BrainBrief - Renderer Process
 * Handles UI interactions and displays sync status
 */

const { ipcRenderer } = require('electron');

console.log('🎨 Renderer process loaded');

// DOM elements
const syncBookmarksBtn = document.getElementById('sync-bookmarks');
const openBookmarksNotebookBtn = document.getElementById('open-bookmarks-notebook');
const discoverListsBtn = document.getElementById('discover-lists-btn');
const notebooklmHomeBtn = document.getElementById('open-notebooklm-home');
const viewLogsBtn = document.getElementById('view-logs');
const listsContainer = document.getElementById('lists-container');
const googleEmailSpan = document.getElementById('google-email');
const accountEmailDisplay = document.getElementById('account-email-display');
const switchAccountBtn = document.getElementById('switch-account-btn');
const resetDatabaseBtn = document.getElementById('reset-database-btn');

// Stats elements
const bookmarksLastSync = document.getElementById('bookmarks-last-sync');
const bookmarksCountStat = document.getElementById('bookmarks-count-stat');
const bookmarksYoutubeStat = document.getElementById('bookmarks-youtube-stat');
const bookmarksNotebookName = document.getElementById('bookmarks-notebook-name');
const listsSummary = document.getElementById('lists-summary');

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
      
      // Update bookmarks card
      bookmarksCountStat.textContent = stats.total_bookmarks || 0;
      bookmarksYoutubeStat.textContent = stats.youtube_count || 0;
      
      // Update last sync time
      if (stats.last_sync) {
        const syncDate = new Date(stats.last_sync);
        const timeAgo = getTimeAgo(syncDate);
        bookmarksLastSync.textContent = timeAgo;
        
        // If we have synced data, assume NotebookLM is connected
        googleEmailSpan.textContent = 'Connected';
        googleEmailSpan.style.color = '#10a37f';
      } else {
        bookmarksLastSync.textContent = 'Never synced';
        googleEmailSpan.textContent = 'Not connected';
        googleEmailSpan.style.color = '#999';
      }
      
      // Load active notebook name
      loadActiveNotebook();
      
      console.log('✅ Stats loaded:', stats);
    } else {
      // Show detailed error
      console.error('❌ Failed to load stats:', result.error);
      bookmarksLastSync.textContent = 'Error';
      
      showNotification(
        'Database Error',
        `Failed to load stats: ${result.error}`,
        'error',
        { autoDismiss: false }
      );
    }
  } catch (error) {
    console.error('❌ Error loading stats:', error);
    bookmarksLastSync.textContent = 'Error';
    
    showNotification(
      'System Error',
      `Unexpected error loading database stats: ${error.message}`,
      'error',
      { autoDismiss: false }
    );
  }
}

/**
 * Load active notebook name
 */
async function loadActiveNotebook() {
  try {
    const result = await ipcRenderer.invoke('get-active-notebook');
    
    if (result.success && result.data && result.data.name) {
      bookmarksNotebookName.textContent = result.data.name;
      bookmarksNotebookName.style.color = '#1DA1F2';
    } else {
      bookmarksNotebookName.textContent = 'Not created yet';
      bookmarksNotebookName.style.color = '#999';
    }
  } catch (error) {
    console.error('Failed to load notebook name:', error);
    bookmarksNotebookName.textContent = 'Unknown';
  }
}

/**
 * Load and display lists
 */
async function loadLists() {
  console.log('📋 Loading lists...');
  
  try {
    const result = await ipcRenderer.invoke('get-lists-config');
    
    if (!result.success || !result.data || result.data.lists.length === 0) {
      // No lists - show empty state
      listsContainer.innerHTML = `
        <div class="empty-state">
          <p>No lists configured</p>
          <button class="btn btn-primary" id="discover-lists-btn">
            🔍 Discover Your Lists
          </button>
        </div>
      `;
      
      // Wire up discover button
      document.getElementById('discover-lists-btn').addEventListener('click', discoverLists);
      
      listsSummary.textContent = '0 of 0 enabled';
      return;
    }
    
    const lists = result.data.lists;
    const enabledCount = lists.filter(l => l.enabled).length;
    
    // Update summary
    listsSummary.textContent = `${enabledCount} of ${lists.length} enabled`;
    
    // Render list cards
    listsContainer.innerHTML = lists.map((list, index) => `
      <div class="list-card ${list.enabled ? '' : 'disabled'}" data-list-id="${list.listId}">
        <div class="list-card-header">
          <div class="list-info">
            <h3>${list.name}</h3>
            <div class="list-meta">${list.memberCount || 'Unknown members'} • ${list.daysBack || 1} day filter</div>
          </div>
          <div class="list-status">
            <div class="list-last-sync">Last: ${list.lastSynced || 'Never'}</div>
          </div>
        </div>
        <div class="list-card-actions">
          ${list.enabled ? `
            <button class="btn btn-primary btn-sync-list" data-index="${index}">
              🔄 Sync
            </button>
            <button class="btn btn-secondary btn-open-list" data-list-name="${list.name}">
              🔗 Open
            </button>
            <button class="btn btn-disable btn-toggle-list" data-index="${index}">
              ❌ Disable
            </button>
          ` : `
            <button class="btn btn-enable btn-toggle-list" data-index="${index}">
              ✅ Enable
            </button>
          `}
        </div>
      </div>
    `).join('');
    
    // Wire up all the buttons
    document.querySelectorAll('.btn-sync-list').forEach(btn => {
      btn.addEventListener('click', () => syncSingleList(parseInt(btn.dataset.index)));
    });
    
    document.querySelectorAll('.btn-open-list').forEach(btn => {
      btn.addEventListener('click', () => openListNotebook(btn.dataset.listName));
    });
    
    document.querySelectorAll('.btn-toggle-list').forEach(btn => {
      btn.addEventListener('click', () => toggleList(parseInt(btn.dataset.index)));
    });
    
  } catch (error) {
    console.error('Failed to load lists:', error);
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
 * Sync a single list
 */
async function syncSingleList(listIndex) {
  console.log(`🔄 Syncing list ${listIndex}...`);
  
  try {
    // Get list config
    const configResult = await ipcRenderer.invoke('get-lists-config');
    if (!configResult.success) {
      showNotification('Error', 'Failed to load list configuration', 'error');
      return;
    }
    
    const list = configResult.data.lists[listIndex];
    if (!list) {
      showNotification('Error', 'List not found', 'error');
      return;
    }
    
    showNotification('Syncing List', `Syncing "${list.name}"...`, 'info');
    
    // Trigger single list sync
    const result = await ipcRenderer.invoke('sync-single-list', { listIndex });
    
    if (result.success) {
      showNotification('Success', `Synced "${list.name}"!`, 'success');
      loadLists(); // Refresh to show updated sync time
    } else {
      showNotification('Error', result.error, 'error');
    }
    
  } catch (error) {
    console.error('Sync list error:', error);
    showNotification('Error', error.message, 'error');
  }
}

/**
 * Open list notebook in NotebookLM
 */
function openListNotebook(listName) {
  const today = new Date().toISOString().split('T')[0];
  const notebookName = `BrainBrief - ${listName} - ${today}`;
  console.log(`🔗 Opening notebook: ${notebookName}`);
  
  // Open NotebookLM (notebook will be there if synced)
  require('electron').shell.openExternal('https://notebooklm.google.com');
  
  showNotification('Opening NotebookLM', `Look for: "${notebookName}"`, 'info');
}

/**
 * Toggle list enabled/disabled
 */
async function toggleList(listIndex) {
  console.log(`Toggle list ${listIndex}`);
  
  try {
    // Get current config
    const configResult = await ipcRenderer.invoke('get-lists-config');
    if (!configResult.success) return;
    
    const lists = configResult.data.lists;
    lists[listIndex].enabled = !lists[listIndex].enabled;
    
    // Save updated config
    await ipcRenderer.invoke('save-lists-config', { lists });
    
    // Reload lists to show updated state
    loadLists();
    
    const status = lists[listIndex].enabled ? 'enabled' : 'disabled';
    showNotification('List Updated', `"${lists[listIndex].name}" ${status}`, 'success');
    
  } catch (error) {
    console.error('Toggle list error:', error);
    showNotification('Error', error.message, 'error');
  }
}

/**
 * Discover lists
 */
async function discoverLists() {
  console.log('🔍 Discovering lists...');
  
  showNotification('Discovering Lists', 'Browser will open...', 'info');
  
  try {
    const result = await ipcRenderer.invoke('discover-lists');
    
    if (result.success) {
      showNotification('Success', `Found ${result.data.count} lists!`, 'success');
      loadLists(); // Reload to show discovered lists
    } else {
      showNotification('Error', result.error, 'error');
    }
  } catch (error) {
    console.error('Discovery error:', error);
    showNotification('Error', error.message, 'error');
  }
}

/**
 * Load Google account info
 */
async function loadGoogleAccount() {
  console.log('🔍 Detecting Google account...');
  
  try {
    const result = await ipcRenderer.invoke('get-google-account');
    
    if (result.success && result.data) {
      const { email, status } = result.data;
      
      if (email && email !== 'logged-in') {
        // Real email detected
        accountEmailDisplay.textContent = email;
        googleEmailSpan.textContent = email;
        googleEmailSpan.style.color = '#10a37f';
      } else if (status === 'connected' || email === 'logged-in') {
        // Logged in but email not detected
        accountEmailDisplay.textContent = 'Connected';
        googleEmailSpan.textContent = 'Connected';
        googleEmailSpan.style.color = '#10a37f';
      } else {
        // Not logged in
        accountEmailDisplay.textContent = 'Not logged in';
        googleEmailSpan.textContent = 'Not connected';
        googleEmailSpan.style.color = '#999';
      }
    } else {
      accountEmailDisplay.textContent = 'Unknown';
      googleEmailSpan.textContent = 'Not connected';
    }
    
  } catch (error) {
    console.error('Failed to load Google account:', error);
    accountEmailDisplay.textContent = 'Error detecting account';
  }
}

/**
 * Switch Google account
 */
async function switchAccount() {
  const confirmed = confirm(
    '⚠️ Switch Google Account\n\n' +
    'This will:\n' +
    '✅ Log you out of current Google account\n' +
    '✅ Next sync will ask you to log in again\n' +
    '✅ You can choose a different account\n\n' +
    '❌ Does NOT delete your bookmarks or sync history\n\n' +
    'Continue?'
  );
  
  if (!confirmed) return;
  
  try {
    const result = await ipcRenderer.invoke('switch-account');
    
    if (result.success) {
      showNotification('Logged Out', 'Next sync will ask you to log in', 'success');
      loadGoogleAccount(); // Refresh account display
    } else {
      showNotification('Error', result.error, 'error');
    }
  } catch (error) {
    showNotification('Error', error.message, 'error');
  }
}

/**
 * Reset database (sync history)
 */
async function resetDatabase() {
  const confirmed = confirm(
    '⚠️⚠️⚠️ RESET SYNC HISTORY ⚠️⚠️⚠️\n\n' +
    'This will:\n' +
    '✅ Clear all sync history\n' +
    '✅ Allow re-uploading to NotebookLM\n' +
    '✅ Keep your Lists configuration\n' +
    '✅ Keep your logins (Twitter & Google)\n\n' +
    '❌ You will need to re-sync everything\n\n' +
    'Use this if you deleted NotebookLM notebooks manually.\n\n' +
    'Are you SURE you want to reset?'
  );
  
  if (!confirmed) return;
  
  // Double confirmation for destructive action
  const doubleConfirm = confirm(
    'Final confirmation:\n\n' +
    'Reset sync history and allow fresh upload?\n\n' +
    'This cannot be undone.'
  );
  
  if (!doubleConfirm) return;
  
  try {
    const result = await ipcRenderer.invoke('reset-database');
    
    if (result.success) {
      showNotification('Database Reset', 'Sync history cleared. Ready to re-sync!', 'success');
      loadStats(); // Refresh stats (will show 0)
    } else {
      showNotification('Error', result.error, 'error');
    }
  } catch (error) {
    showNotification('Error', error.message, 'error');
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
  
  // Update last sync if success (for bookmarks)
  if (type === 'success' && (title.includes('Synced') || title.includes('Success'))) {
    bookmarksLastSync.textContent = 'Just now';
    loadStats(); // Refresh stats
    loadLists(); // Refresh lists to show updated sync times
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

openBookmarksNotebookBtn.addEventListener('click', () => {
  console.log('🔗 Opening Bookmarks Notebook...');
  require('electron').shell.openExternal('https://notebooklm.google.com');
  // TODO: Deep link to specific notebook if possible
});

viewLogsBtn.addEventListener('click', (e) => {
  e.preventDefault();
  console.log('📋 View Logs clicked');
  alert('Logs viewer coming soon!');
});

notebooklmHomeBtn.addEventListener('click', () => {
  console.log('🔗 Opening NotebookLM...');
  require('electron').shell.openExternal('https://notebooklm.google.com');
});

switchAccountBtn.addEventListener('click', () => {
  console.log('🔄 Switch Account clicked');
  switchAccount();
});

resetDatabaseBtn.addEventListener('click', () => {
  console.log('🗑️ Reset Database clicked');
  resetDatabase();
});

/**
 * Initialize app on load
 */
window.addEventListener('DOMContentLoaded', async () => {
  console.log('✅ DOM loaded, initializing app...');
  
  // Check if first run - redirect to onboarding
  const firstRunResult = await ipcRenderer.invoke('is-first-run');
  if (firstRunResult.success && firstRunResult.data.isFirstRun) {
    console.log('🎯 First run detected, redirecting to onboarding...');
    window.location.href = 'onboarding.html';
    return;
  }
  
  // Load initial data
  loadStats();
  loadLists();
  loadGoogleAccount();
  
  // Refresh periodically
  setInterval(loadStats, 30000);
  setInterval(loadLists, 60000);
  setInterval(loadGoogleAccount, 120000); // Refresh account every 2 minutes

console.log('✅ Renderer ready');
});
