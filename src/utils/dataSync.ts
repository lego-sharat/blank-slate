import { calendarToken, todos, thoughts, history, linearIssues, githubPRs, mailThreads, settings, calendarEvents } from '@/store/store';
import { getCalendarToken } from '@/utils/storageManager';

/**
 * Check if Linear is connected (frontend only)
 */
export function isLinearConnected(): boolean {
  return !!(settings.value.linearApiKey && settings.value.linearApiKey.length > 0);
}

/**
 * Data sync utility - ALL data comes from background script
 *
 * Architecture:
 * - Background script fetches all data every 2 minutes
 * - UI requests cached data from background
 * - UI NEVER fetches data directly
 * - Signals are updated with cached data
 */

/**
 * Request all data from background script
 * This returns cached data that the background script maintains
 */
export async function getAllDataFromBackground() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getAllData' });

    if (response.success && response.data) {
      return response.data;
    } else {
      console.error('Failed to get data from background:', response.error);
      return null;
    }
  } catch (error) {
    console.error('Error requesting data from background:', error);
    return null;
  }
}

/**
 * Request immediate refresh from background script
 * This triggers background to fetch fresh data and returns it
 */
export async function requestBackgroundRefresh() {
  try {
    console.log('Requesting immediate data refresh from background...');
    const response = await chrome.runtime.sendMessage({ action: 'refreshData' });

    if (response.success && response.data) {
      return response.data;
    } else {
      console.error('Failed to refresh data:', response.error);
      return null;
    }
  } catch (error) {
    console.error('Error requesting refresh:', error);
    return null;
  }
}

/**
 * Load data directly from chrome.storage (fast, no message passing)
 * This loads cached data synchronously on app startup
 */
export async function loadCachedDataDirectly() {
  try {
    const { getTodos, getThoughts, getHistory, getLinearIssues, getGitHubPRs, getCalendarEvents, getMailMessages } = await import('@/utils/storageManager');

    const [todosData, thoughtsData, historyData, linearData, githubData, calendarData, mailData] = await Promise.all([
      getTodos(),
      getThoughts(),
      getHistory(),
      getLinearIssues(),
      getGitHubPRs(),
      getCalendarEvents(),
      getMailMessages(),
    ]);

    todos.value = todosData;
    thoughts.value = thoughtsData.map((thought: any) => ({
      ...thought,
      status: thought.status || 'draft',
    }));
    history.value = historyData;
    linearIssues.value = linearData;
    githubPRs.value = githubData;
    calendarEvents.value = calendarData;
    mailThreads.value = mailData;

    console.log('Cached data loaded directly from chrome.storage');
  } catch (error) {
    console.error('Error loading cached data:', error);
  }
}

/**
 * Load all data from background and update signals
 * This is the ONLY way the UI should load data
 */
export async function syncAllData() {
  console.log('Loading all data from background...');

  const data = await getAllDataFromBackground();

  if (!data) {
    console.error('No data received from background');
    return;
  }

  // Update all signals with cached data
  todos.value = data.todos || [];
  thoughts.value = (data.thoughts || []).map((thought: any) => ({
    ...thought,
    status: thought.status || 'draft',
  }));
  history.value = data.history || [];

  linearIssues.value = data.linearIssues || {
    assignedToMe: [],
    createdByMe: [],
    mentioningMe: [],
  };

  githubPRs.value = data.githubPRs || {
    createdByMe: [],
    reviewRequested: [],
  };

  mailThreads.value = data.mailMessages || {
    all: [],
    onboarding: [],
    support: [],
  };

  calendarEvents.value = data.calendarEvents || [];

  console.log('All data loaded from background:');
  console.log('- Todos:', todos.value.length);
  console.log('- Thoughts:', thoughts.value.length);
  console.log('- History:', history.value.length);
  console.log('- Linear issues:', linearIssues.value.assignedToMe.length + linearIssues.value.createdByMe.length);
  console.log('- GitHub PRs:', githubPRs.value.createdByMe.length + githubPRs.value.reviewRequested.length);
  console.log('- Mail threads:', mailThreads.value.all.length);
  console.log('- Calendar events:', calendarEvents.value.length);
  console.log('- Last sync:', new Date(data.lastSync || 0).toLocaleTimeString());
}

/**
 * Refresh all data immediately
 * Triggers background to fetch fresh data, then updates signals
 */
export async function refreshAllData() {
  console.log('Refreshing all data...');

  const data = await requestBackgroundRefresh();

  if (!data) {
    console.error('No data received from background refresh');
    return;
  }

  // Update all signals with fresh data
  todos.value = data.todos || [];
  thoughts.value = (data.thoughts || []).map((thought: any) => ({
    ...thought,
    status: thought.status || 'draft',
  }));
  history.value = data.history || [];

  linearIssues.value = data.linearIssues || {
    assignedToMe: [],
    createdByMe: [],
    mentioningMe: [],
  };

  githubPRs.value = data.githubPRs || {
    createdByMe: [],
    reviewRequested: [],
  };

  mailThreads.value = data.mailMessages || {
    all: [],
    onboarding: [],
    support: [],
  };

  calendarEvents.value = data.calendarEvents || [];

  console.log('All data refreshed successfully');
}

/**
 * Legacy functions - kept for backwards compatibility
 * These now use the background data system
 */

export async function loadTasks() {
  // Data is loaded via syncAllData()
  console.log('loadTasks() called - use syncAllData() instead');
}

export async function loadThoughts() {
  // Data is loaded via syncAllData()
  console.log('loadThoughts() called - use syncAllData() instead');
}

export async function loadLinearIssues() {
  // Data is loaded via syncAllData()
  console.log('loadLinearIssues() called - use syncAllData() instead');
}

export async function loadGitHubPRs() {
  // Data is loaded via syncAllData()
  console.log('loadGitHubPRs() called - use syncAllData() instead');
}

export async function loadCalendarToken() {
  // Calendar token is still in chrome.storage
  // This is OK since it's just a token, not fetched data
  const token = await getCalendarToken();
  calendarToken.value = token;
}

export async function loadCalendarEvents() {
  // Data is loaded via syncAllData()
  console.log('loadCalendarEvents() called - use syncAllData() instead');
}

/**
 * @deprecated Use refreshAllData() instead
 */
export async function requestBackgroundSync() {
  await refreshAllData();
}

/**
 * @deprecated Use refreshAllData() instead
 */
export async function syncCalendar() {
  await refreshAllData();
}

/**
 * @deprecated Use refreshAllData() instead
 */
export async function syncLinear() {
  await refreshAllData();
}

/**
 * Check if GitHub is connected
 */
export function isGitHubConnected(): boolean {
  return !!(settings.value.githubToken && settings.value.githubToken.length > 0);
}

/**
 * @deprecated Use refreshAllData() instead
 */
export async function syncGitHub() {
  await refreshAllData();
}
