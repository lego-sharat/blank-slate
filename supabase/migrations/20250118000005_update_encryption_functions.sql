-- Migration: Update encryption functions to accept encryption_key parameter
-- This updates all OAuth token functions to accept encryption key from Supabase secrets

-- Update encrypt_token helper function
CREATE OR REPLACE FUNCTION encrypt_token(token TEXT, encryption_key TEXT)
RETURNS BYTEA AS $$
BEGIN
  IF token IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_encrypt(token, encryption_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update decrypt_token helper function
CREATE OR REPLACE FUNCTION decrypt_token(encrypted_token BYTEA, encryption_key TEXT)
RETURNS TEXT AS $$
BEGIN
  IF encrypted_token IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_decrypt(encrypted_token, encryption_key);
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to decrypt token: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update store_oauth_token to accept encryption_key parameter
CREATE OR REPLACE FUNCTION store_oauth_token(
  p_user_id UUID,
  p_provider TEXT,
  p_refresh_token TEXT,
  p_access_token TEXT,
  p_expires_at BIGINT,
  p_encryption_key TEXT,
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
    encrypt_token(p_refresh_token, p_encryption_key),
    encrypt_token(p_access_token, p_encryption_key),
    p_expires_at,
    p_last_history_id
  )
  ON CONFLICT (user_id, provider)
  DO UPDATE SET
    refresh_token_encrypted = encrypt_token(p_refresh_token, p_encryption_key),
    access_token_encrypted = encrypt_token(p_access_token, p_encryption_key),
    expires_at = p_expires_at,
    last_history_id = COALESCE(p_last_history_id, oauth_tokens.last_history_id),
    updated_at = NOW()
  RETURNING id INTO v_token_id;

  RETURN v_token_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_oauth_token to accept encryption_key parameter
CREATE OR REPLACE FUNCTION get_oauth_token(
  p_user_id UUID,
  p_provider TEXT,
  p_encryption_key TEXT
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
    decrypt_token(ot.refresh_token_encrypted, p_encryption_key) as refresh_token,
    decrypt_token(ot.access_token_encrypted, p_encryption_key) as access_token,
    ot.expires_at,
    ot.last_history_id,
    ot.created_at,
    ot.updated_at
  FROM oauth_tokens ot
  WHERE ot.user_id = p_user_id
    AND ot.provider = p_provider;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_all_oauth_tokens to accept encryption_key parameter
CREATE OR REPLACE FUNCTION get_all_oauth_tokens(
  p_provider TEXT,
  p_encryption_key TEXT
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
    decrypt_token(ot.refresh_token_encrypted, p_encryption_key) as refresh_token,
    decrypt_token(ot.access_token_encrypted, p_encryption_key) as access_token,
    ot.expires_at,
    ot.last_history_id,
    ot.created_at,
    ot.updated_at
  FROM oauth_tokens ot
  WHERE ot.provider = p_provider;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update update_oauth_access_token to accept encryption_key parameter
CREATE OR REPLACE FUNCTION update_oauth_access_token(
  p_user_id UUID,
  p_provider TEXT,
  p_access_token TEXT,
  p_expires_at BIGINT,
  p_encryption_key TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE oauth_tokens
  SET
    access_token_encrypted = encrypt_token(p_access_token, p_encryption_key),
    expires_at = p_expires_at,
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND provider = p_provider;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update refresh_oauth_token_with_lock to accept encryption_key parameter
CREATE OR REPLACE FUNCTION refresh_oauth_token_with_lock(
  p_user_id UUID,
  p_provider TEXT,
  p_access_token TEXT,
  p_expires_at BIGINT,
  p_encryption_key TEXT
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
  PERFORM update_oauth_access_token(p_user_id, p_provider, p_access_token, p_expires_at, p_encryption_key);

  -- Lock is automatically released at transaction end
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
