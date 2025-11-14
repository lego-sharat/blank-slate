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

  // Use Supabase OAuth with popup flow
  const { data, error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      skipBrowserRedirect: false,
      scopes: 'https://www.googleapis.com/auth/calendar.readonly',
      queryParams: {
        access_type: 'offline',
        prompt: 'consent'
      }
    }
  });

  if (error) throw error;

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
    return null;
  }

  const session = await getSession();
  return session?.provider_token || null;
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
