# Edge Function Deployment Guide

This guide will help you deploy the Google token refresh edge function using the automated deployment script.

## Quick Setup (5 Minutes)

### Step 1: Install Supabase CLI

**macOS/Linux:**
```bash
npm install -g supabase
```

**Or with Homebrew (macOS):**
```bash
brew install supabase/tap/supabase
```

**Windows:**
```bash
npm install -g supabase
```

### Step 2: Login to Supabase

```bash
supabase login
```

This will open your browser to authenticate.

### Step 3: Configure Environment Variables

1. **Copy the example file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` and fill in your values:**
   ```bash
   # Open in your favorite editor
   nano .env
   # or
   code .env
   ```

3. **Fill in these values:**

   - **SUPABASE_PROJECT_REF**:
     - Go to your Supabase dashboard
     - Your URL looks like: `https://abcdefghijklmnop.supabase.co`
     - Copy the part: `abcdefghijklmnop`

   - **SUPABASE_DB_PASSWORD**:
     - Your database password (created when you set up the project)
     - If you don't remember it, you can reset it in Project Settings > Database

   - **GOOGLE_OAUTH_CLIENT_ID** and **GOOGLE_OAUTH_CLIENT_SECRET**:
     - Go to Supabase Dashboard → **Authentication** → **Providers** → **Google**
     - Copy both values from there
     - ⚠️ **Important**: Use the SAME credentials already configured in Supabase Auth

### Step 4: Run the Deployment Script

```bash
npm run deploy-edge-function
```

Or directly:
```bash
./deploy-edge-function.sh
```

The script will:
- ✅ Validate your configuration
- ✅ Link to your Supabase project
- ✅ Deploy the edge function
- ✅ Set the OAuth secrets
- ✅ Verify the deployment

### Step 5: Rebuild and Test

```bash
npm run build
```

Then reload your Chrome extension and sign in with Google!

---

## Manual Deployment (Alternative)

If you prefer to deploy manually:

```bash
# Login
supabase login

# Link project
supabase link --project-ref your-project-ref

# Deploy function
supabase functions deploy refresh-google-token

# Set secrets
supabase secrets set GOOGLE_OAUTH_CLIENT_ID="your-id"
supabase secrets set GOOGLE_OAUTH_CLIENT_SECRET="your-secret"
```

---

## Troubleshooting

### "Command not found: supabase"
Install the Supabase CLI first (see Step 1 above).

### "Not logged in to Supabase"
Run `supabase login` before deploying.

### ".env file not found"
Make sure you copied `.env.example` to `.env`:
```bash
cp .env.example .env
```

### "OAuth credentials not configured" in logs
Check that your secrets were set correctly:
```bash
supabase secrets list --project-ref your-project-ref
```

You should see:
```
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
```

### View Function Logs
```bash
supabase functions logs refresh-google-token --project-ref your-project-ref
```

Or in real-time:
```bash
supabase functions logs refresh-google-token --project-ref your-project-ref --follow
```

---

## Testing the Deployment

After deployment, test the token refresh:

1. Open Chrome DevTools (F12)
2. Go to Console tab
3. Sign in with Google in the extension
4. Wait ~5 minutes or manually expire the token
5. Look for these log messages:
   ```
   refreshGoogleToken: Attempting token refresh via Edge Function...
   refreshGoogleToken: Successfully refreshed token via Edge Function
   ```

---

## Security Notes

- ✅ `.env` is in `.gitignore` - your secrets won't be committed
- ✅ OAuth secrets are stored server-side only (Supabase secrets)
- ✅ Client secret is never exposed to the browser
- ✅ Token refresh happens server-to-server (Edge Function → Google)

---

## What Happens After Deployment?

With the edge function deployed:

1. **Before expiration** (at ~55 minutes):
   - Extension detects token is expiring soon
   - Calls edge function to refresh
   - Gets new token automatically
   - User never sees an error

2. **Without edge function**:
   - Token expires at ~60 minutes
   - User sees "Session expired. Please sign in again"
   - Manual re-authentication required

The edge function provides a seamless experience!
