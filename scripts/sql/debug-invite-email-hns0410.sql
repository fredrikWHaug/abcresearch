-- ============================================
-- DEBUG INVITE FOR hns0410@gmail.com
-- ============================================
-- Use this to check why the invite check is failing
-- ============================================

-- 1. Check if email exists in invites table
SELECT 
  id,
  email,
  LOWER(TRIM(email)) AS normalized_email,
  email != LOWER(TRIM(email)) AS needs_normalization,
  used_at,
  used_by,
  expires_at,
  created_at
FROM invites
WHERE email IS NOT NULL
  AND (
    email = 'hns0410@gmail.com'
    OR LOWER(email) = LOWER('hns0410@gmail.com')
    OR TRIM(email) = TRIM('hns0410@gmail.com')
    OR LOWER(TRIM(email)) = LOWER(TRIM('hns0410@gmail.com'))
  )
ORDER BY created_at DESC;

-- 2. Test the function with different variations
SELECT 
  'hns0410@gmail.com' AS test_email,
  check_email_invited('hns0410@gmail.com') AS is_invited_exact,
  check_email_invited('hns0410@gmail.com ') AS is_invited_with_space,
  check_email_invited('Hns0410@Gmail.Com') AS is_invited_uppercase,
  check_email_invited(LOWER(TRIM('hns0410@gmail.com'))) AS is_invited_normalized;

-- 3. Check if user already has a profile
SELECT 
  id,
  user_id,
  email,
  LOWER(TRIM(email)) AS normalized_email,
  invite_id,
  created_at
FROM profiles
WHERE LOWER(TRIM(email)) = LOWER(TRIM('hns0410@gmail.com'));

-- 4. Check if invite was already used
SELECT 
  i.id,
  i.email,
  i.used_at,
  i.used_by,
  u.email AS used_by_email
FROM invites i
LEFT JOIN auth.users u ON i.used_by = u.id
WHERE LOWER(TRIM(i.email)) = LOWER(TRIM('hns0410@gmail.com'));

-- 5. Check if profile exists for the user who used the invite
SELECT 
  p.id AS profile_id,
  p.user_id,
  p.email AS profile_email,
  p.invite_id,
  p.created_at AS profile_created_at,
  u.email AS auth_user_email,
  u.email_confirmed_at,
  u.created_at AS auth_user_created_at,
  CASE 
    WHEN p.id IS NOT NULL THEN '✅ Profile Exists'
    ELSE '❌ No Profile'
  END AS profile_status
FROM invites i
LEFT JOIN auth.users u ON i.used_by = u.id
LEFT JOIN profiles p ON p.user_id = u.id
WHERE LOWER(TRIM(i.email)) = LOWER(TRIM('hns0410@gmail.com'))
  AND i.used_by IS NOT NULL;

-- 6. Check all profiles for this email (in case user_id doesn't match)
SELECT 
  p.id AS profile_id,
  p.user_id,
  p.email,
  p.invite_id,
  p.created_at AS profile_created_at,
  u.email AS auth_user_email,
  u.email_confirmed_at,
  CASE 
    WHEN p.id IS NOT NULL THEN '✅ Profile Exists'
    ELSE '❌ No Profile'
  END AS profile_status
FROM profiles p
LEFT JOIN auth.users u ON p.user_id = u.id
WHERE LOWER(TRIM(p.email)) = LOWER(TRIM('hns0410@gmail.com'));

-- 7. Complete status check for this user
SELECT 
  u.id AS user_id,
  u.email,
  u.email_confirmed_at,
  u.created_at AS user_created_at,
  i.used_at AS invite_used_at,
  i.id AS invite_id,
  p.id AS profile_id,
  p.created_at AS profile_created_at,
  CASE 
    WHEN u.email_confirmed_at IS NOT NULL AND p.id IS NOT NULL THEN '✅ Complete - Ready to use'
    WHEN u.email_confirmed_at IS NOT NULL AND p.id IS NULL THEN '⚠️ Email confirmed but NO PROFILE'
    WHEN u.email_confirmed_at IS NULL AND p.id IS NOT NULL THEN '⚠️ Profile exists but email NOT confirmed'
    ELSE '❌ Incomplete'
  END AS overall_status
FROM auth.users u
LEFT JOIN invites i ON i.used_by = u.id
LEFT JOIN profiles p ON p.user_id = u.id
WHERE LOWER(u.email) = LOWER('hns0410@gmail.com');

