-- Add billing_links as a valid category for mail threads
-- Migration: Add billing_links category

-- Update category column comment to reflect new valid values
COMMENT ON COLUMN mail_threads.category IS 'onboarding | support | billing_links | general';

-- Note: No ALTER needed since category is TEXT type
-- The application logic will handle the new category value
