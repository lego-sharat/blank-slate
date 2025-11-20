# Phase 1+2 Deployment Verification

**Deployment Date**: 2025-11-20
**Deployed Features**: Archive functionality + Enhanced 6-view navigation with AI detection

---

## ✅ Verification Checklist

### 1. Database Schema Verification

```sql
-- Check mail_threads table has new columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'mail_threads'
AND column_name IN ('status', 'is_escalation', 'escalation_reason', 'archived_at', 'customer_name', 'customer_mrr');

-- Check gmail_archive_queue table exists
SELECT COUNT(*) FROM gmail_archive_queue;

-- Check RPC functions exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_name IN ('archive_thread', 'get_pending_archive_queue', 'update_archive_queue_status');
```

**Expected Results**:
- ✅ All 6 columns exist in mail_threads
- ✅ gmail_archive_queue table is accessible
- ✅ All 3 RPC functions are present

---

### 2. Edge Function Verification

```bash
# Check process-mail-summary function logs
supabase functions logs process-mail-summary --tail

# Trigger a test summary (use Supabase dashboard or API)
curl -X POST 'https://[your-project].supabase.co/functions/v1/process-mail-summary' \
  -H 'Authorization: Bearer [your-anon-key]' \
  -H 'Content-Type: application/json' \
  -d '{"userId": "[test-user-id]", "threadIds": ["[test-thread-id]"]}'
```

**Expected Output**:
```
[AI Summary] Generating summary for thread...
✓ Processed thread [thread-id]
```

**Check for new fields in response**:
- ✅ `isEscalation` (boolean)
- ✅ `escalationReason` (string or null)
- ✅ `status` (active/waiting/resolved)

---

### 3. Archive Functionality Test

**Step 1: Archive a thread from UI**
1. Open extension → Navigate to Mail view
2. Click "Archive" button on any thread
3. Thread should **disappear immediately** (optimistic update)

**Step 2: Verify database update**
```sql
-- Check thread was marked as archived
SELECT id, subject, status, archived_at, archive_source
FROM mail_threads
WHERE id = '[archived-thread-id]';

-- Check archive queue entry was created
SELECT * FROM gmail_archive_queue
WHERE thread_id = '[archived-thread-id]'
ORDER BY created_at DESC LIMIT 1;
```

**Expected Results**:
- ✅ Thread status = 'archived'
- ✅ archived_at timestamp is set
- ✅ archive_source = 'user'
- ✅ Queue entry status = 'pending' (initially)

**Step 3: Wait 2 minutes for sync-gmail to process queue**

**Step 4: Verify Gmail was updated**
```sql
-- Check queue entry is now completed
SELECT id, status, processed_at, attempts, error_message
FROM gmail_archive_queue
WHERE thread_id = '[archived-thread-id]';
```

**Expected Results**:
- ✅ Queue status = 'completed'
- ✅ processed_at timestamp is set
- ✅ attempts = 1 (or more if retried)
- ✅ error_message is NULL

**Step 5: Check Gmail directly**
- Open Gmail in browser
- Search for thread subject
- Thread should be **archived** (not in Inbox)

---

### 4. AI Escalation Detection Test

**Test Case 1: Angry Customer (Should be flagged)**

Create a test thread with messages like:
```
Subject: This is unacceptable!

Customer: I've been waiting for 3 days for a response. This is completely unacceptable.
If this isn't resolved immediately, I'm switching to your competitor and leaving a
negative review. This is blocking our entire launch!
```

**Expected AI Output**:
```json
{
  "isEscalation": true,
  "escalationReason": "Customer expressing frustration with long wait time and threatening to churn",
  "status": "active"
}
```

**Verify in Database**:
```sql
SELECT id, subject, is_escalation, escalation_reason, status
FROM mail_threads
WHERE subject LIKE '%unacceptable%';
```

---

**Test Case 2: Normal Support Thread (Should NOT be flagged)**

```
Subject: Question about integration

Customer: Hi, I was wondering if you support integration with Klaviyo?
Thanks for your help!

You: Yes, we do support Klaviyo! Here's how to set it up...

Customer: Perfect, thank you so much!
```

**Expected AI Output**:
```json
{
  "isEscalation": false,
  "escalationReason": null,
  "status": "resolved"
}
```

---

### 5. Thread Status Classification Test

**Test Case 1: Waiting on Customer (status = 'waiting')**

```
Last message from you: "Could you send me your store URL so I can investigate this further?"
```

**Expected**: `status = 'waiting'`

---

**Test Case 2: Resolved Thread (status = 'resolved')**

```
Customer: "Thanks so much! This is exactly what I needed. Really appreciate your help!"
```

**Expected**: `status = 'resolved'`

---

**Test Case 3: Active Thread (status = 'active')**

```
Customer: "I'm still having issues with the checkout page. Can you help?"
```

**Expected**: `status = 'active'`

---

### 6. Enhanced Navigation Views Test

**UI Verification**:
1. Open extension → Mail view
2. Verify navigation sidebar shows 7 views:
   - 📧 All Mail
   - 🔥 Escalations
   - 🎯 Onboarding
   - 💬 Support
   - 📰 Newsletters
   - ✅ My Todos
   - ⏳ Waiting

**Count Badges**:
- Click each view
- Verify count badge matches number of threads shown
- Counts should update in real-time

**Filtering Test**:
- Click "Escalations" → Should show only threads with `is_escalation = true`
- Click "Waiting" → Should show only threads with `status = 'waiting'`
- Click "My Todos" → Should show only threads with action_items
- Click "Newsletters" → Should show threads with 'newsletter' or 'promotional' labels

---

### 7. Background Sync Verification

**Check sync is running**:
```bash
# View background worker logs in browser console
# Open extension → Right-click → Inspect → Console

# Look for:
# "Syncing mail threads from Supabase..."
# "Mail sync complete: X total, Y onboarding, Z support"
```

**Monitor sync frequency**:
- Background worker syncs every 2 minutes
- Archive queue processed every 2 minutes
- Supabase sync every 10 minutes

**Verify chrome.storage cache**:
```javascript
// In browser console (extension context)
chrome.storage.local.get('mailMessages', (result) => {
  console.log('Cached threads:', result.mailMessages);
});
```

---

## 🐛 Common Issues & Troubleshooting

### Issue 1: AI not detecting escalations

**Symptom**: All threads have `is_escalation = false`

**Solution**:
```sql
-- Force re-summarization of threads
UPDATE mail_threads
SET summary_generated_at = NULL
WHERE category IN ('onboarding', 'support');

-- Wait 2 minutes for sync-gmail to trigger process-mail-summary
```

---

### Issue 2: Archive queue stuck in 'pending'

**Symptom**: Queue entries remain 'pending' for >5 minutes

**Debug**:
```sql
-- Check failed queue entries
SELECT * FROM gmail_archive_queue
WHERE status = 'failed'
ORDER BY created_at DESC;

-- Check edge function logs
```

**Solution**:
```sql
-- Retry failed items
UPDATE gmail_archive_queue
SET status = 'pending', attempts = 0
WHERE status = 'failed';
```

---

### Issue 3: Views showing incorrect counts

**Symptom**: Count badges don't match visible threads

**Solution**:
- Hard refresh extension (Ctrl+Shift+R)
- Check browser console for errors
- Verify filters in MailView.tsx are correct

---

### Issue 4: OAuth tokens expired

**Symptom**: No new emails syncing

**Debug**:
```sql
SELECT user_id, provider, expires_at,
       CASE
         WHEN expires_at < EXTRACT(EPOCH FROM NOW()) * 1000 THEN 'EXPIRED'
         ELSE 'VALID'
       END as token_status
FROM oauth_tokens;
```

**Solution**:
- sync-gmail should auto-refresh tokens
- If not, disconnect and reconnect Gmail in Settings

---

## 📊 Success Metrics

After deployment, monitor these metrics:

### Performance
- [ ] UI loads from cache in <100ms
- [ ] Archive action completes in <200ms
- [ ] Background sync completes in <10 seconds

### Reliability
- [ ] Archive success rate >99% (check queue failures)
- [ ] AI classification accuracy >95% (manual review)
- [ ] Zero data loss on failed operations

### User Experience
- [ ] Escalations view shows genuinely urgent threads
- [ ] Waiting view accurately reflects threads awaiting customer
- [ ] Count badges update correctly
- [ ] Archive instantly removes from UI

---

## 🎯 Next Steps After Verification

Once verified, consider:

1. **Phase 4: Advanced Features**
   - Newsletter auto-archive (7-day old)
   - Todo management panel
   - Bulk operations
   - Smart filters

2. **Phase 3 Minor Improvements**
   - Offline queue for user actions
   - Retry UI for failed operations
   - Network status indicator

3. **Production Monitoring**
   - Set up Supabase alerts for edge function errors
   - Monitor archive queue failure rate
   - Track AI classification accuracy

---

**Deployment Complete!** 🚀

Use `./scripts/monitor-mail.sh archive-queue` to monitor archive processing.
