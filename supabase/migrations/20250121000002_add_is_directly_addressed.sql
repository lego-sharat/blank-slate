-- Add is_directly_addressed column to track if sharat@appbrew.tech is in to/cc
ALTER TABLE mail_threads ADD COLUMN IF NOT EXISTS is_directly_addressed BOOLEAN DEFAULT false;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_mail_threads_is_directly_addressed ON mail_threads(user_id, is_directly_addressed) WHERE is_directly_addressed = true;
