-- ============================================
-- CREATE INVITE FOR SPECIFIC EMAIL
-- ============================================
-- Instructions:
-- 1. Replace 'user@example.com' with the target email
-- 2. Run in Supabase SQL Editor
-- 3. Copy the invite_link from the result
-- 4. Send to the user
-- ============================================

INSERT INTO invites (email)
VALUES ('user@example.com')  -- <-- CHANGE THIS EMAIL
RETURNING 
  token,
  email,
  expires_at,
  'https://abcresearch.vercel.app/invite/redeem?token=' || token AS invite_link;


-- ============================================
-- OTHER USEFUL QUERIES
-- ============================================

-- Create invite without email restriction (anyone can use):
-- INSERT INTO invites DEFAULT VALUES
-- RETURNING token, expires_at, 'https://abcresearch.vercel.app/invite/redeem?token=' || token AS invite_link;

-- Create invite with custom expiry (7 days):
-- INSERT INTO invites (email, expires_at)
-- VALUES ('user@example.com', NOW() + INTERVAL '7 days')
-- RETURNING token, email, expires_at, 'https://abcresearch.vercel.app/invite/redeem?token=' || token AS invite_link;

-- Create invite with admin notes:
-- INSERT INTO invites (email, notes)
-- VALUES ('user@example.com', 'Invited by John for beta testing')
-- RETURNING token, email, expires_at, 'https://abcresearch.vercel.app/invite/redeem?token=' || token AS invite_link;

-- View all invites:
-- SELECT token, email, used_at, expires_at, notes, created_at 
-- FROM invites 
-- ORDER BY created_at DESC;

-- View unused invites:
-- SELECT token, email, expires_at, notes 
-- FROM invites 
-- WHERE used_at IS NULL AND expires_at > NOW()
-- ORDER BY created_at DESC;

-- View authorized users:
-- SELECT p.email, p.name, p.created_at, i.notes as invite_notes
-- FROM profiles p
-- LEFT JOIN invites i ON p.invite_id = i.id
-- ORDER BY p.created_at DESC;

-- View waitlist requests:
-- SELECT email, name, linkedin_url, status, created_at 
-- FROM invite_requests 
-- ORDER BY created_at DESC;

-- Approve waitlist request and create invite:
-- WITH updated AS (
--   UPDATE invite_requests 
--   SET status = 'approved', reviewed_at = NOW()
--   WHERE email = 'user@example.com'
--   RETURNING email
-- )
-- INSERT INTO invites (email)
-- SELECT email FROM updated
-- RETURNING token, email, 'https://abcresearch.vercel.app/invite/redeem?token=' || token AS invite_link;

