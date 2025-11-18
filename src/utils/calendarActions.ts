/**
 * Fetch today's calendar events from Google Calendar API
 * Background-safe version - does not import store
 * Note: This function doesn't handle token refresh automatically.
 * For automatic token refresh, use fetchCalendarEventsWithRetry from calendarTokenRefresh.ts
 */
export async function fetchTodayEvents(token: string) {
  if (!token) return [];

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
      if (response.status === 401) {
        console.warn('[Calendar Actions] Token expired (401). Please use fetchCalendarEventsWithRetry for automatic refresh.');
      }
      throw new Error(`Failed to fetch calendar events: ${response.status}`);
    }

    const data = await response.json();
    const eventsList = data.items || [];

    return eventsList;
  } catch (err) {
    console.error('Error fetching calendar events:', err);
    return [];
  }
}

/**
 * UI-safe version that updates the store
 * Only use this from the UI context, not background
 */
export async function fetchAndSaveCalendarEvents(token: string) {
  const events = await fetchTodayEvents(token);

  // Dynamically import store to avoid loading it in background context
  const { calendarEvents, saveCalendarEvents } = await import('@/store/store');
  calendarEvents.value = events;
  saveCalendarEvents();

  return events;
}
