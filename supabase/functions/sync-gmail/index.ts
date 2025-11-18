import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'
const SKIP_LABELS = ['SPAM', 'TRASH', 'CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_UPDATES']

interface OAuthToken {
  user_id: string
  refresh_token: string
  access_token: string
  expires_at: number
  last_history_id: string | null
}

serve(async (req) => {
  try {
    // Initialize Supabase with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    // Verify service role access by checking JWT
    const authHeader = req.headers.get('Authorization')

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized - No authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Verify the token is valid by checking user
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    // Only allow service role (cron job) to call this
    // Regular users should not be able to trigger sync for all users
    if (authError || token !== serviceKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized - Service role required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('[Gmail Sync] Starting sync for all users...')

    // Get encryption key from environment
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY')
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY not configured')
    }

    // Get all users with Gmail connected using decryption function
    const { data: tokens, error: tokensError } = await supabase.rpc('get_all_oauth_tokens', {
      p_provider: 'gmail',
      p_encryption_key: encryptionKey
    })

    if (tokensError) throw tokensError

    console.log(`[Gmail Sync] Found ${tokens?.length || 0} users to sync`)

    let successCount = 0
    let errorCount = 0

    // Process each user
    for (const token of (tokens || [])) {
      try {
        await syncUserMail(supabase, token, encryptionKey)
        successCount++
      } catch (err) {
        console.error(`[Gmail Sync] Failed for user ${token.user_id}:`, err)
        errorCount++
      }
    }

    console.log(`[Gmail Sync] Complete: ${successCount} succeeded, ${errorCount} failed`)

    return new Response(JSON.stringify({
      success: true,
      processed: tokens?.length || 0,
      successCount,
      errorCount
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[Gmail Sync] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})

async function syncUserMail(supabase: any, token: OAuthToken, encryptionKey: string) {
  console.log(`[User ${token.user_id}] Starting sync...`)

  // Refresh access token if expired
  let accessToken = token.access_token
  if (Date.now() > token.expires_at) {
    console.log(`[User ${token.user_id}] Refreshing access token...`)
    accessToken = await refreshAccessToken(supabase, token, encryptionKey)
  }

  // Fetch messages
  const messages = await fetchGmailMessages(accessToken)
  console.log(`[User ${token.user_id}] Fetched ${messages.length} messages`)

  if (messages.length === 0) {
    return
  }

  // Parse and categorize messages
  const parsedMessages = messages.map(msg => parseMessage(msg, token.user_id))

  // Upsert to database
  const { error: upsertError } = await supabase
    .from('mail_messages')
    .upsert(parsedMessages, {
      onConflict: 'user_id,gmail_message_id',
      ignoreDuplicates: false
    })

  if (upsertError) throw upsertError

  console.log(`[User ${token.user_id}] Saved ${parsedMessages.length} messages`)

  // Trigger AI summarization for new messages (async)
  const newMessageIds = parsedMessages.map(m => m.gmail_message_id)
  if (newMessageIds.length > 0) {
    // Fire and forget - don't wait
    supabase.functions.invoke('process-mail-summary', {
      body: { userId: token.user_id, messageIds: newMessageIds }
    }).catch((err: Error) => {
      console.error(`[User ${token.user_id}] Failed to trigger AI summarization:`, err)
    })
  }
}

async function refreshAccessToken(supabase: any, token: OAuthToken, encryptionKey: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      refresh_token: token.refresh_token,
      grant_type: 'refresh_token'
    })
  })

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.statusText}`)
  }

  const data = await response.json()
  const expiresAt = Date.now() + (data.expires_in * 1000)

  // Update token in database with advisory lock to prevent race conditions
  const { data: lockResult, error: lockError } = await supabase.rpc('refresh_oauth_token_with_lock', {
    p_user_id: token.user_id,
    p_provider: 'gmail',
    p_access_token: data.access_token,
    p_expires_at: expiresAt,
    p_encryption_key: encryptionKey
  })

  if (lockError) {
    console.error(`[Token Refresh] Error updating token:`, lockError)
    throw lockError
  }

  if (!lockResult) {
    console.log(`[Token Refresh] Refresh already in progress for user ${token.user_id}, skipped`)
  }

  return data.access_token
}

async function fetchGmailMessages(accessToken: string): Promise<any[]> {
  // Fetch messages from INBOX, excluding spam/trash/promotions/social
  const params = new URLSearchParams({
    maxResults: '50',
    labelIds: 'INBOX',
    q: '-in:spam -in:trash -category:promotions -category:social -category:updates'
  })

  const listResponse = await fetch(`${GMAIL_API_BASE}/messages?${params}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  })

  if (!listResponse.ok) {
    throw new Error(`Gmail API error: ${listResponse.statusText}`)
  }

  const listData = await listResponse.json()
  const messageIds = listData.messages || []

  if (messageIds.length === 0) {
    return []
  }

  // Fetch full message details (batch)
  const messages = await Promise.all(
    messageIds.slice(0, 50).map(async (msg: any) => {
      const msgResponse = await fetch(`${GMAIL_API_BASE}/messages/${msg.id}?format=full`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
      return msgResponse.json()
    })
  )

  return messages
}

function parseMessage(gmailMsg: any, userId: string) {
  const headers = gmailMsg.payload?.headers || []
  const getHeader = (name: string) =>
    headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || ''

  const from = getHeader('from')
  const fromMatch = from.match(/(.*?)\s*<(.+?)>/) || [null, from, from]

  const subject = getHeader('subject')
  const date = getHeader('date')
  const labelIds = gmailMsg.labelIds || []

  // Categorize based on labels or subject
  let category: 'onboarding' | 'support' | 'general' = 'general'
  const labelNames = labelIds.join(' ').toLowerCase()
  const subjectLower = subject.toLowerCase()

  if (labelNames.includes('onboarding') || subjectLower.includes('welcome') || subjectLower.includes('getting started')) {
    category = 'onboarding'
  } else if (labelNames.includes('support') || subjectLower.includes('support') || subjectLower.includes('help')) {
    category = 'support'
  }

  return {
    user_id: userId,
    gmail_message_id: gmailMsg.id,
    thread_id: gmailMsg.threadId,
    subject: subject || '(No subject)',
    from_email: fromMatch[2]?.trim() || fromMatch[1]?.trim(),
    from_name: fromMatch[1]?.replace(/"/g, '').trim(),
    to_addresses: [{ email: getHeader('to') }],
    date: new Date(date || Date.now()).toISOString(),
    snippet: gmailMsg.snippet || '',
    body_preview: gmailMsg.snippet?.substring(0, 500),
    labels: labelIds,
    category,
    is_unread: labelIds.includes('UNREAD'),
    has_attachments: gmailMsg.payload?.parts?.some((p: any) => p.filename && p.filename.length > 0) || false
  }
}
