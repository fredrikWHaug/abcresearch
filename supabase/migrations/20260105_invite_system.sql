-- ============================================
-- INVITE SYSTEM MIGRATION
-- ============================================
-- This migration creates the invite-only authentication system:
-- 1. invites table - stores invite tokens
-- 2. profiles table - authorized users
-- 3. invite_requests table - waitlist submissions
-- 4. redeem_invite RPC function - atomic token redemption
-- 5. Migrate existing users to profiles
-- ============================================

-- 1. INVITES TABLE
-- Stores single-use invite tokens
CREATE TABLE IF NOT EXISTS invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  email TEXT,  -- optional: restrict to specific email (case-insensitive matching)
  used_at TIMESTAMPTZ,
  used_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  notes TEXT  -- optional: admin notes about who this invite is for
);

-- Index for token lookups
CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(lower(email)) WHERE email IS NOT NULL;

-- RLS for invites (admin-only via service role, no direct user access)
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- No policies = only service role can access (which is what we want)


-- 2. PROFILES TABLE
-- Stores authorized users who have redeemed an invite or were migrated
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  invite_id UUID REFERENCES invites(id),  -- which invite they used (null for migrated users)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(lower(email));

-- RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile (drop first to allow re-running)
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can do everything (for API endpoints)
-- No INSERT/UPDATE/DELETE policies for regular users - only via API


-- 3. INVITE_REQUESTS TABLE
-- Waitlist submissions from users requesting access
CREATE TABLE IF NOT EXISTS invite_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  linkedin_url TEXT,
  message TEXT,  -- optional message from requester
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id)
);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_invite_requests_email ON invite_requests(lower(email));
CREATE INDEX IF NOT EXISTS idx_invite_requests_status ON invite_requests(status);

-- RLS for invite_requests
ALTER TABLE invite_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (public waitlist form) - but only via API with validation
-- No direct user access policies


-- 4. REDEEM_INVITE RPC FUNCTION
-- Atomically validates and redeems an invite token
CREATE OR REPLACE FUNCTION redeem_invite(
  p_token TEXT,
  p_email TEXT,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with elevated privileges
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_profile_id UUID;
  v_result JSON;
BEGIN
  -- Normalize email to lowercase
  p_email := lower(trim(p_email));
  
  -- Find and lock the invite row
  SELECT * INTO v_invite
  FROM invites
  WHERE token = p_token
  FOR UPDATE;
  
  -- Check if invite exists
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid invite token'
    );
  END IF;
  
  -- Check if already used
  IF v_invite.used_at IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'This invite has already been used'
    );
  END IF;
  
  -- Check if expired
  IF v_invite.expires_at < NOW() THEN
    RETURN json_build_object(
      'success', false,
      'error', 'This invite has expired'
    );
  END IF;
  
  -- Check email restriction (case-insensitive)
  IF v_invite.email IS NOT NULL AND lower(trim(v_invite.email)) != p_email THEN
    RETURN json_build_object(
      'success', false,
      'error', 'This invite is for a different email address'
    );
  END IF;
  
  -- Check if user already has a profile
  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = p_user_id) THEN
    RETURN json_build_object(
      'success', true,
      'message', 'User already authorized',
      'already_authorized', true
    );
  END IF;
  
  -- Check if email already has a profile (different user)
  IF EXISTS (SELECT 1 FROM profiles WHERE lower(email) = p_email AND user_id != p_user_id) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'This email is already registered to another account'
    );
  END IF;
  
  -- Mark invite as used
  UPDATE invites
  SET used_at = NOW(),
      used_by = p_user_id
  WHERE id = v_invite.id;
  
  -- Create profile
  INSERT INTO profiles (user_id, email, invite_id)
  VALUES (p_user_id, p_email, v_invite.id)
  RETURNING id INTO v_profile_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Invite redeemed successfully',
    'profile_id', v_profile_id
  );
  
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Profile already exists for this user or email'
    );
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'An unexpected error occurred: ' || SQLERRM
    );
END;
$$;


-- 5. CHECK_USER_AUTHORIZED FUNCTION
-- Simple function to check if a user has a profile
CREATE OR REPLACE FUNCTION check_user_authorized(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM profiles WHERE user_id = p_user_id);
END;
$$;


-- 5b. CHECK_EMAIL_INVITED FUNCTION
-- Checks if an email is on the invite list (bypasses RLS)
CREATE OR REPLACE FUNCTION check_email_invited(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM invites 
    WHERE LOWER(email) = LOWER(TRIM(p_email))
  );
END;
$$;

-- Allow anyone to call this function (needed for signup check)
GRANT EXECUTE ON FUNCTION check_email_invited(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION check_email_invited(TEXT) TO authenticated;


-- 6. MIGRATE EXISTING USERS
-- Add existing auth.users to profiles table so they remain authorized
-- This runs once during migration
INSERT INTO profiles (user_id, email, name)
SELECT 
  id AS user_id,
  COALESCE(email, raw_user_meta_data->>'email') AS email,
  COALESCE(
    raw_user_meta_data->>'full_name',
    raw_user_meta_data->>'name',
    split_part(COALESCE(email, raw_user_meta_data->>'email'), '@', 1)
  ) AS name
FROM auth.users
WHERE email IS NOT NULL OR raw_user_meta_data->>'email' IS NOT NULL
ON CONFLICT (email) DO NOTHING;


-- 7. USER_SESSIONS TABLE
-- Logs user activity for analytics
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'login',
    'login_existing',
    'invite_redeemed',
    'signup',
    'logout',
    'app_opened',
    'oauth_google',
    'oauth_github'
  )),
  user_agent TEXT,
  ip_address TEXT,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying user activity
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_timestamp ON user_sessions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_event_type ON user_sessions(event_type);

-- RLS for user_sessions
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can insert their own session logs (drop first to allow re-running)
DROP POLICY IF EXISTS "Users can log their own sessions" ON user_sessions;
CREATE POLICY "Users can log their own sessions"
  ON user_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own sessions (drop first to allow re-running)
DROP POLICY IF EXISTS "Users can read their own sessions" ON user_sessions;
CREATE POLICY "Users can read their own sessions"
  ON user_sessions
  FOR SELECT
  USING (auth.uid() = user_id);


-- 8. LOG_USER_SESSION FUNCTION
-- Helper function to log user sessions with additional metadata
CREATE OR REPLACE FUNCTION log_user_session(
  p_event_type TEXT,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
BEGIN
  INSERT INTO user_sessions (user_id, email, event_type, metadata)
  SELECT 
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    p_event_type,
    p_metadata
  RETURNING id INTO v_session_id;
  
  RETURN v_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION log_user_session(TEXT, JSONB) TO authenticated;


-- 9. GRANT EXECUTE PERMISSIONS
-- Allow authenticated users to call these functions
GRANT EXECUTE ON FUNCTION redeem_invite(TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_authorized(UUID) TO authenticated;


-- ============================================
-- USAGE NOTES:
-- 
-- To create an invite (run in SQL Editor):
--   INSERT INTO invites (email) 
--   VALUES ('user@example.com') 
--   RETURNING token, 'https://abcresearch.vercel.app/invite/redeem?token=' || token AS link;
--
-- To check invite status:
--   SELECT token, email, used_at, expires_at FROM invites;
--
-- To view authorized users:
--   SELECT email, name, created_at FROM profiles;
--
-- To view waitlist:
--   SELECT email, name, linkedin_url, status, created_at FROM invite_requests;
-- ============================================

