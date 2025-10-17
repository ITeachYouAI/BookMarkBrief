/**
 * BrainBrief - Renderer Process
 * Handles UI interactions and displays sync status
 */

console.log('🎨 Renderer process loaded');

// DOM elements
const syncNowBtn = document.getElementById('sync-now');
const settingsBtn = document.getElementById('open-settings');
const viewLogsBtn = document.getElementById('view-logs');

// Status elements
const twitterStatus = document.getElementById('twitter-status');
const notebooklmStatus = document.getElementById('notebooklm-status');
const lastSync = document.getElementById('last-sync');

// Stats elements
const bookmarksCount = document.getElementById('bookmarks-count');
const listsCount = document.getElementById('lists-count');
const tweetsCount = document.getElementById('tweets-count');

/**
 * Event Listeners
 */
syncNowBtn.addEventListener('click', () => {
  console.log('🔄 Sync Now clicked');
  // TODO: Trigger sync function
  alert('Sync functionality coming soon!\n\nThis button will:\n1. Scrape Twitter bookmarks\n2. Scrape selected lists\n3. Upload to NotebookLM');
});

settingsBtn.addEventListener('click', () => {
  console.log('⚙️ Settings clicked');
  // TODO: Open settings page
  alert('Settings page coming soon!\n\nYou will be able to:\n- Configure Twitter login\n- Configure NotebookLM login\n- Select which lists to sync\n- Set sync schedule');
});

viewLogsBtn.addEventListener('click', (e) => {
  e.preventDefault();
  console.log('📋 View Logs clicked');
  // TODO: Open logs folder
  alert('Logs viewer coming soon!\n\nYou will be able to:\n- View sync history\n- Debug errors\n- Export logs');
});

/**
 * Load initial status
 */
function loadStatus() {
  // TODO: Load from database
  console.log('📊 Loading status...');
  
  // For now, show placeholder data
  twitterStatus.textContent = 'Not connected';
  notebooklmStatus.textContent = 'Not connected';
  lastSync.textContent = 'Never';
  
  bookmarksCount.textContent = '0';
  listsCount.textContent = '0';
  tweetsCount.textContent = '0';
}

// Load status on page load
loadStatus();

console.log('✅ Renderer ready');

