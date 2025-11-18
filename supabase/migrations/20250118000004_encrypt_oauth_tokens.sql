-- Migration: Encrypt OAuth tokens using pgcrypto
-- This migration adds encryption to OAuth tokens for security

-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop existing table and recreate with encryption
DROP TABLE IF EXISTS oauth_tokens CASCADE;

-- Create oauth_tokens with encrypted fields
CREATE TABLE oauth_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('gmail')),
  -- Encrypted fields stored as bytea
  refresh_token_encrypted BYTEA NOT NULL,
  access_token_encrypted BYTEA NOT NULL,
  expires_at BIGINT NOT NULL,
  last_history_id TEXT,
  -- Add version field to support key rotation
  encryption_version INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Create indexes
CREATE INDEX idx_oauth_user_provider ON oauth_tokens(user_id, provider);

-- Enable RLS
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own tokens"
  ON oauth_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tokens"
  ON oauth_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tokens"
  ON oauth_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tokens"
  ON oauth_tokens FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to tokens"
  ON oauth_tokens FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Updated timestamp trigger
CREATE TRIGGER update_oauth_tokens_updated_at
  BEFORE UPDATE ON oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to get encryption key from database settings
-- In production, set this with: ALTER DATABASE postgres SET app.encryption_key TO 'your-secure-key';
CREATE OR REPLACE FUNCTION get_encryption_key()
RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.encryption_key', true);
EXCEPTION
  WHEN OTHERS THEN
    -- Fallback to a default key for development (DO NOT USE IN PRODUCTION)
    RAISE WARNING 'Using default encryption key - set app.encryption_key in production!';
    RETURN 'dev_encryption_key_change_in_production';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to encrypt token
CREATE OR REPLACE FUNCTION encrypt_token(token TEXT)
RETURNS BYTEA AS $$
BEGIN
  IF token IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_encrypt(token, get_encryption_key());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrypt token
CREATE OR REPLACE FUNCTION decrypt_token(encrypted_token BYTEA)
RETURNS TEXT AS $$
BEGIN
  IF encrypted_token IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_decrypt(encrypted_token, get_encryption_key());
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to decrypt token: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to store OAuth tokens with encryption
CREATE OR REPLACE FUNCTION store_oauth_token(
  p_user_id UUID,
  p_provider TEXT,
  p_refresh_token TEXT,
  p_access_token TEXT,
  p_expires_at BIGINT,
  p_last_history_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_token_id UUID;
BEGIN
  INSERT INTO oauth_tokens (
    user_id,
    provider,
    refresh_token_encrypted,
    access_token_encrypted,
    expires_at,
    last_history_id
  ) VALUES (
    p_user_id,
    p_provider,
    encrypt_token(p_refresh_token),
    encrypt_token(p_access_token),
    p_expires_at,
    p_last_history_id
  )
  ON CONFLICT (user_id, provider)
  DO UPDATE SET
    refresh_token_encrypted = encrypt_token(p_refresh_token),
    access_token_encrypted = encrypt_token(p_access_token),
    expires_at = p_expires_at,
    last_history_id = COALESCE(p_last_history_id, oauth_tokens.last_history_id),
    updated_at = NOW()
  RETURNING id INTO v_token_id;

  RETURN v_token_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get OAuth token with decryption
CREATE OR REPLACE FUNCTION get_oauth_token(
  p_user_id UUID,
  p_provider TEXT
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  provider TEXT,
  refresh_token TEXT,
  access_token TEXT,
  expires_at BIGINT,
  last_history_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ot.id,
    ot.user_id,
    ot.provider,
    decrypt_token(ot.refresh_token_encrypted) as refresh_token,
    decrypt_token(ot.access_token_encrypted) as access_token,
    ot.expires_at,
    ot.last_history_id,
    ot.created_at,
    ot.updated_at
  FROM oauth_tokens ot
  WHERE ot.user_id = p_user_id
    AND ot.provider = p_provider;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get all OAuth tokens (for cron job)
CREATE OR REPLACE FUNCTION get_all_oauth_tokens(p_provider TEXT)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  provider TEXT,
  refresh_token TEXT,
  access_token TEXT,
  expires_at BIGINT,
  last_history_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ot.id,
    ot.user_id,
    ot.provider,
    decrypt_token(ot.refresh_token_encrypted) as refresh_token,
    decrypt_token(ot.access_token_encrypted) as access_token,
    ot.expires_at,
    ot.last_history_id,
    ot.created_at,
    ot.updated_at
  FROM oauth_tokens ot
  WHERE ot.provider = p_provider;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to update access token (after refresh)
CREATE OR REPLACE FUNCTION update_oauth_access_token(
  p_user_id UUID,
  p_provider TEXT,
  p_access_token TEXT,
  p_expires_at BIGINT
)
RETURNS VOID AS $$
BEGIN
  UPDATE oauth_tokens
  SET
    access_token_encrypted = encrypt_token(p_access_token),
    expires_at = p_expires_at,
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND provider = p_provider;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add advisory lock for token refresh to prevent race conditions
CREATE OR REPLACE FUNCTION refresh_oauth_token_with_lock(
  p_user_id UUID,
  p_provider TEXT,
  p_access_token TEXT,
  p_expires_at BIGINT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_lock_id BIGINT;
  v_got_lock BOOLEAN;
BEGIN
  -- Generate lock ID from user_id and provider
  v_lock_id := ('x' || md5(p_user_id::TEXT || p_provider))::bit(64)::BIGINT;

  -- Try to acquire advisory lock (non-blocking)
  v_got_lock := pg_try_advisory_xact_lock(v_lock_id);

  IF NOT v_got_lock THEN
    RAISE NOTICE 'Token refresh already in progress for user %, skipping', p_user_id;
    RETURN FALSE;
  END IF;

  -- Update token
  PERFORM update_oauth_access_token(p_user_id, p_provider, p_access_token, p_expires_at);

  -- Lock is automatically released at transaction end
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION store_oauth_token TO authenticated;
GRANT EXECUTE ON FUNCTION get_oauth_token TO authenticated;
GRANT EXECUTE ON FUNCTION update_oauth_access_token TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_oauth_token_with_lock TO authenticated;

-- Grant execute permissions to service role
GRANT EXECUTE ON FUNCTION get_all_oauth_tokens TO service_role;

-- Add comment explaining encryption
COMMENT ON TABLE oauth_tokens IS 'OAuth tokens with pgcrypto encryption. Use store_oauth_token() and get_oauth_token() functions to interact with this table.';
COMMENT ON COLUMN oauth_tokens.refresh_token_encrypted IS 'Encrypted using pgp_sym_encrypt with app.encryption_key';
COMMENT ON COLUMN oauth_tokens.access_token_encrypted IS 'Encrypted using pgp_sym_encrypt with app.encryption_key';
