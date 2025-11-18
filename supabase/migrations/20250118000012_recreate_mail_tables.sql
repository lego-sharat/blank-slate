-- Recreate only mail data tables (threads and messages)
-- Keep oauth_tokens and config tables intact
-- This ensures clean schema with proper gmail_labels vs ai_labels separation

-- Drop only mail data tables and their functions
DROP TABLE IF EXISTS mail_messages CASCADE;
DROP TABLE IF EXISTS mail_threads CASCADE;
DROP FUNCTION IF EXISTS process_unsummarized_threads(UUID);
DROP FUNCTION IF EXISTS get_integration_stats(UUID, INTEGER);

-- Create mail_threads table from scratch
CREATE TABLE mail_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_thread_id TEXT NOT NULL,

  -- Thread metadata
  subject TEXT NOT NULL,
  participants JSONB NOT NULL DEFAULT '[]',
  category TEXT NOT NULL DEFAULT 'general', -- onboarding | support | general

  -- Gmail labels (INBOX, UNREAD, SENT, DTC, CATEGORY_PROMOTIONS, etc.)
  gmail_labels TEXT[] DEFAULT '{}',

  -- AI-generated fields
  ai_topic TEXT, -- AI-generated topic (bug_report, feature_request, etc.)
  ai_labels TEXT[] DEFAULT '{}', -- AI labels (customer-support, high-priority, etc.)
  integration_name TEXT, -- Free-form integration name extracted by AI
  summary TEXT,
  action_items JSONB DEFAULT '[]',
  satisfaction_score INTEGER CHECK (satisfaction_score >= 1 AND satisfaction_score <= 10),
  satisfaction_analysis TEXT,
  summary_generated_at TIMESTAMPTZ,

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
  UNIQUE(user_id, gmail_thread_id)
);

-- Create mail_messages table from scratch
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

-- Add indexes for performance
CREATE INDEX idx_mail_threads_user_id ON mail_threads(user_id);
CREATE INDEX idx_mail_threads_gmail_thread_id ON mail_threads(user_id, gmail_thread_id);
CREATE INDEX idx_mail_threads_category ON mail_threads(user_id, category);
CREATE INDEX idx_mail_threads_ai_topic ON mail_threads(user_id, ai_topic);
CREATE INDEX idx_mail_threads_integration ON mail_threads(user_id, integration_name) WHERE integration_name IS NOT NULL;
CREATE INDEX idx_mail_threads_unread ON mail_threads(user_id, is_unread) WHERE is_unread = true;
CREATE INDEX idx_mail_threads_last_message ON mail_threads(user_id, last_message_date DESC);

-- GIN indexes for array columns
CREATE INDEX idx_mail_threads_gmail_labels ON mail_threads USING GIN(gmail_labels);
CREATE INDEX idx_mail_threads_ai_labels ON mail_threads USING GIN(ai_labels);

CREATE INDEX idx_mail_messages_user_id ON mail_messages(user_id);
CREATE INDEX idx_mail_messages_thread_id ON mail_messages(user_id, thread_id);
CREATE INDEX idx_mail_messages_date ON mail_messages(user_id, date DESC);

-- Add comments
COMMENT ON TABLE mail_threads IS 'Email threads with AI-generated summaries and categorization';
COMMENT ON TABLE mail_messages IS 'Individual email messages within threads';

COMMENT ON COLUMN mail_threads.gmail_labels IS 'Gmail label IDs from the email (e.g., INBOX, UNREAD, SENT, DTC, CATEGORY_PROMOTIONS)';
COMMENT ON COLUMN mail_threads.ai_labels IS 'AI-generated labels for flexible categorization: customer-support, onboarding, promotional, newsletter, social-media, team-internal, investor, product-query, update, high-priority, needs-response, etc.';
COMMENT ON COLUMN mail_threads.ai_topic IS 'AI-generated topic/label for thread classification (e.g., bug_report, feature_request, billing_question, integration_request)';
COMMENT ON COLUMN mail_threads.integration_name IS 'AI-extracted integration/service name mentioned in thread (e.g., Yotpo Reviews, Klaviyo, Recharge). Free-form text, not limited to predefined list.';
COMMENT ON COLUMN mail_threads.action_items IS 'AI-extracted action items that require action from the user (recipient), stored as JSON array';
COMMENT ON COLUMN mail_threads.satisfaction_score IS 'Customer satisfaction score (1-10) for onboarding/support threads';

-- Enable Row Level Security
ALTER TABLE mail_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE mail_messages ENABLE ROW LEVEL SECURITY;

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

-- Function to process unsummarized threads
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

-- Function to get integration-specific stats
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
