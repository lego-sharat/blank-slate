-- Add integration tracking and flexible AI labels for threads
-- Integration: AI extracts any integration/service name mentioned (not limited to predefined list)
-- AI Labels: Flexible categorization for filtering (customer, promotional, internal, etc.)
-- Note: gmail_labels are separate and store Gmail's label IDs (INBOX, UNREAD, DTC, etc.)

-- Add columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'mail_threads' AND column_name = 'integration_name') THEN
    ALTER TABLE mail_threads ADD COLUMN integration_name TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'mail_threads' AND column_name = 'ai_labels') THEN
    ALTER TABLE mail_threads ADD COLUMN ai_labels TEXT[] DEFAULT '{}';
  END IF;
END $$;

-- Add index for filtering by integration
CREATE INDEX IF NOT EXISTS idx_mail_threads_integration ON mail_threads(user_id, integration_name) WHERE integration_name IS NOT NULL;

-- Add GIN index for AI labels array for fast filtering
CREATE INDEX IF NOT EXISTS idx_mail_threads_ai_labels ON mail_threads USING GIN(ai_labels);

COMMENT ON COLUMN mail_threads.integration_name IS 'AI-extracted integration/service name mentioned in thread (e.g., Yotpo Reviews, Klaviyo, Recharge). Free-form text, not limited to predefined list.';
COMMENT ON COLUMN mail_threads.ai_labels IS 'AI-generated labels for flexible categorization: customer-support, onboarding, promotional, newsletter, social-media, team-internal, investor, product-query, update, etc.';

-- Add function to get integration-specific stats
-- Useful for understanding which integrations need the most support
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
