-- ============================================================================
-- CONSOLIDATED MIGRATION: Complete Mail Client Schema
-- Created: 2025-01-21
-- Description: Single comprehensive migration for mail client with OAuth,
--              encryption, AI processing, archiving, billing, and team tracking
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- OAUTH TOKENS TABLE (with encryption)
-- ============================================================================

CREATE TABLE oauth_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('gmail')),

  -- Encrypted fields stored as bytea
  refresh_token_encrypted BYTEA NOT NULL,
  access_token_encrypted BYTEA NOT NULL,
  expires_at BIGINT NOT NULL,
  last_history_id TEXT,

  -- Version for key rotation support
  encryption_version INTEGER DEFAULT 1,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, provider)
);

CREATE INDEX idx_oauth_user_provider ON oauth_tokens(user_id, provider);

-- Enable RLS
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own tokens"
  ON oauth_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tokens"
  ON oauth_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tokens"
  ON oauth_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tokens"
  ON oauth_tokens FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to tokens"
  ON oauth_tokens FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Trigger for updated_at
CREATE TRIGGER update_oauth_tokens_updated_at
  BEFORE UPDATE ON oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE oauth_tokens IS 'OAuth tokens with pgcrypto encryption. Use store_oauth_token() and get_oauth_token() functions.';

-- ============================================================================
-- MAIL THREADS TABLE
-- ============================================================================

CREATE TABLE mail_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_thread_id TEXT NOT NULL,

  -- Thread metadata
  subject TEXT NOT NULL,
  participants JSONB NOT NULL DEFAULT '[]',
  category TEXT NOT NULL DEFAULT 'general', -- onboarding | support | general

  -- Gmail labels (INBOX, UNREAD, SENT, DTC, etc.)
  gmail_labels TEXT[] DEFAULT '{}',

  -- AI-generated fields
  ai_topic TEXT,
  ai_labels TEXT[] DEFAULT '{}',
  integration_name TEXT,
  summary TEXT,
  action_items JSONB DEFAULT '[]',
  satisfaction_score INTEGER CHECK (satisfaction_score >= 1 AND satisfaction_score <= 10),
  satisfaction_analysis TEXT,
  summary_generated_at TIMESTAMPTZ,

  -- Status and escalation
  status TEXT DEFAULT 'active', -- active | archived | waiting | resolved
  is_escalation BOOLEAN DEFAULT false,
  escalation_reason TEXT,
  escalation_type TEXT, -- customer | team | null
  escalated_at TIMESTAMPTZ,

  -- Archive metadata
  archived_at TIMESTAMPTZ,
  archive_source TEXT, -- user | auto_newsletter | supabase_cron
  archive_requested_from_ui BOOLEAN DEFAULT false,
  auto_archive_after TIMESTAMPTZ,

  -- Customer metadata
  customer_name TEXT,
  customer_mrr NUMERIC(10,2) DEFAULT 0,

  -- Billing tracking
  is_billing BOOLEAN DEFAULT false,
  billing_status TEXT, -- sent | accepted | pending | null
  billing_sent_at TIMESTAMPTZ,
  billing_accepted_at TIMESTAMPTZ,

  -- Participant tracking (team vs external)
  internal_participants TEXT[], -- @appbrew.tech emails
  external_participants TEXT[], -- Non-team emails
  is_directly_addressed BOOLEAN DEFAULT false, -- True if sharat@appbrew.tech in to/cc

  -- Computed/cached fields
  last_message_from_team BOOLEAN DEFAULT false,
  unread_count INTEGER DEFAULT 0,

  -- Thread stats
  message_count INTEGER NOT NULL DEFAULT 1,
  is_unread BOOLEAN NOT NULL DEFAULT false,
  has_attachments BOOLEAN NOT NULL DEFAULT false,

  -- Timestamps
  first_message_date TIMESTAMPTZ NOT NULL,
  last_message_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint
  UNIQUE(user_id, gmail_thread_id),

  -- Check constraints
  CONSTRAINT check_escalation_type CHECK (
    (is_escalation = false AND escalation_type IS NULL) OR
    (is_escalation = true AND escalation_type IN ('customer', 'team'))
  ),
  CONSTRAINT check_billing_status CHECK (
    (is_billing = false AND billing_status IS NULL) OR
    (is_billing = true AND billing_status IN ('sent', 'accepted', 'pending'))
  )
);

-- Indexes
CREATE INDEX idx_mail_threads_user_id ON mail_threads(user_id);
CREATE INDEX idx_mail_threads_gmail_thread_id ON mail_threads(user_id, gmail_thread_id);
CREATE INDEX idx_mail_threads_category ON mail_threads(user_id, category);
CREATE INDEX idx_mail_threads_ai_topic ON mail_threads(user_id, ai_topic);
CREATE INDEX idx_mail_threads_integration ON mail_threads(user_id, integration_name) WHERE integration_name IS NOT NULL;
CREATE INDEX idx_mail_threads_unread ON mail_threads(user_id, is_unread) WHERE is_unread = true;
CREATE INDEX idx_mail_threads_last_message ON mail_threads(user_id, last_message_date DESC);
CREATE INDEX idx_mail_threads_status ON mail_threads(user_id, status);
CREATE INDEX idx_mail_threads_escalation ON mail_threads(user_id, is_escalation) WHERE is_escalation = true;
CREATE INDEX idx_mail_threads_archived ON mail_threads(user_id, archived_at DESC) WHERE status = 'archived';
CREATE INDEX idx_mail_threads_escalation_type ON mail_threads(user_id, escalation_type) WHERE escalation_type IS NOT NULL;
CREATE INDEX idx_mail_threads_billing ON mail_threads(user_id, is_billing) WHERE is_billing = true;
CREATE INDEX idx_mail_threads_billing_status ON mail_threads(user_id, billing_status) WHERE billing_status IS NOT NULL;
CREATE INDEX idx_mail_threads_is_directly_addressed ON mail_threads(user_id, is_directly_addressed) WHERE is_directly_addressed = true;

-- GIN indexes for array columns
CREATE INDEX idx_mail_threads_gmail_labels ON mail_threads USING GIN(gmail_labels);
CREATE INDEX idx_mail_threads_ai_labels ON mail_threads USING GIN(ai_labels);

-- Enable RLS
ALTER TABLE mail_threads ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own threads"
  ON mail_threads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own threads"
  ON mail_threads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own threads"
  ON mail_threads FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own threads"
  ON mail_threads FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE mail_threads IS 'Email threads with AI-generated summaries and categorization';

-- ============================================================================
-- MAIL MESSAGES TABLE
-- ============================================================================

CREATE TABLE mail_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_message_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,

  -- Message metadata
  subject TEXT NOT NULL,
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_addresses JSONB NOT NULL DEFAULT '[]',
  date TIMESTAMPTZ NOT NULL,

  -- Content
  snippet TEXT,
  body_preview TEXT,

  -- Categorization
  labels TEXT[] DEFAULT '{}',
  category TEXT NOT NULL DEFAULT 'general',

  -- Flags
  is_unread BOOLEAN NOT NULL DEFAULT false,
  has_attachments BOOLEAN NOT NULL DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint
  UNIQUE(user_id, gmail_message_id)
);

-- Indexes
CREATE INDEX idx_mail_messages_user_id ON mail_messages(user_id);
CREATE INDEX idx_mail_messages_thread_id ON mail_messages(user_id, thread_id);
CREATE INDEX idx_mail_messages_date ON mail_messages(user_id, date DESC);

-- Enable RLS
ALTER TABLE mail_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own messages"
  ON mail_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own messages"
  ON mail_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own messages"
  ON mail_messages FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages"
  ON mail_messages FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE mail_messages IS 'Individual email messages within threads';

-- ============================================================================
-- GMAIL ARCHIVE QUEUE TABLE
-- ============================================================================

CREATE TABLE gmail_archive_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES mail_threads(id) ON DELETE CASCADE,
  gmail_thread_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | processing | completed | failed
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,

  UNIQUE(thread_id)
);

-- Indexes
CREATE INDEX idx_gmail_archive_queue_pending
  ON gmail_archive_queue(status, created_at)
  WHERE status = 'pending';

CREATE INDEX idx_gmail_archive_queue_retry
  ON gmail_archive_queue(status, next_retry_at)
  WHERE status = 'failed' AND next_retry_at IS NOT NULL;

-- Enable RLS
ALTER TABLE gmail_archive_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own archive queue"
  ON gmail_archive_queue FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own archive requests"
  ON gmail_archive_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role has full access to archive queue"
  ON gmail_archive_queue FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

COMMENT ON TABLE gmail_archive_queue IS 'Queue for archiving threads in Gmail asynchronously';

-- ============================================================================
-- ENCRYPTION FUNCTIONS
-- ============================================================================

-- Encrypt token
CREATE OR REPLACE FUNCTION encrypt_token(token TEXT, encryption_key TEXT)
RETURNS BYTEA AS $$
BEGIN
  IF token IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_encrypt(token, encryption_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrypt token
CREATE OR REPLACE FUNCTION decrypt_token(encrypted_token BYTEA, encryption_key TEXT)
RETURNS TEXT AS $$
BEGIN
  IF encrypted_token IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_decrypt(encrypted_token, encryption_key);
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to decrypt token: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Store OAuth token
CREATE OR REPLACE FUNCTION store_oauth_token(
  p_user_id UUID,
  p_provider TEXT,
  p_refresh_token TEXT,
  p_access_token TEXT,
  p_expires_at BIGINT,
  p_encryption_key TEXT,
  p_last_history_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_token_id UUID;
BEGIN
  INSERT INTO oauth_tokens (
    user_id,
    provider,
    refresh_token_encrypted,
    access_token_encrypted,
    expires_at,
    last_history_id
  ) VALUES (
    p_user_id,
    p_provider,
    encrypt_token(p_refresh_token, p_encryption_key),
    encrypt_token(p_access_token, p_encryption_key),
    p_expires_at,
    p_last_history_id
  )
  ON CONFLICT (user_id, provider)
  DO UPDATE SET
    refresh_token_encrypted = encrypt_token(p_refresh_token, p_encryption_key),
    access_token_encrypted = encrypt_token(p_access_token, p_encryption_key),
    expires_at = p_expires_at,
    last_history_id = COALESCE(p_last_history_id, oauth_tokens.last_history_id),
    updated_at = NOW()
  RETURNING id INTO v_token_id;

  RETURN v_token_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get OAuth token
CREATE OR REPLACE FUNCTION get_oauth_token(
  p_user_id UUID,
  p_provider TEXT,
  p_encryption_key TEXT
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  provider TEXT,
  refresh_token TEXT,
  access_token TEXT,
  expires_at BIGINT,
  last_history_id TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ot.id,
    ot.user_id,
    ot.provider,
    decrypt_token(ot.refresh_token_encrypted, p_encryption_key) as refresh_token,
    decrypt_token(ot.access_token_encrypted, p_encryption_key) as access_token,
    ot.expires_at,
    ot.last_history_id,
    ot.created_at,
    ot.updated_at
  FROM oauth_tokens ot
  WHERE ot.user_id = p_user_id
    AND ot.provider = p_provider;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get all OAuth tokens
CREATE OR REPLACE FUNCTION get_all_oauth_tokens(
  p_provider TEXT,
  p_encryption_key TEXT
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  provider TEXT,
  refresh_token TEXT,
  access_token TEXT,
  expires_at BIGINT,
  last_history_id TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ot.id,
    ot.user_id,
    ot.provider,
    decrypt_token(ot.refresh_token_encrypted, p_encryption_key) as refresh_token,
    decrypt_token(ot.access_token_encrypted, p_encryption_key) as access_token,
    ot.expires_at,
    ot.last_history_id,
    ot.created_at,
    ot.updated_at
  FROM oauth_tokens ot
  WHERE ot.provider = p_provider;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update OAuth access token
CREATE OR REPLACE FUNCTION update_oauth_access_token(
  p_user_id UUID,
  p_provider TEXT,
  p_access_token TEXT,
  p_expires_at BIGINT,
  p_encryption_key TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE oauth_tokens
  SET
    access_token_encrypted = encrypt_token(p_access_token, p_encryption_key),
    expires_at = p_expires_at,
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND provider = p_provider;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Refresh OAuth token with lock
CREATE OR REPLACE FUNCTION refresh_oauth_token_with_lock(
  p_user_id UUID,
  p_provider TEXT,
  p_access_token TEXT,
  p_expires_at BIGINT,
  p_encryption_key TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_lock_id BIGINT;
  v_got_lock BOOLEAN;
BEGIN
  v_lock_id := ('x' || md5(p_user_id::TEXT || p_provider))::bit(64)::BIGINT;
  v_got_lock := pg_try_advisory_xact_lock(v_lock_id);

  IF NOT v_got_lock THEN
    RAISE NOTICE 'Token refresh already in progress for user %, skipping', p_user_id;
    RETURN FALSE;
  END IF;

  PERFORM update_oauth_access_token(p_user_id, p_provider, p_access_token, p_expires_at, p_encryption_key);
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- MAIL FUNCTIONS
-- ============================================================================

-- Archive thread
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
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT gmail_thread_id INTO v_gmail_thread_id
  FROM mail_threads
  WHERE id = p_thread_id AND user_id = v_user_id;

  IF v_gmail_thread_id IS NULL THEN
    RAISE EXCEPTION 'Thread not found or access denied';
  END IF;

  UPDATE mail_threads
  SET
    status = 'archived',
    archived_at = NOW(),
    archive_source = 'user',
    archive_requested_from_ui = true
  WHERE id = p_thread_id AND user_id = v_user_id;

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

  v_result := json_build_object(
    'success', true,
    'thread_id', p_thread_id,
    'gmail_sync_queued', p_archive_in_gmail
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get pending archive queue
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

-- Update archive queue status
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
  SELECT attempts INTO v_attempts
  FROM gmail_archive_queue
  WHERE id = p_queue_id;

  IF p_status = 'failed' THEN
    v_next_retry := NOW() + (POWER(2, v_attempts) || ' minutes')::INTERVAL;
  END IF;

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

-- Cleanup archive queue
CREATE OR REPLACE FUNCTION cleanup_archive_queue()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER := 0;
  v_temp_count INTEGER;
BEGIN
  DELETE FROM gmail_archive_queue
  WHERE status = 'completed'
    AND processed_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  DELETE FROM gmail_archive_queue
  WHERE status = 'failed'
    AND attempts >= max_attempts
    AND processed_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_deleted_count := v_deleted_count + v_temp_count;

  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Process unsummarized threads
CREATE OR REPLACE FUNCTION process_unsummarized_threads(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  thread_id TEXT,
  subject TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mt.gmail_thread_id,
    mt.subject
  FROM mail_threads mt
  WHERE (p_user_id IS NULL OR mt.user_id = p_user_id)
    AND mt.summary IS NULL
  ORDER BY mt.last_message_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get integration stats
CREATE OR REPLACE FUNCTION get_integration_stats(
  p_user_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  integration_name TEXT,
  thread_count BIGINT,
  avg_satisfaction NUMERIC,
  common_topics TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mt.integration_name,
    COUNT(*) as thread_count,
    AVG(mt.satisfaction_score) as avg_satisfaction,
    ARRAY_AGG(DISTINCT mt.ai_topic) FILTER (WHERE mt.ai_topic IS NOT NULL) as common_topics
  FROM mail_threads mt
  WHERE mt.user_id = p_user_id
    AND mt.integration_name IS NOT NULL
    AND mt.created_at > NOW() - (p_days || ' days')::INTERVAL
  GROUP BY mt.integration_name
  ORDER BY thread_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION store_oauth_token TO authenticated;
GRANT EXECUTE ON FUNCTION get_oauth_token TO authenticated;
GRANT EXECUTE ON FUNCTION update_oauth_access_token TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_oauth_token_with_lock TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_oauth_tokens TO service_role;
GRANT EXECUTE ON FUNCTION archive_thread TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_archive_queue TO service_role;
GRANT EXECUTE ON FUNCTION update_archive_queue_status TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_archive_queue TO service_role;
