/**
 * Supabase Mail Sync Utility
 *
 * Fetches mail data from Supabase and syncs to IndexedDB cache.
 * This replaces the old client-side Gmail API fetching.
 */

import { getSupabaseClient } from './supabaseClient'
import {
  saveMessagesToCache,
  saveSummariesToCache,
  saveActionItemsToCache,
  getMessagesFromCache,
  type MailMessageDB,
  type MailSummaryDB,
  type MailActionItemDB,
} from './mailIndexedDB'

/**
 * Fetch all mail messages from Supabase and cache locally
 */
export async function syncMailFromSupabase(): Promise<{
  all: MailMessageDB[]
  onboarding: MailMessageDB[]
  support: MailMessageDB[]
}> {
  try {
    const supabase = getSupabaseClient()

    if (!supabase) {
      console.log('Supabase not configured, loading from cache only')
      return await getMailFromCache()
    }

    console.log('[Mail Sync] Fetching messages from Supabase...')

    // Fetch messages (last 30 days to keep cache size reasonable)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: messages, error: messagesError } = await supabase
      .from('mail_messages')
      .select('*')
      .gte('date', thirtyDaysAgo.toISOString())
      .order('date', { ascending: false })

    if (messagesError) {
      console.error('[Mail Sync] Error fetching messages:', messagesError)
      // Fall back to cache on error
      return await getMailFromCache()
    }

    if (!messages || messages.length === 0) {
      console.log('[Mail Sync] No messages found in Supabase')
      return { all: [], onboarding: [], support: [] }
    }

    console.log(`[Mail Sync] Fetched ${messages.length} messages from Supabase`)

    // Cache messages in IndexedDB
    await saveMessagesToCache(messages as MailMessageDB[])

    // Fetch summaries for these messages
    const messageIds = messages.map((msg) => msg.id)
    const { data: summaries, error: summariesError } = await supabase
      .from('mail_summaries')
      .select('*')
      .in('message_id', messageIds)

    if (!summariesError && summaries && summaries.length > 0) {
      await saveSummariesToCache(summaries as MailSummaryDB[])
      console.log(`[Mail Sync] Cached ${summaries.length} summaries`)
    }

    // Fetch action items
    const { data: actionItems, error: actionItemsError } = await supabase
      .from('mail_action_items')
      .select('*')
      .in('message_id', messageIds)

    if (!actionItemsError && actionItems && actionItems.length > 0) {
      await saveActionItemsToCache(actionItems as MailActionItemDB[])
      console.log(`[Mail Sync] Cached ${actionItems.length} action items`)
    }

    // Categorize messages
    return categorizeMessages(messages as MailMessageDB[])
  } catch (error) {
    console.error('[Mail Sync] Unexpected error:', error)
    // Fall back to cache on error
    return await getMailFromCache()
  }
}

/**
 * Get mail from cache (fallback when Supabase is unavailable)
 */
async function getMailFromCache(): Promise<{
  all: MailMessageDB[]
  onboarding: MailMessageDB[]
  support: MailMessageDB[]
}> {
  try {
    const all = await getMessagesFromCache()
    return categorizeMessages(all)
  } catch (error) {
    console.error('[Mail Sync] Error loading from cache:', error)
    return { all: [], onboarding: [], support: [] }
  }
}

/**
 * Categorize messages into all/onboarding/support
 */
function categorizeMessages(messages: MailMessageDB[]): {
  all: MailMessageDB[]
  onboarding: MailMessageDB[]
  support: MailMessageDB[]
} {
  return {
    all: messages,
    onboarding: messages.filter((msg) => msg.category === 'onboarding'),
    support: messages.filter((msg) => msg.category === 'support'),
  }
}

/**
 * Check OAuth connection status
 */
export async function checkGmailConnection(): Promise<{
  connected: boolean
  email?: string
  lastSync?: string
}> {
  try {
    const supabase = getSupabaseClient()

    if (!supabase) {
      return { connected: false }
    }

    const { data: token, error } = await supabase
      .from('oauth_tokens')
      .select('provider, updated_at')
      .eq('provider', 'gmail')
      .single()

    if (error || !token) {
      return { connected: false }
    }

    return {
      connected: true,
      lastSync: token.updated_at,
    }
  } catch (error) {
    console.error('[Mail Sync] Error checking connection:', error)
    return { connected: false }
  }
}

/**
 * Initiate Gmail OAuth flow
 * Calls the gmail-oauth-init Edge Function
 */
export async function initiateGmailOAuth(): Promise<{ success: boolean; oauthUrl?: string; error?: string }> {
  try {
    const supabase = getSupabaseClient()

    if (!supabase) {
      return { success: false, error: 'Supabase not configured' }
    }

    // Get current user session
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return { success: false, error: 'Not authenticated' }
    }

    // Call gmail-oauth-init Edge Function
    const { data, error } = await supabase.functions.invoke('gmail-oauth-init', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })

    if (error) {
      console.error('[OAuth] Error initiating OAuth:', error)
      return { success: false, error: error.message }
    }

    if (!data.success || !data.oauthUrl) {
      return { success: false, error: 'Failed to generate OAuth URL' }
    }

    return { success: true, oauthUrl: data.oauthUrl }
  } catch (error) {
    console.error('[OAuth] Unexpected error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Disconnect Gmail (remove OAuth tokens)
 */
export async function disconnectGmail(): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseClient()

    if (!supabase) {
      return { success: false, error: 'Supabase not configured' }
    }

    const { error } = await supabase.from('oauth_tokens').delete().eq('provider', 'gmail')

    if (error) {
      console.error('[OAuth] Error disconnecting Gmail:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('[OAuth] Unexpected error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Mark message as read/unread in Supabase
 */
export async function markMessageAsRead(messageId: string, isRead: boolean): Promise<boolean> {
  try {
    const supabase = getSupabaseClient()

    if (!supabase) {
      console.error('[Mail] Supabase not configured')
      return false
    }

    const { error } = await supabase
      .from('mail_messages')
      .update({ is_unread: !isRead, updated_at: new Date().toISOString() })
      .eq('id', messageId)

    if (error) {
      console.error('[Mail] Error updating message:', error)
      return false
    }

    // Also update in IndexedDB cache
    const { getMessageFromCache, saveMessagesToCache } = await import('./mailIndexedDB')
    const message = await getMessageFromCache(messageId)
    if (message) {
      message.is_unread = !isRead
      message.updated_at = new Date().toISOString()
      await saveMessagesToCache([message])
    }

    return true
  } catch (error) {
    console.error('[Mail] Unexpected error:', error)
    return false
  }
}

/**
 * Complete an action item in Supabase
 */
export async function completeActionItemInSupabase(itemId: string, isCompleted: boolean): Promise<boolean> {
  try {
    const supabase = getSupabaseClient()

    if (!supabase) {
      console.error('[Mail] Supabase not configured')
      return false
    }

    const { error } = await supabase
      .from('mail_action_items')
      .update({
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null,
      })
      .eq('id', itemId)

    if (error) {
      console.error('[Mail] Error updating action item:', error)
      return false
    }

    // Also update in IndexedDB cache
    const { completeActionItem } = await import('./mailIndexedDB')
    if (isCompleted) {
      await completeActionItem(itemId)
    }

    return true
  } catch (error) {
    console.error('[Mail] Unexpected error:', error)
    return false
  }
}
