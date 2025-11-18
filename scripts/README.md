# Supabase Mail System Deployment Scripts

This directory contains scripts to deploy and test the mail system using the Supabase CLI.

## Prerequisites

1. **Install Supabase CLI**
   ```bash
   npm install -g supabase
   ```

2. **Link to your Supabase project**
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

   Get your project ref from: Supabase Dashboard → Settings → General → Reference ID

3. **Prepare API keys**
   - **Google OAuth** credentials (Client ID & Secret)
     - Get from: [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - **Anthropic API** key
     - Get from: [Anthropic Console](https://console.anthropic.com/settings/keys)

## Quick Start

**Complete automated setup:**
```bash
./scripts/setup-mail.sh
```

This will:
1. Deploy database migrations
2. Configure Edge Function secrets
3. Deploy all Edge Functions
4. Set up database configuration
5. Enable the cron job

## Individual Scripts

### 1. Deploy Migrations

Deploy database schema and functions:

```bash
./scripts/deploy-migrations.sh
```

This creates:
- `mail_messages` table
- `mail_summaries` table
- `mail_action_items` table
- `oauth_tokens` table
- `usage_tracking` table
- Helper functions for cron jobs

### 2. Setup Secrets

Configure environment variables for Edge Functions:

```bash
./scripts/setup-secrets.sh
```

Sets up:
- `GOOGLE_CLIENT_ID` - Your Google OAuth Client ID
- `GOOGLE_CLIENT_SECRET` - Your Google OAuth Client Secret
- `ANTHROPIC_API_KEY` - Your Anthropic API key

### 3. Deploy Edge Functions

Deploy all mail-related Edge Functions:

```bash
./scripts/deploy-functions.sh
```

Or deploy a specific function:

```bash
./scripts/deploy-functions.sh sync-gmail
```

Deploys:
- `gmail-oauth-init` - OAuth initialization
- `gmail-oauth-callback` - OAuth callback handler
- `sync-gmail` - Gmail sync (called by cron)
- `process-mail-summary` - AI summarization

### 4. Test Locally

Run Edge Functions on your local machine:

```bash
./scripts/test-local.sh sync-gmail
```

This starts a local Supabase instance and serves the function at:
```
http://localhost:54321/functions/v1/sync-gmail
```

**First time setup:**
1. The script creates `supabase/.env.local`
2. Edit it and add your API keys
3. Run the script again

### 5. Test Functions

Test Edge Functions with sample requests:

```bash
# Test locally
./scripts/test-functions.sh local sync-gmail

# Test production
./scripts/test-functions.sh prod gmail-oauth-init
```

## Manual Configuration

### Set Database Settings

If the automated setup fails, run this SQL manually:

```sql
ALTER DATABASE postgres SET app.service_role_key TO 'your-service-role-key';
ALTER DATABASE postgres SET app.supabase_url TO 'https://your-project.supabase.co';
```

Get your service role key from: Supabase Dashboard → Settings → API

### Enable Cron Job

Run this SQL in the Supabase SQL Editor:

```sql
SELECT cron.schedule(
  'sync-gmail-all-users',
  '*/2 * * * *',
  $$SELECT trigger_gmail_sync();$$
);
```

### Verify Cron Job

```sql
-- List all cron jobs
SELECT * FROM list_cron_jobs();

-- View recent cron runs
SELECT * FROM list_cron_history(10);
```

## Troubleshooting

### Check if Supabase is linked

```bash
supabase status
```

### View Edge Function logs

```bash
supabase functions logs sync-gmail
```

### Test database connection

```bash
supabase db execute "SELECT version();"
```

### Reset local environment

```bash
supabase stop
supabase start
```

### List all secrets

```bash
supabase secrets list
```

### Delete a secret

```bash
supabase secrets unset GOOGLE_CLIENT_ID
```

## Development Workflow

### 1. Develop Locally

```bash
# Start local Supabase
supabase start

# Test your function
./scripts/test-local.sh sync-gmail

# Make changes to supabase/functions/sync-gmail/index.ts
# The function will hot-reload automatically
```

### 2. Test Changes

```bash
# Test with sample requests
./scripts/test-functions.sh local sync-gmail
```

### 3. Deploy to Production

```bash
# Deploy only the changed function
./scripts/deploy-functions.sh sync-gmail

# Or deploy all functions
./scripts/deploy-functions.sh
```

## File Structure

```
scripts/
├── README.md                 # This file
├── setup-mail.sh             # Complete automated setup
├── deploy-migrations.sh      # Deploy database migrations
├── setup-secrets.sh          # Configure Edge Function secrets
├── deploy-functions.sh       # Deploy Edge Functions
├── test-local.sh             # Run functions locally
└── test-functions.sh         # Test functions with curl

supabase/
├── migrations/               # Database migrations
│   ├── 20250118000001_create_mail_tables.sql
│   ├── 20250118000002_create_oauth_tokens.sql
│   └── 20250118000003_setup_mail_sync_cron.sql
├── functions/                # Edge Functions
│   ├── gmail-oauth-init/
│   ├── gmail-oauth-callback/
│   ├── sync-gmail/
│   └── process-mail-summary/
└── .env.local                # Local development secrets (gitignored)
```

## Security Notes

- **Never commit** `.env.local` - it's in `.gitignore`
- **Service role key** has full database access - keep it secret
- **Secrets** are encrypted in Supabase - use `supabase secrets` commands
- **OAuth tokens** are encrypted in the database using pgcrypto

## Next Steps After Deployment

1. Open your Chrome extension
2. Go to Settings
3. Configure Supabase URL and Anon Key
4. Sign in with Google
5. Click "Connect Gmail"
6. Emails will sync every 2 minutes!

## Support

For detailed setup instructions and troubleshooting:
- See: `supabase/MAIL_SETUP.md`
- Check Edge Function logs in Supabase Dashboard
- View cron job status: `SELECT * FROM list_cron_history(10);`
