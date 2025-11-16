import { shouldTrackUrl, createHistoryItem, updateHistoryItemTitle } from './utils/historyTracker';
import {
  getTodos,
  getThoughts,
  getHistory,
  getSettings,
  setLinearIssues,
  setGitHubPRs,
  getCalendarToken,
  setCalendarEvents,
  setLastSync,
  getLastSync,
} from './utils/storageManager';
import { initSupabase } from './utils/supabaseClient';
import { syncAllToSupabase } from './utils/supabaseSync';
import { fetchAllLinearIssues } from './utils/linearApi';
import { fetchAllGitHubPRs } from './utils/githubApi';

/**
 * Background script for:
 * - Tracking browsing history
 * - Fetching data from external APIs (Linear, GitHub, Calendar)
 * - Syncing data to Supabase
 * - Caching everything in chrome.storage
 */

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
const SUPABASE_SYNC_INTERVAL = 10 * 60 * 1000; // 10 minutes

console.log('Background script starting...');

/**
 * Initialize Supabase on startup
 */
async function initializeSupabase() {
  try {
    const settings = await getSettings();
    if (settings.supabaseUrl && settings.supabaseKey) {
      initSupabase(settings.supabaseUrl, settings.supabaseKey);
      console.log('Supabase initialized in background');
    }
  } catch (error) {
    console.error('Failed to initialize Supabase:', error);
  }
}

/**
 * Fetch Linear issues and cache them
 */
async function fetchAndCacheLinearIssues() {
  try {
    const settings = await getSettings();
    if (!settings.linearApiKey) {
      console.log('Linear API key not configured, skipping');
      return;
    }

    console.log('Fetching Linear issues...');
    const issues = await fetchAllLinearIssues();
    await setLinearIssues(issues);
    console.log('Linear issues cached successfully');
  } catch (error) {
    console.error('Failed to fetch Linear issues:', error);
  }
}

/**
 * Fetch GitHub PRs and cache them
 */
async function fetchAndCacheGitHubPRs() {
  try {
    const settings = await getSettings();
    if (!settings.githubToken) {
      console.log('GitHub token not configured, skipping');
      return;
    }

    console.log('Fetching GitHub PRs...');
    const prs = await fetchAllGitHubPRs(settings.githubToken);
    await setGitHubPRs(prs);
    console.log('GitHub PRs cached successfully');
  } catch (error) {
    console.error('Failed to fetch GitHub PRs:', error);
  }
}

/**
 * Fetch Calendar events and cache them
 * Thought: Calendar API needs to be imported from calendarActions
 */
async function fetchAndCacheCalendarEvents() {
  try {
    const token = await getCalendarToken();
    if (!token) {
      console.log('Calendar token not configured, skipping');
      return;
    }

    console.log('Fetching calendar events...');
    // Import dynamically to avoid issues
    const { fetchTodayEvents } = await import('./utils/calendarActions');
    const events = await fetchTodayEvents(token);
    if (events && events.length > 0) {
      await setCalendarEvents(events);
      console.log('Calendar events cached successfully');
    }
  } catch (error) {
    console.error('Failed to fetch calendar events:', error);
  }
}

/**
 * Sync all data to Supabase
 */
async function syncToSupabase() {
  try {
    const settings = await getSettings();
    if (!settings.supabaseUrl || !settings.supabaseKey) {
      console.log('Supabase not configured, skipping sync');
      return;
    }

    console.log('Syncing to Supabase...');
    const [todos, thoughts, history] = await Promise.all([
      getTodos(),
      getThoughts(),
      getHistory(),
    ]);

    await syncAllToSupabase(todos, thoughts, history);
    console.log('Supabase sync complete');
  } catch (error) {
    console.error('Failed to sync to Supabase:', error);
  }
}

/**
 * Fetch all external data (Linear, GitHub, Calendar)
 */
async function fetchAllExternalData() {
  console.log('Fetching all external data...');

  const lastSync = await getLastSync();
  const now = Date.now();

  // Only sync if enough time has passed
  if (now - lastSync < SYNC_INTERVAL) {
    console.log('Skipping sync, too soon since last sync');
    return;
  }

  await Promise.all([
    fetchAndCacheLinearIssues(),
    fetchAndCacheGitHubPRs(),
    fetchAndCacheCalendarEvents(),
  ]);

  await setLastSync(now);
  console.log('All external data fetched and cached');
}

/**
 * Main sync function - runs periodically
 */
async function performPeriodicSync() {
  console.log('Starting periodic sync...');

  // Fetch external data
  await fetchAllExternalData();

  // Sync to Supabase (less frequently)
  const lastSync = await getLastSync();
  const now = Date.now();
  if (now - lastSync >= SUPABASE_SYNC_INTERVAL) {
    await syncToSupabase();
  }

  console.log('Periodic sync complete');
}

// =============================================================================
// History Tracking
// =============================================================================

// Listen for tab updates
chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  // Handle title changes (for dynamic sites like Notion)
  if (changeInfo.title && tab.url && shouldTrackUrl(tab.url)) {
    await updateHistoryItemTitle(tab.url, changeInfo.title);
  }

  // Only process when the page is completely loaded
  if (changeInfo.status === 'complete' && tab.url) {
    const url = tab.url;

    // Check if we should track this URL
    if (shouldTrackUrl(url)) {
      const historyItem = createHistoryItem(url, tab.title);

      if (historyItem) {
        // Save to chrome.storage
        const { saveHistoryItem } = await import('./utils/historyTracker');
        await saveHistoryItem(historyItem);
      }
    }
  }
});

// Listen for tab activation (switching between tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);

    if (tab.url && tab.status === 'complete') {
      const url = tab.url;

      if (shouldTrackUrl(url)) {
        const historyItem = createHistoryItem(url, tab.title);

        if (historyItem) {
          const { saveHistoryItem } = await import('./utils/historyTracker');
          await saveHistoryItem(historyItem);
        }
      }
    }
  } catch (e) {
    console.error('Error tracking tab activation:', e);
  }
});

// =============================================================================
// Initialization and Periodic Tasks
// =============================================================================

// Initialize on install/update
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Extension installed/updated');
  await initializeSupabase();
  await fetchAllExternalData();
});

// Initialize on startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('Browser started');
  await initializeSupabase();
  await fetchAllExternalData();
});

// Set up periodic sync (every 5 minutes)
chrome.alarms.create('periodicSync', { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'periodicSync') {
    await performPeriodicSync();
  }
});

// Listen for storage changes to reinitialize Supabase if settings change
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local' && changes.settings) {
    console.log('Settings changed, reinitializing Supabase');
    await initializeSupabase();
  }
});

// Listen for messages from UI to trigger manual sync
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'syncNow') {
    console.log('Manual sync requested from UI');
    performPeriodicSync()
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error('Manual sync failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    // Return true to indicate we'll send response asynchronously
    return true;
  }
});

// Initialize immediately on script load
(async () => {
  await initializeSupabase();
  console.log('Background script loaded and ready');
})();

console.log('History tracking background script loaded');
