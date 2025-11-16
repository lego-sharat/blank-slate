import { calendarEvents, saveCalendarEvents } from '@/store/store';

/**
 * Fetch today's calendar events from Google Calendar API
 */
export async function fetchTodayEvents(token: string) {
  if (!token) return;

  try {
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
      throw new Error('Failed to fetch calendar events');
    }

    const data = await response.json();
    const eventsList = data.items || [];

    calendarEvents.value = eventsList;
    saveCalendarEvents();

    return eventsList;
  } catch (err) {
    console.error('Error fetching calendar events:', err);
    return [];
  }
}
