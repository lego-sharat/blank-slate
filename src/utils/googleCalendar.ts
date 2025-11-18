import { calendarEvents, calendarToken, saveCalendarEvents } from '@/store/store';
// @ts-ignore
import { getGoogleAccessToken, refreshGoogleToken } from '@/supabase';
import type { CalendarEvent } from '@/types';

// Fetch calendar events from Google Calendar API with automatic token refresh
export async function fetchCalendarEvents(): Promise<void> {
  const maxRetries = 2;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Get Google token from Supabase session
      const token = await getGoogleAccessToken();

      if (!token) {
        console.warn('No calendar token available');
        return;
      }

      console.log(`Fetching calendar events (attempt ${attempt + 1})...`);

      // Get events for the next 7 days
      const now = new Date();
      const timeMin = now.toISOString();
      const timeMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
        `timeMin=${encodeURIComponent(timeMin)}` +
        `&timeMax=${encodeURIComponent(timeMax)}` +
        `&singleEvents=true` +
        `&orderBy=startTime` +
        `&maxResults=50`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const events: CalendarEvent[] = data.items || [];

        calendarEvents.value = events;
        saveCalendarEvents();
        console.log(`Fetched ${events.length} calendar events`);
        return;
      }

      // Handle 401 - token expired
      if (response.status === 401 && attempt < maxRetries - 1) {
        console.warn('Calendar token expired (401), attempting refresh...');

        // Try to refresh the token
        const newToken = await refreshGoogleToken();

        if (!newToken) {
          throw new Error('Failed to refresh calendar token. Please re-authenticate.');
        }

        console.log('Token refreshed successfully, retrying request...');
        // Continue to next iteration to retry with new token
        continue;
      }

      throw new Error(`Failed to fetch events: ${response.status} ${response.statusText}`);

    } catch (error) {
      // If this was our last attempt, throw the error
      if (attempt === maxRetries - 1) {
        console.error('Error fetching calendar events:', error);
        throw error;
      }

      // Otherwise, log and continue to retry
      console.error(`Error on attempt ${attempt + 1}:`, error);
    }
  }
}

// Check if user is authenticated
export function isCalendarConnected(): boolean {
  return !!calendarToken.value;
}

// Auto-sync calendar events periodically
export function startCalendarSync(intervalMinutes: number = 15) {
  if (!isCalendarConnected()) {
    console.log('Calendar not connected, skipping sync');
    return;
  }

  // Initial fetch
  fetchCalendarEvents().catch(console.error);

  // Set up periodic sync
  const intervalMs = intervalMinutes * 60 * 1000;
  return setInterval(() => {
    if (isCalendarConnected()) {
      fetchCalendarEvents().catch(console.error);
    }
  }, intervalMs);
}
