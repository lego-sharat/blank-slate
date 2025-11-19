# Mail Sync Fix Summary

## Issues Fixed

### 1. Supabase Credentials Not Found
**Problem:** Mail sync was looking for credentials in the wrong place
**Fix:** Updated `getSupabaseCredentials()` to read from `settings` object

### 2. RLS Authentication Failure
**Problem:** API calls used anon key instead of user session token, causing RLS to block all requests
**Fix:** All API calls now use the authenticated user's `access_token`

## Changes Made

### File: `src/utils/mailThreadsSync.ts`

1. **Added Settings interface** (lines 8-11)
   - Proper TypeScript typing for settings object

2. **Fixed credential lookup** (line 57)
   - Changed from `chrome.storage.local.get(['supabaseUrl', 'supabaseKey'])`
   - To: `chrome.storage.local.get('settings')`

3. **Added getSession() function** (lines 76-94)
   - Retrieves user's authenticated session from chrome.storage
   - Returns access_token for RLS authentication

4. **Updated supabaseFetch()** (lines 96-131)
   - Now requires authenticated session
   - Uses `session.access_token` instead of anon key for Authorization header
   - Returns empty array if user not authenticated

5. **Updated markThreadAsRead()** (lines 218-260)
   - Added session authentication
   - Uses user's access token for RLS

6. **Updated disconnectGmail()** (lines 313-352)
   - Added session authentication
   - Uses user's access token for RLS

## Testing

### 1. Verify SQL Queries
Run the queries in `quick-diagnosis.sql` to check if data exists:

```bash
# In Supabase SQL Editor, run:
cat quick-diagnosis.sql
```

### 2. Test with Authenticated Session

To test the API with proper authentication, you need the user's access token from their session:

```javascript
// In browser console (extension context):
chrome.storage.local.get('supabaseSession', (result) => {
  console.log('Session:', result.supabaseSession);
});
```

Then use that token in your curl:

```bash
curl 'https://YOUR_SUPABASE_URL/rest/v1/mail_threads?last_message_date=gte.2025-10-20T13:25:21.079Z&order=last_message_date.desc&limit=200' \
  -H 'apikey: YOUR_ANON_KEY' \
  -H 'authorization: Bearer YOUR_USER_ACCESS_TOKEN' \
  -H 'content-type: application/json'
```

### 3. Expected Logs

After the fix, you should see:
- ✅ `[Mail Threads] Fetching threads from Supabase...`
- ✅ `[Mail Threads] Fetched X threads (Y onboarding, Z support)`

Instead of:
- ❌ `[Mail Threads] Supabase not configured`
- ❌ `[Mail Threads] No Supabase credentials available`

## Why This Was Happening

The `mail_threads` table has Row Level Security (RLS) enabled with this policy:

```sql
CREATE POLICY "Users can view their own mail threads"
  ON mail_threads FOR SELECT
  USING (auth.uid() = user_id);
```

This means:
- Anon key doesn't provide user context (`auth.uid()` is NULL)
- User's access token provides authentication context
- Only threads where `user_id` matches the authenticated user are returned

## Files Included

- `verify-mail-data.sql` - Comprehensive SQL queries to verify data
- `quick-diagnosis.sql` - Quick diagnostic queries
- `MAIL_FIX_SUMMARY.md` - This file

## Git Hooks Installed

A pre-push hook now runs TypeScript type checking before every push:
- Install: `npm run setup`
- Location: `.githooks/pre-push`
- Bypass (not recommended): `git push --no-verify`
