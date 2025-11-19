import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Gmail OAuth Initialization
 *
 * Generates the Google OAuth URL for the user to authorize the extension.
 * Called from the extension when user clicks "Connect Gmail".
 *
 * Flow:
 * 1. Extension calls this function with user authentication
 * 2. Function generates OAuth URL with state parameter
 * 3. Extension opens URL in new tab
 * 4. User completes OAuth consent
 * 5. Google redirects to gmail-oauth-callback
 */
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get user from authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid user token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Google OAuth credentials from environment
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const redirectUri = `${supabaseUrl}/functions/v1/gmail-oauth-callback`

    console.log('[OAuth Init] Client ID:', clientId)
    console.log('[OAuth Init] Redirect URI:', redirectUri)
    console.log('[OAuth Init] Supabase URL:', supabaseUrl)

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: 'Google OAuth not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate state parameter (user_id for verification in callback)
    // In production, you might want to add more security (CSRF token, timestamp, etc.)
    const state = btoa(JSON.stringify({
      userId: user.id,
      timestamp: Date.now(),
    }))

    // Build Google OAuth URL
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/gmail.readonly',
      access_type: 'offline', // Required to get refresh token
      prompt: 'consent', // Force consent screen to ensure refresh token
      state: state,
    })

    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

    console.log('[OAuth Init] Generated OAuth URL')

    return new Response(
      JSON.stringify({
        success: true,
        oauthUrl,
        redirectUri, // Include for debugging
        message: 'Open this URL to authorize Gmail access',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error generating OAuth URL:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to generate OAuth URL',
        details: error.message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
