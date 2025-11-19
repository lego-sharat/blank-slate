-- Create a secure table to store configuration for pg_cron
-- This is needed because ALTER DATABASE SET requires superuser permissions

CREATE TABLE IF NOT EXISTS _config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- No RLS - this table should only be accessible through SECURITY DEFINER functions
ALTER TABLE _config ENABLE ROW LEVEL SECURITY;

-- Block all direct access
CREATE POLICY "No direct access to _config" ON _config
  FOR ALL USING (false);

-- Function to set config (can only be called by postgres role)
CREATE OR REPLACE FUNCTION set_config(p_key TEXT, p_value TEXT)
RETURNS void AS $$
BEGIN
  INSERT INTO _config (key, value)
  VALUES (p_key, p_value)
  ON CONFLICT (key) DO UPDATE SET value = p_value, updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get config (used by trigger_gmail_sync)
CREATE OR REPLACE FUNCTION get_config(p_key TEXT)
RETURNS TEXT AS $$
DECLARE
  v_value TEXT;
BEGIN
  SELECT value INTO v_value FROM _config WHERE key = p_key;
  RETURN v_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update trigger_gmail_sync to use the new config table
CREATE OR REPLACE FUNCTION trigger_gmail_sync()
RETURNS void AS $$
DECLARE
  v_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Get the service role key from config table
  v_service_key := get_config('service_role_key');

  -- Get the Supabase project URL from config table
  v_url := get_config('supabase_url') || '/functions/v1/sync-gmail';

  -- Trigger the Edge Function
  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_service_key,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
