-- ============================================
-- ADD PAGE VISIT TRACKING TO USER_SESSIONS
-- ============================================
-- This migration adds page visit event types to the user_sessions table
-- and allows tracking which pages users visit
-- ============================================

-- Drop the existing CHECK constraint to add new event types
ALTER TABLE user_sessions 
DROP CONSTRAINT IF EXISTS user_sessions_event_type_check;

-- Add new CHECK constraint with page visit event types
ALTER TABLE user_sessions
ADD CONSTRAINT user_sessions_event_type_check 
CHECK (event_type IN (
  -- Authentication events
  'login',
  'login_existing',
  'invite_redeemed',
  'signup',
  'logout',
  'app_opened',
  'oauth_google',
  'oauth_github',
  'invite_check_failed',  -- User tried to sign up but email not on invite list
  -- Page visit events
  'page_home',
  'page_research',
  'page_pipeline',
  'page_marketmap',
  'page_extraction',
  'page_feed',
  'page_auth',
  'page_unauthorized',
  'page_visit'  -- Fallback for unknown pages
));

-- Add index for page visit queries
CREATE INDEX IF NOT EXISTS idx_user_sessions_event_type_timestamp 
ON user_sessions(event_type, timestamp DESC);

-- Add index for user activity queries
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id_timestamp 
ON user_sessions(user_id, timestamp DESC);

