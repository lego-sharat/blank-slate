-- Add integration tracking and flexible labels for threads
-- Integration: AI extracts any integration/service name mentioned (not limited to predefined list)
-- Labels: Flexible categorization for filtering (customer, promotional, internal, etc.)

ALTER TABLE mail_threads
ADD COLUMN integration_name TEXT,
ADD COLUMN labels TEXT[] DEFAULT '{}';

-- Add index for filtering by integration
CREATE INDEX idx_mail_threads_integration ON mail_threads(user_id, integration_name) WHERE integration_name IS NOT NULL;

-- Add GIN index for labels array for fast filtering
CREATE INDEX idx_mail_threads_labels ON mail_threads USING GIN(labels);

COMMENT ON COLUMN mail_threads.integration_name IS 'AI-extracted integration/service name mentioned in thread (e.g., Yotpo Reviews, Klaviyo, Recharge). Free-form text, not limited to predefined list.';
COMMENT ON COLUMN mail_threads.labels IS 'AI-generated labels for flexible categorization: customer-support, onboarding, promotional, newsletter, social-media, team-internal, investor, product-query, update, etc.';

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
