-- ============================================
-- ADD EMAIL TO INVITE LIST
-- ============================================
-- Instructions:
-- 1. Replace 'user@example.com' with the email you want to invite
-- 2. Run in Supabase SQL Editor
-- 3. The user can now sign up with that email
-- ============================================

INSERT INTO invites (email)
VALUES ('user@example.com')  -- <-- CHANGE THIS EMAIL
RETURNING id, email, created_at;


-- ============================================
-- ADD MULTIPLE EMAILS AT ONCE
-- ============================================
-- INSERT INTO invites (email)
-- VALUES 
--   ('user1@example.com'),
--   ('user2@example.com'),
--   ('user3@example.com')
-- RETURNING id, email, created_at;


-- ============================================
-- VIEW ALL INVITED EMAILS
-- ============================================
-- SELECT email, created_at 
-- FROM invites 
-- ORDER BY created_at DESC;


-- ============================================
-- VIEW AUTHORIZED USERS (signed up successfully)
-- ============================================
-- SELECT email, created_at 
-- FROM profiles 
-- ORDER BY created_at DESC;


-- ============================================
-- CHECK IF EMAIL IS INVITED
-- ============================================
-- SELECT EXISTS(
--   SELECT 1 FROM invites WHERE LOWER(email) = LOWER('user@example.com')
-- ) AS is_invited;


-- ============================================
-- REMOVE EMAIL FROM INVITE LIST
-- ============================================
-- DELETE FROM invites WHERE LOWER(email) = LOWER('user@example.com');
