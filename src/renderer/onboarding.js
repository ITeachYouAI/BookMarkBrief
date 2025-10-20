/**
 * Onboarding Flow for First-Time Users
 */

const { ipcRenderer } = require('electron');

// Steps
const stepWelcome = document.getElementById('step-welcome');
const stepTwitter = document.getElementById('step-twitter');
const stepNotebookLM = document.getElementById('step-notebooklm');
const stepComplete = document.getElementById('step-complete');

// Buttons
const startSetupBtn = document.getElementById('start-setup');
const connectTwitterBtn = document.getElementById('connect-twitter');
const skipTwitterBtn = document.getElementById('skip-twitter');
const connectNotebookLMBtn = document.getElementById('connect-notebooklm');
const skipNotebookLMBtn = document.getElementById('skip-notebooklm');
const finishOnboardingBtn = document.getElementById('finish-onboarding');

// Status displays
const twitterStatus = document.getElementById('twitter-status');
const notebooklmStatus = document.getElementById('notebooklm-status');
const notebooklmEmailStatus = document.getElementById('notebooklm-email-status');

/**
 * Show specific step
 */
function showStep(step) {
  [stepWelcome, stepTwitter, stepNotebookLM, stepComplete].forEach(s => {
    s.style.display = 'none';
  });
  step.style.display = 'block';
}

/**
 * Start setup flow
 */
startSetupBtn.addEventListener('click', () => {
  showStep(stepTwitter);
});

/**
 * Connect Twitter
 */
connectTwitterBtn.addEventListener('click', async () => {
  try {
    connectTwitterBtn.disabled = true;
    connectTwitterBtn.textContent = 'Opening browser...';
    
    // Trigger a test extraction (will prompt login if needed)
    const result = await ipcRenderer.invoke('test-twitter-connection');
    
    if (result.success) {
      twitterStatus.className = 'status-indicator status-success';
      twitterStatus.textContent = '✅ Connected';
      
      // Auto-advance after 2 seconds
      setTimeout(() => {
        showStep(stepNotebookLM);
      }, 2000);
    } else {
      twitterStatus.className = 'status-indicator status-pending';
      twitterStatus.textContent = '❌ Connection failed';
      connectTwitterBtn.disabled = false;
      connectTwitterBtn.textContent = 'Try Again';
    }
    
  } catch (error) {
    console.error('Twitter connection error:', error);
    connectTwitterBtn.disabled = false;
    connectTwitterBtn.textContent = 'Try Again';
  }
});

skipTwitterBtn.addEventListener('click', () => {
  showStep(stepNotebookLM);
});

/**
 * Connect NotebookLM
 */
connectNotebookLMBtn.addEventListener('click', async () => {
  try {
    connectNotebookLMBtn.disabled = true;
    connectNotebookLMBtn.textContent = 'Opening browser...';
    
    // Trigger NotebookLM connection test
    const result = await ipcRenderer.invoke('test-notebooklm-connection');
    
    if (result.success) {
      notebooklmStatus.className = 'status-indicator status-success';
      notebooklmStatus.textContent = `✅ Connected`;
      
      // Show email in completion step
      const email = result.data?.email || 'Connected';
      notebooklmEmailStatus.textContent = `✅ NotebookLM: ${email}`;
      
      // Auto-advance after 2 seconds
      setTimeout(() => {
        showStep(stepComplete);
      }, 2000);
    } else {
      notebooklmStatus.className = 'status-indicator status-pending';
      notebooklmStatus.textContent = '❌ Connection failed';
      connectNotebookLMBtn.disabled = false;
      connectNotebookLMBtn.textContent = 'Try Again';
    }
    
  } catch (error) {
    console.error('NotebookLM connection error:', error);
    connectNotebookLMBtn.disabled = false;
    connectNotebookLMBtn.textContent = 'Try Again';
  }
});

skipNotebookLMBtn.addEventListener('click', () => {
  showStep(stepComplete);
});

/**
 * Finish onboarding
 */
finishOnboardingBtn.addEventListener('click', async () => {
  // Mark onboarding as complete
  await ipcRenderer.invoke('complete-onboarding');
  
  // Go to main app
  window.location.href = 'index.html';
});

// Auto-detect if already connected
window.addEventListener('DOMContentLoaded', async () => {
  // Check if already connected to Twitter
  const twitterResult = await ipcRenderer.invoke('check-twitter-connected');
  if (twitterResult.success && twitterResult.data.connected) {
    twitterStatus.className = 'status-indicator status-success';
    twitterStatus.textContent = '✅ Already Connected';
  }
  
  // Check if already connected to NotebookLM
  const notebooklmResult = await ipcRenderer.invoke('check-notebooklm-connected');
  if (notebooklmResult.success && notebooklmResult.data.connected) {
    notebooklmStatus.className = 'status-indicator status-success';
    notebooklmStatus.textContent = '✅ Already Connected';
  }
});

