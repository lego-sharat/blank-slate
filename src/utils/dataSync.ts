import { calendarToken, todos, thoughts, linearIssues, githubPRs, settings, calendarEvents } from '@/store/store';
import {
  getTodos,
  getThoughts,
  getLinearIssues,
  getGitHubPRs,
  getCalendarToken,
  getCalendarEvents,
} from '@/utils/storageManager';

/**
 * Load tasks from chrome.storage
 */
export async function loadTasks() {
  try {
    const storedTodos = await getTodos();
    todos.value = storedTodos;
    console.log('Loaded', todos.value.length, 'tasks from storage');
  } catch (error) {
    console.error('Error loading tasks:', error);
  }
}

/**
 * Load thoughts from chrome.storage
 */
export async function loadThoughts() {
  try {
    const storedNotes = await getThoughts();
    // Migrate old thoughts to include status field
    thoughts.value = storedNotes.map((thought: any) => ({
      ...thought,
      status: thought.status || 'draft',
    }));
    console.log('Loaded', thoughts.value.length, 'thoughts from storage');
  } catch (error) {
    console.error('Error loading thoughts:', error);
  }
}

/**
 * Load Linear issues from chrome.storage
 */
export async function loadLinearIssues() {
  try {
    const stored = await getLinearIssues();
    linearIssues.value = stored;
    console.log('Loaded Linear issues from storage');
  } catch (error) {
    console.error('Error loading Linear issues:', error);
  }
}

/**
 * Load GitHub PRs from chrome.storage
 */
export async function loadGitHubPRs() {
  try {
    const stored = await getGitHubPRs();
    githubPRs.value = stored;
    console.log('Loaded GitHub PRs from storage');
  } catch (error) {
    console.error('Error loading GitHub PRs:', error);
  }
}

/**
 * Load calendar token from chrome.storage
 */
export async function loadCalendarToken() {
  try {
    const token = await getCalendarToken();
    calendarToken.value = token;
    console.log('Loaded calendar token from storage');
  } catch (error) {
    console.error('Error loading calendar token:', error);
  }
}

/**
 * Load calendar events from chrome.storage
 */
export async function loadCalendarEvents() {
  try {
    const events = await getCalendarEvents();
    calendarEvents.value = events;
    console.log('Loaded', events.length, 'calendar events from storage');
  } catch (error) {
    console.error('Error loading calendar events:', error);
  }
}

/**
 * Sync all data from chrome.storage
 * This loads all cached data that the background script maintains
 */
export async function syncAllData() {
  console.log('Loading all data from storage...');

  await Promise.all([
    loadTasks(),
    loadThoughts(),
    loadLinearIssues(),
    loadGitHubPRs(),
    loadCalendarToken(),
    loadCalendarEvents(),
  ]);

  console.log('All data loaded from storage');
}

/**
 * Request background script to sync data immediately
 * This triggers the background script to fetch fresh data from APIs
 */
export async function requestBackgroundSync() {
  try {
    // Send message to background script to trigger sync
    await chrome.runtime.sendMessage({ action: 'syncNow' });
    console.log('Background sync requested');
  } catch (error) {
    console.error('Failed to request background sync:', error);
  }
}

/**
 * Sync calendar data only
 * @deprecated Use requestBackgroundSync() instead
 */
export async function syncCalendar() {
  await requestBackgroundSync();
}

/**
 * Sync Linear issues only
 * @deprecated Use requestBackgroundSync() instead
 */
export async function syncLinear() {
  await requestBackgroundSync();
}

/**
 * Check if GitHub is connected
 */
export function isGitHubConnected(): boolean {
  return !!(settings.value.githubToken && settings.value.githubToken.length > 0);
}

/**
 * Sync GitHub pull requests only
 * @deprecated Use requestBackgroundSync() instead
 */
export async function syncGitHub() {
  await requestBackgroundSync();
}
