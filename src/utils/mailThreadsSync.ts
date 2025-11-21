/**
 * Thread-Focused Mail Sync (Background Worker Safe)
 *
 * Uses direct REST API calls to Supabase to avoid importing @supabase/supabase-js
 * which includes Realtime library with DOM dependencies
 */

interface Settings {
  supabaseUrl?: string;
  supabaseKey?: string;
}

export interface MailThread {
  id: string
  user_id: string
  gmail_thread_id: string
  subject: string
  participants: Array<{ name: string; email: string }>
  category: 'onboarding' | 'support' | 'general'

  // Status and escalation
  status?: 'active' | 'archived' | 'waiting' | 'resolved'
  is_escalation?: boolean
  escalation_reason?: string
  escalation_type?: 'customer' | 'team' | null
  escalated_at?: string

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

  // Customer metadata
  customer_name?: string
  customer_mrr?: number

  // Billing tracking
  is_billing?: boolean
  billing_status?: 'sent' | 'accepted' | 'pending' | null
  billing_sent_at?: string
  billing_accepted_at?: string

  // Participant tracking
  internal_participants?: string[]
  external_participants?: string[]

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
  archived_at?: string
}

/**
 * Get Supabase credentials from chrome.storage
 */
async function getSupabaseCredentials(): Promise<{ url: string; key: string } | null> {
  try {
    // Get the settings object from chrome.storage
    const result = await chrome.storage.local.get('settings')
    const settings = (result.settings || {}) as Settings

    if (!settings.supabaseUrl || !settings.supabaseKey ||
        typeof settings.supabaseUrl !== 'string' ||
        typeof settings.supabaseKey !== 'string') {
      console.log('[Mail Threads] Supabase not configured')
      return null
    }

    return {
      url: settings.supabaseUrl,
      key: settings.supabaseKey
    }
  } catch (error) {
    console.error('[Mail Threads] Error getting credentials:', error)
    return null
  }
}

/**
 * Get user session for authenticated requests
 */
async function getSession(): Promise<{ access_token: string } | null> {
  try {
    const result = await chrome.storage.local.get('supabaseSession')
    const session = result.supabaseSession as { access_token?: string } | undefined

    if (!session?.access_token) {
      console.log('[Mail Threads] No active session')
      return null
    }

    return session as { access_token: string }
  } catch (error) {
    console.error('[Mail Threads] Error getting session:', error)
    return null
  }
}

/**
 * Make direct REST API call to Supabase with user authentication
 */
async function supabaseFetch(
  url: string,
  apiKey: string,
  table: string,
  params: Record<string, string>
): Promise<any[]> {
  // Get user session for RLS authentication
  const session = await getSession()

  if (!session) {
    console.log('[Mail Threads] Cannot fetch data - user not authenticated')
    return []
  }

  const queryString = new URLSearchParams(params).toString()
  const apiUrl = `${url}/rest/v1/${table}?${queryString}`

  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'apikey': apiKey,
      'Authorization': `Bearer ${session.access_token}`, // Use user's access token for RLS
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  })

  if (!response.ok) {
    throw new Error(`Supabase API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

/**
 * Fetch threads from Supabase (last 30 days to keep cache reasonable)
 */
export async function syncThreadsFromSupabase(): Promise<{
  all: MailThread[]
  onboarding: MailThread[]
  support: MailThread[]
}> {
  try {
    const credentials = await getSupabaseCredentials()

    if (!credentials) {
      console.log('[Mail Threads] No Supabase credentials available')
      return { all: [], onboarding: [], support: [] }
    }

    console.log('[Mail Threads] Fetching threads from Supabase...')

    // Fetch threads from last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const threads = await supabaseFetch(
      credentials.url,
      credentials.key,
      'mail_threads',
      {
        'last_message_date': `gte.${thirtyDaysAgo.toISOString()}`,
        'status': 'eq.active', // Only fetch active threads (exclude archived)
        'order': 'last_message_date.desc',
        'limit': '200'
      }
    )

    const all = (threads || []) as MailThread[]
    const onboarding = all.filter(t => t.category === 'onboarding')
    const support = all.filter(t => t.category === 'support')

    console.log(`[Mail Threads] Fetched ${all.length} threads (${onboarding.length} onboarding, ${support.length} support)`)

    return { all, onboarding, support }
  } catch (error) {
    console.error('[Mail Threads] Failed to sync threads:', error)
    return { all: [], onboarding: [], support: [] }
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
  try {
    const credentials = await getSupabaseCredentials()

    if (!credentials) {
      return { connected: false }
    }

    const tokens = await supabaseFetch(
      credentials.url,
      credentials.key,
      'oauth_tokens',
      {
        'provider': 'eq.gmail',
        'limit': '1'
      }
    )

    if (!tokens || tokens.length === 0) {
      return { connected: false }
    }

    return {
      connected: true,
      lastSync: tokens[0].updated_at,
    }
  } catch (error) {
    console.error('[Mail Threads] Error checking connection:', error)
    return { connected: false }
  }
}

/**
 * Mark thread as read/unread
 */
export async function markThreadAsRead(threadId: string, isRead: boolean): Promise<boolean> {
  try {
    const credentials = await getSupabaseCredentials()

    if (!credentials) {
      return false
    }

    const session = await getSession()

    if (!session) {
      console.log('[Mail Threads] Cannot update thread - user not authenticated')
      return false
    }

    const filterString = new URLSearchParams({ 'id': `eq.${threadId}` }).toString()
    const apiUrl = `${credentials.url}/rest/v1/mail_threads?${filterString}`

    const response = await fetch(apiUrl, {
      method: 'PATCH',
      headers: {
        'apikey': credentials.key,
        'Authorization': `Bearer ${session.access_token}`, // Use user's access token for RLS
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ is_unread: !isRead })
    })

    if (!response.ok) {
      console.error('[Mail Threads] Error updating thread:', response.status)
      return false
    }

    return true
  } catch (error) {
    console.error('[Mail Threads] Error updating thread:', error)
    return false
  }
}

/**
 * Initiate Gmail OAuth flow
 * Note: Should be called from UI context, not background
 */
export async function initiateGmailOAuth(): Promise<{
  success: boolean
  oauthUrl?: string
  error?: string
}> {
  try {
    const credentials = await getSupabaseCredentials()

    if (!credentials) {
      return { success: false, error: 'Supabase not configured' }
    }

    // Get session from storage
    const result = await chrome.storage.local.get(['supabaseSession'])
    const session = result.supabaseSession as { access_token?: string } | undefined

    if (!session?.access_token) {
      return { success: false, error: 'Not authenticated' }
    }

    // Call Edge Function
    const response = await fetch(`${credentials.url}/functions/v1/gmail-oauth-init`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': credentials.key,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` }
    }

    const data = await response.json()

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
    const credentials = await getSupabaseCredentials()

    if (!credentials) {
      return { success: false, error: 'Supabase not configured' }
    }

    const session = await getSession()

    if (!session) {
      return { success: false, error: 'Not authenticated' }
    }

    const filterString = new URLSearchParams({ 'provider': 'eq.gmail' }).toString()
    const apiUrl = `${credentials.url}/rest/v1/oauth_tokens?${filterString}`

    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        'apikey': credentials.key,
        'Authorization': `Bearer ${session.access_token}`, // Use user's access token for RLS
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.error('[OAuth] Error disconnecting Gmail:', response.status)
      return { success: false, error: `HTTP ${response.status}` }
    }

    return { success: true }
  } catch (error) {
    console.error('[OAuth] Unexpected error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
