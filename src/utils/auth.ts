import { currentUser, isAuthenticated, calendarToken, saveCalendarToken } from '@/store/store';
// @ts-ignore
import { initSupabase, signInWithGoogle, signOut as supabaseSignOut, getCurrentUser, getGoogleAccessToken, handleOAuthCallback } from '@/supabase';

// Default Supabase credentials (user can change in settings)
const DEFAULT_SUPABASE_URL = 'https://your-project.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'your-anon-key';

/**
 * Initialize authentication system
 */
export async function initAuth() {
  console.log('Initializing auth...');

  // Get Supabase credentials from localStorage or use defaults
  const supabaseUrl = localStorage.getItem('supabase_url') || DEFAULT_SUPABASE_URL;
  const supabaseKey = localStorage.getItem('supabase_anon_key') || DEFAULT_SUPABASE_ANON_KEY;

  // Initialize Supabase client
  const client = initSupabase(supabaseUrl, supabaseKey);

  if (!client) {
    console.error('Failed to initialize Supabase client');
    return;
  }

  // Check for existing session
  try {
    const user = await getCurrentUser();
    if (user) {
      currentUser.value = user;
      isAuthenticated.value = true;
      console.log('User authenticated:', user.email);

      // Get Google calendar token if available
      const token = await getGoogleAccessToken();
      if (token) {
        calendarToken.value = token;
        saveCalendarToken();
      }
    }
  } catch (error) {
    console.error('Error checking auth state:', error);
  }

  // Listen for auth state changes
  window.addEventListener('supabase-auth-changed', async (event: any) => {
    const { session } = event.detail;

    if (session && session.user) {
      currentUser.value = session.user;
      isAuthenticated.value = true;

      // Get Google calendar token
      const token = await getGoogleAccessToken();
      if (token) {
        calendarToken.value = token;
        saveCalendarToken();
      }
    } else {
      currentUser.value = null;
      isAuthenticated.value = false;
      calendarToken.value = null;
      saveCalendarToken();
    }
  });
}

/**
 * Sign in with Google and request calendar permissions
 */
export async function signIn() {
  try {
    console.log('Starting Google sign in...');
    const { url } = await signInWithGoogle();

    if (!url) {
      throw new Error('No OAuth URL returned');
    }

    // Open OAuth in a popup window
    const width = 500;
    const height = 600;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;

    const popup = window.open(
      url,
      'Google Sign In',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (!popup) {
      throw new Error('Failed to open popup window');
    }

    // Helper to safely close popup (COOP may block access to popup.closed)
    const safeClosePopup = () => {
      try {
        if (popup && !popup.closed) {
          popup.close();
        }
      } catch (e) {
        // COOP may block access to popup.closed, just try to close it
        try {
          popup?.close();
        } catch (closeError) {
          // Popup already closed or can't be closed
        }
      }
    };

    // Wait for the callback
    return new Promise((resolve, reject) => {
      // Listen for storage changes from the auth callback
      const checkAuth = setInterval(async () => {
        try {
          const result = await chrome.storage.local.get('supabase_auth_callback');
          if (result.supabase_auth_callback) {
            clearInterval(checkAuth);

            const callbackData = result.supabase_auth_callback as { callback_url: string; hash: string; timestamp: number };

            // Clear the callback data
            await chrome.storage.local.remove('supabase_auth_callback');

            // Close popup if still open
            safeClosePopup();

            // Process the OAuth callback to establish session
            console.log('Processing OAuth callback...');
            await handleOAuthCallback(callbackData.callback_url);

            // Get the user after session is established
            const user = await getCurrentUser();
            if (user) {
              currentUser.value = user;
              isAuthenticated.value = true;

              // Get calendar token
              const token = await getGoogleAccessToken();
              if (token) {
                calendarToken.value = token;
                saveCalendarToken();
              }

              resolve(user);
            } else {
              reject(new Error('Authentication failed'));
            }
          }
        } catch (error) {
          clearInterval(checkAuth);
          reject(error);
        }
      }, 500);

      // Timeout after 2 minutes
      setTimeout(() => {
        clearInterval(checkAuth);
        safeClosePopup();
        reject(new Error('Authentication timeout'));
      }, 120000);
    });
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  }
}

/**
 * Sign out the current user
 */
export async function signOut() {
  try {
    await supabaseSignOut();
    currentUser.value = null;
    isAuthenticated.value = false;
    calendarToken.value = null;
    saveCalendarToken();
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
}

/**
 * Get user's display name
 */
export function getUserDisplayName(): string {
  if (!currentUser.value) return '';

  const user = currentUser.value;

  // Try user_metadata.full_name first
  if (user.user_metadata?.full_name) {
    return user.user_metadata.full_name;
  }

  // Try user_metadata.name
  if (user.user_metadata?.name) {
    return user.user_metadata.name;
  }

  // Fall back to email prefix
  if (user.email) {
    return user.email.split('@')[0];
  }

  return 'User';
}

/**
 * Get user's initials for avatar
 */
export function getUserInitials(): string {
  const displayName = getUserDisplayName();

  if (!displayName) return 'U';

  // Get first letter of first word
  const words = displayName.trim().split(' ');
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }

  // Get first letter of first and last word
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

/**
 * Get user's email
 */
export function getUserEmail(): string {
  return currentUser.value?.email || '';
}
