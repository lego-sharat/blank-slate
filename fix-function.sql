-- First create the encrypt_token helper function
CREATE OR REPLACE FUNCTION encrypt_token(token TEXT, encryption_key TEXT)
RETURNS BYTEA AS $$
BEGIN
  IF token IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_encrypt(token, encryption_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Then update store_oauth_token to use it
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
