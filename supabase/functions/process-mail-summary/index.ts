import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildPrompt } from '../_shared/prompt-template.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ProcessMailRequest {
  userId: string
  threadIds: string[] // Array of gmail thread IDs
}

interface ActionItem {
  description: string
  dueDate?: string // ISO date string
  priority?: 'high' | 'medium' | 'low'
}

interface SummaryResult {
  summary: string
  actionItems: ActionItem[]
  topic: string // AI-generated topic/label for categorization
  integrationName?: string // AI-extracted integration/service name (free-form)
  labels: string[] // Flexible labels for categorization and filtering
  satisfactionScore?: number
  satisfactionAnalysis?: string
  isEscalation?: boolean // Whether this requires immediate attention
  escalationReason?: string // Why this is an escalation
  escalationType?: 'customer' | 'team' | null // Type of escalation
  status?: 'active' | 'waiting' | 'resolved' // Thread status
  isBilling?: boolean // Whether this thread contains billing links
  billingStatus?: 'sent' | 'accepted' | 'pending' | null // Billing status
}

/**
 * Process Mail Summary with AI (Thread-Focused)
 *
 * Generates AI summaries and extracts action items from email THREADS using Claude Haiku.
 * Triggered asynchronously by the sync-gmail function after fetching new threads.
 *
 * Flow:
 * 1. Check rate limits (100 summaries/day default)
 * 2. Fetch all messages in each thread from database
 * 3. Call Claude Haiku API with full thread context
 * 4. Store thread-level summaries and action items
 * 5. Track usage for rate limiting
 */
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const { userId, threadIds }: ProcessMailRequest = await req.json()

    if (!userId || !threadIds || threadIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing userId or threadIds' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[AI Summary] Processing ${threadIds.length} threads for user ${userId}`)

    // Check rate limit (uses function from migration)
    const { data: rateLimitCheck, error: rateLimitError } = await supabase.rpc(
      'check_rate_limit',
      {
        p_user_id: userId,
        p_action: 'generate_summary',
        p_limit: 100, // 100 thread summaries per day
      }
    )

    if (rateLimitError) {
      console.error('[AI Summary] Rate limit check failed:', rateLimitError)
      return new Response(
        JSON.stringify({ error: 'Rate limit check failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!rateLimitCheck) {
      console.log(`[AI Summary] Rate limit exceeded for user ${userId}`)
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'You have reached the daily limit of 100 email thread summaries',
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Anthropic API key
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({ error: 'Anthropic API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user's email and name for action item filtering
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId)

    if (userError || !userData?.user?.email) {
      console.error('[AI Summary] Failed to fetch user data:', userError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userEmail = userData.user.email
    const userName = userData.user.user_metadata?.name || userData.user.user_metadata?.full_name || null
    console.log(`[AI Summary] Processing for user: ${userName || userEmail} (${userEmail})`)

    // Process each thread
    const results = []
    let successCount = 0
    let errorCount = 0

    for (const threadId of threadIds) {
      try {
        // Check if thread already has a recent summary (less than 1 hour old)
        const { data: existingThread } = await supabase
          .from('mail_threads')
          .select('summary, summary_generated_at, category, internal_participants, external_participants')
          .eq('user_id', userId)
          .eq('gmail_thread_id', threadId)
          .single()

        if (existingThread?.summary && existingThread.summary_generated_at) {
          const summaryAge = Date.now() - new Date(existingThread.summary_generated_at).getTime()
          const oneHour = 60 * 60 * 1000

          if (summaryAge < oneHour) {
            console.log(`[AI Summary] Skipping thread ${threadId} - recent summary exists`)
            continue
          }
        }

        // Fetch all messages in the thread (chronological order)
        const { data: messages, error: fetchError } = await supabase
          .from('mail_messages')
          .select('*')
          .eq('user_id', userId)
          .eq('thread_id', threadId)
          .order('date', { ascending: true })

        if (fetchError) {
          console.error(`[AI Summary] Failed to fetch messages for thread ${threadId}:`, fetchError)
          errorCount++
          continue
        }

        if (!messages || messages.length === 0) {
          console.log(`[AI Summary] No messages found for thread ${threadId}`)
          continue
        }

        console.log(`[AI Summary] Generating summary for thread ${threadId} with ${messages.length} messages`)

        // Generate thread summary using Claude Haiku
        const category = existingThread?.category || 'general'
        const internalParticipants = existingThread?.internal_participants || []
        const externalParticipants = existingThread?.external_participants || []
        const summaryResult = await generateThreadSummary(messages, category, userEmail, userName, internalParticipants, externalParticipants, anthropicApiKey)

        // Check if this is a calendar event (should never be escalation)
        const isCalendarEvent = isCalendarInviteThread(messages)

        // Update thread with summary, action items, topic, integration, labels, satisfaction score, escalation, and status
        const updateData: any = {
          summary: summaryResult.summary,
          action_items: summaryResult.actionItems,
          ai_topic: summaryResult.topic,
          ai_labels: summaryResult.labels || [],
          summary_generated_at: new Date().toISOString()
        }

        // Add integration name if detected
        if (summaryResult.integrationName) {
          updateData.integration_name = summaryResult.integrationName
        }

        // Add satisfaction score for onboarding/support threads
        if ((category === 'onboarding' || category === 'support') && summaryResult.satisfactionScore) {
          updateData.satisfaction_score = summaryResult.satisfactionScore
          updateData.satisfaction_analysis = summaryResult.satisfactionAnalysis
        }

        // Add escalation detection (force false for calendar events)
        if (isCalendarEvent) {
          // Calendar events should NEVER be escalations
          updateData.is_escalation = false
          updateData.escalation_reason = null
          updateData.escalation_type = null
          console.log(`[AI Summary] Thread ${threadId} is a calendar event, forcing is_escalation=false`)
        } else if (summaryResult.isEscalation !== undefined) {
          updateData.is_escalation = summaryResult.isEscalation
          if (summaryResult.isEscalation && summaryResult.escalationReason) {
            updateData.escalation_reason = summaryResult.escalationReason
            updateData.escalation_type = summaryResult.escalationType || null
            updateData.escalated_at = new Date().toISOString()
          } else {
            // Not an escalation, clear escalation_type
            updateData.escalation_type = null
          }
        }

        // Add thread status
        if (summaryResult.status) {
          updateData.status = summaryResult.status
        }

        // Add billing tracking
        if (summaryResult.isBilling !== undefined) {
          updateData.is_billing = summaryResult.isBilling
          if (summaryResult.isBilling && summaryResult.billingStatus) {
            updateData.billing_status = summaryResult.billingStatus
            // Set billing timestamps based on status
            if (summaryResult.billingStatus === 'sent' && !updateData.billing_sent_at) {
              updateData.billing_sent_at = new Date().toISOString()
            }
            if (summaryResult.billingStatus === 'accepted') {
              updateData.billing_accepted_at = new Date().toISOString()
            }
          } else {
            updateData.billing_status = null
          }
        }

        const { error: updateError } = await supabase
          .from('mail_threads')
          .update(updateData)
          .eq('user_id', userId)
          .eq('gmail_thread_id', threadId)

        if (updateError) {
          console.error(`[AI Summary] Failed to update thread ${threadId}:`, updateError)
          errorCount++
          continue
        }

        // Track usage
        await supabase.rpc('track_usage', {
          p_user_id: userId,
          p_action: 'generate_summary',
          p_count: 1,
        })

        successCount++
        results.push({
          threadId,
          success: true,
          summary: summaryResult.summary,
          actionItemsCount: summaryResult.actionItems.length,
        })

        console.log(`[AI Summary] ✓ Processed thread ${threadId}`)
      } catch (error) {
        console.error(`[AI Summary] Error processing thread ${threadId}:`, error)
        errorCount++
        results.push({
          threadId,
          success: false,
          error: error.message,
        })
      }
    }

    console.log(`[AI Summary] Completed: ${successCount} success, ${errorCount} errors`)

    return new Response(
      JSON.stringify({
        success: true,
        processed: threadIds.length,
        successCount,
        errorCount,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[AI Summary] Unexpected error:', error)
    return new Response(
      JSON.stringify({
        error: 'An unexpected error occurred',
        details: error.message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Detect if a thread is a calendar invite based on message content
 * Prevents calendar events from being misclassified as escalations
 */
function isCalendarInviteThread(messages: any[]): boolean {
  if (!messages || messages.length === 0) return false

  const firstMessage = messages[0]
  const subject = (firstMessage.subject || '').toLowerCase()
  const from = (firstMessage.from_email || '').toLowerCase()
  const snippet = (firstMessage.snippet || firstMessage.body_preview || '').toLowerCase()

  // Check subject for calendar keywords
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

  // Check subject for calendar phrases
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

  // Check from address
  const calendarFromPatterns = [
    'calendar-notification@google.com',
    'calendar@google.com',
    'noreply@google.com',
    'notifications@google.com',
  ]

  if (calendarFromPatterns.some(pattern => from.includes(pattern))) {
    return true
  }

  // Check snippet for calendar phrases
  const calendarSnippetKeywords = [
    'view event',
    'going?',
    'yes, maybe, no',
    'google calendar',
    'add to calendar',
    'when:',
    'where:',
  ]

  if (calendarSnippetKeywords.some(keyword => snippet.includes(keyword))) {
    return true
  }

  return false
}

/**
 * Generate thread summary and action items using Claude Haiku
 * Analyzes the entire conversation with full context
 * For onboarding/support threads, also extracts customer satisfaction score
 * Only extracts action items that the user needs to do
 */
async function generateThreadSummary(messages: any[], category: string, userEmail: string, userName: string | null, internalParticipants: string[], externalParticipants: string[], apiKey: string): Promise<SummaryResult> {
  // Build conversation context
  const threadContext = messages.map((msg, idx) => {
    return `
Message ${idx + 1} (${new Date(msg.date).toLocaleDateString()}):
From: ${msg.from_name || msg.from_email}
Subject: ${msg.subject}
${msg.body_preview || msg.snippet || '(No content)'}
---`
  }).join('\n')

  // Build prompt using template
  const prompt = buildPrompt({
    userName,
    userEmail,
    threadContext,
    messageCount: messages.length,
    category,
    internalParticipants,
    externalParticipants
  })

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Anthropic API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  const content = data.content[0].text

  // Parse JSON from Claude's response
  // Claude sometimes wraps JSON in markdown code blocks or adds extra text
  let jsonContent = content.trim()

  // Try to extract JSON from markdown code blocks
  const codeBlockMatch = jsonContent.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (codeBlockMatch) {
    jsonContent = codeBlockMatch[1].trim()
  } else {
    // Try to find JSON object by looking for { ... }
    const jsonMatch = jsonContent.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      jsonContent = jsonMatch[0]
    }
  }

  let result: SummaryResult
  try {
    result = JSON.parse(jsonContent)
  } catch (error) {
    console.error('[AI Summary] Failed to parse JSON. Raw response:', content)
    console.error('[AI Summary] Extracted content:', jsonContent)
    throw new Error(`Failed to parse AI response: ${error.message}`)
  }

  // Validate structure
  if (!result.summary || typeof result.summary !== 'string') {
    throw new Error('Invalid summary format from Claude')
  }

  if (!result.topic || typeof result.topic !== 'string') {
    console.warn('Missing topic from Claude, defaulting to "other"')
    result.topic = 'other'
  }

  // Validate integration name (free-form, keep as extracted)
  if (result.integrationName !== undefined && result.integrationName !== null) {
    if (typeof result.integrationName !== 'string' || result.integrationName.trim() === '') {
      console.warn('Invalid integration name from Claude, ignoring')
      delete result.integrationName
    } else {
      // Keep as-is, just trim whitespace
      result.integrationName = result.integrationName.trim()
    }
  }

  // Validate labels array
  if (!Array.isArray(result.labels)) {
    console.warn('Missing or invalid labels from Claude, defaulting to empty array')
    result.labels = []
  } else {
    // Filter out invalid labels (non-string or empty)
    result.labels = result.labels.filter(label =>
      typeof label === 'string' && label.trim() !== ''
    ).map(label => label.trim())
  }

  if (!Array.isArray(result.actionItems)) {
    result.actionItems = []
  }

  // Validate satisfaction score if present
  if (result.satisfactionScore !== undefined) {
    if (typeof result.satisfactionScore !== 'number' || result.satisfactionScore < 1 || result.satisfactionScore > 10) {
      console.warn('Invalid satisfaction score from Claude, ignoring')
      delete result.satisfactionScore
      delete result.satisfactionAnalysis
    }
  }

  // Validate escalation detection
  if (result.isEscalation !== undefined) {
    if (typeof result.isEscalation !== 'boolean') {
      console.warn('Invalid isEscalation from Claude, defaulting to false')
      result.isEscalation = false
      result.escalationReason = null
    } else if (result.isEscalation && result.escalationReason) {
      if (typeof result.escalationReason !== 'string' || result.escalationReason.trim() === '') {
        console.warn('Invalid escalationReason from Claude, clearing')
        result.escalationReason = null
      } else {
        result.escalationReason = result.escalationReason.trim()
      }
    }
  } else {
    // Default to false if not provided
    result.isEscalation = false
    result.escalationReason = null
  }

  // Validate status
  const validStatuses = ['active', 'waiting', 'resolved']
  if (result.status !== undefined) {
    if (!validStatuses.includes(result.status)) {
      console.warn(`Invalid status from Claude: ${result.status}, defaulting to "active"`)
      result.status = 'active'
    }
  } else {
    // Default to active if not provided
    result.status = 'active'
  }

  return result
}
