import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    // Process each thread
    const results = []
    let successCount = 0
    let errorCount = 0

    for (const threadId of threadIds) {
      try {
        // Check if thread already has a recent summary (less than 1 hour old)
        const { data: existingThread } = await supabase
          .from('mail_threads')
          .select('summary, summary_generated_at')
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
        const summaryResult = await generateThreadSummary(messages, anthropicApiKey)

        // Update thread with summary and action items
        const { error: updateError } = await supabase
          .from('mail_threads')
          .update({
            summary: summaryResult.summary,
            action_items: summaryResult.actionItems,
            summary_generated_at: new Date().toISOString()
          })
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
 * Generate thread summary and action items using Claude Haiku
 * Analyzes the entire conversation with full context
 */
async function generateThreadSummary(messages: any[], apiKey: string): Promise<SummaryResult> {
  // Build conversation context
  const threadContext = messages.map((msg, idx) => {
    return `
Message ${idx + 1} (${new Date(msg.date).toLocaleDateString()}):
From: ${msg.from_name || msg.from_email}
Subject: ${msg.subject}
${msg.body_preview || msg.snippet || '(No content)'}
---`
  }).join('\n')

  const prompt = `You are an AI assistant that helps summarize email threads and extract action items.

This is an email conversation with ${messages.length} message(s):
${threadContext}

Please analyze this entire email thread and provide:
1. A concise 2-3 sentence summary of the overall conversation, including:
   - What the conversation is about
   - Key points discussed
   - Current status or outcome if applicable

2. A list of action items (tasks, deadlines, requests, follow-ups) extracted from the ENTIRE thread
   - Only include actionable items that require someone to do something
   - Include context about who needs to do what
   - Identify any mentioned deadlines or timeframes

Respond in JSON format:
{
  "summary": "Brief summary of the entire conversation",
  "actionItems": [
    {
      "description": "Specific action item with context",
      "dueDate": "YYYY-MM-DD" or null,
      "priority": "high" | "medium" | "low"
    }
  ]
}

If there are no action items, return an empty array.
Focus on actionable items, not general statements.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
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
