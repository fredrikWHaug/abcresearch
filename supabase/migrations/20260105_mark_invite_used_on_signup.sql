-- ============================================
-- MARK INVITE AS USED ON SIGNUP
-- ============================================
-- This migration creates an RPC function to mark an invite as used
-- when a user signs up via email (not token-based redemption)
-- ============================================

-- Function to mark invite as used and return invite_id for profile linking
-- This is called when creating a profile for email-based signups
CREATE OR REPLACE FUNCTION mark_invite_used_by_email(
  p_email TEXT,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_normalized_email TEXT;
BEGIN
  -- Normalize the input email
  v_normalized_email := LOWER(TRIM(p_email));
  
  -- Find the invite for this email (not yet used)
  SELECT * INTO v_invite
  FROM invites
  WHERE email IS NOT NULL
    AND LOWER(TRIM(email)) = v_normalized_email
    AND used_at IS NULL
  ORDER BY created_at ASC  -- Use oldest unused invite first
  LIMIT 1
  FOR UPDATE;
  
  -- Check if invite exists
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No unused invite found for this email'
    );
  END IF;
  
  -- Mark invite as used
  UPDATE invites
  SET used_at = NOW(),
      used_by = p_user_id
  WHERE id = v_invite.id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Invite marked as used',
    'invite_id', v_invite.id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'An unexpected error occurred: ' || SQLERRM
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION mark_invite_used_by_email(TEXT, UUID) TO authenticated;

