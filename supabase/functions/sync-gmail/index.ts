import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'
const SKIP_LABELS = ['SPAM', 'TRASH', 'CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_UPDATES', 'DTC']

interface OAuthToken {
  user_id: string
  refresh_token: string
  access_token: string
  expires_at: number
  last_history_id: string | null
}

interface GmailMessage {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  payload: {
    headers: Array<{ name: string; value: string }>
    parts?: any[]
  }
  internalDate: string
}

serve(async (req) => {
  try {
    // Initialize Supabase with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    // Verify service role access
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || authHeader.replace('Bearer ', '') !== serviceKey) {
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

    // Get all users with Gmail connected
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

    // Process archive queue
    console.log('[Gmail Sync] Processing archive queue...')
    const archiveResults = await processArchiveQueue(supabase, encryptionKey)
    console.log(`[Gmail Sync] Archive queue: ${archiveResults.successCount} succeeded, ${archiveResults.errorCount} failed`)

    return new Response(JSON.stringify({
      success: true,
      processed: tokens?.length || 0,
      successCount,
      errorCount,
      archiveQueue: archiveResults
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

  // Determine if this is first sync or incremental sync
  const isFirstSync = !token.last_history_id
  let changedThreadIds: Set<string>

  if (isFirstSync) {
    console.log(`[User ${token.user_id}] First sync - fetching recent messages...`)
    changedThreadIds = await fetchRecentThreads(accessToken)
  } else {
    console.log(`[User ${token.user_id}] Incremental sync using History API...`)
    changedThreadIds = await fetchChangedThreads(accessToken, token.last_history_id)
  }

  console.log(`[User ${token.user_id}] Found ${changedThreadIds.size} changed threads`)

  if (changedThreadIds.size === 0) {
    console.log(`[User ${token.user_id}] No changes detected`)
    return
  }

  // Fetch all messages for each changed thread with rate limiting
  // Process in batches of 5 to avoid Gmail API rate limits
  const threadIds = Array.from(changedThreadIds)
  const threadUpdates = []
  const batchSize = 5
  const delayMs = 1000 // 1 second delay between batches

  for (let i = 0; i < threadIds.length; i += batchSize) {
    const batch = threadIds.slice(i, i + batchSize)
    console.log(`[User ${token.user_id}] Fetching threads ${i + 1}-${i + batch.length} of ${threadIds.length}`)

    const batchResults = await Promise.all(
      batch.map(threadId =>
        fetchThreadMessages(accessToken, threadId, token.user_id)
      )
    )

    threadUpdates.push(...batchResults)

    // Delay between batches to respect rate limits
    if (i + batchSize < threadIds.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  // Filter out threads that should be skipped (spam, trash, calendar invites, etc)
  const validThreads = threadUpdates.filter(thread => {
    // Skip if has excluded labels
    if (thread.messages.some(msg => msg.labelIds.some(label => SKIP_LABELS.includes(label)))) {
      return false
    }

    // Skip calendar invites
    if (isCalendarInvite(thread)) {
      return false
    }

    return true
  })

  console.log(`[User ${token.user_id}] Processing ${validThreads.length} valid threads`)

  // Process each thread
  for (const thread of validThreads) {
    try {
      await saveThread(supabase, thread, token.user_id)
    } catch (err) {
      console.error(`[User ${token.user_id}] Failed to save thread ${thread.threadId}:`, err)
    }
  }

  // Update last_history_id
  const newHistoryId = await getLatestHistoryId(accessToken)
  if (newHistoryId) {
    const { error: updateError } = await supabase
      .from('oauth_tokens')
      .update({ last_history_id: newHistoryId })
      .eq('user_id', token.user_id)
      .eq('provider', 'gmail')

    if (updateError) {
      console.error(`[User ${token.user_id}] Failed to update last_history_id:`, updateError)
    } else {
      console.log(`[User ${token.user_id}] Updated last_history_id to ${newHistoryId}`)
    }
  } else {
    console.warn(`[User ${token.user_id}] Could not get latest history ID from Gmail`)
  }

  // Trigger AI summarization for threads (fire and forget)
  if (validThreads.length > 0) {
    const threadIds = validThreads.map(t => t.threadId)
    supabase.functions.invoke('process-mail-summary', {
      body: { userId: token.user_id, threadIds }
    }).catch((err: Error) => {
      console.error(`[User ${token.user_id}] Failed to trigger AI summarization:`, err)
    })
  }

  console.log(`[User ${token.user_id}] Sync complete`)
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

  // Update token with advisory lock
  const { data: lockResult, error: lockError } = await supabase.rpc('refresh_oauth_token_with_lock', {
    p_user_id: token.user_id,
    p_provider: 'gmail',
    p_access_token: data.access_token,
    p_expires_at: expiresAt,
    p_encryption_key: encryptionKey
  })

  if (lockError) throw lockError
  if (!lockResult) {
    console.log(`[Token Refresh] Refresh already in progress, skipped`)
  }

  return data.access_token
}

// Fetch recent threads for first sync (last 500 messages)
async function fetchRecentThreads(accessToken: string): Promise<Set<string>> {
  const params = new URLSearchParams({
    maxResults: '500',
    q: '(in:inbox OR label:support OR label:onboarding) -in:spam -in:trash -category:promotions -category:social -category:updates -label:dtc'
  })

  const response = await fetch(`${GMAIL_API_BASE}/messages?${params}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  })

  if (!response.ok) {
    throw new Error(`Gmail API error: ${response.statusText}`)
  }

  const data = await response.json()
  const messages = data.messages || []

  // Extract unique thread IDs
  const threadIds = new Set<string>()
  messages.forEach((msg: any) => threadIds.add(msg.threadId))

  return threadIds
}

// Fetch changed threads using Gmail History API
async function fetchChangedThreads(accessToken: string, lastHistoryId: string): Promise<Set<string>> {
  const params = new URLSearchParams({
    startHistoryId: lastHistoryId,
    historyTypes: 'messageAdded,messageDeleted,labelAdded,labelRemoved'
  })

  const response = await fetch(`${GMAIL_API_BASE}/history?${params}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  })

  if (!response.ok) {
    // If history ID is invalid or too old, fall back to recent threads
    if (response.status === 404 || response.status === 400) {
      console.log(`[History API] Invalid or expired history ID (${response.status}): ${lastHistoryId}, falling back to recent threads`)
      return await fetchRecentThreads(accessToken)
    }

    const errorText = await response.text()
    throw new Error(`Gmail History API error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  const data = await response.json()
  const history = data.history || []

  // Extract unique thread IDs from all history events
  const threadIds = new Set<string>()
  history.forEach((event: any) => {
    event.messagesAdded?.forEach((msg: any) => threadIds.add(msg.message.threadId))
    event.messagesDeleted?.forEach((msg: any) => threadIds.add(msg.message.threadId))
    event.labelsAdded?.forEach((msg: any) => threadIds.add(msg.message.threadId))
    event.labelsRemoved?.forEach((msg: any) => threadIds.add(msg.message.threadId))
  })

  return threadIds
}

// Fetch all messages in a thread with retry logic for rate limits
async function fetchThreadMessages(accessToken: string, threadId: string, userId: string, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(`${GMAIL_API_BASE}/threads/${threadId}?format=full`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })

      if (response.status === 429) {
        // Rate limited - exponential backoff
        const delay = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s
        console.log(`[Rate limit] Retrying thread ${threadId} after ${delay}ms (attempt ${attempt + 1}/${retries})`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch thread ${threadId}: ${response.statusText}`)
      }

      const data = await response.json()
      const messages: GmailMessage[] = data.messages || []

      return {
        threadId,
        userId,
        messages
      }
    } catch (error) {
      if (attempt === retries - 1) throw error

      // For network errors, also retry with backoff
      const delay = Math.pow(2, attempt) * 1000
      console.log(`[Network error] Retrying thread ${threadId} after ${delay}ms (attempt ${attempt + 1}/${retries})`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw new Error(`Failed to fetch thread ${threadId} after ${retries} attempts`)
}

// Get latest history ID from Gmail
async function getLatestHistoryId(accessToken: string): Promise<string | null> {
  const response = await fetch(`${GMAIL_API_BASE}/profile`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  })

  if (!response.ok) {
    console.error(`[getLatestHistoryId] Failed to fetch profile: ${response.status} ${response.statusText}`)
    return null
  }

  const data = await response.json()
  console.log(`[getLatestHistoryId] Gmail profile response:`, JSON.stringify(data))

  if (!data.historyId) {
    console.warn(`[getLatestHistoryId] No historyId in profile response`)
    return null
  }

  const historyId = String(data.historyId) // Ensure it's a string
  console.log(`[getLatestHistoryId] Extracted historyId: ${historyId} (type: ${typeof historyId}, length: ${historyId.length})`)

  return historyId
}

// Save thread and all its messages to database
async function saveThread(supabase: any, thread: { threadId: string; userId: string; messages: GmailMessage[] }, userId: string) {
  if (thread.messages.length === 0) return

  const messages = thread.messages
  const firstMessage = messages[0]
  const lastMessage = messages[messages.length - 1]

  // Parse messages
  const parsedMessages = messages.map(msg => parseMessage(msg, userId))

  // Extract thread metadata
  const subject = getHeader(firstMessage, 'subject') || '(No subject)'
  const allParticipants = new Set<string>()
  const recipientEmails = new Set<string>()
  let isDirectlyAddressed = false

  messages.forEach(msg => {
    const from = getHeader(msg, 'from')
    const to = getHeader(msg, 'to')
    const cc = getHeader(msg, 'cc')

    if (from) allParticipants.add(from)
    if (to) {
      to.split(',').forEach(email => {
        const trimmed = email.trim()
        allParticipants.add(trimmed)
        // Extract just the email address for recipient checking
        const match = trimmed.match(/<(.+?)>/)
        const emailOnly = match ? match[1].toLowerCase() : trimmed.toLowerCase()
        recipientEmails.add(emailOnly)
        // Check if sharat@appbrew.tech is directly addressed
        if (emailOnly === 'sharat@appbrew.tech') {
          isDirectlyAddressed = true
        }
      })
    }
    if (cc) {
      cc.split(',').forEach(email => {
        const trimmed = email.trim()
        allParticipants.add(trimmed)
        // Extract email and check if sharat is CC'd
        const match = trimmed.match(/<(.+?)>/)
        const emailOnly = match ? match[1].toLowerCase() : trimmed.toLowerCase()
        if (emailOnly === 'sharat@appbrew.tech') {
          isDirectlyAddressed = true
        }
      })
    }
  })

  const participants = Array.from(allParticipants).map(p => {
    const match = p.match(/(.*?)\s*<(.+?)>/) || [null, p, p]
    return {
      name: match[1]?.replace(/"/g, '').trim() || match[2]?.trim(),
      email: match[2]?.trim() || match[1]?.trim()
    }
  })

  // Separate internal (@appbrew.tech) from external participants
  const internalParticipants: string[] = []
  const externalParticipants: string[] = []

  participants.forEach(p => {
    if (p.email && p.email.toLowerCase().endsWith('@appbrew.tech')) {
      internalParticipants.push(p.email)
    } else if (p.email) {
      externalParticipants.push(p.email)
    }
  })

  // Determine category based on recipient email
  const labelIds = [...new Set(messages.flatMap(m => m.labelIds))]
  const category = categorizeThread(recipientEmails, labelIds, subject)

  // Check if any message is unread
  const isUnread = messages.some(m => m.labelIds.includes('UNREAD'))

  // Check if thread has attachments
  const hasAttachments = messages.some(m =>
    m.payload?.parts?.some((p: any) => p.filename && p.filename.length > 0)
  )

  // Upsert thread
  const { error: threadError } = await supabase
    .from('mail_threads')
    .upsert({
      user_id: userId,
      gmail_thread_id: thread.threadId,
      subject,
      participants,
      category,
      gmail_labels: labelIds,
      internal_participants: internalParticipants,
      external_participants: externalParticipants,
      is_directly_addressed: isDirectlyAddressed,
      is_unread: isUnread,
      has_attachments: hasAttachments,
      message_count: messages.length,
      first_message_date: parsedMessages[0].date,
      last_message_date: parsedMessages[parsedMessages.length - 1].date,
      last_synced_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,gmail_thread_id',
      ignoreDuplicates: false
    })

  if (threadError) throw threadError

  // Upsert all messages in thread
  const { error: messagesError } = await supabase
    .from('mail_messages')
    .upsert(parsedMessages, {
      onConflict: 'user_id,gmail_message_id',
      ignoreDuplicates: false
    })

  if (messagesError) throw messagesError
}

function getHeader(message: GmailMessage, name: string): string {
  const headers = message.payload?.headers || []
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''
}

/**
 * Detect if a thread is a calendar invite
 * Checks subject line, from address, content type, and snippet
 */
function isCalendarInvite(thread: any): boolean {
  const firstMessage = thread.messages[0]
  if (!firstMessage) return false

  const subject = getHeader(firstMessage, 'subject').toLowerCase()
  const from = getHeader(firstMessage, 'from').toLowerCase()
  const contentType = getHeader(firstMessage, 'content-type').toLowerCase()
  const snippet = (firstMessage.snippet || '').toLowerCase()

  // Check subject line for calendar keywords (strict prefixes)
  const calendarSubjectPrefixes = [
    'invitation:',
    'accepted:',
    'declined:',
    'tentative:',
    'canceled:',
    'cancelled:',
    'updated invitation:',
    'updated event:',
    'reminder:',
  ]

  if (calendarSubjectPrefixes.some(prefix => subject.startsWith(prefix))) {
    return true
  }

  // Check subject for calendar-related phrases
  const calendarSubjectKeywords = [
    'has invited you',
    'event invitation',
    'calendar event',
    'meeting invitation',
    'meeting invite',
    'has accepted',
    'has declined',
    'has tentatively accepted',
    'changed this event',
    'cancelled this event',
    'canceled this event',
    'event reminder',
  ]

  if (calendarSubjectKeywords.some(keyword => subject.includes(keyword))) {
    return true
  }

  // Check from address for calendar services
  const calendarFromPatterns = [
    'calendar-notification@google.com',
    'calendar@google.com',
    'noreply@google.com',
    'notifications@google.com',
    'calendar-server@',
    'no-reply@calendar',
  ]

  if (calendarFromPatterns.some(pattern => from.includes(pattern))) {
    return true
  }

  // Check snippet for calendar-specific phrases
  const calendarSnippetKeywords = [
    'view event',
    'going?',
    'yes, maybe, no',
    'rsvp',
    'google calendar',
    'add to calendar',
    'event details',
    'when:',
    'where:',
  ]

  if (calendarSnippetKeywords.some(keyword => snippet.includes(keyword))) {
    return true
  }

  // Check content type for calendar data
  if (contentType.includes('text/calendar') || contentType.includes('application/ics')) {
    return true
  }

  return false
}

function parseMessage(gmailMsg: GmailMessage, userId: string) {
  const from = getHeader(gmailMsg, 'from')
  const fromMatch = from.match(/(.*?)\s*<(.+?)>/) || [null, from, from]

  const subject = getHeader(gmailMsg, 'subject')
  const date = getHeader(gmailMsg, 'date')

  return {
    user_id: userId,
    gmail_message_id: gmailMsg.id,
    thread_id: gmailMsg.threadId,
    subject: subject || '(No subject)',
    from_email: fromMatch[2]?.trim() || fromMatch[1]?.trim(),
    from_name: fromMatch[1]?.replace(/"/g, '').trim(),
    to_addresses: [{ email: getHeader(gmailMsg, 'to') }],
    date: new Date(parseInt(gmailMsg.internalDate)).toISOString(),
    snippet: gmailMsg.snippet || '',
    body_preview: gmailMsg.snippet?.substring(0, 500),
    labels: gmailMsg.labelIds,
    category: categorizeThread(gmailMsg.labelIds, subject),
    is_unread: gmailMsg.labelIds.includes('UNREAD'),
    has_attachments: gmailMsg.payload?.parts?.some((p: any) => p.filename && p.filename.length > 0) || false
  }
}

function categorizeThread(recipientEmails: Set<string>, labelIds: string[], subject: string): 'onboarding' | 'support' | 'general' {
  // First check recipient email address (most reliable)
  if (recipientEmails.has('onboarding@appbrew.tech')) {
    return 'onboarding'
  }
  if (recipientEmails.has('support@appbrew.tech')) {
    return 'support'
  }

  // Fall back to labels and subject
  const labelNames = labelIds.join(' ').toLowerCase()
  const subjectLower = subject.toLowerCase()

  if (labelNames.includes('onboarding') || subjectLower.includes('welcome') || subjectLower.includes('getting started')) {
    return 'onboarding'
  } else if (labelNames.includes('support') || subjectLower.includes('support') || subjectLower.includes('help')) {
    return 'support'
  }

  return 'general'
}

// Process archive queue - archive threads in Gmail that were archived from UI
async function processArchiveQueue(supabase: any, encryptionKey: string) {
  let successCount = 0
  let errorCount = 0

  try {
    // Get pending archive queue items
    const { data: queueItems, error: queueError } = await supabase.rpc('get_pending_archive_queue', {
      p_limit: 50
    })

    if (queueError) {
      console.error('[Archive Queue] Failed to fetch queue:', queueError)
      return { successCount: 0, errorCount: 0 }
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('[Archive Queue] No items to process')
      return { successCount: 0, errorCount: 0 }
    }

    console.log(`[Archive Queue] Processing ${queueItems.length} items`)

    // Group by user_id to batch token fetches
    const itemsByUser = new Map<string, any[]>()
    for (const item of queueItems) {
      if (!itemsByUser.has(item.user_id)) {
        itemsByUser.set(item.user_id, [])
      }
      itemsByUser.get(item.user_id)!.push(item)
    }

    // Process each user's archive requests
    for (const [userId, userItems] of itemsByUser.entries()) {
      try {
        // Get user's OAuth token
        const { data: tokenData, error: tokenError } = await supabase.rpc('get_oauth_token', {
          p_user_id: userId,
          p_provider: 'gmail',
          p_encryption_key: encryptionKey
        })

        if (tokenError || !tokenData || tokenData.length === 0) {
          console.error(`[Archive Queue] Failed to get token for user ${userId}:`, tokenError)
          // Mark all items for this user as failed
          for (const item of userItems) {
            await supabase.rpc('update_archive_queue_status', {
              p_queue_id: item.id,
              p_status: 'failed',
              p_error_message: 'Failed to get OAuth token'
            })
          }
          errorCount += userItems.length
          continue
        }

        const token = tokenData[0]
        let accessToken = token.access_token

        // Refresh if expired
        if (Date.now() > token.expires_at) {
          try {
            accessToken = await refreshAccessToken(supabase, token, encryptionKey)
          } catch (refreshError) {
            console.error(`[Archive Queue] Token refresh failed for user ${userId}:`, refreshError)
            for (const item of userItems) {
              await supabase.rpc('update_archive_queue_status', {
                p_queue_id: item.id,
                p_status: 'failed',
                p_error_message: 'Token refresh failed'
              })
            }
            errorCount += userItems.length
            continue
          }
        }

        // Archive each thread in Gmail
        for (const item of userItems) {
          try {
            await archiveThreadInGmail(accessToken, item.gmail_thread_id)

            // Mark as completed
            await supabase.rpc('update_archive_queue_status', {
              p_queue_id: item.id,
              p_status: 'completed',
              p_error_message: null
            })

            successCount++
            console.log(`[Archive Queue] ✓ Archived thread ${item.gmail_thread_id}`)

          } catch (archiveError) {
            console.error(`[Archive Queue] Failed to archive thread ${item.gmail_thread_id}:`, archiveError)

            // Mark as failed
            await supabase.rpc('update_archive_queue_status', {
              p_queue_id: item.id,
              p_status: 'failed',
              p_error_message: archiveError.message || 'Unknown error'
            })

            errorCount++
          }

          // Small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 200))
        }

      } catch (userError) {
        console.error(`[Archive Queue] Error processing user ${userId}:`, userError)
        errorCount += userItems.length
      }
    }

  } catch (error) {
    console.error('[Archive Queue] Unexpected error:', error)
  }

  return { successCount, errorCount }
}

// Archive a thread in Gmail by removing INBOX label
async function archiveThreadInGmail(accessToken: string, threadId: string) {
  const response = await fetch(
    `${GMAIL_API_BASE}/threads/${threadId}/modify`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        removeLabelIds: ['INBOX', 'UNREAD']
      })
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gmail API error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  return response.json()
}
