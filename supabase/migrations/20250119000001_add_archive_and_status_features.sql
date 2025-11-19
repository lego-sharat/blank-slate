-- Migration: Add archive, status, and enhanced thread features
-- This enables UI-driven archiving and better thread management

-- Add status and escalation tracking to mail_threads
ALTER TABLE mail_threads ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
  -- Values: 'active' | 'archived' | 'waiting' | 'resolved'

ALTER TABLE mail_threads ADD COLUMN IF NOT EXISTS is_escalation BOOLEAN DEFAULT false;
ALTER TABLE mail_threads ADD COLUMN IF NOT EXISTS escalation_reason TEXT;
ALTER TABLE mail_threads ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;

-- Add archive metadata
ALTER TABLE mail_threads ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE mail_threads ADD COLUMN IF NOT EXISTS archive_source TEXT;
  -- Values: 'user' | 'auto_newsletter' | 'supabase_cron'
ALTER TABLE mail_threads ADD COLUMN IF NOT EXISTS archive_requested_from_ui BOOLEAN DEFAULT false;

-- Add customer metadata for better UI display
ALTER TABLE mail_threads ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE mail_threads ADD COLUMN IF NOT EXISTS customer_mrr NUMERIC(10,2) DEFAULT 0;

-- Add computed/cached fields for UI performance
ALTER TABLE mail_threads ADD COLUMN IF NOT EXISTS last_message_from_team BOOLEAN DEFAULT false;
ALTER TABLE mail_threads ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0;

-- Add newsletter auto-archive tracking
ALTER TABLE mail_threads ADD COLUMN IF NOT EXISTS auto_archive_after TIMESTAMPTZ;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_mail_threads_status ON mail_threads(user_id, status);
CREATE INDEX IF NOT EXISTS idx_mail_threads_escalation ON mail_threads(user_id, is_escalation)
  WHERE is_escalation = true;
CREATE INDEX IF NOT EXISTS idx_mail_threads_archived ON mail_threads(user_id, archived_at DESC)
  WHERE status = 'archived';

-- Add comments
COMMENT ON COLUMN mail_threads.status IS 'Thread status: active (in inbox), archived (removed from inbox), waiting (waiting on customer), resolved (completed)';
COMMENT ON COLUMN mail_threads.is_escalation IS 'True if thread requires immediate attention (e.g., angry customer, high MRR churn risk)';
COMMENT ON COLUMN mail_threads.archive_source IS 'Source that triggered archive: user (manual), auto_newsletter (auto after 7 days), supabase_cron (scheduled job)';
COMMENT ON COLUMN mail_threads.customer_name IS 'Extracted or manually set customer name for display';
COMMENT ON COLUMN mail_threads.customer_mrr IS 'Monthly recurring revenue for this customer (in USD)';
COMMENT ON COLUMN mail_threads.auto_archive_after IS 'For newsletters: timestamp when this thread should be auto-archived';

-- Create gmail_archive_queue table for async Gmail operations
CREATE TABLE IF NOT EXISTS gmail_archive_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES mail_threads(id) ON DELETE CASCADE,
  gmail_thread_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
    -- Values: 'pending' | 'processing' | 'completed' | 'failed'
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  UNIQUE(thread_id)
);

-- Add index for processing queue
CREATE INDEX IF NOT EXISTS idx_gmail_archive_queue_pending
  ON gmail_archive_queue(status, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_gmail_archive_queue_retry
  ON gmail_archive_queue(status, next_retry_at)
  WHERE status = 'failed' AND next_retry_at IS NOT NULL;

-- Enable RLS on archive queue
ALTER TABLE gmail_archive_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies for archive queue
CREATE POLICY "Users can view their own archive queue"
  ON gmail_archive_queue FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own archive requests"
  ON gmail_archive_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role has full access to archive queue"
  ON gmail_archive_queue FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Function to archive a thread (called from extension UI)
CREATE OR REPLACE FUNCTION archive_thread(
  p_thread_id UUID,
  p_archive_in_gmail BOOLEAN DEFAULT true
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_gmail_thread_id TEXT;
  v_result JSON;
BEGIN
  -- Get current user
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get gmail_thread_id for the thread
  SELECT gmail_thread_id INTO v_gmail_thread_id
  FROM mail_threads
  WHERE id = p_thread_id AND user_id = v_user_id;

  IF v_gmail_thread_id IS NULL THEN
    RAISE EXCEPTION 'Thread not found or access denied';
  END IF;

  -- Update thread status
  UPDATE mail_threads
  SET
    status = 'archived',
    archived_at = NOW(),
    archive_source = 'user',
    archive_requested_from_ui = true
  WHERE id = p_thread_id AND user_id = v_user_id;

  -- If Gmail sync is requested, add to queue
  IF p_archive_in_gmail THEN
    INSERT INTO gmail_archive_queue (
      user_id,
      thread_id,
      gmail_thread_id,
      status
    ) VALUES (
      v_user_id,
      p_thread_id,
      v_gmail_thread_id,
      'pending'
    )
    ON CONFLICT (thread_id) DO UPDATE
    SET
      status = 'pending',
      attempts = 0,
      error_message = NULL,
      next_retry_at = NULL;
  END IF;

  -- Return success with thread info
  v_result := json_build_object(
    'success', true,
    'thread_id', p_thread_id,
    'gmail_sync_queued', p_archive_in_gmail
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION archive_thread TO authenticated;

-- Function to get pending archive queue items (for cron job)
CREATE OR REPLACE FUNCTION get_pending_archive_queue(
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  thread_id UUID,
  gmail_thread_id TEXT,
  attempts INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.id,
    q.user_id,
    q.thread_id,
    q.gmail_thread_id,
    q.attempts
  FROM gmail_archive_queue q
  WHERE q.status = 'pending'
    OR (q.status = 'failed' AND q.attempts < q.max_attempts AND q.next_retry_at <= NOW())
  ORDER BY q.created_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_pending_archive_queue TO service_role;

-- Function to update archive queue status
CREATE OR REPLACE FUNCTION update_archive_queue_status(
  p_queue_id UUID,
  p_status TEXT,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_attempts INTEGER;
  v_next_retry TIMESTAMPTZ;
BEGIN
  -- Get current attempts
  SELECT attempts INTO v_attempts
  FROM gmail_archive_queue
  WHERE id = p_queue_id;

  -- Calculate next retry time for failed attempts (exponential backoff)
  IF p_status = 'failed' THEN
    v_next_retry := NOW() + (POWER(2, v_attempts) || ' minutes')::INTERVAL;
  END IF;

  -- Update queue item
  UPDATE gmail_archive_queue
  SET
    status = p_status,
    error_message = p_error_message,
    attempts = CASE WHEN p_status = 'failed' THEN attempts + 1 ELSE attempts END,
    processed_at = CASE WHEN p_status IN ('completed', 'failed') THEN NOW() ELSE processed_at END,
    next_retry_at = v_next_retry
  WHERE id = p_queue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_archive_queue_status TO service_role;

-- Function to clean up old completed/failed archive queue items
CREATE OR REPLACE FUNCTION cleanup_archive_queue()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER := 0;
  v_temp_count INTEGER;
BEGIN
  -- Delete completed items older than 7 days
  DELETE FROM gmail_archive_queue
  WHERE status = 'completed'
    AND processed_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Delete failed items that exceeded max attempts and are older than 7 days
  DELETE FROM gmail_archive_queue
  WHERE status = 'failed'
    AND attempts >= max_attempts
    AND processed_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_deleted_count := v_deleted_count + v_temp_count;

  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION cleanup_archive_queue TO service_role;

-- Add comment to table
COMMENT ON TABLE gmail_archive_queue IS 'Queue for archiving threads in Gmail asynchronously. When users archive from UI, threads are marked as archived in DB immediately and queued for Gmail API sync.';
