/**
 * Settings Page - List Selection
 */

const { ipcRenderer } = require('electron');

// DOM elements
const listsContainer = document.getElementById('lists-container');
const saveBtn = document.getElementById('save-settings');
const discoverBtn = document.getElementById('discover-lists');
const backBtn = document.getElementById('back-home');
const maxTweetsInput = document.getElementById('max-tweets');
const daysBackInput = document.getElementById('days-back');

let currentLists = [];

/**
 * Load lists from config
 */
async function loadLists() {
  try {
    const result = await ipcRenderer.invoke('get-lists-config');
    
    if (!result.success || !result.data || result.data.lists.length === 0) {
      listsContainer.innerHTML = `
        <p style="text-align: center; padding: 40px; color: #999;">
          No lists found. Click "Discover Lists" to find your Twitter Lists.
        </p>
      `;
      return;
    }
    
    currentLists = result.data.lists;
    
    // Render lists with checkboxes
    listsContainer.innerHTML = currentLists.map((list, index) => `
      <div class="list-item" data-index="${index}">
        <input 
          type="checkbox" 
          class="list-checkbox" 
          id="list-${index}"
          ${list.enabled ? 'checked' : ''}
        >
        <div class="list-info">
          <div class="list-name">${list.name}</div>
          <div class="list-meta">
            ${list.memberCount || 'Unknown members'} • 
            Max ${list.maxTweets || 50} tweets
          </div>
        </div>
      </div>
    `).join('');
    
  } catch (error) {
    console.error('Failed to load lists:', error);
    showNotification('Error', 'Failed to load lists', 'error');
  }
}

/**
 * Save settings
 */
async function saveSettings() {
  try {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    // Update enabled state for each list
    currentLists.forEach((list, index) => {
      const checkbox = document.getElementById(`list-${index}`);
      list.enabled = checkbox.checked;
    });
    
    // Update max tweets and days back
    const maxTweets = parseInt(maxTweetsInput.value);
    const daysBack = parseInt(daysBackInput.value);
    
    currentLists.forEach(list => {
      list.maxTweets = maxTweets;
      list.daysBack = daysBack;
    });
    
    // Save to config
    const result = await ipcRenderer.invoke('save-lists-config', {
      lists: currentLists
    });
    
    if (result.success) {
      showNotification('Settings Saved', 'List configuration updated', 'success');
      
      const enabledCount = currentLists.filter(l => l.enabled).length;
      console.log(`✅ Saved: ${enabledCount}/${currentLists.length} lists enabled`);
    } else {
      showNotification('Save Failed', result.error, 'error');
    }
    
  } catch (error) {
    console.error('Failed to save settings:', error);
    showNotification('Error', error.message, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 Save Settings';
  }
}

/**
 * Discover lists
 */
async function discoverLists() {
  try {
    discoverBtn.disabled = true;
    discoverBtn.textContent = 'Discovering...';
    
    showNotification('Discovering Lists', 'Browser will open...', 'info');
    
    const result = await ipcRenderer.invoke('discover-lists');
    
    if (result.success) {
      showNotification('Discovery Complete', `Found ${result.data.count} lists`, 'success');
      loadLists(); // Reload lists
    } else {
      showNotification('Discovery Failed', result.error, 'error');
    }
    
  } catch (error) {
    console.error('Discovery failed:', error);
    showNotification('Error', error.message, 'error');
  } finally {
    discoverBtn.disabled = false;
    discoverBtn.textContent = '🔍 Discover Lists';
  }
}

/**
 * Show notification
 */
function showNotification(title, message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <strong>${title}</strong><br>
    ${message}
  `;
  
  const container = document.getElementById('toast-container');
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('show');
  }, 100);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Event Listeners
 */
saveBtn.addEventListener('click', saveSettings);
discoverBtn.addEventListener('click', discoverLists);
backBtn.addEventListener('click', () => {
  window.location.href = 'index.html';
});

/**
 * Initialize
 */
window.addEventListener('DOMContentLoaded', () => {
  console.log('⚙️ Settings page loaded');
  loadLists();
});

