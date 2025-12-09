import { Page } from '@playwright/test'

/**
 * Helper function to log in with test credentials
 * Uses environment variables for credentials in CI, falls back to guest mode locally
 */
export async function loginWithTestUser(page: Page): Promise<void> {
  const email = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD

  // Navigate to the app
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  console.log(`Current URL: ${page.url()}`)

  if (email && password) {
    // CI mode: Use test credentials
    console.log('🔑 Using test credentials for authentication')

    // Wait for the auth form to be visible
    const emailInput = page.locator('input#email')
    const isAuthFormVisible = await emailInput.isVisible({ timeout: 10000 }).catch(() => false)

    if (isAuthFormVisible) {
      // Fill in credentials
      await emailInput.fill(email)
      await page.locator('input#password').fill(password)
      console.log('✅ Filled in credentials')

      // Click Sign In button
      await page.getByRole('button', { name: /sign in/i }).click()
      console.log('✅ Clicked Sign In')

      // Wait for redirect to dashboard
      await page.waitForURL(/\/app\/project/, { timeout: 15000 })
      console.log('✅ Successfully logged in and redirected to dashboard')
    } else {
      console.log('⚠️ Auth form not visible, checking if already logged in...')
      // Maybe already on dashboard?
      const isOnDashboard = page.url().includes('/app/project')
      if (isOnDashboard) {
        console.log('✅ Already on dashboard')
      } else {
        throw new Error(`Auth form not visible and not on dashboard. URL: ${page.url()}`)
      }
    }
  } else {
    // Local mode: Use guest mode
    console.log('👤 No test credentials found, using guest mode')

    const guestButton = page.getByRole('button', { name: /continue as guest|guest mode/i })
    const isGuestButtonVisible = await guestButton.isVisible({ timeout: 5000 }).catch(() => false)

    if (isGuestButtonVisible) {
      await guestButton.click()
      console.log('✅ Clicked guest mode button')
      await page.waitForURL(/\/app\/project/, { timeout: 10000 })
      console.log('✅ Successfully entered guest mode')
    } else {
      // Check if already on dashboard
      const isOnDashboard = page.url().includes('/app/project')
      if (isOnDashboard) {
        console.log('✅ Already on dashboard')
      } else {
        throw new Error(`Guest button not visible and not on dashboard. URL: ${page.url()}`)
      }
    }
  }
}
