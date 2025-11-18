/**
 * Calendar token refresh utilities for service worker context
 * Handles automatic token refresh when 401 errors occur
 */

interface GoogleProviderToken {
  token: string;
  refresh_token: string;
  expires_in: number;
  timestamp: number;
}

/**
 * Get Google provider token from chrome.storage
 */
async function getStoredGoogleToken(): Promise<GoogleProviderToken | null> {
  const result = await chrome.storage.local.get('google_provider_token');
  const tokenData = result.google_provider_token;

  // Type guard to ensure we have a valid token
  if (tokenData && typeof tokenData === 'object' && 'token' in tokenData && 'refresh_token' in tokenData) {
    return tokenData as GoogleProviderToken;
  }

  return null;
}

/**
 * Refresh the Google provider token using the refresh token
 * This is a service-worker-compatible version of the logic in supabase.js
 */
async function refreshGoogleTokenInBackground(): Promise<string | null> {
  console.log('[Calendar Token Refresh] Starting token refresh...');

  const tokenData = await getStoredGoogleToken();

  if (!tokenData || !tokenData.refresh_token) {
    console.error('[Calendar Token Refresh] No refresh token available');
    return null;
  }

  const { refresh_token } = tokenData;

  try {
    // Get Supabase client to refresh the session
    // @ts-ignore
    const { getSupabase } = await import('@/supabase');
    const supabaseClient = getSupabase();

    if (supabaseClient) {
      console.log('[Calendar Token Refresh] Attempting Supabase session refresh...');
      const { data, error } = await supabaseClient.auth.refreshSession();

      if (!error && data.session?.provider_token) {
        console.log('[Calendar Token Refresh] Got new provider_token from Supabase session refresh');

        // Update stored token
        await chrome.storage.local.set({
          google_provider_token: {
            token: data.session.provider_token,
            refresh_token: refresh_token,
            expires_in: 3600,
            timestamp: Date.now()
          }
        });

        return data.session.provider_token;
      }

      console.log('[Calendar Token Refresh] Supabase session refresh did not return provider_token');
    }

    // If Supabase refresh didn't work, we need to re-authenticate
    console.warn('[Calendar Token Refresh] Token refresh failed. User needs to re-authenticate.');
    return null;

  } catch (error) {
    console.error('[Calendar Token Refresh] Error refreshing token:', error);
    return null;
  }
}

/**
 * Get the current Google access token
 * Checks expiration and refreshes if needed
 */
export async function getGoogleAccessTokenForBackground(): Promise<string | null> {
  const tokenData = await getStoredGoogleToken();

  if (!tokenData || !tokenData.token) {
    console.log('[Calendar Token Refresh] No token found in storage');
    return null;
  }

  const tokenAge = Date.now() - (tokenData.timestamp || 0);
  const expiresIn = (tokenData.expires_in || 3600) * 1000; // Convert to ms

  // Check if token is expired or about to expire (within 5 minutes)
  if (tokenAge >= expiresIn - 300000) {
    console.log('[Calendar Token Refresh] Token expired or expiring soon, attempting refresh...');
    const newToken = await refreshGoogleTokenInBackground();
    if (newToken) {
      console.log('[Calendar Token Refresh] Token refreshed successfully');
      return newToken;
    } else {
      console.warn('[Calendar Token Refresh] Token refresh failed, returning expired token');
      // Return the expired token anyway - the API call will fail with 401
      // and we'll trigger a re-authentication
      return tokenData.token;
    }
  }

  return tokenData.token;
}

/**
 * Fetch calendar events with automatic token refresh on 401 errors
 * Service worker compatible
 */
export async function fetchCalendarEventsWithRetry() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const url =
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
    `timeMin=${startOfDay.toISOString()}&` +
    `timeMax=${endOfDay.toISOString()}&` +
    `singleEvents=true&` +
    `orderBy=startTime&` +
    `maxResults=50`;

  // Try up to 2 times (initial attempt + 1 retry with refreshed token)
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getGoogleAccessTokenForBackground();

    if (!token) {
      console.log('[Calendar Fetch] No calendar token available');
      return null;
    }

    try {
      console.log(`[Calendar Fetch] Fetching calendar events (attempt ${attempt + 1})...`);

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const events = data.items || [];
        console.log(`[Calendar Fetch] Successfully fetched ${events.length} events`);
        return events;
      }

      // Handle 401 - token expired
      if (response.status === 401 && attempt === 0) {
        console.warn('[Calendar Fetch] Got 401, attempting token refresh...');

        // Force refresh the token
        const newToken = await refreshGoogleTokenInBackground();

        if (!newToken) {
          console.error('[Calendar Fetch] Token refresh failed, cannot retry');
          throw new Error('Calendar token expired and refresh failed. Please re-authenticate.');
        }

        console.log('[Calendar Fetch] Token refreshed, retrying request...');
        // Continue to next iteration to retry with new token
        continue;
      }

      // Other error
      throw new Error(`Failed to fetch calendar events: ${response.status} ${response.statusText}`);

    } catch (error) {
      // If this was our last attempt or not a 401 error, throw
      if (attempt === 1) {
        throw error;
      }

      // Otherwise, log and continue to retry
      console.error('[Calendar Fetch] Error on attempt', attempt + 1, ':', error);
    }
  }

  // Should not reach here, but just in case
  throw new Error('Failed to fetch calendar events after retries');
}
