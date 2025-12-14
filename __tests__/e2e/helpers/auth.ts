import type { Page } from '@playwright/test'

/**
 * Helper function to log in with test credentials
 * Uses environment variables for credentials in CI, falls back to guest mode locally
 */
export async function loginWithTestUser(page: Page): Promise<void> {
  const email = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD

  // Navigate to auth page
  await page.goto('/auth')
  await page.waitForLoadState('networkidle')

  console.log(`Current URL: ${page.url()}`)

  if (email && password) {
    console.log('🔑 Using test credentials for authentication')

    // Wait for the auth form
    const emailInput = page.locator('input#email')
    await emailInput.waitFor({ state: 'visible', timeout: 10000 })

    // Fill in credentials and submit
    await emailInput.fill(email)
    await page.locator('input#password').fill(password)
    console.log('✅ Filled in credentials')

    await page.getByRole('button', { name: /sign in/i }).click()
    console.log('✅ Clicked Sign In')

    // Wait for redirect to dashboard
    await page.waitForURL(/\/app\/(home|project)/, { timeout: 15000 })
    console.log(`URL after login attempt: ${page.url()}`)
    console.log('✅ Successfully logged in and redirected to dashboard')
  } else {
    console.log('👤 No test credentials found, using guest mode')

    const guestButton = page.getByRole('button', { name: /continue as guest|guest mode/i })
    await guestButton.waitFor({ state: 'visible', timeout: 5000 })
    await guestButton.click()
    console.log('✅ Clicked guest mode button')

    await page.waitForURL(/\/app\/project/, { timeout: 10000 })
    console.log('✅ Successfully entered guest mode')
  }
}
