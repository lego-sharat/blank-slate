-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Note: The cron schedule will be set up after deploying the Edge Function
-- This is a placeholder that can be activated after deployment

-- Store the service role key securely (one-time manual setup required)
-- Run this command manually in your Supabase SQL editor:
-- ALTER DATABASE postgres SET app.service_role_key TO 'your-service-role-key-here';

-- Create a helper function to trigger the sync
CREATE OR REPLACE FUNCTION trigger_gmail_sync()
RETURNS void AS $$
DECLARE
  v_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Get the service role key from database settings
  v_service_key := current_setting('app.service_role_key', true);

  -- Get the Supabase project URL
  -- Replace 'your-project' with actual project reference
  v_url := current_setting('app.supabase_url', true) || '/functions/v1/sync-gmail';

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

-- Schedule the sync job (runs every 2 minutes)
-- Uncomment after deploying the Edge Function and setting up the service role key:
-- SELECT cron.schedule(
--   'sync-gmail-all-users',
--   '*/2 * * * *',
--   $$SELECT trigger_gmail_sync();$$
-- );

-- View scheduled jobs
CREATE OR REPLACE FUNCTION list_cron_jobs()
RETURNS TABLE (
  jobid BIGINT,
  schedule TEXT,
  command TEXT,
  nodename TEXT,
  nodeport INTEGER,
  database TEXT,
  username TEXT,
  active BOOLEAN,
  jobname TEXT
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM cron.job;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View cron job history
CREATE OR REPLACE FUNCTION list_cron_history(p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  jobid BIGINT,
  runid BIGINT,
  job_pid INTEGER,
  database TEXT,
  username TEXT,
  command TEXT,
  status TEXT,
  return_message TEXT,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM cron.job_run_details
  ORDER BY start_time DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
