-- Quick diagnosis for mail_threads data

-- Run this first to check if data exists at all (bypasses RLS if you're admin)
SELECT
    COUNT(*) as total_threads,
    COUNT(DISTINCT user_id) as unique_users,
    MIN(last_message_date) as earliest_message,
    MAX(last_message_date) as latest_message
FROM mail_threads;

-- Show all threads (ignoring RLS - only works if you run as postgres/admin)
SELECT
    id,
    user_id,
    subject,
    category,
    last_message_date,
    is_unread,
    message_count
FROM mail_threads
ORDER BY last_message_date DESC
LIMIT 10;

-- Check what user_id values exist
SELECT
    user_id,
    COUNT(*) as thread_count,
    MAX(last_message_date) as latest_thread
FROM mail_threads
GROUP BY user_id;
