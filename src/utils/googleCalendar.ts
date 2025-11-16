import { calendarEvents, calendarToken, saveCalendarEvents, saveCalendarToken } from '@/store/store';
import type { CalendarEvent } from '@/types';

// Google Calendar API configuration
const CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com'; // Replace with actual client ID
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

// OAuth2 authentication using Chrome Identity API
export async function authenticateWithGoogle(): Promise<boolean> {
  try {
    console.log('Starting Google Calendar authentication...');

    const redirectUrl = chrome.identity.getRedirectURL('oauth2');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${CLIENT_ID}` +
      `&response_type=token` +
      `&redirect_uri=${encodeURIComponent(redirectUrl)}` +
      `&scope=${encodeURIComponent(SCOPES.join(' '))}`;

    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        {
          url: authUrl,
          interactive: true,
        },
        (redirectUrl) => {
          if (chrome.runtime.lastError) {
            console.error('Auth error:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
            return;
          }

          if (!redirectUrl) {
            reject(new Error('No redirect URL received'));
            return;
          }

          // Extract access token from redirect URL
          const url = new URL(redirectUrl);
          const hash = url.hash.substring(1);
          const params = new URLSearchParams(hash);
          const accessToken = params.get('access_token');

          if (accessToken) {
            calendarToken.value = accessToken;
            saveCalendarToken();
            console.log('Google Calendar authenticated successfully');
            resolve(true);
          } else {
            reject(new Error('No access token in response'));
          }
        }
      );
    });
  } catch (error) {
    console.error('Authentication error:', error);
    return false;
  }
}

// Disconnect Google Calendar
export function disconnectGoogleCalendar() {
  calendarToken.value = null;
  calendarEvents.value = [];
  saveCalendarToken();
  saveCalendarEvents();
  console.log('Google Calendar disconnected');
}

// Fetch calendar events from Google Calendar API
export async function fetchCalendarEvents(): Promise<void> {
  if (!calendarToken.value) {
    console.warn('No calendar token available');
    return;
  }

  try {
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
          Authorization: `Bearer ${calendarToken.value}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, clear it
        console.warn('Calendar token expired');
        calendarToken.value = null;
        saveCalendarToken();
        throw new Error('Authentication expired. Please reconnect your calendar.');
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
