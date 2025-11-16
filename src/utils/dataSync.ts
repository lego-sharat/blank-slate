import { calendarToken, todos, notes, STORAGE_KEYS, saveTodos, saveNotes } from '@/store/store';
import { fetchTodayEvents } from '@/utils/calendarActions';

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
