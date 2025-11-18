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
  topic: string // AI-generated topic/label for categorization
  integrationName?: string // AI-extracted integration/service name (free-form)
  labels: string[] // Flexible labels for categorization and filtering
  satisfactionScore?: number
  satisfactionAnalysis?: string
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

    // Get user's email for action item filtering
    const { data: userData, error: userError } = await supabase
      .from('oauth_tokens')
      .select('email')
      .eq('user_id', userId)
      .eq('provider', 'gmail')
      .single()

    if (userError || !userData?.email) {
      console.error('[AI Summary] Failed to fetch user email:', userError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userEmail = userData.email
    console.log(`[AI Summary] Processing for user: ${userEmail}`)

    // Process each thread
    const results = []
    let successCount = 0
    let errorCount = 0

    for (const threadId of threadIds) {
      try {
        // Check if thread already has a recent summary (less than 1 hour old)
        const { data: existingThread } = await supabase
          .from('mail_threads')
          .select('summary, summary_generated_at, category')
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
        const summaryResult = await generateThreadSummary(messages, category, userEmail, anthropicApiKey)

        // Update thread with summary, action items, topic, integration, labels, and satisfaction score (if applicable)
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
 * Generate thread summary and action items using Claude Haiku
 * Analyzes the entire conversation with full context
 * For onboarding/support threads, also extracts customer satisfaction score
 * Only extracts action items that the user needs to do
 */
async function generateThreadSummary(messages: any[], category: string, userEmail: string, apiKey: string): Promise<SummaryResult> {
  // Build conversation context
  const threadContext = messages.map((msg, idx) => {
    return `
Message ${idx + 1} (${new Date(msg.date).toLocaleDateString()}):
From: ${msg.from_name || msg.from_email}
Subject: ${msg.subject}
${msg.body_preview || msg.snippet || '(No content)'}
---`
  }).join('\n')

  // Build prompt based on category
  const isCustomerFacing = category === 'onboarding' || category === 'support'

  const satisfactionInstructions = isCustomerFacing ? `

3. Customer Satisfaction Score (1-10):
   - Analyze the customer's tone, sentiment, and overall experience
   - Consider: Was their issue resolved? Did they express gratitude or frustration?
   - Look for indicators: positive language, complaints, escalations, unresolved issues
   - Score 1-3: Unhappy/frustrated customer
   - Score 4-6: Neutral experience, some issues
   - Score 7-10: Satisfied/happy customer
   - Provide a brief analysis explaining the score` : ''

  const responseFormat = isCustomerFacing ? `
{
  "summary": "Brief summary of the entire conversation",
  "topic": "integration_request | integration_issue | app_customization | feature_request | bug_report | billing_question | technical_issue | onboarding_help | hiring_team | general_inquiry | other",
  "integrationName": "Name of Shopify app/integration mentioned (e.g., Yotpo Reviews, Klaviyo, Recharge) or null",
  "labels": ["customer-support", "high-priority"],
  "actionItems": [
    {
      "description": "Specific action item with context",
      "dueDate": "YYYY-MM-DD" or null,
      "priority": "high" | "medium" | "low"
    }
  ],
  "satisfactionScore": 7,
  "satisfactionAnalysis": "Brief explanation of the satisfaction score"
}` : `
{
  "summary": "Brief summary of the entire conversation",
  "topic": "integration_request | integration_issue | app_customization | feature_request | bug_report | billing_question | technical_issue | onboarding_help | hiring_team | general_inquiry | other",
  "integrationName": "Name of Shopify app/integration mentioned (e.g., Yotpo Reviews, Klaviyo, Recharge) or null",
  "labels": ["customer-support", "high-priority"],
  "actionItems": [
    {
      "description": "Specific action item with context",
      "dueDate": "YYYY-MM-DD" or null,
      "priority": "high" | "medium" | "low"
    }
  ]
}`

  const prompt = `You are an AI assistant for a Shopify mobile app builder platform. You help summarize email threads, extract action items${isCustomerFacing ? ', and analyze customer satisfaction' : ''}.

User's email address: ${userEmail}

This is an email conversation with ${messages.length} message(s):
${threadContext}

Please analyze this entire email thread and provide:

1. A concise 2-3 sentence summary of the overall conversation, including:
   - What the conversation is about
   - Key points discussed
   - Current status or outcome if applicable

2. A topic/label that best categorizes this thread:
   - integration_request: Customer requesting a new Shopify app integration (not yet supported)
   - integration_issue: Problems with an existing integration (bugs, not working, setup issues)
   - app_customization: Questions about mobile app design, UI/UX customization, branding, PDP/PLP/Cart templates, theme management, content blocks, landing pages
   - feature_request: New feature requests for the app builder platform itself (new capabilities, enhancements)
   - bug_report: Bugs in the mobile app or builder platform (crashes, display issues, functionality not working)
   - billing_question: Questions about pricing, plans, subscriptions, payments, upgrades
   - technical_issue: Technical problems, setup issues, deployment, catalog sync, deeplink setup, push notification setup
   - onboarding_help: Help getting started, initial setup, tutorials, first-time configuration
   - hiring_team: Hiring, recruitment, job applications, team updates, HR matters
   - general_inquiry: General questions, information requests, how-to questions
   - other: Doesn't fit other categories

3. Integration name (if applicable):
   - Look for ANY Shopify app or third-party integration mentioned in the conversation
   - Extract the exact name as mentioned by the customer
   - Examples of common integrations to look for:
     * Search: "Boost", "Searchanise", "Zevi", "Algolia", "Fast Simon", "Findify"
     * Reviews: "Yotpo Reviews", "Judge.me", "Stamped", "Loox", "Junip", "Reviews.io", "Okendo"
     * Analytics/Push: "GA4", "Klaviyo", "CleverTap", "Moengage", "Firebase", "WebEngage"
     * Rewards: "Smile", "Nector", "Loyalty Lion", "Yotpo Rewards", "99minds"
     * Subscriptions: "Recharge", "Stay.AI", "Loop", "Appstle", "Prive"
     * Checkout: "Gokwik", "Shopflo", "Fastrr"
     * Returns: "Return Prime", "Eco Returns", "Loop Returns"
     * Customer Support: "Gorgias", "Kapture", "Tidio", "Kustomer"
     * Attribution: "Adjust", "Appsflyer", "Branch"
     * Video: "Firework", "Whatamore", "Quinn"
     * Size Charts: "Wair", "Kiwi Size Chart"
     * Product Recommendations: "Rebuy", "Visenze"
     * Shipping/EDD: "Shiprocket", "Clickpost", "Fenix"
   - If customer mentions a different integration not in examples above, still extract it
   - Use null if no integration is mentioned

4. Labels (array of applicable labels for filtering):
   Email Type Labels:
   - "customer-support": Customer support inquiry or issue
   - "onboarding": New customer onboarding
   - "promotional": Promotional emails, marketing, offers
   - "newsletter": Newsletter, product updates, announcements
   - "social-media": Social media notifications, mentions
   - "update": Software updates, changelogs, notifications
   - "team-internal": Internal team communication
   - "investor": Investor-related communication
   - "product-query": General product questions
   - "hiring": Job applications, recruitment, candidates
   - "team-update": Team announcements, HR updates, organizational changes
   - "cold-email": Unsolicited sales outreach from external SaaS companies, agencies, or vendors trying to sell products/services (e.g., marketing agencies, development shops, lead generation services, AI tools, etc.)

   Priority/Status Labels:
   - "high-priority": Urgent or critical issues
   - "needs-response": Requires immediate response
   - "escalated": Escalated to senior team
   - "resolved": Issue has been resolved

   Content Labels:
   - "integration-related": Related to an integration
   - "billing": Related to billing/payments
   - "technical": Technical in nature
   - "design": Design/UI/UX related

   Use 1-4 most relevant labels. Always include at least one email type label.

   IMPORTANT - Detecting Cold Emails:
   Apply "cold-email" label if the email matches these characteristics:
   - Unsolicited outreach from companies/agencies you don't have a relationship with
   - Offering services like: web development, app development, marketing, SEO, lead generation, staff augmentation, design services, AI/ML solutions, data analytics, etc.
   - Generic templates with phrases like: "I came across your company...", "We help companies like yours...", "We specialize in...", "I'd love to schedule a quick call..."
   - Sender is from a marketing/sales agency or SaaS vendor
   - No prior conversation history or existing relationship
   - Typically asking for a call/meeting to pitch their services
   - NOT from: actual customers, partners, investors, or people replying to your outreach

5. Action items for the user (${userEmail})
   - ONLY extract action items that the USER needs to do (not what others need to do)
   - Examples of valid action items for the user:
     * "Respond to customer's question about Klaviyo integration"
     * "Schedule demo call with customer on Friday"
     * "Review and provide feedback on design mockups"
     * "Follow up with engineering team about bug fix"
   - DO NOT include:
     * Actions that others need to do for the user
     * General observations or statements
     * Things the user already completed
   - Include context about what needs to be done
   - Identify any mentioned deadlines or timeframes
   - If there are no action items for the user, return an empty array
${satisfactionInstructions}

IMPORTANT: Respond with ONLY a valid JSON object, no other text or markdown formatting.
Use this exact structure:
${responseFormat}

Guidelines:
- If no action items for the user: return empty array
- Only include action items that ${userEmail} needs to do themselves
- If no integration mentioned: use null for integrationName
- For integrationName: Extract exact name as mentioned in email (e.g., "Yotpo Reviews" not "yotpo-reviews")
- For labels: Select 1-4 most relevant labels from the list above
- Focus on actionable items that require the user to take action`

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

  return result
}
