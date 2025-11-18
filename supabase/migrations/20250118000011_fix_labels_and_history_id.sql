-- Fix labels confusion and history_id type
-- Separate Gmail labels (INBOX, UNREAD, DTC) from AI-generated labels (customer-support, high-priority)

-- 1. Rename existing 'labels' column to 'ai_labels' (it's being used for AI labels)
DO $$
BEGIN
  -- Check if we need to rename
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'mail_threads' AND column_name = 'labels') THEN
    ALTER TABLE mail_threads RENAME COLUMN labels TO ai_labels;
  END IF;
END $$;

-- 2. Add gmail_labels column for Gmail label IDs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'mail_threads' AND column_name = 'gmail_labels') THEN
    ALTER TABLE mail_threads ADD COLUMN gmail_labels TEXT[] DEFAULT '{}';
  END IF;
END $$;

-- 3. Ensure last_history_id is TEXT in oauth_tokens
DO $$
BEGIN
  -- Check current type and alter if needed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oauth_tokens'
    AND column_name = 'last_history_id'
    AND data_type != 'text'
  ) THEN
    ALTER TABLE oauth_tokens ALTER COLUMN last_history_id TYPE TEXT;
  END IF;
END $$;

-- 4. Update indexes
DROP INDEX IF EXISTS idx_mail_threads_labels;
CREATE INDEX IF NOT EXISTS idx_mail_threads_ai_labels ON mail_threads USING GIN(ai_labels);
CREATE INDEX IF NOT EXISTS idx_mail_threads_gmail_labels ON mail_threads USING GIN(gmail_labels);

-- 5. Update comments
COMMENT ON COLUMN mail_threads.gmail_labels IS 'Gmail label IDs from the email (e.g., INBOX, UNREAD, SENT, DTC, CATEGORY_PROMOTIONS)';
COMMENT ON COLUMN mail_threads.ai_labels IS 'AI-generated labels for flexible categorization: customer-support, onboarding, promotional, newsletter, social-media, team-internal, investor, product-query, update, etc.';
COMMENT ON COLUMN oauth_tokens.last_history_id IS 'Gmail History API history ID (large numeric string) for incremental sync';
