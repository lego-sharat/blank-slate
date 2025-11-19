-- Add customer satisfaction score tracking for onboarding and support threads
-- Score is 1-10, extracted by AI analysis of conversation tone and outcomes

ALTER TABLE mail_threads
ADD COLUMN satisfaction_score INTEGER CHECK (satisfaction_score >= 1 AND satisfaction_score <= 10),
ADD COLUMN satisfaction_analysis TEXT;

-- Create index for querying by satisfaction score
CREATE INDEX idx_mail_threads_satisfaction ON mail_threads(category, satisfaction_score)
WHERE category IN ('onboarding', 'support') AND satisfaction_score IS NOT NULL;

-- Function to get average satisfaction score by category
CREATE OR REPLACE FUNCTION get_satisfaction_stats(
  p_user_id UUID,
  p_category TEXT DEFAULT NULL,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  category TEXT,
  avg_score NUMERIC,
  total_threads BIGINT,
  score_1_3 BIGINT,
  score_4_6 BIGINT,
  score_7_10 BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mt.category,
    ROUND(AVG(mt.satisfaction_score), 2) as avg_score,
    COUNT(*) as total_threads,
    COUNT(*) FILTER (WHERE mt.satisfaction_score BETWEEN 1 AND 3) as score_1_3,
    COUNT(*) FILTER (WHERE mt.satisfaction_score BETWEEN 4 AND 6) as score_4_6,
    COUNT(*) FILTER (WHERE mt.satisfaction_score BETWEEN 7 AND 10) as score_7_10
  FROM mail_threads mt
  WHERE mt.user_id = p_user_id
    AND mt.satisfaction_score IS NOT NULL
    AND (p_category IS NULL OR mt.category = p_category)
    AND mt.last_message_date >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY mt.category
  ORDER BY avg_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON COLUMN mail_threads.satisfaction_score IS 'AI-analyzed customer satisfaction score (1-10) for onboarding/support threads';
COMMENT ON COLUMN mail_threads.satisfaction_analysis IS 'AI explanation of the satisfaction score';
