-- ============================================
-- CHECK VERIFICATION EMAIL STATUS
-- ============================================
-- Use this to check if verification emails have been sent
-- and whether users have confirmed their emails
-- ============================================

-- 1. Check specific user's email verification status
-- Replace 'hns0410@gmail.com' with the email you want to check
SELECT 
  id AS user_id,
  email,
  email_confirmed_at,
  confirmed_at,
  created_at AS user_created_at,
  last_sign_in_at,
  CASE 
    WHEN email_confirmed_at IS NOT NULL THEN 'Email Confirmed'
    WHEN confirmed_at IS NOT NULL THEN 'Account Confirmed (other method)'
    ELSE 'Email Not Confirmed'
  END AS verification_status,
  -- Time since account creation
  NOW() - created_at AS time_since_signup
FROM auth.users
WHERE email = 'hns0410@gmail.com'
   OR LOWER(email) = LOWER('hns0410@gmail.com');

-- 2. Check all users who signed up but haven't confirmed email
SELECT 
  id AS user_id,
  email,
  email_confirmed_at,
  created_at AS user_created_at,
  NOW() - created_at AS time_since_signup,
  CASE 
    WHEN email_confirmed_at IS NULL THEN 'Pending Verification'
    ELSE 'Verified'
  END AS status
FROM auth.users
WHERE email_confirmed_at IS NULL
  AND created_at > NOW() - INTERVAL '7 days'  -- Last 7 days
ORDER BY created_at DESC;

-- 3. Check users with invites who haven't confirmed email yet
SELECT 
  u.id AS user_id,
  u.email,
  u.email_confirmed_at,
  u.created_at AS user_created_at,
  i.email AS invite_email,
  i.used_at AS invite_used_at,
  i.used_by,
  p.id AS profile_id,
  CASE 
    WHEN u.email_confirmed_at IS NULL AND p.id IS NULL THEN 'Needs Verification + Profile Creation'
    WHEN u.email_confirmed_at IS NULL THEN 'Needs Verification'
    WHEN p.id IS NULL THEN 'Needs Profile Creation'
    ELSE 'Complete'
  END AS status
FROM auth.users u
LEFT JOIN invites i ON LOWER(TRIM(i.email)) = LOWER(TRIM(u.email))
LEFT JOIN profiles p ON p.user_id = u.id
WHERE i.used_by = u.id
  AND u.created_at > NOW() - INTERVAL '7 days'
ORDER BY u.created_at DESC;

-- 4. Check recent signups and their verification status
SELECT 
  u.id AS user_id,
  u.email,
  u.email_confirmed_at,
  u.created_at,
  p.id AS profile_id,
  i.used_at AS invite_used_at,
  CASE 
    WHEN u.email_confirmed_at IS NOT NULL AND p.id IS NOT NULL THEN '✅ Complete'
    WHEN u.email_confirmed_at IS NOT NULL AND p.id IS NULL THEN '⚠️ Verified but no profile'
    WHEN u.email_confirmed_at IS NULL AND p.id IS NOT NULL THEN '⚠️ Profile exists but not verified'
    ELSE '❌ Not verified, no profile'
  END AS status
FROM auth.users u
LEFT JOIN profiles p ON p.user_id = u.id
LEFT JOIN invites i ON i.used_by = u.id
WHERE u.created_at > NOW() - INTERVAL '7 days'
ORDER BY u.created_at DESC
LIMIT 20;

