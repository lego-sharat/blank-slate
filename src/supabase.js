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
 * Sign up a new user with email and password
 */
export async function signUp(email, password) {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized');
  }

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

/**
 * Sign in an existing user with email and password
 */
export async function signIn(email, password) {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized');
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
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
 * Store user tokens (Google Calendar, Notion) in Supabase user metadata
 */
export async function updateUserTokens(tokens) {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized');
  }

  const { data, error } = await supabaseClient.auth.updateUser({
    data: {
      tokens: tokens
    }
  });

  if (error) throw error;
  return data;
}

/**
 * Get user tokens from Supabase user metadata
 */
export async function getUserTokens() {
  if (!supabaseClient) {
    return null;
  }

  const user = await getCurrentUser();
  return user?.user_metadata?.tokens || null;
}
