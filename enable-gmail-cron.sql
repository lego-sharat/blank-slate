-- Enable Gmail sync cron job (runs every 2 minutes)
SELECT cron.schedule(
  'sync-gmail-all-users',
  '*/2 * * * *',
  $$SELECT trigger_gmail_sync();$$
);

-- Verify the job was created
SELECT * FROM cron.job WHERE jobname = 'sync-gmail-all-users';
