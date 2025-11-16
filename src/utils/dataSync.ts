import { calendarToken } from '@/store/store';
import { fetchTodayEvents } from '@/utils/calendarActions';

/**
 * Sync all data from external sources
 * This is the central place for fetching data from APIs, databases, etc.
 */
export async function syncAllData() {
  console.log('Syncing all data...');

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
