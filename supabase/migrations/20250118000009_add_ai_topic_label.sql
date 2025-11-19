-- Add AI-generated topic label to threads
-- This is more specific than category (onboarding/support/general)
-- Examples: bug_report, feature_request, billing_question, technical_issue, feedback, etc.

ALTER TABLE mail_threads
ADD COLUMN ai_topic TEXT;

-- Add index for filtering by topic
CREATE INDEX idx_mail_threads_ai_topic ON mail_threads(user_id, ai_topic);

COMMENT ON COLUMN mail_threads.ai_topic IS 'AI-generated topic/label for thread classification (e.g., bug_report, feature_request, billing_question)';
