import { test, expect } from '@playwright/test'

/**
 * Basic E2E Smoke Test
 *
 * Simple test that verifies:
 * 1. App launches
 * 2. Login portal renders
 * 3. Authentication works
 * 4. Dashboard loads after login
 */

test('app launches, login works, and dashboard loads', async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD

  // Skip if no credentials provided
  if (!email || !password) {
    console.log('⚠️  No test credentials found - skipping test')
    test.skip()
    return
  }

  // =========================================
  // STEP 1: Navigate to auth page
  // =========================================
  await page.goto('/auth')
  await page.waitForLoadState('networkidle')

  // =========================================
  // STEP 2: Screenshot the login portal
  // =========================================
  await page.screenshot({
    path: '__tests__/output/screenshots/01-login-portal.png',
    fullPage: true
  })
  console.log('✅ Screenshot: Login portal')

  // =========================================
  // STEP 3: Log in with test credentials
  // =========================================
  await page.locator('input#email').fill(email)
  await page.locator('input#password').fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  console.log('✅ Logged in with test credentials')

  // Wait for redirect to dashboard
  await page.waitForURL(/\/app\//, { timeout: 15000 })

  // =========================================
  // STEP 4: Screenshot the dashboard
  // =========================================
  // Wait a moment for the dashboard to fully render
  await page.waitForTimeout(2000)

  await page.screenshot({
    path: '__tests__/output/screenshots/02-dashboard-after-login.png',
    fullPage: true
  })
  console.log('✅ Screenshot: Dashboard after login')

  // Verify we're actually on the app
  await expect(page).toHaveURL(/\/app\//)
  console.log('🎉 Basic smoke test complete!')
})
