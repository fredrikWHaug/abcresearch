-- ============================================
-- CREATE PROFILE ON SIGNUP FUNCTION
-- ============================================
-- This migration creates an RPC function to create a profile
-- when a user signs up (bypasses RLS)
-- ============================================

-- Function to create profile for invited user
-- This is called after user signs up and gets authenticated
CREATE OR REPLACE FUNCTION create_profile_for_invited_user(
  p_user_id UUID,
  p_email TEXT,
  p_invite_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_normalized_email TEXT;
BEGIN
  -- Normalize the input email
  v_normalized_email := LOWER(TRIM(p_email));
  
  -- Check if profile already exists
  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = p_user_id) THEN
    RETURN json_build_object(
      'success', true,
      'message', 'Profile already exists',
      'profile_id', (SELECT id FROM profiles WHERE user_id = p_user_id),
      'already_exists', true
    );
  END IF;
  
  -- Check if email already has a profile (different user)
  IF EXISTS (SELECT 1 FROM profiles WHERE LOWER(TRIM(email)) = v_normalized_email AND user_id != p_user_id) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'This email is already registered to another account'
    );
  END IF;
  
  -- Create profile
  INSERT INTO profiles (user_id, email, invite_id)
  VALUES (p_user_id, v_normalized_email, p_invite_id)
  RETURNING id INTO v_profile_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Profile created successfully',
    'profile_id', v_profile_id
  );
  
EXCEPTION
  WHEN unique_violation THEN
    -- Profile might have been created by another process - check if it exists now
    IF EXISTS (SELECT 1 FROM profiles WHERE user_id = p_user_id) THEN
      RETURN json_build_object(
        'success', true,
        'message', 'Profile already exists',
        'profile_id', (SELECT id FROM profiles WHERE user_id = p_user_id),
        'already_exists', true
      );
    ELSE
      RETURN json_build_object(
        'success', false,
        'error', 'Profile creation failed: ' || SQLERRM
      );
    END IF;
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'An unexpected error occurred: ' || SQLERRM
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_profile_for_invited_user(UUID, TEXT, UUID) TO authenticated;

