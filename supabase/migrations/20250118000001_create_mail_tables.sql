-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Mail messages table
CREATE TABLE IF NOT EXISTS mail_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  gmail_message_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  subject TEXT,
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_addresses JSONB DEFAULT '[]'::jsonb,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  snippet TEXT,
  body_preview TEXT,
  labels TEXT[] DEFAULT '{}',
  category TEXT CHECK (category IN ('onboarding', 'support', 'general')),
  is_unread BOOLEAN DEFAULT true,
  has_attachments BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, gmail_message_id)
);

-- AI-generated summaries
CREATE TABLE IF NOT EXISTS mail_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES mail_messages(id) ON DELETE CASCADE NOT NULL,
  summary TEXT NOT NULL,
  key_points JSONB DEFAULT '[]'::jsonb,
  urgency_score INTEGER CHECK (urgency_score BETWEEN 1 AND 5),
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  model_used TEXT DEFAULT 'claude-3-haiku-20240307',
  UNIQUE(message_id)
);

-- Extracted action items
CREATE TABLE IF NOT EXISTS mail_action_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES mail_messages(id) ON DELETE CASCADE NOT NULL,
  action_text TEXT NOT NULL,
  priority TEXT CHECK (priority IN ('high', 'medium', 'low')),
  due_date TIMESTAMP WITH TIME ZONE,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_mail_user_date ON mail_messages(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_mail_category ON mail_messages(user_id, category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mail_labels ON mail_messages USING GIN(labels);
CREATE INDEX IF NOT EXISTS idx_mail_unread ON mail_messages(user_id, is_unread) WHERE is_unread = true;
CREATE INDEX IF NOT EXISTS idx_mail_gmail_id ON mail_messages(user_id, gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_summaries_message ON mail_summaries(message_id);
CREATE INDEX IF NOT EXISTS idx_actions_message ON mail_action_items(message_id);

-- Enable Row Level Security
ALTER TABLE mail_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE mail_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE mail_action_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for mail_messages
CREATE POLICY "Users can view their own mail"
  ON mail_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own mail"
  ON mail_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own mail"
  ON mail_messages FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own mail"
  ON mail_messages FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for mail_summaries
CREATE POLICY "Users can view summaries for their mail"
  ON mail_summaries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM mail_messages
      WHERE mail_messages.id = mail_summaries.message_id
      AND mail_messages.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert summaries"
  ON mail_summaries FOR INSERT
  WITH CHECK (true);

-- RLS Policies for mail_action_items
CREATE POLICY "Users can view action items for their mail"
  ON mail_action_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM mail_messages
      WHERE mail_messages.id = mail_action_items.message_id
      AND mail_messages.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert action items"
  ON mail_action_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their action items"
  ON mail_action_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM mail_messages
      WHERE mail_messages.id = mail_action_items.message_id
      AND mail_messages.user_id = auth.uid()
    )
  );

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_mail_messages_updated_at
  BEFORE UPDATE ON mail_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
