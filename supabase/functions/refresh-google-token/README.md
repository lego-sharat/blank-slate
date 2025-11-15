# Google Token Refresh Edge Function

This Supabase Edge Function handles automatic refresh of Google OAuth tokens for calendar access.

## Purpose

When Google OAuth tokens expire (typically after 1 hour), this function uses the refresh_token to obtain a new access_token without requiring the user to re-authenticate.

## Setup

### 1. Deploy the Edge Function

```bash
supabase functions deploy refresh-google-token
```

### 2. Set Environment Variables

You need to configure the Google OAuth credentials in your Supabase project:

```bash
supabase secrets set GOOGLE_OAUTH_CLIENT_ID="your-client-id"
supabase secrets set GOOGLE_OAUTH_CLIENT_SECRET="your-client-secret"
```

**Important:** These should be the same OAuth credentials configured in your Supabase Auth settings for Google provider.

### 3. Finding Your OAuth Credentials

1. Go to your Supabase project dashboard
2. Navigate to Authentication > Providers > Google
3. Copy the Client ID and Client Secret shown there
4. Use those values to set the secrets above

## How It Works

1. Extension detects an expired token (401 from Google Calendar API)
2. Extension calls this edge function with the refresh_token
3. Edge function calls Google's OAuth token endpoint
4. Returns new access_token to the extension
5. Extension retries the calendar request with the new token

## Fallback Behavior

The extension implements multiple fallback strategies:

1. **Primary:** Try Supabase session refresh (automatic)
2. **Secondary:** Call this edge function (requires setup)
3. **Tertiary:** Prompt user to sign in again

If this edge function is not deployed or configured, the extension will still work but may require users to sign in more frequently.

## Testing

To test if the edge function is working:

1. Sign in with Google in the extension
2. Wait for the token to expire (or manually expire it in storage)
3. Check browser console for log messages about token refresh
4. Successful refresh will show: "Successfully refreshed token via Edge Function"

## Troubleshooting

### "OAuth credentials not configured" error

- Make sure you've set the `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` secrets
- Verify they match the values in your Supabase Auth Google provider settings

### "Failed to refresh token: 400" error

- The refresh_token may be invalid or revoked
- User needs to sign in again to get a new refresh_token

### Edge function not being called

- Check that the extension has the correct Supabase URL configured
- Verify the function is deployed: `supabase functions list`
- Check Supabase function logs for errors: `supabase functions logs refresh-google-token`
