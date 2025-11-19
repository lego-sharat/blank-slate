/**
 * Thread-Focused Mail Sync
 *
 * Syncs mail threads from Supabase mail_threads table
 * Uses shared Supabase client (configured for service workers)
 */

// @ts-ignore
import { getSupabase as getSupabaseClient } from '@/supabase';

export interface MailThread {
  id: string
  user_id: string
  gmail_thread_id: string
  subject: string
  participants: Array<{ name: string; email: string }>
  category: 'onboarding' | 'support' | 'general'

  // Gmail labels vs AI labels
  gmail_labels: string[] // INBOX, UNREAD, DTC, etc.
  ai_labels: string[] // customer-support, high-priority, cold-email, etc.

  // AI-generated fields
  ai_topic?: string
  integration_name?: string
  summary?: string
  action_items?: Array<{
    description: string
    dueDate?: string
    priority?: 'high' | 'medium' | 'low'
  }>
  satisfaction_score?: number
  satisfaction_analysis?: string

  // Thread stats
  message_count: number
  is_unread: boolean
  has_attachments: boolean

  // Timestamps
  first_message_date: string
  last_message_date: string
  created_at: string
  last_synced_at: string
  summary_generated_at?: string
}

/**
 * Fetch threads from Supabase (last 30 days to keep cache reasonable)
 */
export async function syncThreadsFromSupabase(): Promise<{
  all: MailThread[]
  onboarding: MailThread[]
  support: MailThread[]
}> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.log('[Mail Threads] Supabase client not initialized');
    return { all: [], onboarding: [], support: [] };
  }

  try {
    console.log('[Mail Threads] Fetching threads from Supabase...');

    // Fetch threads from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: threads, error } = await supabase
      .from('mail_threads')
      .select('*')
      .gte('last_message_date', thirtyDaysAgo.toISOString())
      .order('last_message_date', { ascending: false })
      .limit(200); // Limit to most recent 200 threads

    if (error) {
      console.error('[Mail Threads] Error fetching threads:', error);
      return { all: [], onboarding: [], support: [] };
    }

    if (!threads || threads.length === 0) {
      console.log('[Mail Threads] No threads found');
      return { all: [], onboarding: [], support: [] };
    }

    console.log(`[Mail Threads] Fetched ${threads.length} threads`);

    // Categorize threads
    const all = threads as MailThread[];
    const onboarding = all.filter(t => t.category === 'onboarding');
    const support = all.filter(t => t.category === 'support');

    return { all, onboarding, support };
  } catch (error) {
    console.error('[Mail Threads] Unexpected error:', error);
    return { all: [], onboarding: [], support: [] };
  }
}

/**
 * Check Gmail OAuth connection status
 */
export async function checkGmailConnection(): Promise<{
  connected: boolean
  email?: string
  lastSync?: string
}> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { connected: false };
  }

  try {
    // Check if user has Gmail OAuth token
    const { data: token, error } = await supabase
      .from('oauth_tokens')
      .select('provider, updated_at')
      .eq('provider', 'gmail')
      .maybeSingle();

    if (error || !token) {
      return { connected: false };
    }

    return {
      connected: true,
      lastSync: token.updated_at,
    };
  } catch (error) {
    console.error('[Mail Threads] Error checking connection:', error);
    return { connected: false };
  }
}

/**
 * Mark thread as read/unread
 */
export async function markThreadAsRead(threadId: string, isRead: boolean): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return false;
  }

  try {
    const { error } = await supabase
      .from('mail_threads')
      .update({ is_unread: !isRead })
      .eq('id', threadId);

    if (error) {
      console.error('[Mail Threads] Error updating thread:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Mail Threads] Unexpected error:', error);
    return false;
  }
}

/**
 * Initiate Gmail OAuth flow
 */
export async function initiateGmailOAuth(): Promise<{
  success: boolean
  oauthUrl?: string
  error?: string
}> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    // Get current user session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    // Call gmail-oauth-init Edge Function
    const { data, error } = await supabase.functions.invoke('gmail-oauth-init', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      console.error('[OAuth] Error initiating OAuth:', error);
      return { success: false, error: error.message };
    }

    if (!data.success || !data.oauthUrl) {
      return { success: false, error: 'Failed to generate OAuth URL' };
    }

    return { success: true, oauthUrl: data.oauthUrl };
  } catch (error) {
    console.error('[OAuth] Unexpected error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Disconnect Gmail (remove OAuth tokens)
 */
export async function disconnectGmail(): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { error } = await supabase.from('oauth_tokens').delete().eq('provider', 'gmail');

    if (error) {
      console.error('[OAuth] Error disconnecting Gmail:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('[OAuth] Unexpected error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
