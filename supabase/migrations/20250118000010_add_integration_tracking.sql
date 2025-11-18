-- Add integration tracking for threads (Shopify mobile app builder)
-- Captures which Shopify app integration is being discussed
-- Examples: yotpo-reviews, klaviyo, recharge, gorgias, etc.

ALTER TABLE mail_threads
ADD COLUMN integration_name TEXT;

-- Add index for filtering by integration
CREATE INDEX idx_mail_threads_integration ON mail_threads(user_id, integration_name) WHERE integration_name IS NOT NULL;

COMMENT ON COLUMN mail_threads.integration_name IS 'AI-extracted Shopify app integration name mentioned in thread (e.g., yotpo-reviews, klaviyo, recharge, gorgias). Use "other-integration" for integrations not in our list.';

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
