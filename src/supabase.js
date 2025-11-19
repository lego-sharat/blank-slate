import { createClient } from '@supabase/supabase-js';

// Configuration - Users need to set these in Settings
let supabaseClient = null;
let supabaseUrl = null;

/**
 * Initialize Supabase client with user's credentials
 */
export function initSupabase(url, supabaseKey) {
  if (!url || !supabaseKey) {
    console.error('Supabase credentials are required');
    return null;
  }

  try {
    supabaseUrl = url; // Store URL for edge function calls
    supabaseClient = createClient(url, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        storage: {
          getItem: async (key) => {
            const result = await chrome.storage.local.get(key);
            return result[key] || null;
          },
          setItem: async (key, value) => {
            await chrome.storage.local.set({ [key]: value });
          },
          removeItem: async (key) => {
            await chrome.storage.local.remove(key);
          }
        }
      },
      realtime: {
        // Disable Realtime to prevent DOM errors in service worker
        params: {
          eventsPerSecond: -1
        }
      }
    });

    // Set up auth state change listener
    supabaseClient.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);

      // Only dispatch events if window exists (not in service worker context)
      if (typeof window !== 'undefined') {
        if (event === 'SIGNED_IN') {
          // User signed in successfully
          window.dispatchEvent(new CustomEvent('supabase-auth-changed', {
            detail: { event, session }
          }));
        } else if (event === 'SIGNED_OUT') {
          // User signed out
          window.dispatchEvent(new CustomEvent('supabase-auth-changed', {
            detail: { event, session: null }
          }));
        }
      }

      if (event === 'TOKEN_REFRESHED') {
        // Token was refreshed automatically
        console.log('Auth token refreshed automatically');
      }
    });

    return supabaseClient;
  } catch (error) {
    console.error('Error initializing Supabase:', error);
    return null;
  }
}

/**
 * Get the current Supabase client instance
 */
export function getSupabase() {
  return supabaseClient;
}

/**
 * Sign in with Google OAuth using Supabase
 * Opens OAuth in a popup window and handles the callback
 */
export async function signInWithGoogle() {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized');
  }

  // Get the extension's callback URL
  const callbackUrl = chrome.runtime.getURL('auth-callback.html');

  console.log('Initiating OAuth with callback URL:', callbackUrl);

  // Use Supabase OAuth with popup flow
  // IMPORTANT: skipBrowserRedirect must be TRUE to prevent auto-redirect in current window
  const { data, error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl,
      skipBrowserRedirect: true, // Prevent auto-redirect, we'll open popup manually
      scopes: 'https://www.googleapis.com/auth/calendar.readonly',
      queryParams: {
        access_type: 'offline',
        prompt: 'consent'
      }
    }
  });

  if (error) throw error;

  console.log('OAuth URL generated:', data.url);

  // Return the OAuth URL to open in a popup
  return data;
}

/**
 * Process OAuth callback and establish session
 * @param {string} callbackUrl - The full callback URL with hash fragment
 */
export async function handleOAuthCallback(callbackUrl) {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized');
  }

  console.log('Processing OAuth callback...');

  // Parse the hash fragment to extract tokens
  const url = new URL(callbackUrl);
  const hash = url.hash.substring(1); // Remove the # symbol
  const params = new URLSearchParams(hash);

  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  const provider_token = params.get('provider_token');
  const provider_refresh_token = params.get('provider_refresh_token');

  if (!access_token || !refresh_token) {
    throw new Error('Missing tokens in callback URL');
  }

  console.log('Setting session with tokens from callback');

  // Set the session using the tokens from the callback
  const { data, error } = await supabaseClient.auth.setSession({
    access_token,
    refresh_token
  });

  if (error) {
    console.error('Error setting session:', error);
    throw error;
  }

  console.log('Session established successfully');

  // Store the provider tokens separately for Calendar API access
  if (provider_token) {
    console.log('Storing Google provider token');
    await chrome.storage.local.set({
      google_provider_token: {
        token: provider_token,
        refresh_token: provider_refresh_token || refresh_token,
        expires_in: 3600,
        timestamp: Date.now()
      }
    });
  }

  return data;
}

/**
 * Sign out the current user
 */
export async function signOut() {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized');
  }

  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
}

/**
 * Get the current user
 */
export async function getCurrentUser() {
  if (!supabaseClient) {
    return null;
  }

  const { data: { user } } = await supabaseClient.auth.getUser();
  return user;
}

/**
 * Get the current session
 */
export async function getSession() {
  if (!supabaseClient) {
    return null;
  }

  const { data: { session } } = await supabaseClient.auth.getSession();
  return session;
}

/**
 * Refresh the Google provider token using the refresh token
 */
export async function refreshGoogleToken() {
  console.log('refreshGoogleToken: Starting token refresh...');

  // Get the stored refresh token
  const result = await chrome.storage.local.get('google_provider_token');

  if (!result.google_provider_token || !result.google_provider_token.refresh_token) {
    console.error('refreshGoogleToken: No refresh token available');
    return null;
  }

  const { refresh_token } = result.google_provider_token;

  try {
    // First, try to refresh the Supabase session which might also refresh the provider token
    if (supabaseClient) {
      console.log('refreshGoogleToken: Attempting Supabase session refresh...');
      const { data, error } = await supabaseClient.auth.refreshSession();

      if (!error && data.session?.provider_token) {
        console.log('refreshGoogleToken: Got new provider_token from Supabase session refresh');

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

      console.log('refreshGoogleToken: Supabase session refresh did not return provider_token');
    }

    // Fallback: Try to use the Supabase Edge Function for token refresh
    if (supabaseUrl && supabaseClient) {
      console.log('refreshGoogleToken: Attempting token refresh via Edge Function...');

      const session = await getSession();
      if (!session) {
        console.error('refreshGoogleToken: No active session for Edge Function call');
        return null;
      }

      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/refresh-google-token`;

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: refresh_token
        })
      });

      if (response.ok) {
        const tokenData = await response.json();
        console.log('refreshGoogleToken: Successfully refreshed token via Edge Function');

        // Update stored token
        await chrome.storage.local.set({
          google_provider_token: {
            token: tokenData.access_token,
            refresh_token: refresh_token,
            expires_in: tokenData.expires_in || 3600,
            timestamp: Date.now()
          }
        });

        return tokenData.access_token;
      } else {
        const errorText = await response.text();
        console.error('refreshGoogleToken: Edge Function failed:', errorText);
      }
    }

    // If all methods failed, we need to re-authenticate
    console.warn('refreshGoogleToken: All refresh methods failed. User needs to re-authenticate.');
    return null;

  } catch (error) {
    console.error('refreshGoogleToken: Error refreshing token:', error);
    return null;
  }
}

/**
 * Get Google access token from the session for Calendar API
 * Automatically checks expiration and refreshes if needed
 */
export async function getGoogleAccessToken() {
  if (!supabaseClient) {
    console.log('getGoogleAccessToken: No supabase client');
    return null;
  }

  const session = await getSession();

  if (!session) {
    console.log('getGoogleAccessToken: No active session');
    return null;
  }

  // First try to get provider_token from Supabase session
  if (session.provider_token) {
    console.log('getGoogleAccessToken: Returning provider_token from session (length:', session.provider_token.length, ')');
    return session.provider_token;
  }

  // If not in session, try to get from chrome.storage (where we stored it separately)
  console.log('getGoogleAccessToken: No provider_token in session, checking chrome.storage...');
  const result = await chrome.storage.local.get('google_provider_token');

  if (result.google_provider_token && result.google_provider_token.token) {
    const tokenData = result.google_provider_token;
    const tokenAge = Date.now() - (tokenData.timestamp || 0);
    const expiresIn = (tokenData.expires_in || 3600) * 1000; // Convert to ms

    // Check if token is expired or about to expire (within 5 minutes)
    if (tokenAge >= expiresIn - 300000) {
      console.log('getGoogleAccessToken: Token expired or expiring soon, attempting refresh...');
      const newToken = await refreshGoogleToken();
      if (newToken) {
        console.log('getGoogleAccessToken: Token refreshed successfully');
        return newToken;
      } else {
        console.warn('getGoogleAccessToken: Token refresh failed, returning expired token');
        // Return the expired token anyway - the API call will fail with 401
        // and we'll trigger a re-authentication
        return tokenData.token;
      }
    }

    console.log('getGoogleAccessToken: Found valid provider_token in chrome.storage (length:', tokenData.token.length, ')');
    return tokenData.token;
  }

  console.warn('getGoogleAccessToken: No provider_token found anywhere');
  console.warn('Session data:', {
    user: session.user?.email,
    expires_at: session.expires_at,
    provider: session.user?.app_metadata?.provider
  });
  return null;
}

/**
 * Store user data (Notion credentials) in Supabase user metadata
 */
export async function updateUserData(data) {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized');
  }

  const { data: userData, error } = await supabaseClient.auth.updateUser({
    data: data
  });

  if (error) throw error;
  return userData;
}

/**
 * Get user data from Supabase user metadata
 */
export async function getUserData() {
  if (!supabaseClient) {
    return null;
  }

  const user = await getCurrentUser();
  return user?.user_metadata || null;
}
