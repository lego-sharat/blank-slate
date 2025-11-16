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
  getLinearIssues,
  getGitHubPRs,
  getCalendarEvents,
} from './utils/storageManager';
import { initSupabase } from './utils/supabaseClient';
import { syncAllToSupabase } from './utils/supabaseSync';
import { fetchAllLinearIssues } from './utils/linearApi';
import { fetchAllGitHubPRs } from './utils/githubApi';

/**
 * Background script for:
 * - Tracking browsing history
 * - Fetching ALL data from external APIs (Linear, GitHub, Calendar)
 * - Syncing data to Supabase
 * - Caching everything in chrome.storage
 *
 * Foreground scripts should NEVER fetch data directly.
 * They should only request cached data from this background script.
 */

const FETCH_INTERVAL_MINUTES = 2; // Fetch external data every 2 minutes
const SUPABASE_SYNC_INTERVAL = 10 * 60 * 1000; // Sync to Supabase every 10 minutes

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
 * Inline implementation to avoid import issues in background worker
 */
async function fetchAndCacheCalendarEvents() {
  try {
    const token = await getCalendarToken();
    if (!token) {
      console.log('Calendar token not configured, skipping');
      return;
    }

    console.log('Fetching calendar events...');

    // Inline calendar fetching - no imports to avoid window references
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${startOfDay.toISOString()}&` +
      `timeMax=${endOfDay.toISOString()}&` +
      `singleEvents=true&` +
      `orderBy=startTime&` +
      `maxResults=50`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch calendar events: ${response.status}`);
    }

    const data = await response.json();
    const events = data.items || [];

    await setCalendarEvents(events);
    console.log(`Calendar events cached successfully (${events.length} events)`);
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
 * This is the main data fetching function - runs every 2 minutes
 */
async function fetchAllExternalData() {
  console.log('Fetching all external data...');

  await Promise.all([
    fetchAndCacheLinearIssues(),
    fetchAndCacheGitHubPRs(),
    fetchAndCacheCalendarEvents(),
  ]);

  await setLastSync(Date.now());
  console.log('All external data fetched and cached');
}

/**
 * Main sync function - runs periodically
 */
async function performPeriodicSync() {
  console.log('Starting periodic sync...');

  // Fetch all external data
  await fetchAllExternalData();

  // Sync to Supabase (less frequently)
  const lastSupabaseSync = await getLastSync();
  const now = Date.now();
  if (now - lastSupabaseSync >= SUPABASE_SYNC_INTERVAL) {
    await syncToSupabase();
  }

  console.log('Periodic sync complete');
}

/**
 * Get all cached data - this is what foreground requests
 */
async function getAllCachedData() {
  console.log('Getting all cached data for foreground...');

  const [todos, thoughts, history, linearIssues, githubPRs, calendarEvents, settings] = await Promise.all([
    getTodos(),
    getThoughts(),
    getHistory(),
    getLinearIssues(),
    getGitHubPRs(),
    getCalendarEvents(),
    getSettings(),
  ]);

  return {
    todos,
    thoughts,
    history,
    linearIssues,
    githubPRs,
    calendarEvents,
    settings,
    lastSync: await getLastSync(),
  };
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
// Message Handlers - Foreground Communication
// =============================================================================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Handle all messages asynchronously
  (async () => {
    try {
      switch (message.action) {
        case 'getAllData':
          // Foreground is requesting all cached data
          console.log('Foreground requested all data');
          const data = await getAllCachedData();
          sendResponse({ success: true, data });
          break;

        case 'refreshData':
          // Foreground is requesting immediate refresh
          console.log('Foreground requested immediate refresh');
          await fetchAllExternalData();
          const refreshedData = await getAllCachedData();
          sendResponse({ success: true, data: refreshedData });
          break;

        case 'syncNow':
          // Legacy support - same as refreshData
          console.log('Manual sync requested from UI');
          await performPeriodicSync();
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error: any) {
      console.error('Message handler error:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  // Return true to indicate we'll send response asynchronously
  return true;
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

// Set up periodic sync (every 2 minutes)
chrome.alarms.create('periodicSync', { periodInMinutes: FETCH_INTERVAL_MINUTES });

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
    // Also refresh data immediately when settings change
    await fetchAllExternalData();
  }
});

// Initialize immediately on script load
(async () => {
  await initializeSupabase();
  // Fetch data on startup
  await fetchAllExternalData();
  console.log('Background script loaded and ready');
})();

console.log('History tracking background script loaded');
