/**
 * Thread-Focused Mail Sync (Background Worker Safe)
 *
 * Syncs mail threads from Supabase mail_threads table
 * This version uses direct REST API calls to avoid DOM dependencies
 */

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
 * Make a direct REST API call to Supabase (no client library needed)
 */
async function supabaseFetch(
  url: string,
  apiKey: string,
  table: string,
  params: Record<string, string>
): Promise<any[]> {
  const queryString = new URLSearchParams(params).toString()
  const apiUrl = `${url}/rest/v1/${table}?${queryString}`

  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'apikey': apiKey,
      'Authorization': `Bearer ${apiKey}`,
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
 * Update records in Supabase using direct REST API
 */
async function supabaseUpdate(
  url: string,
  apiKey: string,
  table: string,
  filter: Record<string, string>,
  data: Record<string, any>
): Promise<void> {
  const filterString = new URLSearchParams(filter).toString()
  const apiUrl = `${url}/rest/v1/${table}?${filterString}`

  const response = await fetch(apiUrl, {
    method: 'PATCH',
    headers: {
      'apikey': apiKey,
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error(`Supabase API error: ${response.status} ${response.statusText}`)
  }
}

/**
 * Delete records from Supabase using direct REST API
 */
async function supabaseDelete(
  url: string,
  apiKey: string,
  table: string,
  filter: Record<string, string>
): Promise<void> {
  const filterString = new URLSearchParams(filter).toString()
  const apiUrl = `${url}/rest/v1/${table}?${filterString}`

  const response = await fetch(apiUrl, {
    method: 'DELETE',
    headers: {
      'apikey': apiKey,
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`Supabase API error: ${response.status} ${response.statusText}`)
  }
}

/**
 * Get Supabase credentials from chrome.storage
 */
async function getSupabaseCredentials(): Promise<{ url: string; key: string } | null> {
  try {
    const result = await chrome.storage.local.get(['supabaseUrl', 'supabaseKey'])

    if (!result.supabaseUrl || !result.supabaseKey ||
        typeof result.supabaseUrl !== 'string' ||
        typeof result.supabaseKey !== 'string') {
      console.log('[Mail Threads] Supabase not configured')
      return null
    }

    return {
      url: result.supabaseUrl,
      key: result.supabaseKey
    }
  } catch (error) {
    console.error('[Mail Threads] Error getting credentials:', error)
    return null
  }
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

    // Use direct REST API call instead of Supabase client
    const threads = await supabaseFetch(
      credentials.url,
      credentials.key,
      'mail_threads',
      {
        'last_message_date': `gte.${thirtyDaysAgo.toISOString()}`,
        'order': 'last_message_date.desc',
        'limit': '200'
      }
    )

    if (!threads || threads.length === 0) {
      console.log('[Mail Threads] No threads found')
      return { all: [], onboarding: [], support: [] }
    }

    console.log(`[Mail Threads] Fetched ${threads.length} threads`)

    // Categorize threads
    const all = threads as MailThread[]
    const onboarding = all.filter(t => t.category === 'onboarding')
    const support = all.filter(t => t.category === 'support')

    return { all, onboarding, support }
  } catch (error) {
    console.error('[Mail Threads] Unexpected error:', error)
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

    // Check if user has Gmail OAuth token using direct API
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

    // Update using direct API
    await supabaseUpdate(
      credentials.url,
      credentials.key,
      'mail_threads',
      { 'id': `eq.${threadId}` },
      { is_unread: !isRead }
    )

    return true
  } catch (error) {
    console.error('[Mail Threads] Error updating thread:', error)
    return false
  }
}

/**
 * Initiate Gmail OAuth flow
 * Note: This should only be called from UI context where we have user session
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

    // Get session from storage (set by UI auth flow)
    const result = await chrome.storage.local.get(['supabaseSession'])
    const session = result.supabaseSession as { access_token?: string } | undefined

    if (!session?.access_token) {
      return { success: false, error: 'Not authenticated' }
    }

    // Call gmail-oauth-init Edge Function using direct fetch
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

    // Delete OAuth tokens using direct API
    await supabaseDelete(
      credentials.url,
      credentials.key,
      'oauth_tokens',
      { 'provider': 'eq.gmail' }
    )

    return { success: true }
  } catch (error) {
    console.error('[OAuth] Unexpected error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
