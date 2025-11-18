import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ProcessMailRequest {
  userId: string
  messageIds: string[] // Array of mail_messages.id (UUIDs)
}

interface ActionItem {
  description: string
  dueDate?: string // ISO date string
  priority?: 'high' | 'medium' | 'low'
}

interface SummaryResult {
  summary: string
  actionItems: ActionItem[]
}

/**
 * Process Mail Summary with AI
 *
 * Generates AI summaries and extracts action items from emails using Claude Haiku.
 * Triggered asynchronously by the sync-gmail function after fetching new emails.
 *
 * Flow:
 * 1. Check rate limits (100 summaries/day default)
 * 2. Fetch mail messages from database
 * 3. Call Claude Haiku API for each message
 * 4. Store summaries and action items
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
    const { userId, messageIds }: ProcessMailRequest = await req.json()

    if (!userId || !messageIds || messageIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing userId or messageIds' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[AI Summary] Processing ${messageIds.length} messages for user ${userId}`)

    // Check rate limit (uses function from migration)
    const { data: rateLimitCheck, error: rateLimitError } = await supabase.rpc(
      'check_rate_limit',
      {
        p_user_id: userId,
        p_action: 'generate_summary',
        p_limit: 100, // 100 summaries per day
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
          message: 'You have reached the daily limit of 100 email summaries',
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch mail messages
    const { data: messages, error: fetchError } = await supabase
      .from('mail_messages')
      .select('*')
      .in('id', messageIds)
      .eq('user_id', userId)

    if (fetchError) {
      console.error('[AI Summary] Failed to fetch messages:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch messages' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No messages found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[AI Summary] Fetched ${messages.length} messages`)

    // Get Anthropic API key
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({ error: 'Anthropic API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Process each message
    const results = []
    let successCount = 0
    let errorCount = 0

    for (const message of messages) {
      try {
        // Skip if summary already exists
        const { data: existingSummary } = await supabase
          .from('mail_summaries')
          .select('id')
          .eq('message_id', message.id)
          .single()

        if (existingSummary) {
          console.log(`[AI Summary] Skipping message ${message.id} - summary already exists`)
          continue
        }

        // Generate summary using Claude Haiku
        const summaryResult = await generateSummary(message, anthropicApiKey)

        // Insert summary
        const { data: summaryData, error: summaryError } = await supabase
          .from('mail_summaries')
          .insert({
            message_id: message.id,
            user_id: userId,
            summary: summaryResult.summary,
          })
          .select()
          .single()

        if (summaryError) {
          console.error(`[AI Summary] Failed to insert summary for message ${message.id}:`, summaryError)
          errorCount++
          continue
        }

        // Insert action items if any
        if (summaryResult.actionItems.length > 0) {
          const actionItems = summaryResult.actionItems.map((item) => ({
            message_id: message.id,
            user_id: userId,
            description: item.description,
            due_date: item.dueDate || null,
            priority: item.priority || 'medium',
          }))

          const { error: actionItemsError } = await supabase
            .from('mail_action_items')
            .insert(actionItems)

          if (actionItemsError) {
            console.error(`[AI Summary] Failed to insert action items for message ${message.id}:`, actionItemsError)
          }
        }

        // Track usage
        await supabase.rpc('track_usage', {
          p_user_id: userId,
          p_action: 'generate_summary',
          p_count: 1,
        })

        successCount++
        results.push({
          messageId: message.id,
          success: true,
          summary: summaryResult.summary,
          actionItemsCount: summaryResult.actionItems.length,
        })

        console.log(`[AI Summary] ✓ Processed message ${message.id}`)
      } catch (error) {
        console.error(`[AI Summary] Error processing message ${message.id}:`, error)
        errorCount++
        results.push({
          messageId: message.id,
          success: false,
          error: error.message,
        })
      }
    }

    console.log(`[AI Summary] Completed: ${successCount} success, ${errorCount} errors`)

    return new Response(
      JSON.stringify({
        success: true,
        processed: messages.length,
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
 * Generate summary and action items using Claude Haiku
 */
async function generateSummary(message: any, apiKey: string): Promise<SummaryResult> {
  const prompt = `You are an AI assistant that helps summarize emails and extract action items.

Email Details:
From: ${message.from_name || message.from_email}
Subject: ${message.subject || '(No subject)'}
Date: ${message.date}
Body: ${message.body_preview || message.snippet || '(No content)'}

Please provide:
1. A concise 1-2 sentence summary of this email
2. A list of action items (tasks, deadlines, requests) if any

Respond in JSON format:
{
  "summary": "Brief summary here",
  "actionItems": [
    {
      "description": "Action item description",
      "dueDate": "YYYY-MM-DD" or null,
      "priority": "high" | "medium" | "low"
    }
  ]
}

If there are no action items, return an empty array.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-20240307',
      max_tokens: 1024,
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
  // Claude sometimes wraps JSON in markdown code blocks, so we need to handle that
  let jsonContent = content.trim()
  if (jsonContent.startsWith('```json')) {
    jsonContent = jsonContent.replace(/^```json\n/, '').replace(/\n```$/, '')
  } else if (jsonContent.startsWith('```')) {
    jsonContent = jsonContent.replace(/^```\n/, '').replace(/\n```$/, '')
  }

  const result: SummaryResult = JSON.parse(jsonContent)

  // Validate structure
  if (!result.summary || typeof result.summary !== 'string') {
    throw new Error('Invalid summary format from Claude')
  }

  if (!Array.isArray(result.actionItems)) {
    result.actionItems = []
  }

  return result
}
