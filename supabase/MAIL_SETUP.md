# Mail System Setup Guide

This guide explains how to set up the server-side mail system with Supabase.

## Architecture

```
Supabase pg_cron (every 2 min)
    ↓ HTTP POST
Edge Function: sync-gmail
    ↓
For each user:
  1. Refresh Gmail OAuth token
  2. Fetch new emails from Gmail API
  3. Save to Postgres
  4. Trigger AI summarization (async)
    ↓
Extension reads from Postgres
  (with IndexedDB cache for offline)
```

## Setup Steps

### 1. Deploy Migrations

Run the migrations in order:

```bash
# From the Supabase dashboard SQL editor, run each migration file:
supabase/migrations/20250118000001_create_mail_tables.sql
supabase/migrations/20250118000002_create_oauth_tokens.sql
supabase/migrations/20250118000003_setup_mail_sync_cron.sql
```

### 2. Set Environment Variables

In your Supabase project settings (Edge Functions), add:

```
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
ANTHROPIC_API_KEY=your-anthropic-api-key
```

### 3. Store Service Role Key

In Supabase SQL editor, run:

```sql
ALTER DATABASE postgres SET app.service_role_key TO 'your-service-role-key-from-settings';
ALTER DATABASE postgres SET app.supabase_url TO 'https://your-project.supabase.co';
```

### 4. Deploy Edge Functions

```bash
# Deploy sync-gmail function
supabase functions deploy sync-gmail

# Deploy OAuth functions (to be created)
supabase functions deploy gmail-oauth-init
supabase functions deploy gmail-oauth-callback

# Deploy AI summarization function (to be created)
supabase functions deploy process-mail-summary
```

### 5. Enable Cron Job

In Supabase SQL editor:

```sql
SELECT cron.schedule(
  'sync-gmail-all-users',
  '*/2 * * * *',  -- Every 2 minutes
  $$SELECT trigger_gmail_sync();$$
);
```

### 6. Verify Setup

Check cron job is running:

```sql
SELECT * FROM list_cron_jobs();
SELECT * FROM list_cron_history(10);
```

## OAuth Flow

1. User clicks "Connect Gmail" in extension settings
2. Extension calls `gmail-oauth-init` Edge Function
3. User completes Google OAuth consent
4. Callback stores encrypted tokens in `oauth_tokens` table
5. Cron job starts syncing mail every 2 minutes

## Rate Limiting

- **Default**: 100 AI summaries per user per day
- Configurable in `check_rate_limit()` function
- Tracked in `usage_tracking` table

## Monitoring

View sync status:

```sql
-- Recent cron runs
SELECT * FROM list_cron_history(20);

-- User sync status
SELECT
  u.email,
  ot.provider,
  ot.last_history_id,
  ot.updated_at,
  COUNT(mm.id) as message_count
FROM auth.users u
LEFT JOIN oauth_tokens ot ON u.id = ot.user_id
LEFT JOIN mail_messages mm ON u.id = mm.user_id
WHERE ot.provider = 'gmail'
GROUP BY u.email, ot.provider, ot.last_history_id, ot.updated_at;
```

## Troubleshooting

### Cron job not running

```sql
-- Check if extension is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Check job schedule
SELECT * FROM cron.job;

-- View error logs
SELECT * FROM cron.job_run_details
WHERE status != 'succeeded'
ORDER BY start_time DESC;
```

### Token refresh failing

Check Google OAuth credentials are correct and refresh token is valid.

### AI summaries not generating

Check Anthropic API key is set and rate limits are not exceeded:

```sql
SELECT user_id, SUM(count) as total_summaries
FROM usage_tracking
WHERE action = 'generate_summary'
AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY user_id;
```

## Cost Estimates

- **Supabase**: Free tier (500MB database)
- **Claude Haiku**: ~$0.001 per email summary
- **50 emails/day**: ~$1.50/month per user
- **Gmail API**: Free (quota: 1 billion units/day)
