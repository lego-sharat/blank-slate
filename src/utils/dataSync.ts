import { calendarToken, todos, notes, linearIssues, githubPRs, settings, STORAGE_KEYS } from '@/store/store';
import { fetchTodayEvents } from '@/utils/calendarActions';
import { fetchAllLinearIssues, isLinearConnected } from '@/utils/linearApi';
import { fetchAllGitHubPRs } from '@/utils/githubApi';

/**
 * Load tasks from localStorage
 */
export function loadTasks() {
  try {
    const storedTodos = localStorage.getItem(STORAGE_KEYS.TODOS);
    if (storedTodos) {
      todos.value = JSON.parse(storedTodos);
      console.log('Loaded', todos.value.length, 'tasks from localStorage');
    }
  } catch (error) {
    console.error('Error loading tasks:', error);
  }
}

/**
 * Load notes from localStorage
 */
export function loadNotes() {
  try {
    const storedNotes = localStorage.getItem(STORAGE_KEYS.NOTES);
    if (storedNotes) {
      const parsed = JSON.parse(storedNotes);
      // Migrate old notes to include status field
      notes.value = parsed.map((note: any) => ({
        ...note,
        status: note.status || 'draft',
      }));
      console.log('Loaded', notes.value.length, 'notes from localStorage');
    }
  } catch (error) {
    console.error('Error loading notes:', error);
  }
}

/**
 * Sync all data from external sources and localStorage
 * This is the central place for loading all application data
 */
export async function syncAllData() {
  console.log('Syncing all data...');

  // Load local data synchronously
  loadTasks();
  loadNotes();

  const syncPromises: Promise<any>[] = [];

  // Sync calendar events if we have a token
  if (calendarToken.value) {
    syncPromises.push(
      fetchTodayEvents(calendarToken.value).catch(err => {
        console.error('Failed to sync calendar events:', err);
      })
    );
  }

  // Sync Linear issues if API key is configured
  if (isLinearConnected()) {
    syncPromises.push(
      syncLinear().catch(err => {
        console.error('Failed to sync Linear issues:', err);
      })
    );
  }

  // Sync GitHub PRs if token is configured
  if (isGitHubConnected()) {
    syncPromises.push(
      syncGitHub().catch(err => {
        console.error('Failed to sync GitHub PRs:', err);
      })
    );
  }

  // Add more data sync operations here as needed
  // Example:
  // syncPromises.push(fetchReadingList());
  // syncPromises.push(syncNotionNotes());

  await Promise.all(syncPromises);
  console.log('Data sync complete');
}

/**
 * Sync calendar data only
 */
export async function syncCalendar() {
  if (!calendarToken.value) {
    console.warn('Cannot sync calendar: no token available');
    return;
  }

  try {
    await fetchTodayEvents(calendarToken.value);
  } catch (err) {
    console.error('Failed to sync calendar:', err);
    throw err;
  }
}

/**
 * Sync Linear issues only
 */
export async function syncLinear() {
  if (!isLinearConnected()) {
    console.warn('Cannot sync Linear: no API key configured');
    return;
  }

  try {
    const issues = await fetchAllLinearIssues();
    linearIssues.value = issues;
  } catch (err) {
    console.error('Failed to sync Linear issues:', err);
    throw err;
  }
}

/**
 * Check if GitHub is connected
 */
export function isGitHubConnected(): boolean {
  return !!(settings.value.githubToken && settings.value.githubToken.length > 0);
}

/**
 * Sync GitHub pull requests only
 */
export async function syncGitHub() {
  if (!isGitHubConnected()) {
    console.warn('Cannot sync GitHub: no token configured');
    return;
  }

  try {
    const prs = await fetchAllGitHubPRs(settings.value.githubToken);
    githubPRs.value = prs;
  } catch (err) {
    console.error('Failed to sync GitHub PRs:', err);
    throw err;
  }
}
