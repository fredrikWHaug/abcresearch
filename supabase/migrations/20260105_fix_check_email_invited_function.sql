-- ============================================
-- FIX CHECK_EMAIL_INVITED FUNCTION
-- ============================================
-- This migration fixes the check_email_invited function to:
-- 1. Properly normalize email input (lowercase, trimmed)
-- 2. Match emails case-insensitively with proper normalization
-- 3. Handle edge cases like NULL and empty strings
-- ============================================

-- Update CHECK_EMAIL_INVITED FUNCTION
-- Checks if an email is on the invite list (bypasses RLS)
-- Returns true if there's an invite with matching email (case-insensitive, trimmed)
CREATE OR REPLACE FUNCTION check_email_invited(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized_email TEXT;
BEGIN
  -- Normalize the input email: lowercase and trim whitespace
  v_normalized_email := LOWER(TRIM(p_email));
  
  -- Check if email is valid
  IF v_normalized_email IS NULL OR v_normalized_email = '' THEN
    RETURN FALSE;
  END IF;
  
  -- Return true if there's an invite with matching email
  -- Both sides are normalized: lowercase and trimmed
  RETURN EXISTS (
    SELECT 1 FROM invites 
    WHERE email IS NOT NULL 
      AND LOWER(TRIM(email)) = v_normalized_email
  );
END;
$$;

-- Grant permissions (in case they don't exist)
GRANT EXECUTE ON FUNCTION check_email_invited(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION check_email_invited(TEXT) TO authenticated;

