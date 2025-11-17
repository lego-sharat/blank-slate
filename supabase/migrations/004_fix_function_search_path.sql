-- Fix search_path security issue for update_updated_at_column function
-- Add SECURITY DEFINER and set explicit search_path
-- Use CREATE OR REPLACE to avoid dropping function with dependencies

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
