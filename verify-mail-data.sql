-- SQL queries to verify mail_threads data in Supabase

-- 1. Check if the table exists and see its structure
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'mail_threads'
ORDER BY ordinal_position;

-- 2. Count total records in mail_threads
SELECT COUNT(*) as total_threads
FROM mail_threads;

-- 3. Check the date range of your data
SELECT
    MIN(last_message_date) as earliest_message,
    MAX(last_message_date) as latest_message,
    COUNT(*) as total_count
FROM mail_threads;

-- 4. See sample of most recent threads (with key fields)
SELECT
    id,
    subject,
    category,
    last_message_date,
    created_at,
    user_id,
    is_unread,
    message_count
FROM mail_threads
ORDER BY last_message_date DESC
LIMIT 10;

-- 5. Check threads from last 30 days (same filter as the API call)
SELECT
    COUNT(*) as threads_last_30_days,
    MIN(last_message_date) as earliest,
    MAX(last_message_date) as latest
FROM mail_threads
WHERE last_message_date >= NOW() - INTERVAL '30 days';

-- 6. Check threads matching the exact API filter
-- (Replace the date with the one from your curl command)
SELECT
    id,
    subject,
    last_message_date,
    category
FROM mail_threads
WHERE last_message_date >= '2025-10-20T13:25:21.079Z'
ORDER BY last_message_date DESC
LIMIT 10;

-- 7. Check for Row Level Security (RLS) policies
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'mail_threads';

-- 8. Check all threads regardless of date (to see if data exists at all)
SELECT
    id,
    subject,
    last_message_date,
    category,
    user_id
FROM mail_threads
ORDER BY created_at DESC
LIMIT 20;

-- 9. Check user_id distribution (to see if RLS might be filtering by user)
SELECT
    user_id,
    COUNT(*) as thread_count
FROM mail_threads
GROUP BY user_id;

-- 10. If you're logged in, check your current user_id
SELECT auth.uid() as current_user_id;
