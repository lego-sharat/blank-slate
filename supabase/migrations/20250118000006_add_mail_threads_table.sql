-- Create mail_threads table for thread-level data and summaries
-- This table stores one row per email thread (conversation)
CREATE TABLE IF NOT EXISTS mail_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_thread_id TEXT NOT NULL,

  -- Thread metadata
  subject TEXT NOT NULL,
  participants JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {name, email}
  category TEXT CHECK (category IN ('onboarding', 'support', 'general')) DEFAULT 'general',
  labels TEXT[] DEFAULT '{}',

  -- Thread status
  is_unread BOOLEAN DEFAULT false,
  has_attachments BOOLEAN DEFAULT false,
  message_count INTEGER DEFAULT 0,

  -- Timestamps
  first_message_date TIMESTAMP WITH TIME ZONE NOT NULL,
  last_message_date TIMESTAMP WITH TIME ZONE NOT NULL,
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- AI-generated summary (thread-level)
  summary TEXT,
  action_items JSONB DEFAULT '[]'::jsonb,
  summary_generated_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, gmail_thread_id)
);

-- Update mail_messages to reference threads
-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_mail_messages_thread ON mail_messages(user_id, thread_id);
CREATE INDEX IF NOT EXISTS idx_mail_messages_date ON mail_messages(user_id, date DESC);

-- Create indexes for mail_threads
CREATE INDEX idx_mail_threads_user_id ON mail_threads(user_id);
CREATE INDEX idx_mail_threads_category ON mail_threads(user_id, category);
CREATE INDEX idx_mail_threads_last_message ON mail_threads(user_id, last_message_date DESC);
CREATE INDEX idx_mail_threads_unread ON mail_threads(user_id, is_unread) WHERE is_unread = true;

-- Add RLS policies for mail_threads
ALTER TABLE mail_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own mail threads"
  ON mail_threads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own mail threads"
  ON mail_threads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own mail threads"
  ON mail_threads FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own mail threads"
  ON mail_threads FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update thread metadata after message changes
CREATE OR REPLACE FUNCTION update_thread_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the thread with aggregated message data
  UPDATE mail_threads
  SET
    message_count = (
      SELECT COUNT(*)
      FROM mail_messages
      WHERE thread_id = NEW.thread_id AND user_id = NEW.user_id
    ),
    is_unread = (
      SELECT bool_or(is_unread)
      FROM mail_messages
      WHERE thread_id = NEW.thread_id AND user_id = NEW.user_id
    ),
    has_attachments = (
      SELECT bool_or(has_attachments)
      FROM mail_messages
      WHERE thread_id = NEW.thread_id AND user_id = NEW.user_id
    ),
    last_message_date = (
      SELECT MAX(date)
      FROM mail_messages
      WHERE thread_id = NEW.thread_id AND user_id = NEW.user_id
    ),
    first_message_date = (
      SELECT MIN(date)
      FROM mail_messages
      WHERE thread_id = NEW.thread_id AND user_id = NEW.user_id
    ),
    updated_at = NOW()
  WHERE gmail_thread_id = NEW.thread_id AND user_id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update thread metadata when messages are inserted/updated
DROP TRIGGER IF EXISTS trigger_update_thread_metadata ON mail_messages;
CREATE TRIGGER trigger_update_thread_metadata
  AFTER INSERT OR UPDATE ON mail_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_thread_metadata();

-- Function to get threads with message preview
CREATE OR REPLACE FUNCTION get_user_threads(
  p_user_id UUID,
  p_category TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  gmail_thread_id TEXT,
  subject TEXT,
  participants JSONB,
  category TEXT,
  labels TEXT[],
  is_unread BOOLEAN,
  has_attachments BOOLEAN,
  message_count INTEGER,
  first_message_date TIMESTAMP WITH TIME ZONE,
  last_message_date TIMESTAMP WITH TIME ZONE,
  summary TEXT,
  action_items JSONB,
  latest_message_preview TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mt.id,
    mt.gmail_thread_id,
    mt.subject,
    mt.participants,
    mt.category,
    mt.labels,
    mt.is_unread,
    mt.has_attachments,
    mt.message_count,
    mt.first_message_date,
    mt.last_message_date,
    mt.summary,
    mt.action_items,
    (
      SELECT body_preview
      FROM mail_messages mm
      WHERE mm.thread_id = mt.gmail_thread_id
        AND mm.user_id = mt.user_id
      ORDER BY mm.date DESC
      LIMIT 1
    ) as latest_message_preview
  FROM mail_threads mt
  WHERE mt.user_id = p_user_id
    AND (p_category IS NULL OR mt.category = p_category)
  ORDER BY mt.last_message_date DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all messages in a thread
CREATE OR REPLACE FUNCTION get_thread_messages(
  p_user_id UUID,
  p_thread_id TEXT
)
RETURNS TABLE (
  id UUID,
  gmail_message_id TEXT,
  subject TEXT,
  from_email TEXT,
  from_name TEXT,
  to_addresses JSONB,
  date TIMESTAMP WITH TIME ZONE,
  body_preview TEXT,
  is_unread BOOLEAN,
  has_attachments BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mm.id,
    mm.gmail_message_id,
    mm.subject,
    mm.from_email,
    mm.from_name,
    mm.to_addresses,
    mm.date,
    mm.body_preview,
    mm.is_unread,
    mm.has_attachments
  FROM mail_messages mm
  WHERE mm.user_id = p_user_id
    AND mm.thread_id = p_thread_id
  ORDER BY mm.date ASC; -- Chronological order for thread view
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
