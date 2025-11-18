import { shouldTrackUrl, updateHistoryItemTitle } from './utils/historyTracker';
import {
  getTodos,
  getThoughts,
  getHistory,
  getSettings,
  setLinearIssues,
  setGitHubPRs,
  setCalendarEvents,
  setLastSync,
  getLastSync,
  getLinearIssues,
  getGitHubPRs,
  getCalendarEvents,
  getMailMessages,
  getLastSupabaseSync,
  setLastSupabaseSync,
} from './utils/storageManager';
import { initSupabase, getSupabaseClient } from './utils/supabaseClient';
import { syncAllToSupabase } from './utils/supabaseSync';
import { fetchAllLinearIssues } from './utils/linearApi';
import { fetchAllGitHubPRs } from './utils/githubApi';
import { cleanAndDeduplicateHistory } from './utils/cleanHistory';
import { fetchCalendarEventsWithRetry } from './utils/calendarTokenRefresh';

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
 * Run one-time migration to clean and deduplicate existing history
 * This runs once per installation and is tracked via a flag
 * v2: Added Figma URL normalization (removes name variations for boards/files)
 */
async function runHistoryCleanupMigration() {
  const MIGRATION_FLAG = 'history_cleaned_v2';

  try {
    // Check if migration has already been run
    const result = await chrome.storage.local.get(MIGRATION_FLAG);

    if (result[MIGRATION_FLAG]) {
      console.log('✓ History cleanup migration v2 already completed');
      return;
    }

    console.log('→ Running history cleanup migration v2...');
    const cleanupResult = await cleanAndDeduplicateHistory();

    console.log(`✓ History cleanup complete:`, {
      originalCount: cleanupResult.originalCount,
      cleanedCount: cleanupResult.cleanedCount,
      duplicatesRemoved: cleanupResult.duplicatesRemoved,
    });

    // Set flag to prevent running again
    await chrome.storage.local.set({ [MIGRATION_FLAG]: true });
    console.log('✓ Migration flag set');
  } catch (error) {
    console.error('✗ Failed to run history cleanup migration:', error);
  }
}

/**
 * Initialize Supabase on startup
 */
async function initializeSupabase() {
  try {
    const settings = await getSettings();
    console.log('Checking Supabase configuration...');
    console.log('  - Has URL:', !!settings.supabaseUrl);
    console.log('  - Has Key:', !!settings.supabaseKey);

    if (settings.supabaseUrl && settings.supabaseKey) {
      console.log('  - URL value:', settings.supabaseUrl);
      console.log('  - Key length:', settings.supabaseKey?.length || 0);

      const client = initSupabase(settings.supabaseUrl, settings.supabaseKey);
      if (client) {
        console.log('✓ Supabase initialized in background');

        // Test the connection
        try {
          const { error } = await client.from('todos').select('count').limit(1);
          if (error) {
            console.error('✗ Supabase connection test failed:', error.message);
          } else {
            console.log('✓ Supabase connection test successful');
          }
        } catch (testError) {
          console.error('✗ Supabase connection test error:', testError);
        }
      } else {
        console.error('✗ Supabase initialization failed - client is null');
      }
    } else {
      console.log('ℹ Supabase not configured (no URL or key in settings)');
      console.log('  Configure Supabase in Settings to enable cloud sync');
    }
  } catch (error) {
    console.error('✗ Failed to initialize Supabase:', error);
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
    const issues = await fetchAllLinearIssues(settings.linearApiKey);
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
 * Uses automatic token refresh on 401 errors
 */
async function fetchAndCacheCalendarEvents() {
  try {
    console.log('Fetching calendar events...');

    // Use the new utility with automatic token refresh
    const events = await fetchCalendarEventsWithRetry();

    if (events) {
      await setCalendarEvents(events);
      console.log(`Calendar events cached successfully (${events.length} events)`);
    } else {
      console.log('No calendar events fetched (token not available)');
    }
  } catch (error) {
    console.error('Failed to fetch calendar events:', error);
    // Don't throw - allow other data fetching to continue
  }
}

/**
 * Fetch Mail messages from Supabase and cache in IndexedDB
 * Replaces old client-side Gmail API fetching
 */
async function fetchAndCacheMailMessages() {
  try {
    console.log('Syncing mail from Supabase...');

    // Import the new Supabase sync utility
    const { syncMailFromSupabase } = await import('./utils/mailSupabaseSync');

    // Fetch from Supabase and cache in IndexedDB
    const messages = await syncMailFromSupabase();

    console.log(`Mail sync complete: ${messages.all.length} total, ${messages.onboarding.length} onboarding, ${messages.support.length} support`);
  } catch (error) {
    console.error('Failed to sync mail messages:', error);
    // Don't throw - allow other data fetching to continue
  }
}

/**
 * Sync all data to Supabase
 */
async function syncToSupabase() {
  try {
    const settings = await getSettings();
    console.log('=== Supabase Sync Attempt ===');
    console.log('Settings check:', {
      hasUrl: !!settings.supabaseUrl,
      hasKey: !!settings.supabaseKey,
      url: settings.supabaseUrl,
      keyLength: settings.supabaseKey?.length || 0,
    });

    if (!settings.supabaseUrl || !settings.supabaseKey) {
      console.log('⚠ Supabase not configured, skipping sync (no URL or key in settings)');
      return;
    }

    // Verify client is initialized
    const client = getSupabaseClient();
    console.log('Supabase client status:', client ? 'initialized' : 'NOT initialized');

    if (!client) {
      console.warn('⚠ Supabase client not initialized despite having settings');
      console.log('Attempting to reinitialize...');
      await initializeSupabase();
      const retryClient = getSupabaseClient();
      if (!retryClient) {
        console.error('✗ Reinitialization failed - aborting sync');
        return;
      }
    }

    console.log('→ Starting data sync...');
    const [todos, thoughts, history] = await Promise.all([
      getTodos(),
      getThoughts(),
      getHistory(),
    ]);

    console.log(`→ Data loaded: ${todos.length} todos, ${thoughts.length} thoughts, ${history.length} history items`);
    await syncAllToSupabase(todos, thoughts, history);

    // Update last Supabase sync timestamp
    await setLastSupabaseSync(Date.now());
    console.log('✓ Supabase sync complete');
  } catch (error) {
    console.error('✗ Failed to sync to Supabase:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

/**
 * Fetch all external data (Linear, GitHub, Calendar, Mail)
 * This is the main data fetching function - runs every 2 minutes
 */
async function fetchAllExternalData() {
  console.log('Fetching all external data...');

  await Promise.all([
    fetchAndCacheLinearIssues(),
    fetchAndCacheGitHubPRs(),
    fetchAndCacheCalendarEvents(),
    fetchAndCacheMailMessages(),
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

  // Sync to Supabase (less frequently - every 10 minutes)
  const lastSupabaseSync = await getLastSupabaseSync();
  const now = Date.now();
  const timeSinceLastSync = now - lastSupabaseSync;
  const shouldSync = timeSinceLastSync >= SUPABASE_SYNC_INTERVAL;

  console.log('Supabase sync check:', {
    lastSync: new Date(lastSupabaseSync).toLocaleTimeString(),
    timeSinceLastSync: Math.round(timeSinceLastSync / 1000) + 's',
    interval: Math.round(SUPABASE_SYNC_INTERVAL / 1000) + 's',
    shouldSync,
  });

  if (shouldSync) {
    console.log('→ Time to sync to Supabase');
    await syncToSupabase();
  } else {
    const timeUntilNextSync = SUPABASE_SYNC_INTERVAL - timeSinceLastSync;
    console.log(`⏳ Next Supabase sync in ${Math.round(timeUntilNextSync / 1000)}s`);
  }

  console.log('Periodic sync complete');
}

/**
 * Get all cached data - this is what foreground requests
 */
async function getAllCachedData() {
  console.log('Getting all cached data for foreground...');

  const [todos, thoughts, history, linearIssues, githubPRs, calendarEvents, mailMessages, settings] = await Promise.all([
    getTodos(),
    getThoughts(),
    getHistory(),
    getLinearIssues(),
    getGitHubPRs(),
    getCalendarEvents(),
    getMailMessages(),
    getSettings(),
  ]);

  return {
    todos,
    thoughts,
    history,
    linearIssues,
    githubPRs,
    calendarEvents,
    mailMessages,
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
      const { createHistoryItemAsync, saveHistoryItem } = await import('./utils/historyTracker');
      const historyItem = await createHistoryItemAsync(url, tab.title);

      if (historyItem) {
        // Save to chrome.storage
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
        const { createHistoryItemAsync, saveHistoryItem } = await import('./utils/historyTracker');
        const historyItem = await createHistoryItemAsync(url, tab.title);

        if (historyItem) {
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

        case 'debugInspectHistory': {
          // Debug: Inspect history for duplicates
          const { inspectHistory } = await import('./utils/debugHistory');
          const stats = await inspectHistory();
          sendResponse({ success: true, data: stats });
          break;
        }

        case 'debugForceCleanHistory': {
          // Debug: Force cleanup of history
          const { forceCleanHistory } = await import('./utils/debugHistory');
          const result = await forceCleanHistory();
          sendResponse({ success: true, data: result });
          break;
        }

        case 'debugResetMigration': {
          // Debug: Reset migration flag
          const { resetMigrationFlag } = await import('./utils/debugHistory');
          await resetMigrationFlag();
          sendResponse({ success: true });
          break;
        }

        case 'deleteHistoryItem': {
          // Delete a history item by ID
          const { deleteHistoryItem } = await import('./utils/historyTracker');
          await deleteHistoryItem(message.id);
          sendResponse({ success: true });
          break;
        }

        case 'deleteHistoryItemByUrl': {
          // Delete a history item by URL
          const { deleteHistoryItemByUrl } = await import('./utils/historyTracker');
          await deleteHistoryItemByUrl(message.url);
          sendResponse({ success: true });
          break;
        }

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
  await runHistoryCleanupMigration();
  await initializeSupabase();
  await fetchAllExternalData();
});

// Initialize on startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('Browser started');
  await runHistoryCleanupMigration();
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
  await runHistoryCleanupMigration();
  await initializeSupabase();
  // Fetch data on startup
  await fetchAllExternalData();
  console.log('Background script loaded and ready');
})();

console.log('History tracking background script loaded');
