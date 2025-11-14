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
 * Sign in with Google OAuth using Chrome Identity API
 * This works properly in Chrome extensions and provides Calendar access
 */
export async function signInWithGoogle(googleClientId) {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized');
  }

  if (!googleClientId) {
    throw new Error('Google Client ID is required');
  }

  // Build OAuth URL for Chrome identity flow
  const redirectURL = chrome.identity.getRedirectURL();
  const scopes = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/calendar.readonly'
  ];

  const authURL = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authURL.searchParams.set('client_id', googleClientId);
  authURL.searchParams.set('response_type', 'token id_token');
  authURL.searchParams.set('redirect_uri', redirectURL);
  authURL.searchParams.set('scope', scopes.join(' '));
  authURL.searchParams.set('access_type', 'offline');
  authURL.searchParams.set('prompt', 'consent');

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      {
        url: authURL.toString(),
        interactive: true
      },
      async (responseURL) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!responseURL) {
          reject(new Error('No response from OAuth flow'));
          return;
        }

        try {
          // Parse the response URL to get tokens
          const url = new URL(responseURL);
          const hash = url.hash.substring(1);
          const params = new URLSearchParams(hash);

          const accessToken = params.get('access_token');
          const idToken = params.get('id_token');
          const expiresIn = parseInt(params.get('expires_in') || '3600');

          if (!accessToken || !idToken) {
            reject(new Error('Failed to get tokens from OAuth response'));
            return;
          }

          // Sign in to Supabase using the Google ID token
          const { data, error } = await supabaseClient.auth.signInWithIdToken({
            provider: 'google',
            token: idToken,
            access_token: accessToken
          });

          if (error) {
            reject(error);
            return;
          }

          resolve({
            user: data.user,
            session: data.session,
            accessToken: accessToken,
            expiresIn: expiresIn
          });
        } catch (error) {
          reject(error);
        }
      }
    );
  });
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
