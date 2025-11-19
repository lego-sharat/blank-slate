# Archive Feature Deployment Guide

This guide walks through deploying the new email archive functionality for the Chrome extension.

## Overview

The archive feature allows users to archive email threads directly from the extension UI. When a thread is archived:
1. It's immediately marked as `archived` in the Supabase database
2. It's queued for archiving in Gmail (removes from INBOX)
3. It disappears from the extension UI
4. The background sync job processes the Gmail archive queue every 2 minutes

## Architecture

```
User clicks "Archive" button
    ↓
Extension UI calls archiveThread()
    ↓
Supabase RPC function archive_thread()
    - Updates thread status to 'archived'
    - Adds to gmail_archive_queue table
    ↓
UI immediately removes thread from view
    ↓
Background sync-gmail Edge Function (every 2min)
    - Processes queue
    - Archives in Gmail via API
    - Marks queue item as completed
```

## Files Changed

### Database (Supabase)
- **`supabase/migrations/20250119000001_add_archive_and_status_features.sql`** (NEW)
  - Adds `status`, `is_escalation`, archive fields to `mail_threads`
  - Creates `gmail_archive_queue` table
  - Creates `archive_thread()` RPC function
  - Creates queue processing functions

### Backend (Edge Functions)
- **`supabase/functions/sync-gmail/index.ts`** (MODIFIED)
  - Added `processArchiveQueue()` function
  - Added `archiveThreadInGmail()` function
  - Calls archive queue processing after each sync

### Frontend (Extension)
- **`src/utils/mailSupabaseSync.ts`** (MODIFIED)
  - Added `archiveThread()` function to call RPC

- **`src/utils/mailThreadsSync.ts`** (MODIFIED)
  - Updated `MailThread` interface with new fields
  - Added `status: 'eq.active'` filter to exclude archived threads

- **`src/components/Mail/MailView.tsx`** (MODIFIED)
  - Added `handleArchive()` function
  - Added Archive button with icon to each thread

## Deployment Steps

### 1. Deploy Database Migration

Run the migration in your Supabase project:

```bash
# Option A: Using Supabase CLI
supabase db push

# Option B: Manual via SQL Editor
# 1. Go to Supabase Dashboard → SQL Editor
# 2. Copy contents of supabase/migrations/20250119000001_add_archive_and_status_features.sql
# 3. Run the SQL
```

**Verify migration:**
```sql
-- Check new columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'mail_threads'
  AND column_name IN ('status', 'is_escalation', 'archived_at', 'archive_source');

-- Check archive queue table exists
SELECT * FROM gmail_archive_queue LIMIT 0;

-- Check RPC function exists
SELECT proname FROM pg_proc WHERE proname = 'archive_thread';
```

### 2. Deploy Edge Function

The `sync-gmail` Edge Function needs to be redeployed with the new archive queue processing:

```bash
# Deploy updated function
supabase functions deploy sync-gmail

# Verify deployment
supabase functions list
```

**Test the Edge Function:**
```bash
# Get your service role key from Supabase Dashboard → Settings → API
export SUPABASE_SERVICE_KEY="your-service-role-key"

# Call the function manually
curl -X POST \
  "https://your-project.supabase.co/functions/v1/sync-gmail" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json"

# Check logs
supabase functions logs sync-gmail --tail
```

### 3. Build and Deploy Extension

```bash
# Build the extension with new changes
npm run build

# For development, load unpacked extension in Chrome:
# 1. Go to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the dist/ folder

# For production deployment:
# 1. Create a zip of the dist/ folder
# 2. Upload to Chrome Web Store
```

### 4. Verify Permissions

The extension doesn't need additional Gmail API permissions for archiving since:
- Archive happens server-side via Supabase Edge Function
- Edge Function uses stored OAuth tokens
- No new scopes required

## Testing Checklist

### ✅ Database Setup

```sql
-- 1. Verify archive_thread function works
SELECT archive_thread(
  (SELECT id FROM mail_threads LIMIT 1),
  true
);

-- Expected result: {"success": true, "thread_id": "...", "gmail_sync_queued": true}

-- 2. Check queue was created
SELECT * FROM gmail_archive_queue
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 5;

-- 3. Verify thread was marked archived
SELECT id, subject, status, archived_at, archive_source
FROM mail_threads
WHERE status = 'archived'
ORDER BY archived_at DESC
LIMIT 5;
```

### ✅ Edge Function

```sql
-- 1. Check that sync job processes queue
SELECT * FROM gmail_archive_queue
WHERE status = 'completed'
ORDER BY processed_at DESC
LIMIT 5;

-- 2. Check for failed queue items
SELECT id, gmail_thread_id, status, error_message, attempts
FROM gmail_archive_queue
WHERE status = 'failed'
ORDER BY created_at DESC;

-- 3. Monitor sync logs
-- View in Supabase Dashboard → Functions → sync-gmail → Logs
```

### ✅ Extension UI

1. **Test Archive Button Appears:**
   - Open extension
   - Go to Mail view
   - Verify "Archive" button shows on each thread
   - Verify button has archive icon

2. **Test Archive Action:**
   - Click Archive on a thread
   - Verify thread disappears immediately from UI
   - Check browser console for success message
   - Check Supabase database for updated status

3. **Test Archive in Gmail:**
   - Wait 2 minutes (for sync job to run)
   - Open Gmail in browser
   - Verify thread was removed from INBOX
   - Check in All Mail or Archive to confirm it's still there

4. **Test Error Handling:**
   - Temporarily break Supabase connection (invalid API key)
   - Try to archive a thread
   - Verify error message is shown to user
   - Restore connection and verify it works again

### ✅ Performance

1. **Check Query Performance:**
```sql
-- Ensure status filter uses index
EXPLAIN ANALYZE
SELECT * FROM mail_threads
WHERE status = 'active'
  AND last_message_date >= NOW() - INTERVAL '30 days'
ORDER BY last_message_date DESC
LIMIT 200;

-- Should show "Index Scan using idx_mail_threads_status"
```

2. **Monitor Queue Processing:**
```sql
-- Average processing time for queue items
SELECT
  AVG(EXTRACT(EPOCH FROM (processed_at - created_at))) as avg_seconds,
  COUNT(*) as total_processed
FROM gmail_archive_queue
WHERE status = 'completed'
  AND processed_at >= NOW() - INTERVAL '24 hours';
```

## Troubleshooting

### Thread Not Appearing in Archive Queue

**Symptom:** Clicking archive marks thread as archived, but nothing in `gmail_archive_queue`

**Solution:**
```sql
-- Check if RPC function is working
SELECT archive_thread(
  'thread-id-here',
  true  -- Make sure this is true for Gmail sync
);

-- Check RLS policies
SELECT * FROM gmail_archive_queue;  -- Should see rows if authenticated
```

### Archive Queue Items Stuck in "Pending"

**Symptom:** Queue items stay in pending status after 5+ minutes

**Solutions:**

1. **Check sync job is running:**
```sql
-- Check pg_cron jobs
SELECT * FROM cron.job WHERE jobname LIKE '%gmail%';

-- Check recent job runs
SELECT jobid, jobname, status, return_message, start_time
FROM cron.job_run_details
WHERE jobname LIKE '%gmail%'
ORDER BY start_time DESC
LIMIT 10;
```

2. **Manually trigger sync:**
```bash
curl -X POST \
  "https://your-project.supabase.co/functions/v1/sync-gmail" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY"
```

3. **Check Edge Function logs:**
```bash
supabase functions logs sync-gmail --tail
```

### Gmail API Errors

**Symptom:** Queue items marked as "failed" with Gmail API errors

**Common errors:**

1. **"Invalid credentials"**
   - OAuth token expired or revoked
   - User needs to reconnect Gmail in extension settings

2. **"Insufficient permissions"**
   - OAuth token doesn't have `gmail.modify` scope
   - User needs to reauthorize with correct scopes

3. **"Not found"**
   - Thread already deleted in Gmail
   - Mark as completed with cleanup:
   ```sql
   UPDATE gmail_archive_queue
   SET status = 'completed', error_message = 'Thread not found in Gmail'
   WHERE id = 'queue-item-id';
   ```

### Threads Reappearing After Archive

**Symptom:** Thread disappears but comes back after refresh

**Causes:**
1. **Archive failed in Gmail** - Check queue status
2. **Background sync re-fetched** - Check sync filter excludes archived threads
3. **User un-archived in Gmail** - Expected behavior

**Fix for #2:**
```typescript
// Verify this line exists in src/utils/mailThreadsSync.ts
'status': 'eq.active', // Only fetch active threads (exclude archived)
```

## Monitoring & Metrics

### Key Metrics to Track

```sql
-- Archive success rate (last 24 hours)
SELECT
  COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / COUNT(*) as success_rate_pct,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) FILTER (WHERE status = 'pending') as pending
FROM gmail_archive_queue
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- Average time from archive request to Gmail sync
SELECT
  AVG(EXTRACT(EPOCH FROM (processed_at - created_at))) / 60.0 as avg_minutes
FROM gmail_archive_queue
WHERE status = 'completed'
  AND created_at >= NOW() - INTERVAL '24 hours';

-- Most common error messages
SELECT
  error_message,
  COUNT(*) as occurrences
FROM gmail_archive_queue
WHERE status = 'failed'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY error_message
ORDER BY occurrences DESC;
```

### Cleanup Old Queue Items

Run periodically to clean up processed items:

```sql
-- Manual cleanup (keeps last 7 days)
DELETE FROM gmail_archive_queue
WHERE status = 'completed'
  AND processed_at < NOW() - INTERVAL '7 days';

-- Or use the built-in function
SELECT cleanup_archive_queue();
```

## Rollback Plan

If issues arise, you can rollback:

### 1. Disable Archive Button in UI

```typescript
// Temporarily comment out in src/components/Mail/MailView.tsx
// <button onClick={(e) => handleArchive(thread.id, e)}>
//   Archive
// </button>
```

### 2. Stop Queue Processing

```typescript
// Comment out in supabase/functions/sync-gmail/index.ts
// const archiveResults = await processArchiveQueue(supabase, encryptionKey)
```

### 3. Full Database Rollback

```sql
-- Drop new table
DROP TABLE IF EXISTS gmail_archive_queue CASCADE;

-- Remove new columns
ALTER TABLE mail_threads
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS is_escalation,
  DROP COLUMN IF EXISTS archived_at,
  DROP COLUMN IF EXISTS archive_source;

-- Drop functions
DROP FUNCTION IF EXISTS archive_thread;
DROP FUNCTION IF EXISTS get_pending_archive_queue;
DROP FUNCTION IF EXISTS update_archive_queue_status;
```

## Next Steps (Phase 2)

After archive is stable, consider:

1. **Enhanced Views** - Add "Escalations", "Waiting", "Newsletters" views
2. **Bulk Archive** - Archive multiple threads at once
3. **Auto-Archive Rules** - Newsletters after 7 days, etc.
4. **Archive Analytics** - Dashboard showing archive patterns
5. **Unarchive** - Allow users to restore archived threads

## Support

For issues or questions:
1. Check Supabase Dashboard → Logs
2. Check browser console (F12)
3. Run SQL diagnostics above
4. Check GitHub issues

---

**Deployment Checklist:**
- [ ] Run database migration
- [ ] Deploy sync-gmail Edge Function
- [ ] Build and deploy extension
- [ ] Test archive button appears
- [ ] Test archive marks thread as archived in DB
- [ ] Test archive queues Gmail sync
- [ ] Test Gmail sync processes queue
- [ ] Test archived threads don't reappear
- [ ] Monitor for 24 hours
- [ ] Set up automated cleanup job
