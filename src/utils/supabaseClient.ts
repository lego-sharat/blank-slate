import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

/**
 * Initialize Supabase client with credentials from settings
 */
export function initSupabase(supabaseUrl: string, supabaseKey: string): SupabaseClient | null {
  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase URL or key not configured');
    return null;
  }

  try {
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        storage: {
          getItem: async (key: string): Promise<string | null> => {
            const result = await chrome.storage.local.get(key);
            return result[key] ? String(result[key]) : null;
          },
          setItem: async (key: string, value: string): Promise<void> => {
            await chrome.storage.local.set({ [key]: value });
          },
          removeItem: async (key: string): Promise<void> => {
            await chrome.storage.local.remove(key);
          }
        }
      }
    });
    console.log('Supabase client initialized');
    return supabaseClient;
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    return null;
  }
}

/**
 * Get the current Supabase client instance
 */
export function getSupabaseClient(): SupabaseClient | null {
  return supabaseClient;
}

/**
 * Check if Supabase is configured and ready
 */
export function isSupabaseConfigured(): boolean {
  return supabaseClient !== null;
}
