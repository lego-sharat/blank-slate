-- OAuth tokens table (encrypted storage)
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('gmail')),
  refresh_token TEXT NOT NULL, -- Encrypted
  access_token TEXT NOT NULL, -- Encrypted
  expires_at BIGINT NOT NULL,
  last_history_id TEXT, -- Gmail historyId for incremental sync
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Usage tracking for rate limiting
CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL, -- 'generate_summary', 'fetch_mail', etc.
  count INTEGER DEFAULT 1,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_oauth_user_provider ON oauth_tokens(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_usage_user_date ON usage_tracking(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_usage_action_date ON usage_tracking(action, timestamp DESC);

-- Enable RLS
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies for oauth_tokens
CREATE POLICY "Users can view their own tokens"
  ON oauth_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tokens"
  ON oauth_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tokens"
  ON oauth_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to tokens"
  ON oauth_tokens FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for usage_tracking
CREATE POLICY "Users can view their own usage"
  ON usage_tracking FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can track usage"
  ON usage_tracking FOR INSERT
  WITH CHECK (true);

-- Updated timestamp trigger for oauth_tokens
CREATE TRIGGER update_oauth_tokens_updated_at
  BEFORE UPDATE ON oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Helper function to check rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id UUID,
  p_action TEXT,
  p_limit INTEGER,
  p_window_hours INTEGER DEFAULT 24
)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COALESCE(SUM(count), 0) INTO v_count
  FROM usage_tracking
  WHERE user_id = p_user_id
    AND action = p_action
    AND timestamp > NOW() - (p_window_hours || ' hours')::INTERVAL;

  RETURN v_count < p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
