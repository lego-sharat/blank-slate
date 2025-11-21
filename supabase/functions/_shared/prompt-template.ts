/**
 * AI Prompt Template for Email Thread Summarization
 *
 * This prompt is used by Claude Haiku to:
 * - Summarize email conversations
 * - Extract action items
 * - Detect escalations
 * - Classify thread status
 * - Analyze customer satisfaction (for support/onboarding)
 */

export interface PromptParams {
  userName: string | null
  userEmail: string
  threadContext: string
  messageCount: number
  category: string
  internalParticipants: string[]  // @appbrew.tech team members
  externalParticipants: string[]  // Customers and external people
}

export function buildPrompt(params: PromptParams): string {
  const { userName, userEmail, threadContext, messageCount, category, internalParticipants, externalParticipants } = params
  const isCustomerFacing = category === 'onboarding' || category === 'support'

  // Format participant lists for context
  const teamContext = internalParticipants.length > 0
    ? `\n\nYour team members in this thread (all @appbrew.tech): ${internalParticipants.join(', ')}`
    : ''
  const customerContext = externalParticipants.length > 0
    ? `\nExternal people (customers/partners): ${externalParticipants.join(', ')}`
    : ''

  const satisfactionInstructions = isCustomerFacing ? `

3. Customer Satisfaction Score (1-10):
   - Analyze the customer's tone, sentiment, and overall experience
   - Consider: Was their issue resolved? Did they express gratitude or frustration?
   - Look for indicators: positive language, complaints, escalations, unresolved issues
   - Score 1-3: Unhappy/frustrated customer
   - Score 4-6: Neutral experience, some issues
   - Score 7-10: Satisfied/happy customer
   - Provide a brief analysis explaining the score

4. Escalation Detection (isEscalation, escalationReason, and escalationType):
   - **IMPORTANT: NEVER mark calendar invites/events as escalations**
   - **ONLY mark as escalation if this is a support or onboarding thread (customer-facing)**
   - For customer-facing threads, mark as escalation (true) with escalationType="customer" if ANY apply:
     * Customer is angry, frustrated, or threatening to churn
     * Multiple unresolved follow-ups or long wait times
     * Issue is blocking business-critical functionality
     * Customer explicitly asks to speak with senior management/founder
     * High-value customer (based on context) with serious issue
     * Complaint about poor service or multiple failures
     * Legal threats or public reputation risks
   - Provide brief reason if escalation (1 sentence)
   - If not escalation OR if calendar event: use false, null, and null

5. Thread Status:
   - "waiting": Last message is from your team asking customer for info/action, waiting for their response
   - "resolved": Issue clearly resolved, customer thanked you, or conversation naturally concluded
   - "active": Requires response from your team, customer waiting, or ongoing discussion
   - Default to "active" if unclear

6. Billing Detection (isBilling and billingStatus):
   - Set isBilling=true if your team (@appbrew.tech) sent billing/payment links to external customers
   - Look for phrases like: "payment link", "invoice", "subscription renewal", "upgrade to paid plan", "billing details", "payment due"
   - Determine billingStatus:
     * "sent": Billing link sent but no customer response yet
     * "accepted": Customer confirmed payment, accepted plan, or thanked for successful payment
     * "pending": Customer asked questions about billing but hasn't acted yet
   - If not billing-related: use false and null` : `

3. Escalation Detection (isEscalation, escalationReason, and escalationType):
   - **IMPORTANT: NEVER mark calendar invites/events as escalations**
   - **For general threads, mark as escalation (true) with escalationType="team" if ANY apply:**
     * Urgent request from team member requiring immediate attention
     * Critical business issue or blocker affecting operations
     * Important stakeholder (investor, partner, leadership) with high-priority matter
     * Multiple unresolved follow-ups from team
     * Time-sensitive matter with approaching deadline
   - Provide brief reason if escalation (1 sentence)
   - If not escalation OR if calendar event: use false, null, and null

4. Thread Status:
   - "waiting": Last message is from you asking someone for info/action, waiting for their response
   - "resolved": Matter clearly resolved or conversation concluded
   - "active": Requires action from you or ongoing discussion
   - Default to "active" if unclear

5. Billing Detection (isBilling and billingStatus):
   - Set isBilling=true if your team (@appbrew.tech) sent billing/payment links to external participants
   - Look for phrases like: "payment link", "invoice", "subscription renewal", "upgrade to paid plan", "billing details", "payment due"
   - Determine billingStatus:
     * "sent": Billing link sent but no customer response yet
     * "accepted": Customer/partner confirmed payment or accepted plan
     * "pending": Customer asked questions about billing but hasn't acted yet
   - If not billing-related: use false and null`

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
  "satisfactionAnalysis": "Brief explanation of the satisfaction score",
  "isEscalation": false,
  "escalationReason": null,
  "escalationType": null,
  "status": "active",
  "isBilling": false,
  "billingStatus": null
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
  ],
  "isEscalation": false,
  "escalationReason": null,
  "escalationType": null,
  "status": "active",
  "isBilling": false,
  "billingStatus": null
}`

  return `You are an AI assistant for a Shopify mobile app builder platform. You help summarize email threads, extract action items${isCustomerFacing ? ', and analyze customer satisfaction' : ''}.

User: ${userName ? `${userName} (${userEmail})` : userEmail}${teamContext}${customerContext}

This is an email conversation with ${messageCount} message(s):
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
   - "billing-accepted": Customer has accepted/paid billing (use with "billing")
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

5. Action items for the user (${userName || userEmail})
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
- Only include action items that ${userName || userEmail} needs to do themselves
- If no integration mentioned: use null for integrationName
- For integrationName: Extract exact name as mentioned in email (e.g., "Yotpo Reviews" not "yotpo-reviews")
- For labels: Select 1-4 most relevant labels from the list above
- Focus on actionable items that require the user to take action`
}
