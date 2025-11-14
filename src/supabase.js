import { createClient } from '@supabase/supabase-js';

// Configuration - Users need to set these in Settings
let supabaseClient = null;

/**
 * Initialize Supabase client with user's credentials
 */
export function initSupabase(supabaseUrl, supabaseKey) {
  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase credentials are required');
    return null;
  }

  try {
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        storage: {
          getItem: (key) => {
            return localStorage.getItem(key);
          },
          setItem: (key, value) => {
            localStorage.setItem(key, value);
          },
          removeItem: (key) => {
            localStorage.removeItem(key);
          }
        }
      }
    });

    // Set up auth state change listener
    supabaseClient.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);

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
      } else if (event === 'TOKEN_REFRESHED') {
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
 * Get Google access token from the session for Calendar API
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
    console.log('getGoogleAccessToken: Found provider_token in chrome.storage (length:', result.google_provider_token.token.length, ')');
    return result.google_provider_token.token;
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
