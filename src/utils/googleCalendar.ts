import { calendarEvents, calendarToken, saveCalendarEvents } from '@/store/store';
// @ts-ignore
import { getGoogleAccessToken } from '@/supabase';
import type { CalendarEvent } from '@/types';

// Fetch calendar events from Google Calendar API
export async function fetchCalendarEvents(): Promise<void> {
  try {
    // Get Google token from Supabase session
    const token = await getGoogleAccessToken();

    if (!token) {
      console.warn('No calendar token available');
      return;
    }

    console.log('Fetching calendar events...');

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

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired - Supabase will handle refresh
        console.warn('Calendar token expired, needs refresh');
        throw new Error('Authentication expired. Refreshing token...');
      }
      throw new Error(`Failed to fetch events: ${response.statusText}`);
    }

    const data = await response.json();
    const events: CalendarEvent[] = data.items || [];

    calendarEvents.value = events;
    saveCalendarEvents();
    console.log(`Fetched ${events.length} calendar events`);
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    throw error;
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
