-- Migration: Add team awareness, billing tracking, and enhanced escalations
-- This migration adds:
-- 1. Escalation types (customer vs team escalations)
-- 2. Billing tracking (detect billing links, track acceptance)
-- 3. Team participant tracking (identify internal team members)

-- Add escalation_type field to distinguish customer vs team escalations
ALTER TABLE mail_threads ADD COLUMN IF NOT EXISTS escalation_type TEXT;
  -- Values: 'customer' | 'team' | null
  -- 'customer': Customer-facing escalations (frustrated customer, churn risk, etc.)
  -- 'team': Internal team escalations (urgent internal matter, important stakeholder)
  -- null: Not an escalation

-- Add billing tracking fields
ALTER TABLE mail_threads ADD COLUMN IF NOT EXISTS is_billing BOOLEAN DEFAULT false;
  -- True if thread contains billing links sent to customers

ALTER TABLE mail_threads ADD COLUMN IF NOT EXISTS billing_status TEXT;
  -- Values: 'sent' | 'accepted' | 'pending' | null
  -- 'sent': Billing link sent to customer
  -- 'accepted': Customer has accepted/paid
  -- 'pending': Awaiting customer action
  -- null: Not a billing thread

ALTER TABLE mail_threads ADD COLUMN IF NOT EXISTS billing_sent_at TIMESTAMPTZ;
  -- Timestamp when billing link was sent

ALTER TABLE mail_threads ADD COLUMN IF NOT EXISTS billing_accepted_at TIMESTAMPTZ;
  -- Timestamp when customer accepted/paid

-- Add internal_participants field to track team members
ALTER TABLE mail_threads ADD COLUMN IF NOT EXISTS internal_participants TEXT[];
  -- Array of email addresses from @appbrew.tech domain
  -- Used to identify team members vs external customers

ALTER TABLE mail_threads ADD COLUMN IF NOT EXISTS external_participants TEXT[];
  -- Array of email addresses NOT from @appbrew.tech domain
  -- Represents customers and external stakeholders

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_mail_threads_escalation_type ON mail_threads(user_id, escalation_type)
  WHERE escalation_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mail_threads_billing ON mail_threads(user_id, is_billing)
  WHERE is_billing = true;

CREATE INDEX IF NOT EXISTS idx_mail_threads_billing_status ON mail_threads(user_id, billing_status)
  WHERE billing_status IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN mail_threads.escalation_type IS 'Type of escalation: customer (external), team (internal), or null (not escalated)';
COMMENT ON COLUMN mail_threads.is_billing IS 'True if thread contains billing links sent to customers';
COMMENT ON COLUMN mail_threads.billing_status IS 'Billing status: sent (link sent), accepted (payment received), pending (awaiting action), null (not billing)';
COMMENT ON COLUMN mail_threads.billing_sent_at IS 'Timestamp when billing link was sent to customer';
COMMENT ON COLUMN mail_threads.billing_accepted_at IS 'Timestamp when customer accepted/paid billing';
COMMENT ON COLUMN mail_threads.internal_participants IS 'Email addresses of internal team members (@appbrew.tech)';
COMMENT ON COLUMN mail_threads.external_participants IS 'Email addresses of external customers and stakeholders';

-- Update existing escalations to set escalation_type based on category
-- Customer-facing categories (support, onboarding) -> 'customer'
-- General category -> 'team'
UPDATE mail_threads
SET escalation_type = CASE
  WHEN category IN ('support', 'onboarding') THEN 'customer'
  WHEN category = 'general' THEN 'team'
  ELSE NULL
END
WHERE is_escalation = true AND escalation_type IS NULL;

-- Add constraint to ensure escalation_type is only set when is_escalation is true
ALTER TABLE mail_threads ADD CONSTRAINT check_escalation_type
  CHECK (
    (is_escalation = false AND escalation_type IS NULL) OR
    (is_escalation = true AND escalation_type IN ('customer', 'team'))
  );

-- Add constraint to ensure billing_status is only set when is_billing is true
ALTER TABLE mail_threads ADD CONSTRAINT check_billing_status
  CHECK (
    (is_billing = false AND billing_status IS NULL) OR
    (is_billing = true AND billing_status IN ('sent', 'accepted', 'pending'))
  );
