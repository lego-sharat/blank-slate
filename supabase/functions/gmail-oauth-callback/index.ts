import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Gmail OAuth Callback
 *
 * Handles the OAuth callback from Google after user consent.
 * Exchanges authorization code for access and refresh tokens.
 * Stores encrypted tokens in the oauth_tokens table.
 *
 * Flow:
 * 1. Google redirects here with code and state
 * 2. Verify state parameter
 * 3. Exchange code for tokens
 * 4. Store tokens in database
 * 5. Show success page to user
 */
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Parse query parameters
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    // Handle OAuth errors (user denied access, etc.)
    if (error) {
      return new Response(
        generateErrorPage(error),
        { status: 400, headers: { 'Content-Type': 'text/html' } }
      )
    }

    if (!code || !state) {
      return new Response(
        generateErrorPage('Missing code or state parameter'),
        { status: 400, headers: { 'Content-Type': 'text/html' } }
      )
    }

    // Decode and verify state parameter
    let stateData: { userId: string; timestamp: number }
    try {
      stateData = JSON.parse(atob(state))
    } catch {
      return new Response(
        generateErrorPage('Invalid state parameter'),
        { status: 400, headers: { 'Content-Type': 'text/html' } }
      )
    }

    // Verify state timestamp (prevent replay attacks - valid for 10 minutes)
    const stateAge = Date.now() - stateData.timestamp
    if (stateAge > 10 * 60 * 1000) {
      return new Response(
        generateErrorPage('OAuth state expired. Please try again.'),
        { status: 400, headers: { 'Content-Type': 'text/html' } }
      )
    }

    // Initialize Supabase with service role (needed to write to oauth_tokens)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get Google OAuth credentials
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
    const redirectUri = `${supabaseUrl}/functions/v1/gmail-oauth-callback`

    if (!clientId || !clientSecret) {
      return new Response(
        generateErrorPage('Google OAuth not configured'),
        { status: 500, headers: { 'Content-Type': 'text/html' } }
      )
    }

    // Exchange authorization code for tokens
    console.log('[OAuth] Exchanging code for tokens...')
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('[OAuth] Token exchange failed:', errorData)
      return new Response(
        generateErrorPage('Failed to exchange code for tokens'),
        { status: 500, headers: { 'Content-Type': 'text/html' } }
      )
    }

    const tokenData = await tokenResponse.json()
    const { access_token, refresh_token, expires_in } = tokenData

    if (!refresh_token) {
      console.error('[OAuth] No refresh token received. User may need to revoke and re-authorize.')
      return new Response(
        generateErrorPage('No refresh token received. Please revoke access and try again.'),
        { status: 500, headers: { 'Content-Type': 'text/html' } }
      )
    }

    console.log('[OAuth] Tokens received successfully')

    // Calculate token expiration timestamp
    const expiresAt = Date.now() + (expires_in * 1000)

    // Get encryption key from environment
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY')
    if (!encryptionKey) {
      console.error('[OAuth] ENCRYPTION_KEY not configured')
      return new Response(
        generateErrorPage('Server configuration error: Missing encryption key'),
        { status: 500, headers: { 'Content-Type': 'text/html' } }
      )
    }

    // Store tokens using encrypted storage function
    // Tokens are encrypted using pgcrypto with ENCRYPTION_KEY from Supabase secrets
    const { error: dbError } = await supabase.rpc('store_oauth_token', {
      p_user_id: stateData.userId,
      p_provider: 'gmail',
      p_refresh_token: refresh_token,
      p_access_token: access_token,
      p_expires_at: expiresAt,
      p_encryption_key: encryptionKey,
    })

    if (dbError) {
      console.error('[OAuth] Database error:', dbError)
      return new Response(
        generateErrorPage('Failed to store tokens'),
        { status: 500, headers: { 'Content-Type': 'text/html' } }
      )
    }

    console.log(`[OAuth] Encrypted tokens stored successfully for user ${stateData.userId}`)

    // Return success page
    return new Response(
      generateSuccessPage(),
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    )
  } catch (error) {
    console.error('[OAuth] Callback error:', error)
    return new Response(
      generateErrorPage('An unexpected error occurred'),
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    )
  }
})

/**
 * Generate success page HTML
 */
function generateSuccessPage(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gmail Connected Successfully</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .container {
      text-align: center;
      padding: 40px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      backdrop-filter: blur(10px);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }
    .checkmark {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      display: block;
      stroke-width: 3;
      stroke: white;
      stroke-miterlimit: 10;
      margin: 0 auto 20px;
      animation: fill 0.4s ease-in-out 0.4s forwards, scale 0.3s ease-in-out 0.9s both;
    }
    .checkmark-circle {
      stroke-dasharray: 166;
      stroke-dashoffset: 166;
      stroke-width: 3;
      stroke-miterlimit: 10;
      stroke: white;
      fill: none;
      animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
    }
    .checkmark-check {
      transform-origin: 50% 50%;
      stroke-dasharray: 48;
      stroke-dashoffset: 48;
      animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards;
    }
    @keyframes stroke {
      100% { stroke-dashoffset: 0; }
    }
    @keyframes scale {
      0%, 100% { transform: none; }
      50% { transform: scale3d(1.1, 1.1, 1); }
    }
    h1 { margin: 0 0 10px; font-size: 28px; }
    p { margin: 0 0 20px; opacity: 0.9; }
    .info {
      background: rgba(255, 255, 255, 0.1);
      padding: 15px;
      border-radius: 10px;
      margin-top: 20px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
      <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
      <path class="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
    </svg>
    <h1>Gmail Connected!</h1>
    <p>Your Gmail account has been successfully connected.</p>
    <div class="info">
      <p><strong>What happens next?</strong></p>
      <p>Your emails will be synced automatically every 2 minutes.</p>
      <p>You can close this tab and return to your extension.</p>
    </div>
  </div>
  <script>
    // Auto-close tab after 3 seconds
    setTimeout(() => {
      window.close();
    }, 3000);
  </script>
</body>
</html>
  `.trim()
}

/**
 * Generate error page HTML
 */
function generateErrorPage(errorMessage: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gmail Connection Failed</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: white;
    }
    .container {
      text-align: center;
      padding: 40px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      backdrop-filter: blur(10px);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      max-width: 500px;
    }
    .error-icon {
      font-size: 60px;
      margin-bottom: 20px;
    }
    h1 { margin: 0 0 10px; font-size: 28px; }
    p { margin: 0 0 20px; opacity: 0.9; }
    .error-details {
      background: rgba(255, 255, 255, 0.1);
      padding: 15px;
      border-radius: 10px;
      margin-top: 20px;
      font-size: 14px;
      font-family: monospace;
    }
    button {
      background: white;
      color: #f5576c;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s;
    }
    button:hover {
      transform: scale(1.05);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-icon">⚠️</div>
    <h1>Connection Failed</h1>
    <p>We couldn't connect your Gmail account.</p>
    <div class="error-details">
      <strong>Error:</strong><br>${errorMessage}
    </div>
    <br>
    <button onclick="window.close()">Close Tab</button>
  </div>
</body>
</html>
  `.trim()
}
